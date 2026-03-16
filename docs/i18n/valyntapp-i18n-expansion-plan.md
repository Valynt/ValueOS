# ValyntApp i18n Expansion Plan

## Starting point

- Locale configuration and source-of-truth language set live in `apps/ValyntApp/src/i18n/config.ts`.
- Runtime loading and fallback behavior live in `apps/ValyntApp/src/i18n/index.ts`.
- Locale message files are organized as JSON by locale under `apps/ValyntApp/src/i18n/locales/<locale>/common.json`.

## Phase 1 — Reliability (implemented)

1. **Fallback tests**
   - Add automated tests for unsupported locales, region variants (`en-US`), and missing-key fallback.
   - Enforced in `apps/ValyntApp/src/i18n/__tests__/fallback.test.ts`.

2. **Extraction workflow baseline**
   - Generate a normalized catalog from source locale (`en`) with `scripts/ci/extract-i18n-catalog.mjs`.
   - Output artifact: `artifacts/i18n/extracted-keys.json`.

3. **Locale completeness checks**
   - Continue enforcing key parity/coverage via `scripts/ci/check-i18n-keys.mjs`.
   - Output artifact: `artifacts/i18n/coverage-dashboard.json`.

4. **Pseudo-localization checks in CI**
   - Enforce expansion ratio and token integrity using `scripts/ci/check-pseudo-localization.mjs`.
   - Output artifact: `artifacts/i18n/pseudo-localization-report.json`.

## Phase 2 — Translation operations

1. **Translation handoff package**
   - Use `extracted-keys.json` as the translator handoff and import contract.
   - Add source context notes for ambiguous strings in future schema revisions.

2. **PR workflow for locale additions**
   - Require updated locale JSON + passing coverage and pseudo-localization checks.
   - Require fallback tests when changing locale resolution behavior.

3. **Planned locale onboarding sequence**
   - Tier 1: `fr`, `de`, `pt`.
   - Tier 2: `ja`, `ar` (add direction metadata and RTL checks before release).

## Phase 3 — Scale and observability

1. **Namespace growth**
   - Split `common.json` into domain namespaces (e.g., `auth.json`, `dashboard.json`, `settings.json`) while preserving existing fallback logic.

2. **Pseudo-loc visual pass**
   - Add optional Playwright screenshot checks on pseudo-loc builds for truncation/overflow hotspots.

3. **Dashboard integration**
   - Publish i18n coverage and pseudo-loc status into frontend quality dashboard artifacts (`artifacts/frontend-quality/dashboard.*`).

## Definition of done for i18n expansion PRs

- Locale fallback tests pass.
- Key extraction artifact generated.
- Locale coverage threshold passes.
- Pseudo-localization checks pass with token integrity.
- Frontend quality dashboard reflects updated localization status.
