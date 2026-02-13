# Localization Standards

**Last Updated**: 2026-02-13

## Purpose

Define implementation and QA standards for all user-facing localized experiences in ValueOS applications.

## 1. Translation Key and Message Standards

- All user-facing strings must be sourced from translation keys (no hardcoded copy in UI components).
- Keys must follow namespaced dot notation: `<domain>.<feature>.<message>` (example: `auth.signIn`).
- English (`en`) is the source locale for key lifecycle, coverage, and deprecation.
- New keys require translation entries for all GA locales before release.

## 2. Formatting Standards

- Dates and times must use locale-aware formatting APIs (`Intl.DateTimeFormat`) and region-correct ordering.
- Numbers must use locale-aware grouping and decimal separators (`Intl.NumberFormat`).
- Currency must always include ISO currency code and locale-aware symbol rendering.
- Percentages and units must be formatted via locale-aware formatters; do not concatenate symbols manually.

## 3. Pluralization and Grammatical Rules

- Use ICU pluralization-capable message patterns for count-based messages.
- Do not implement plural logic with manual ternary checks in components.
- Any language with multiple plural categories (for example: one, few, many) must be validated with locale-specific test cases.

## 4. RTL Readiness Standards

- Components must rely on logical CSS properties when possible (for example: `margin-inline-start` over `margin-left`).
- Layouts, iconography direction, and navigation affordances must be mirrored in RTL mode.
- Locale metadata must declare text direction and propagate it to `<html dir="...">`.
- RTL support is required before launch in Arabic/Hebrew market segments.

## 5. CI Localization Quality Gates

- CI must fail if a non-default locale has missing keys against the default locale.
- CI must fail if locale files contain unused keys not present in the default locale.
- CI must enforce fallback ratio thresholds (missing keys / default keys) per locale.
- Threshold default is `<= 5%` during rollout and should be tightened to `<= 1%` before GA in a region.

## 6. QA and Release Standards

- Every user-facing feature PR must include localization impact assessment (new keys, changed keys, removed keys).
- Release checklist must include localization QA verification for:
  - Translation completeness
  - Layout integrity for long strings
  - Locale-specific formatting correctness
  - Directionality checks for RTL locales when applicable
- Critical flows (auth, checkout/billing, legal consent, notifications) require manual localized smoke testing.

## 7. Ownership

- Product Engineering owns key lifecycle and formatter correctness.
- QA owns localized validation and release sign-off evidence.
- Legal/Compliance owns regional legal-language approval for regulated copy.
