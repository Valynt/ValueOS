# Deal assembly migration reconciliation — 2026-11-06

**Status:** Candidate fixes are in the consolidated draft [PR #2667](https://github.com/Valynt/ValueOS/pull/2667). **Not production approved.** Separate release gate [#2650](https://github.com/Valynt/ValueOS/issues/2650) remains NO-GO.

## Verified incompatibilities

| Contract | Earlier `20260318000000_deal_assembly_pipeline.sql` | Later `20260318161110_deal_assembly_tables.sql` | Current treatment |
| --- | --- | --- | --- |
| Parent scope | `tenant_id UUID NOT NULL` | `organization_id UUID NOT NULL` | Additive dual-scope columns and ownership validation |
| `deal_contexts.opportunity_id` | `UUID NOT NULL` | `TEXT NOT NULL` | **Neither type converted**; owner decision needed |
| `use_cases.pain_signals`, `expected_outcomes` | `JSONB` | `TEXT[]` | **Neither type converted**; owner decision needed |
| `stakeholders.priority`, `use_cases.priority` | integer range 1–100 | integer range 1–10 | Existing constraints unchanged; owner decision needed |
| source/role checks | different accepted strings | different accepted strings | Existing constraints unchanged; owner decision needed |
| updated_at triggers | canonical trigger name already installed | blindly creates same name | Early bridge renames legacy trigger without disabling it; later migration creates canonical trigger; later forward repair drops only duplicate legacy trigger |
| tenant isolation | JWT-claim UUID comparison | `organization_id::text` passed to tenant membership check | Additional restrictive membership and verified-ownership RLS guards; composite parent/child FK |
| service contract | not represented | not represented | `DealAssemblyService` also expects `account_name`, `stakeholders`, `gaps`, `assembly_status` and other fields. **Unresolved** |

### Repair boundaries

The earlier migration `20260318161109_deal_assembly_scope_bridge.sql` runs before the incompatible later historical migration. The identical, unique-version `20261106020000_deal_assembly_scope_reconciliation.sql` is a forward-only repair candidate for histories where the later migration already applied. Both are transactional with lock and statement timeouts.

Backfills never use coincidental UUID equality. An existing parent with no organization must have a verified value-case relationship; child scope comes only from its actual deal-context parent. Absent/contradictory case, tenant, organization or child ownership fails atomically. Existing UUID, JSONB and source-code vocabularies are retained. Composite FKs and restrictive RLS prevent an old/new permissive policy from OR-granting another tenant. The paired rollbacks **freeze writes without removing rows, constraints, RLS or original data**.

**These bridges establish a compatible migration sequence and access contract for tested shapes. They do not certify the application-level DTO/type contract or applied production history.**

## Reproducible evidence

On candidate `d963387e52248d80762db8e696695906c30d3d73`, [PostgreSQL 15 migration run 42306288938](https://github.com/Valynt/ValueOS/actions/runs/42306288938) job `128196317093`:

- **PASS**: reproduce original missing-`organization_id` error; apply early bridge, later historical migration, and post-history forward migration.
- **PASS**: populated tenant-first legacy rows and populated organization-first rows retained with verified ownership and original `opportunity_id` types.
- **PASS**: 3 child scope FKs, 16 restrictive RLS policies, forged-tenant negative read, contradictory child write rejection, rollback freeze/reapply.
- **PASS**: ambiguous legacy parent without case mapping rejected atomically and pre-existing rows/columns preserved.
- **PASS**: previous value-modeling, billing, and libpq-routing disposable regression suites.
- **FAIL**: unrelated next clean-chain migration `20260319000000_create_academy_pillars_table.sql:52` references missing `public.academy_modules` ([#2673](https://github.com/Valynt/ValueOS/issues/2673)). Its archived definition uses a seven-value enum, while the active new FK targets an integer in a ten-pillar catalog; restoring archived DDL as-is is unsafe.
- **FAIL**: strict Supabase numeric-version gate still reports 19 historical duplicate groups ([#2664](https://github.com/Valynt/ValueOS/issues/2664)); no suppression or renumbering.

These use a **disposable PostgreSQL 15 container with test-only Auth fixtures**, not real Supabase Auth or a deployed schema.

## Required before any merge or production upgrade

1. For **every actual deployed environment**, collect a read-only `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;` and the deployed Git SHA, or a documented owner statement that **no deployed databases exist**. Do not include credentials or customer row contents.
2. Obtain read-only schema fingerprints (`pg_attribute`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_trigger`) and aggregate row counts for the four deal tables, `organizations`, `value_cases`, Academy relations and migration lineage.
3. Have the data/API owner explicitly choose UUID versus external TEXT opportunity IDs, JSONB versus TEXT arrays, priority and role/source vocabularies, and the canonical `DealAssemblyService` persisted fields. Write old/new writer compatibility tests for these choices.
4. Reconcile Academy's seven-value `academy_pillar` enum against the ten-row `academy_pillars.number INTEGER` FK **without blind casts** ([#2673](https://github.com/Valynt/ValueOS/issues/2673)).
5. Reconcile all 19 historical version collisions with applied-file lineage, preserving existing numbers/hashes where deployed ([#2664](https://github.com/Valynt/ValueOS/issues/2664)); prove fresh and populated upgrades with Supabase CLI and real isolated Supabase Auth.
6. Pass exact-HEAD full-chain and all required CI/security checks, independent review and named release sign-offs. **No direct main push, admin bypass, PR merge or deployment while blocked.**
