# Skill: document-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Documents flowing through upload → OCR → analysis → comparison preserve full
provenance (§32) and remain DATA — never instructions, never legal findings.

## Inputs

- Diffs to Documents/Dossier upload, `tesseract.js`/OCR paths, SHA-256
  hashing, analysis prompts, document comparison.

## Process

1. **Provenance preserved** — SHA-256 hash, MIME/size validation, upload
   timestamp, owner, and page/section locators where extractable.
2. **Extracted ≠ authoritative** — OCR text stored as extracted-with-locator;
   it never merges into the authoritative legal knowledge layer.
3. **Analysis is advisory** — model outputs labeled استرشادي; the model never
   authors legal conclusions or citations.
4. **Injection defense** — screening runs *before* any model sees content;
   content is quoted as data inside prompts (TEST-006 discipline).
5. **Local-first storage** — size/type limits enforced server-side; no
   third-party file clouds (§53).

## Validation

- [ ] Hash + provenance on every stored document.
- [ ] Screening tests pass; advisory labels present in UI.
- [ ] Extraction provenance survives the OCR path.

## Failure conditions

- Document text entering the knowledge layer as authority; model output
  presented as a legal finding; provenance dropped anywhere in the pipeline.

## Output

- Reviewed diff + test evidence, or rejection naming the broken rule.
