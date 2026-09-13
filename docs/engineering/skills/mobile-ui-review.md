# Skill: mobile-ui-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Every UI change — web or external component (§33–35) — stays one product:
Claymorphism tokens, Arabic-first RTL, accessible on Android-sized screens and
slow devices.

## Inputs

- Diffs to `src/pages/**`, `src/components/**`, `src/index.css`, Capacitor
  shell, or any proposed external UI component.

## Process

1. **Design-system inheritance** — colors/typography/spacing/radius from the
   Claymorphism tokens + Tailwind theme; no parallel styles, no framework
   resets, no UI fragmentation (§34).
2. **RTL correctness** — logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`);
   `<html dir="rtl" lang="ar">` intact; icons/text mirrored sensibly.
3. **Mobile pass (§35)** — Android small-screen layout, 48dp touch targets,
   RTL render, keyboard focus order, degraded/offline behavior (React Query
   persistence; no hard dependency on network for core flows).
4. **Accessibility** — contrast, focus rings, `aria-*` where structural,
   disability-mode themes untouched.
5. **External component isolation** — wrapped by an adapter component that
   maps our tokens onto it; its own CSS never leaks globals; its telemetry/
   fonts/CDN calls stripped (§3).
6. **Performance** — no layout shift on load; heavy libs (PDF, OCR) lazy and
   cancellable on slow devices.

## Validation

- [ ] Visual check at 360px width + RTL + Arabic copy.
- [ ] Touch/keyboard pass; no horizontal scroll.
- [ ] No new global CSS leaks; tokens used, not hardcoded hex.

## Failure conditions

- Component imposing its own theme/global styles; LTR-only layout; paid API
  behind a pretty UI.

## Output

- Screenshots/checklist in the PR + merged diff.
