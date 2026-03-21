# Migration Manifest

This document defines the authoritative boundary between the **active** Supabase migration chain and the **archived-reference** SQL retained for history.

## Active migration contract

The only active migration inputs are the top-level timestamped files in:

- `infra/supabase/supabase/migrations/`

These files are the canonical chain used by CI, `supabase db push`, and repo migration validation.

## Classification

| Path | Classification | Notes |
| --- | --- | --- |
| top-level `*.sql` / `*.rollback.sql` in `migrations/` | Active | Canonical forward + rollback chain. |
| `archive/monolith-20260213/` | Archived-reference | Monolith-era schema history retained for auditability only. |
| `archive/deferred-superseded/` | Archived-reference | Deferred or superseded migrations kept for design traceability and recovery review. |
| `archive/pre-initial-release-2026-03/` | Archived-reference | Pre-baseline migration chain preserved after deterministic baseline consolidation. |

## Why the archive exists

Archived SQL is preserved because some current migrations and compliance docs need historical traceability, but the repository must keep a single unambiguous active chain for clean applies and audits.

## Validation

Run migration hygiene checks:

```bash
node scripts/ci/check-migration-hygiene.mjs
node scripts/ci/check-migration-chain-integrity.mjs
```

Check pending local migrations:

```bash
supabase migration list --local
```

## Rollback policy

Every active migration has a corresponding `.rollback.sql` file. In emergencies:

```bash
psql "$DATABASE_URL" -f <migration>.rollback.sql
```

Archived SQL must not be restored to the top-level migration root without a reviewed migration plan and updated documentation.
