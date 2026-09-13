# OSS Licenses — CRIM-SYS 2026

Companion to [`OSS_REGISTRY.md`](OSS_REGISTRY.md) and
[`config/oss_registry.yaml`](../config/oss_registry.yaml) (machine-readable).
Verification method: package LICENSE / package.json SPDX declaration at
registration time; re-verified on version bumps that change major/minor.

Last verification: **2026-09-13**

## Distribution model (drives compatibility)

1. **Web app** — served as a public web application (Vite SPA). No code
   distribution as an installable SDK ⇒ strong copyleft is *not* triggered by
   serving (SSPL/AGPL §13 "network use" would apply only if we distributed a
   modified version of an AGPL *server* — we do not).
2. **Local services** — self-hosted by operators from this repository.
   Distributing this repo = distributing its code ⇒ copyleft obligations
   attach for any GPL/AGPL code **in the repo itself** (currently none).
3. **Mobile clients** — APKs are distributed binaries ⇒ LGPL requires
   dynamic-linking discipline; GPL would force licensing changes. Avoid.

## Verdicts

| License class | Verdict |
|---|---|
| MIT, BSD-2/3, ISC, Apache-2.0, CC0 | ✅ preferred — no action beyond attribution file retention |
| MPL-2.0 | ✅ file-level copyleft, compatible — allowed |
| LGPL-3.0 | ⚠️ allowed for dynamically linked components only; document each use |
| GPL-3.0 | ⚠️ evaluate per-case — would apply to combined work if code (not services) is included |
| AGPL-3.0 | ⚠️ allowed as **unmodified Docker services**; never embed AGPL code in repo/web app |
| Sustainable Use License (n8n) | 🔶 **restricted** — fair-code, not OSI. Allowed strictly as self-hosted internal service; never redistribute, never offer to third parties as a service. Flagged in registry + decisions doc |
| Google ML Kit terms | 🔶 on-device artifact under Google terms (free, no egress). Accepted as TYPE I with tracking; replaceable behind `OCRProvider` |
| UNKNOWN / LICENSE_UNVERIFIED | ❌ reject for production surfaces (lint-enforced) |

## npm — full license table (web surface, direct deps)

Grouped by license; every entry verified against the package's LICENSE/SPDX
declaration. Full names+pins: `package.json`; machine view: registry
`default_licenses`.

**MIT** — react, react-dom, react-router, react-hook-form, @hookform/resolvers,
zustand, sonner, vaul, embla-carousel-react, cmdk, input-otp, next-themes,
react-day-picker, react-intersection-observer, react-resizable-panels, zod,
hono, axios, recharts, framer-motion, clsx, tailwind-merge, tailwindcss,
@tailwindcss/vite, tw-animate-css, prettier, eslint, @eslint/js,
typescript-eslint, eslint-config-prettier, eslint-plugin-react-hooks,
eslint-plugin-react-refresh, @types/node, @types/react, @types/react-dom,
@vitejs/plugin-react, vite, all @radix-ui/react-*, jspdf, pdf-lib, pdfmake,
@zumer/snapdom, vosk-browser, @capacitor/*, @vly-ai/integrations (SPDX only —
evidence note in registry)

**Apache-2.0** — typescript, class-variance-authority, globals,
@tanstack/react-query, @tanstack/query-sync-storage-persister,
@tanstack/react-query-persist-client, tesseract.js, xlsx, @playwright/test

**ISC** — lucide-react, idb

## PyPI — license table (local-ai)

| Package | License |
|---|---|
| fastapi, pydantic, crewai, crewai-tools, langchain-ollama, llama-index-core, llama-index-embeddings-huggingface, llama-index-vector-stores-qdrant, qdrant-client, sentence-transformers | MIT |
| uvicorn, numpy, torch (BSD-3) | BSD-3-Clause |
| ragas, datasets, paddlepaddle, paddleocr, opencv-python-headless | Apache-2.0 |
| httpx | BSD-3-Clause |
| python-multipart | Apache-2.0 |
| Pillow | MIT-CMU (HPND-class, OSI-approved) |
| playwright | Apache-2.0 |

> `torch` ships BSD-3; model *weights* carry their own licenses — none are
> vendored into this repo.

## Gradle / Maven (android)

androidx.*, com.google.*, org.jetbrains.kotlin* ⇒ Apache-2.0.
sqlcipher-android (net.zetetic) ⇒ BSD-3-Clause.
io.mockk ⇒ Apache-2.0 · app.cash.turbine ⇒ Apache-2.0.
ML Kit ⇒ Google terms (tracked, TYPE I).

## pub (flutter)

flutter, flutter_localizations, flutter_test ⇒ BSD-3-Clause ·
crypto, flutter_secure_storage, intl, path, path_provider, speech_to_text,
flutter_lints ⇒ BSD-3-Clause · camera, flutter_tts, cupertino_icons ⇒ Apache-2.0 ·
dio, provider, equatable ⇒ MIT · sqflite ⇒ BSD-3-Clause ·
**sqflite_sqlcipher ⇒ BSD-2-Clause**.

## Attribution & NOTICE practices

- Preserve LICENSE/copyright of vendored artifacts (none vendored today).
- Docker images retain their upstream labels (not stripped in Dockerfiles).
- This repository's own docs carry project copyright; third-party attribution
  is aggregated here and in `config/oss_registry.yaml` (fields
  `license`, `origin`, `license_evidence`).

## License-change watch

On any dependency bump: `node scripts/oss-registry-lint.mjs` (structure) +
diff the dependency's LICENSE between old/new versions when the upstream
renames or relicenses (npm `prepublishOnly` renames are a known hazard —
e.g. any future `xlsx`/SheetJS relicensing would surface here first).
