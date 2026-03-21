# Supabase Migration Archive

This directory contains **archived-reference** or **superseded** migration material.

Only top-level timestamped files in `infra/supabase/supabase/migrations/` are active.
Anything under `migrations/archive/` is excluded from the canonical migration chain.

## Contents

| Path | Classification | Purpose |
| --- | --- | --- |
| `monolith-20260213/` | Archived-reference | Monolith-era schema history retained for audits and compatibility analysis. |
| `deferred-superseded/` | Archived-reference | Deferred or superseded migrations retained for recovery context and design traceability. |
| `pre-initial-release-2026-03/` | Archived-reference | Pre-baseline migration chain preserved after deterministic baseline consolidation. |

Do not move files from this archive back into the active root without a reviewed migration plan and updated documentation.
