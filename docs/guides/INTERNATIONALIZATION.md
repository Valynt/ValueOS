# Internationalization Strategy

## Locale Strategy
- Supported locales: `en`, `es` (expandable via `src/i18n/config.ts`).
- Default locale: `en`.
- Locale is derived from user preference, browser language, or tenant settings, then normalized to a supported code.

## Resource Layout
- Base directory: `src/i18n/`.
- Locale files: `src/i18n/locales/<locale>/common.json` for shared UI strings.
- Configuration: `src/i18n/config.ts` defines supported locales and metadata.
- Helpers: `src/i18n/index.ts` exposes `resolveLocale`, `getMessage`, and `i18n.resources` for runtime usage.

## Copy Extraction
- Store UI strings in JSON resource files instead of inline literals.
- Use stable, namespaced keys (e.g., `canvas.summary`, `errors.network`).
- Avoid concatenating localized strings; prefer complete sentences with placeholders.

## Pluralization & Formatting
- Handle pluralization in translation files with distinct keys (e.g., `item.single`, `item.plural`).
- Use locale-aware formatters for dates (`Intl.DateTimeFormat`), numbers, and currency (`Intl.NumberFormat`).
- Keep formatting logic separated from view components for easier localization.

## Fallback Behavior
- Unknown locales fall back to `en`.
- Missing keys return the English value; unmatched keys surface the key name for debugging.

## Testing Steps
- Verify `resolveLocale` selection using different browser languages and explicit query/header overrides.
- Switch between locales in the UI and confirm persistence for authenticated sessions.
- Validate date/number formatting against locale expectations (decimal separators, currency symbols).
