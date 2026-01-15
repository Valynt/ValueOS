# Legacy Business Cases Deprecation Plan

## Context

The `business_cases` table is a legacy artifact that has been superseded by the `value_cases` table and its associated `ValueCaseService`. To maintain a clean architecture and prevent logic divergence, we are deprecating the `business_cases` table and the `PersistenceService` methods that rely on it.

## Deprecation Strategy

### Phase 1: Soft Deprecation (Current)

- **Flag:** `DISABLE_LEGACY_BUSINESS_CASES = false` (default)
- **Behavior:**
  - `ValueCaseService` prefers `value_cases` but falls back to `business_cases` for reads.
  - `CanvasSchemaService` prefers `value_cases` but falls back to `business_cases` for reads.
  - Usage of legacy paths logs a warning: `DEPRECATION: ...`.
  - New writes (create/update) via legacy paths are still allowed but logged.

### Phase 2: Write Block (Next Step)

- **Flag:** `DISABLE_LEGACY_BUSINESS_CASES = true`
- **Behavior:**
  - `PersistenceService` throws errors on write operations (`createBusinessCase`, `updateBusinessCase`).
  - `ValueCaseService` throws errors if legacy paths are attempted for writes.
  - Reads may still work via direct SQL fallbacks in some places if not fully guarded, but services should return `null` or empty arrays.

### Phase 3: Data Migration

- Run a migration script to move all valid `business_cases` records to `value_cases`.
- Map metadata fields:
  - `business_cases.client` -> `value_cases.company_profiles(company_name)` (may require creating profiles)
  - `business_cases.metadata.stage` -> `value_cases.metadata.stage`
  - `business_cases.status` -> `value_cases.status` (map 'presented' -> 'completed')

### Phase 4: Code Removal

- Remove `business_cases` table from `database.types.ts`.
- Remove `PersistenceService.ts` methods related to business cases.
- Remove fallback logic from `ValueCaseService.ts` and `CanvasSchemaService.ts`.
- Remove `DISABLE_LEGACY_BUSINESS_CASES` feature flag.

## Key Changes

- **Feature Flag:** Added `DISABLE_LEGACY_BUSINESS_CASES` to `src/config/featureFlags.ts`.
- **ValueCaseService:** Updated to check flag and warn on fallback.
- **CanvasSchemaService:** Updated to prioritize `value_cases` and warn/block legacy fallback.
- **PersistenceService:** Marked legacy methods as deprecated with logging and flag checks.

## Monitoring

- Monitor logs for `DEPRECATION:` warnings to identify remaining legacy usage.
- Track errors related to `Updates to legacy business cases are disabled` to identify blocked workflows.
