# ValyntApp i18n Expansion Plan

## Current shipped contract

- Production locale configuration and the source-of-truth shipped language set live in `apps/ValyntApp/src/i18n/config.ts`.
- Runtime loading and fallback behavior live in `apps/ValyntApp/src/i18n/index.ts`.
- Locale message files are organized as JSON by locale under `apps/ValyntApp/src/i18n/locales/<locale>/common.json`.
- **Production support is currently limited to `en` and `es`.** Additional locales discussed in this document are roadmap items until locale JSON, runtime wiring, and release evidence land together.
- Pseudo-localization is available as a QA implementation path in `apps/ValyntApp/src/i18n/pseudoLocalization.ts`; it is not a shipped customer-facing locale.

## Phase 1 — Reliability (implemented)

1. **Fallback tests**
   - Automated tests cover unsupported locales, region variants (`en-US`, `es-MX`), and missing-key fallback.
   - Enforced in `apps/ValyntApp/src/i18n/__tests__/fallback.test.ts` and contract tests under `tests/localization/`.

2. **Extraction workflow baseline**
   - Generate a normalized catalog from source locale (`en`) with `scripts/ci/extract-i18n-catalog.mjs`.
   - Output artifact: `artifacts/i18n/extracted-keys.json`.

3. **Locale completeness checks**
   - Continue enforcing key parity/coverage via `scripts/ci/check-i18n-keys.mjs`.
   - Output artifact: `artifacts/i18n/coverage-dashboard.json`.
   - Release interpretation today applies to shipped locales `en` and `es` only.

4. **Pseudo-localization checks in CI**
   - Enforce expansion ratio and token integrity using `scripts/ci/check-pseudo-localization.mjs`.
   - Runtime helper implementation lives in `apps/ValyntApp/src/i18n/pseudoLocalization.ts` so QA and docs refer to a concrete path.
   - Output artifact: `artifacts/i18n/pseudo-localization-report.json`.

## Phase 2 — Translation operations

1. **Translation handoff package**
   - Use `extracted-keys.json` as the translator handoff and import contract.
   - Add source context notes for ambiguous strings in future schema revisions.

2. **PR workflow for locale additions**
   - Require updated locale JSON + passing coverage and pseudo-localization checks.
   - Require fallback tests when changing locale resolution behavior.
   - Do not update release docs to call a locale “supported” until runtime loading, accessibility review, and release sign-off evidence are all present.

3. **Planned locale onboarding sequence**
   - Tier 1 candidates: `fr`, `de`, `pt`.
   - Tier 2 candidates: `ja`, `ar` (direction metadata, RTL behavior, and locale-specific accessibility checks must land before release).

## Phase 3 — Scale and observability

1. **Namespace growth**
   - Split `common.json` into domain namespaces (for example `auth.json`, `dashboard.json`, `settings.json`) while preserving existing fallback logic.

2. **Pseudo-loc visual pass**
   - Add optional Playwright screenshot checks on pseudo-loc builds for truncation/overflow hotspots.
   - Treat those checks as QA evidence for `en-XA`, not as proof of a shipped locale.

3. **Dashboard integration**
   - Publish i18n coverage and pseudo-loc status into frontend quality dashboard artifacts (`artifacts/frontend-quality/dashboard.*`).
   - Ensure scorecards clearly separate shipped locales from expansion candidates.

## Definition of done for i18n expansion PRs

- Locale fallback tests pass.
- Key extraction artifact generated.
- Locale coverage threshold passes.
- Pseudo-localization checks pass with token integrity.
- Frontend quality dashboard reflects updated localization status.
- Release docs and scorecards only list the new locale after runtime support is merged and release evidence is captured.
