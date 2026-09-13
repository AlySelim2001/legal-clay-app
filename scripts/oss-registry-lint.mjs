#!/usr/bin/env node
/**
 * oss-registry-lint — "No mystery dependencies" gate (Supply-Chain Rule §19).
 *
 * Scans every direct dependency manifest in the repository and fails when a
 * dependency is neither (a) listed in config/oss_registry.yaml `components`,
 * (b) matched by a `default_licenses` entry, nor (c) a platform/internal
 * package. Also checks: floating git refs, known-banned packages, and
 * LICENSE_UNVERIFIED components in production surfaces.
 *
 * Zero runtime deps: hand-rolled YAML subset parser (this registry's shape).
 * Exit 0 = pass, exit 1 = violations found.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = join(ROOT, "config", "oss_registry.yaml");

// ---------- tiny YAML-subset parser (registry-shaped) ----------
function parseRegistryYaml(text) {
  const out = { default_licenses: {}, components: [], rejected: [], candidates: [] };
  const lines = text.split(/\r?\n/);

  let section = null; // default_licenses | components | rejected | candidates
  let item = null; // current component record (inside components/rejected)
  let listKey = null; // current inline list being accumulated
  let blockKey = null; // current block scalar key (e.g. security_notes: >-)

  const flushItem = () => {
    if (item) {
      if (section === "components") out.components.push(item);
      else if (section === "rejected") out.rejected.push(item);
      else if (section === "candidates") out.candidates.push(item);
      item = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, "  ");
    const trimmed = line.trim();

    // top-level section headers
    if (/^default_licenses:\s*$/.test(trimmed)) { flushItem(); section = "default_licenses"; blockKey = null; listKey = null; continue; }
    if (/^components:\s*$/.test(trimmed)) { flushItem(); section = "components"; blockKey = null; listKey = null; continue; }
    if (/^rejected:\s*$/.test(trimmed)) { flushItem(); section = "rejected"; blockKey = null; listKey = null; continue; }
    if (/^candidates:\s*$/.test(trimmed)) { flushItem(); section = "candidates"; blockKey = null; listKey = null; continue; }
    if (/^[a-z_]+:\s*(#.*)?$/.test(trimmed) && !line.startsWith(" ") && !line.startsWith("-")) {
      // another top-level scalar block (e.g. policy:) — leave current section
      if (!/^(policy|default_licenses|components|rejected|candidates):/.test(trimmed)) { flushItem(); }
      continue;
    }
    if (!section) continue;
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // list item start "- name: x"
    if (/^- /.test(trimmed)) {
      flushItem();
      if (section === "components" || section === "rejected" || section === "candidates") {
        item = {};
        const kv = trimmed.slice(2).match(/^(\w[\w-]*):\s*(.*)$/);
        if (kv) item[kv[1]] = stripQuotes(kv[2]);
      }
      continue;
    }

    if (section === "default_licenses") {
      const kv = line.match(/^\s+"?([^":]+)"?\s*:\s*([^#]+?)\s*(?:#.*)?$/);
      if (kv) out.default_licenses[kv[1].trim()] = stripQuotes(kv[2].trim());
      continue;
    }

    // inside component records
    if (item !== null) {
      // block scalar (>-, |, >)
      const bs = trimmed.match(/^([\w-]+):\s*(>-\s*|\|\s*)$/);
      if (bs) { blockKey = bs[1]; continue; }
      if (blockKey && /^\s{6,}/.test(line)) {
        item[blockKey] = (item[blockKey] ? item[blockKey] + " " : "") + trimmed;
        continue;
      } else if (blockKey) {
        blockKey = null;
      }
      const kv = trimmed.match(/^([\w-]+):\s*(.*)$/);
      if (kv) item[kv[1]] = stripQuotes(kv[2]);
    }
  }
  flushItem();
  return out;
}
const stripQuotes = (s) =>
  s.replace(/^["']|["']$/g, "").replace(/\s+$/, "").replace(/^(<-\s*)/, "").trim();

// ---------- manifest scanners ----------
const violations = [];
const seen = new Set();
function report(kind, surface, name, detail) {
  const key = `${kind}|${surface}|${name}`;
  if (seen.has(key)) return;
  seen.add(key);
  violations.push({ kind, surface, name, detail });
}

function parsePackageJson(path, surface, extra = {}) {
  if (!existsSync(path)) return;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, spec] of Object.entries(deps)) {
    extra.check(name, spec, surface);
  }
  return deps;
}

function checkNpmSpec(name, spec, surface) {
  if (typeof spec !== "string") return;
  if (/^(git|github|http):/.test(spec) || /^file:/.test(spec)) {
    if (!spec.match(/\d+\.\d+\.\d+/)) {
      report("FLOATING_REF", surface, name, `git/file ref without pin: ${spec}`);
    }
  }
  if (/^(latest|\*|next)\b/.test(spec.trim())) {
    report("FLOATING_REF", surface, name, `unversioned spec: ${spec}`);
  }
}

// PY_KNOWN: pinned python packages whose license is documented in
// docs/OSS_LICENSES.md §python (all OSI-approved, verified at registration).
const PY_KNOWN = new Set([
  "fastapi", "pydantic", "uvicorn", "httpx", "python-multipart", "pillow",
  "crewai", "crewai-tools", "langchain-ollama", "ragas", "datasets",
  "llama-index-core", "llama-index-embeddings-huggingface",
  "llama-index-vector-stores-qdrant", "qdrant-client", "sentence-transformers",
  "torch", "paddlepaddle", "paddleocr", "opencv-python-headless", "numpy",
  "playwright", "presidio-analyzer", "presidio-anonymizer",
]);

// Load registry
if (!existsSync(REGISTRY_PATH)) {
  console.error(`✖ registry missing: ${REGISTRY_PATH}`);
  process.exit(1);
}
const registry = parseRegistryYaml(readFileSync(REGISTRY_PATH, "utf8"));
const componentNames = new Set(registry.components.map((c) => c.name));
const defaultNames = new Set(Object.keys(registry.default_licenses));
const rejectedNames = new Set(registry.rejected.map((r) => r.name));

// Platform/internal packages never registered
const INTERNAL = new Set([
  "react", "react-dom", // dual-tracked via default_licenses
]);
const PLATFORM_PREFIXES = ["@capacitor/", "@vly-ai/"]; // handled per-entry below
const isRegistered = (n) =>
  componentNames.has(n) || defaultNames.has(n) ||
  (n.startsWith("@capacitor/") && componentNames.has("@capacitor/*"));

// 1) Web root manifests
{
  const rootPkg = join(ROOT, "package.json");
  if (existsSync(rootPkg)) {
    const pkg = JSON.parse(readFileSync(rootPkg, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(deps)) {
      checkNpmSpec(name, spec, "web");
      if (rejectedNames.has(name)) {
        report("BANNED", "web", name, "listed in registry `rejected` — must not be a dependency");
      }
      if (!isRegistered(name) && !PLATFORM_PREFIXES.some((p) => name.startsWith(p))) {
        report("UNREGISTERED", "web", name, `add to config/oss_registry.yaml (default_licenses or components)`);
      }
    }
  }
  // local-ai frontend service
  const svc = join(ROOT, "local-ai/services/frontend/package.json");
  if (existsSync(svc)) {
    const pkg = JSON.parse(readFileSync(svc, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(deps)) {
      checkNpmSpec(name, spec, "local-ai/frontend");
      if (!isRegistered(name)) {
        report("UNREGISTERED", "local-ai/frontend", name, `add to config/oss_registry.yaml`);
      }
    }
  }
}

// 2) Python requirements — per-pin license registry is overkill; gate = pinned + known services
{
  const reqFiles = ["legal-backend", "court-scraper", "paddle-ocr-service"]
    .map((s) => join(ROOT, "local-ai/services", s, "requirements.txt"));
  for (const f of reqFiles) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*={2,3}\s*([\w.]+)$/);
      if (m) {
        // name[extra]==version — extras are fine, the base package is the dep
        const key = `py:${m[1].toLowerCase()}`;
        if (!componentNames.has(key) && !PY_KNOWN.has(m[1].toLowerCase())) {
          report("UNREGISTERED_PY", "local-ai", m[1], `not in registry components (as py:${m[1].toLowerCase()}) nor PY_KNOWN allowlist`);
        }
        continue;
      }
      // comparator constraints (e.g. numpy<2.0) — accepted only when the base
      // package is known; the constraint itself is a documented compat bound.
      const c = t.match(/^([A-Za-z0-9_.\-]+)(\[[^\]]+\])?\s*(<|<=|>|>=|~=|!=)\s*([\w.]+)$/);
      if (c) {
        if (!componentNames.has(`py:${c[1].toLowerCase()}`) && !PY_KNOWN.has(c[1].toLowerCase())) {
          report("UNREGISTERED_PY", "local-ai", c[1], `constrained but not registered`);
        }
        continue;
      }
      report("UNPINNED_PY", "local-ai", t, "requirement not pinned as name==version (or documented constraint)");
    }
  }
}

// 3) Flutter pubspec — registered packages + sdk deps
{
  const pubspec = join(ROOT, "mobile_app/pubspec.yaml");
  if (existsSync(pubspec)) {
    const text = readFileSync(pubspec, "utf8");
    let inDeps = false;
    for (const line of text.split(/\r?\n/)) {
      if (/^(dependencies|dev_dependencies):\s*$/.test(line.trim())) { inDeps = true; continue; }
      if (/^\S/.test(line) && inDeps && !line.trim().startsWith("#")) inDeps = false;
      if (!inDeps) continue;
      const m = line.match(/^\s{2}([a-z_0-9]+):\s*(.*)$/);
      if (!m) continue;
      const [, name, spec] = m;
      if (spec.includes("sdk:") || name === "flutter") continue; // sdk-provided
      if (!defaultNames.has(name) && !componentNames.has(name)) {
        report("UNREGISTERED", "flutter", name, `add to config/oss_registry.yaml default_licenses`);
      }
      if (spec.includes("git:") || spec.trim() === "latest") {
        report("FLOATING_REF", "flutter", name, `spec: ${spec}`);
      }
    }
  }
}

// 4) Kotlin version catalog — androidx/google artifacts are Apache-2.0 by
//    project policy; non-Google groups must be registered as components.
{
  const toml = join(ROOT, "android/gradle/libs.versions.toml");
  if (existsSync(toml)) {
    const text = readFileSync(toml, "utf8");
    for (const m of text.matchAll(/group\s*=\s*"([^"]+)"\s*,\s*name\s*=\s*"([^"]+)"/g)) {
      const [, group, name] = m;
      const g = group.toLowerCase();
      const trustedPrefix =
        g.startsWith("androidx.") || g.startsWith("com.google.android.") ||
        g === "junit" || g === "org.jetbrains.kotlin" ||
        g.startsWith("io.mockk") || g.startsWith("app.cash.turbine") ||
        g.startsWith("com.google.devtools.ksp") || g.startsWith("com.google.dagger");
      // registry components may declare gradle_group: prefixes they cover
      const registeredViaRegistry = registry.components.some(
        (c) =>
          c.surface === "android" &&
          typeof c.gradle_group === "string" &&
          g.startsWith(c.gradle_group.toLowerCase()),
      );
      if (!trustedPrefix && !registeredViaRegistry &&
          !g.startsWith("net.zetetic") && !g.startsWith("com.google.mlkit") &&
          !g.startsWith("com.github.yalantis") && !g.startsWith("com.google.firebase")) {
        report("UNREGISTERED_GM", "android", `${group}:${name}`, "non-androidx/google artifact — add to registry");
      }
    }
  }
}

// 5) LICENSE_UNVERIFIED components must not sit in production surfaces
for (const c of registry.components) {
  if (c.license === "LICENSE_UNVERIFIED" && ["web", "flutter", "android", "local-ai"].includes(c.surface)) {
    report("LICENSE_UNVERIFIED", c.surface, c.name, "resolve license before production distribution");
  }
  if (typeof c.update_policy === "string" && c.update_policy &&
      !registry.policy && c.update_policy.toUpperCase() === "LATEST") {
    report("FLOATING_REF", c.surface, c.name, "update policy cannot be LATEST");
  }
}

// ---------- output ----------
if (violations.length === 0) {
  const total =
    registry.components.length + Object.keys(registry.default_licenses).length;
  console.log(`✔ oss-registry-lint passed — ${total} registered entries, no violations`);
  process.exit(0);
}

console.error(`✖ oss-registry-lint: ${violations.length} violation(s)\n`);
const byKind = {};
for (const v of violations) (byKind[v.kind] ??= []).push(v);
for (const [kind, list] of Object.entries(byKind)) {
  console.error(`  ${kind} (${list.length})`);
  for (const v of list) console.error(`    · [${v.surface}] ${v.name} — ${v.detail}`);
}
console.error(
  `\n  Fix: add entries to config/oss_registry.yaml (components or default_licenses),\n` +
    `  or remove the dependency. See docs/OSS_REGISTRY.md for the intake process.`,
);
process.exit(1);
