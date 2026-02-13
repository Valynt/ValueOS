# Localization Roadmap

## Current State

- **Source locale**: `en` (English)
- **Supported locales**: `en`, `es` (Spanish)
- **Translation files**: `apps/ValyntApp/src/i18n/locales/{locale}/common.json`
- **Framework**: Custom I18nProvider (`apps/ValyntApp/src/i18n/`)

## Locale Coverage Plan (`apps/ValyntApp/src/i18n/locales/`)

### Phase 0 (Now)

| Locale folder | Purpose | Status |
|--------|----------|--------|
| `en/` | Source strings and key authority | Active |
| `es/` | Production translation for Spanish | Active |

### Phase 1 (Next 1-2 releases)

| Locale folder | Language | Priority | Coverage gate |
|--------|----------|----------|--------|
| `fr/` | French | P1 | >= 95% key parity with `en` |
| `de/` | German | P1 | >= 95% key parity with `en` |
| `pt-BR/` | Brazilian Portuguese | P2 | >= 95% key parity with `en` |
| `en-XA/` | Pseudo-localized English (accented + expanded copy) | P0 for QA only | 100% generated from `en` |

### Phase 2 (Readiness)

| Locale folder | Language | Priority | Notes |
|--------|----------|----------|--------|
| `ar/` | Arabic | P2 | RTL validation required |
| `he/` | Hebrew | P2 | RTL validation required |

## Standards

### Date/Number/Currency Formatting

- Use `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.RelativeTimeFormat` for all locale-sensitive formatting.
- Never hardcode date separators, decimal separators, or currency symbols.
- Store all timestamps as UTC; convert to user timezone at display time.
- Currency display must respect locale conventions (symbol position, spacing).

### Pluralization

- Use ICU MessageFormat syntax for pluralized strings.
- All locales must define at minimum: `one` and `other` plural forms.
- Languages with additional plural categories (e.g., Russian: `one`, `few`, `many`) must define all required forms.

### Timezone Handling

- All API responses use ISO 8601 with UTC offset.
- Frontend stores user timezone preference in profile settings.
- Date pickers and scheduled events display in user's local timezone.

### RTL Readiness

- CSS must use logical properties (`margin-inline-start` instead of `margin-left`).
- Icons that imply direction (arrows, chevrons) must be mirrored in RTL mode.
- Layout direction is set via `dir` attribute on `<html>` based on active locale.
- RTL locales (Arabic, Hebrew) are Phase 2 targets.

## CI Enforcement

Translation quality and pseudo-localization safeguards are enforced in CI:

1. **Key integrity** (`scripts/ci/check-i18n-keys.mjs`)
   - Missing keys fail CI when non-source locales diverge from `en`.
   - Coverage threshold fails CI below configured minimum.
2. **Pseudo-localization guardrails** (`scripts/ci/check-pseudo-localization.mjs`)
   - Ensures source locale keys can be pseudo-localized deterministically.
   - Ensures pseudo copy expands by a safe ratio (1.15x to 1.45x) for overflow testing.
   - Fails if generated pseudo strings include empty outputs or preserve unexpanded text.
3. **Localization overflow visual checks** (`tests/visual/localization-overflow.spec.ts`)
   - Runs screenshot + DOM overflow assertions for login, dashboard, deals, and canvas workflows.
   - Fails CI on clipping/overflow regressions.

## Release Checklist

Before releasing any user-facing feature:

- [ ] All new UI strings use translation keys (no hardcoded strings).
- [ ] Source locale (`en`) file updated with new keys.
- [ ] All active locales have translations for new keys (or approved fallback).
- [ ] Date/number/currency formatting uses `Intl` APIs.
- [ ] Pluralization tested with counts 0, 1, 2, 5, 21.
- [ ] Screen reader + keyboard-only + high-zoom manual protocol completed.
- [ ] Localization overflow screenshot suite passed.
