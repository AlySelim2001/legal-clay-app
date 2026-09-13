#!/usr/bin/env node
/**
 * generate-sbom — CycloneDX 1.5 JSON SBOM (zero-dependency).
 *
 * Inventories every direct dependency across all five surfaces:
 *   web (package.json) · local-ai/frontend (package.json)
 *   local-ai services (requirements.txt) · flutter (pubspec.yaml)
 *   android (gradle/libs.versions.toml)
 * Enriches licenses from config/oss_registry.yaml when available.
 *
 * Output: sbom/cyclonedx.json  (spec: https://cyclonedx.org)
 * Exit 0 always (generation tool); run oss-registry-lint.mjs for gating.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const components = [];
const seen = new Set();

function addComponent({ type = "library", name, version, surface, license, purl }) {
  const key = `${type}|${name}|${version}|${surface}`;
  if (seen.has(key) || !name) return;
  seen.add(key);
  const bom = {
    type,
    "bom-ref": `pkg:${surface}/${name}@${version || "unknown"}`,
    name,
    version: version || "unknown",
    group: name.startsWith("@") ? name.split("/")[0] : undefined,
    properties: [{ name: "crimsys:surface", value: surface }],
  };
  if (license && license !== "LICENSE_UNVERIFIED") {
    bom.licenses = [{ license: { id: license } }];
  } else if (license === "LICENSE_UNVERIFIED") {
    bom.licenses = [{ license: { name: "UNVERIFIED" } }];
  }
  if (purl) bom.purl = purl;
  components.push(bom);
}

const npmPurl = (n, v) =>
  `pkg:npm/${n.startsWith("@") ? n.replace("@", "%40").replace("/", "%2F") : n}@${v}`;

// ---------- 1) npm manifests ----------
function scanNpm(pkgPath, surface) {
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const [scope, ctype] of [
    ["dependencies", "library"],
    ["devDependencies", "framework"],
  ]) {
    for (const [name, spec] of Object.entries(pkg[scope] ?? {})) {
      const v = String(spec).replace(/[^0-9.]/g, "") || "unknown";
      addComponent({
        type: ctype,
        name,
        version: v,
        surface,
        license: null, // enriched below
        purl: npmPurl(name, v),
      });
    }
  }
}
scanNpm(join(ROOT, "package.json"), "web");
scanNpm(join(ROOT, "local-ai/services/frontend/package.json"), "local-ai/frontend");

// ---------- 2) Python requirements ----------
for (const svc of ["legal-backend", "court-scraper", "paddle-ocr-service", "presidio-scrubber"]) {
  const req = join(ROOT, "local-ai/services", svc, "requirements.txt");
  if (!existsSync(req)) continue;
  for (const line of readFileSync(req, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z0-9_.\-]+)(\[[^\]]*\])?\s*(={2,3}|<|<=|>|>=|~=)\s*([\w.]+)?/);
    if (!m) continue;
    addComponent({
      type: "library",
      name: m[1],
      version: m[4] ?? "unpinned-constraint",
      surface: `local-ai/${svc}`,
      license: null,
      purl: `pkg:pypi/${m[1].toLowerCase()}@${m[4] ?? ""}`,
    });
  }
}

// ---------- 3) Flutter pubspec ----------
{
  const pubspec = join(ROOT, "mobile_app/pubspec.yaml");
  if (existsSync(pubspec)) {
    let inDeps = false;
    for (const line of readFileSync(pubspec, "utf8").split(/\r?\n/)) {
      if (/^(dependencies|dev_dependencies):\s*$/.test(line.trim())) { inDeps = true; continue; }
      if (/^\S/.test(line) && inDeps) inDeps = false;
      if (!inDeps) continue;
      const m = line.match(/^\s{2}([a-z_0-9]+):\s*(.*)$/);
      if (!m) continue;
      const [, name, spec] = m;
      if (spec.includes("sdk:")) {
        addComponent({ name, version: "sdk", surface: "flutter", license: null });
      } else {
        const v = (spec.match(/[\d.]+/) ?? ["unknown"])[0];
        addComponent({ name, version: v, surface: "flutter", license: null, purl: `pkg:pub/${name}@${v}` });
      }
    }
  }
}

// ---------- 4) Gradle version catalog ----------
{
  const toml = join(ROOT, "android/gradle/libs.versions.toml");
  if (existsSync(toml)) {
    const text = readFileSync(toml, "utf8");
    for (const m of text.matchAll(/group\s*=\s*"([^"]+)"\s*,\s*name\s*=\s*"([^"]+)"\s*,\s*version(?:\.ref)?\s*=\s*"?([\w.\-]+)"?/g)) {
      const [, group, name, ver] = m;
      addComponent({
        name: `${group}:${name}`,
        version: ver,
        surface: "android",
        license: null,
        purl: `pkg:maven/${group}/${name}@${ver}`,
      });
    }
    // docker-style pins from compose
    const compose = join(ROOT, "local-ai/docker-compose.yml");
    if (existsSync(compose)) {
      for (const m of readFileSync(compose, "utf8").matchAll(/image:\s*([^\s:]+):([\w.\-]+)/g)) {
        addComponent({ type: "container", name: m[1], version: m[2], surface: "local-ai/docker", license: null });
      }
    }
  }
}

// ---------- 5) license enrichment from registry ----------
let registered = 0;
try {
  const reg = readFileSync(join(ROOT, "config/oss_registry.yaml"), "utf8");
  const licByName = new Map();
  // Linear line-by-line scan: track the current component record and capture
  // its `license:` / `name:` fields (avoids lazy-quantifier backtracking).
  let curName = null;
  let inComponents = false;
  for (const line of reg.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "" || t.startsWith("#")) continue;
    if (/^components:\s*$/.test(t)) { inComponents = true; curName = null; continue; }
    if (/^(default_licenses|rejected|candidates|policy):\s*$/.test(t)) { inComponents = false; continue; }
    if (!inComponents) continue;
    if (/^- /.test(t)) {
      // new record begins — start a fresh name
      const kv = t.slice(2).match(/^name:\s*"?([^"\n]+)"?/);
      curName = kv ? kv[1].trim() : null;
      continue;
    }
    const nm = t.match(/^name:\s*"?([^"\n]+)"?\s*$/);
    if (nm) { curName = nm[1].trim(); continue; }
    const lic = t.match(/^license:\s*([^\n]+)/);
    if (lic && curName && !licByName.has(curName)) {
      licByName.set(curName, lic[1].trim());
    }
  }
  // default_licenses block — simple `name: LICENSE` pairs. Section-exit is
  // detected on the RAW line (entries are indented; top-level keys are not).
  let inDL = false;
  for (const line of reg.split(/\r?\n/)) {
    const t = line.trim();
    if (/^default_licenses:\s*$/.test(t)) { inDL = true; continue; }
    if (/^\S/.test(line) && inDL && !line.startsWith(" ")) inDL = false;
    if (!inDL || t === "" || t.startsWith("#")) continue;
    const m = t.match(/^"?([^":\s]+)"?\s*:\s*(MIT|Apache-2\.0|BSD-[23]-Clause|ISC|CC0-1\.0)\s*$/);
    if (m && !licByName.has(m[1])) licByName.set(m[1], m[2]);
  }
  // Same-project artifact-name aliases (registry key ≠ maven artifact name).
  // Only alias artifacts within the same upstream project/license. Seeded
  // with hard facts, extended from registry `artifact_alias:` declarations.
  const ARTIFACT_ALIAS = new Map([
    ["hilt-android", "hilt"],
    ["hilt-compiler", "hilt"],
  ]);
  // license_group_policy — group-prefix license facts for maven artifacts,
  // parsed linearly from the registry `policy.license_group_policy` list.
  const groupPolicy = [];
  let gpPrefix = null;
  let inGP = false;
  for (const line of reg.split(/\r?\n/)) {
    const t = line.trim();
    if (/^license_group_policy:\s*$/.test(t)) { inGP = true; gpPrefix = null; continue; }
    if (/^\S/.test(line) && inGP && !line.startsWith(" ")) inGP = false;
    if (!inGP || t === "" || t.startsWith("#")) continue;
    const g = t.match(/^(-\s*)?group_prefix:\s*"?([^"\n]+?)"?\s*$/);
    if (g) { gpPrefix = g[2].trim(); continue; }
    const l = t.match(/^license:\s*([^#\n]+?)\s*$/);
    if (l && gpPrefix) { groupPolicy.push({ prefix: gpPrefix, license: l[1].trim() }); gpPrefix = null; }
  }
  // license_pypi — `name: LICENSE` pairs, namespaced as py:<name> so the
  // pypi lookup below finds them without colliding with npm names.
  let inPY = false;
  for (const line of reg.split(/\r?\n/)) {
    const t = line.trim();
    if (/^license_pypi:\s*$/.test(t)) { inPY = true; continue; }
    if (/^\S/.test(line) && inPY && !line.startsWith(" ")) inPY = false;
    if (!inPY || t === "" || t.startsWith("#")) continue;
    const m = t.match(/^"?([^":\s]+)"?\s*:\s*([^#\n]+?)\s*$/);
    if (m && !licByName.has(`py:${m[1].toLowerCase()}`)) {
      licByName.set(`py:${m[1].toLowerCase()}`, m[2].trim());
    }
  }
  // artifact_alias declared on component records (alias → registry name).
  let aliasName = null;
  let inComps = false;
  for (const line of reg.split(/\r?\n/)) {
    const t = line.trim();
    if (/^components:\s*$/.test(t)) { inComps = true; aliasName = null; continue; }
    if (/^\S/.test(line) && inComps && !line.startsWith(" ")) inComps = false;
    if (!inComps || t === "" || t.startsWith("#")) continue;
    if (/^- /.test(t)) { aliasName = (t.slice(2).match(/^name:\s*"?([^"\n]+?)"?\s*$/) ?? [])[1] ?? null; continue; }
    const n = t.match(/^name:\s*"?([^"\n]+?)"?\s*$/);
    if (n) { aliasName = n[1].trim(); continue; }
    const a = t.match(/^artifact_alias:\s*"?([^"\n]+?)"?\s*$/);
    if (a && aliasName) ARTIFACT_ALIAS.set(a[1].trim(), aliasName);
  }
  for (const c of components) {
    const short = c.name.split("/").pop().replace(/^py:/, "");
    const mavenArtifact = c.name.includes(":") ? c.name.split(":").pop() : undefined;
    const mavenGroup = c.name.includes(":") ? c.name.split(":")[0] : undefined;
    // Scoped packages may be registered as a wildcard family ("@capacitor/*").
    const scopedWildcard = c.name.startsWith("@") && c.name.includes("/")
      ? `${c.name.split("/")[0]}/*` : undefined;
    const pypi = typeof c.purl === "string" && c.purl.startsWith("pkg:pypi/");
    const lic =
      licByName.get(c.name) ??
      (scopedWildcard ? licByName.get(scopedWildcard) : undefined) ??
      licByName.get(short) ??
      (pypi ? licByName.get(`py:${c.name.toLowerCase()}`) : undefined) ??
      (mavenArtifact
        ? licByName.get(mavenArtifact) ??
          licByName.get(ARTIFACT_ALIAS.get(mavenArtifact) ?? "")
        : undefined) ??
      (mavenGroup
        ? groupPolicy.find((p) => mavenGroup.startsWith(p.prefix))?.license
        : undefined);
    if (lic) {
      if (lic !== "LICENSE_UNVERIFIED") {
        // SPDX-looking ids go in `id`; anything else (e.g. "Google ML Kit
        // Terms (on-device, free)", "Sustainable Use License") is a named,
        // non-SPDX license and goes in `name`.
        const isSpdx = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(lic);
        c.licenses = [{ license: isSpdx ? { id: lic } : { name: lic } }];
      } else {
        c.licenses = [{ license: { name: "UNVERIFIED" } }];
      }
      registered++;
    }
  }
} catch {
  // registry optional for SBOM generation
}

// ---------- assemble + write ----------
const doc = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${createHash("sha256")
    .update(components.map((c) => c["bom-ref"]).sort().join("|"))
    .digest("hex")
    .slice(0, 32)
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: "CRIM-SYS", name: "generate-sbom.mjs", version: "1.0.0" }],
    properties: [
      { name: "crimsys:project", value: "CRIM-SYS 2026 (legal-clay-app)" },
      { name: "crimsys:registry", value: "config/oss_registry.yaml" },
      { name: "crimsys:license_enriched", value: `${registered}/${components.length}` },
    ],
  },
  components: components.sort((a, b) => a["bom-ref"].localeCompare(b["bom-ref"])),
};

mkdirSync(join(ROOT, "sbom"), { recursive: true });
const outPath = join(ROOT, "sbom/cyclonedx.json");
writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
console.log(
  `✔ SBOM written: ${outPath} — ${components.length} components (${registered} license-enriched from registry)`,
);
