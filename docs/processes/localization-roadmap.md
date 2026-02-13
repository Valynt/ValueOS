# Localization Roadmap

## Current State

- **Source locale**: `en` (English)
- **Supported locales**: `en`, `es` (Spanish)
- **Translation files**: `apps/ValyntApp/src/i18n/locales/{locale}/common.json`
- **Framework**: Custom I18nProvider (`apps/ValyntApp/src/i18n/`)

## Target Locales (Phase 1)

| Locale | Language | Region | Priority | Status |
|--------|----------|--------|----------|--------|
| en | English | US/Global | P0 | Active |
| es | Spanish | LATAM/Spain | P0 | Active |
| fr | French | France/Canada | P1 | Planned |
| de | German | DACH | P1 | Planned |
| pt-BR | Portuguese | Brazil | P2 | Planned |

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

Translation key integrity is enforced by `scripts/ci/check-i18n-keys.mjs` which runs in CI on every PR:

1. **Missing keys**: Fails if any non-source locale is missing keys present in `en`.
2. **Unused keys**: Warns if keys exist in locale files but are not referenced in source code.
3. **Fallback ratio**: Fails if any locale has < 90% of source keys translated (configurable threshold).

## Release Checklist

Before releasing any user-facing feature:

- [ ] All new UI strings use translation keys (no hardcoded strings).
- [ ] Source locale (`en`) file updated with new keys.
- [ ] All active locales have translations for new keys (or approved fallback).
- [ ] Date/number/currency formatting uses `Intl` APIs.
- [ ] Pluralization tested with counts 0, 1, 2, 5, 21.
- [ ] Screenshots reviewed for text truncation in longer locales (de, es).
