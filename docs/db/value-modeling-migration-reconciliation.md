# Value-modeling migration reconciliation

Status: candidate repair for #2665; #2664 and production readiness #2650 remain open.
No production deployment or migration-history repair is authorized by this document.

## Contract and supported paths

`20260318160000_value_modeling_scope_bridge.sql` runs before the conflicting
`20260318160647` indexes. `20261106000000_value_modeling_scope_reconciliation.sql`
contains the same repair for installations that already passed historical migrations.
The regression suite requires their SQL and rollback bodies to remain identical.

For assumptions and scenarios, the case's explicit `organization_id` must identify
an existing organization. Its TEXT `tenant_id` must agree with any supplied case
or legacy row tenant. The repair backfills only this verified relationship;
missing or contradictory ownership aborts the entire transaction. No IDs or ID
types are rewritten. The legacy model `tenant_id UUID` remains UUID. Consequently,
non-UUID organization tenant IDs require a separate explicit model-scope migration;
they fail closed here. This limitation does not change the canonical user contract:
Auth/profile IDs stay UUID and membership user IDs stay TEXT.

The bridge accepts legacy tenant-only and newer organization-only writes when the
case supplies a verified, UUID-compatible tenant mapping. Composite case/org FKs
prevent moving a case with models to another organization. RLS resolves membership
through `organizations.tenant_id`; a restrictive policy prevents old permissive
policies from granting access merely because an organization UUID matches a
membership tenant ID. Trigger lookups use SECURITY INVOKER.

Rollback freezes authenticated/service-role model writes and retains rows, FKs and
RLS. Reapply validates data and restores CRUD. It does not undo the schema or restore
less restrictive access. Operators must account for this write freeze during rollback.

## Additional destructive-upgrade blocker

`20260923000000_value_modeling_schema_consolidation.sql` historically drops seven
tables with CASCADE. Its previous assertion that no valid data could exist was
unsupported. It now locks and checks every affected table before the first DROP,
and refuses populated upgrades. Empty-install behavior is retained. This is a safety
barrier, not a completed forward-only upgrade implementation. Applied migrations
cannot recover previously deleted data. A migration after that file cannot protect
an upgrade that reaches the destructive file first.

Therefore **#2665 is not closed by the bridge**: the complete populated historical
upgrade path and remaining downstream schema conflicts still need proof. Do not
rename applied migrations, skip failures, or regenerate the canonical snapshot
from a partial installation.

## Reproducible checks

Run against an explicitly disposable local PostgreSQL service:

```bash
DATABASE_URL="$DISPOSABLE_LOCAL_DATABASE_URL" \
  node scripts/ci/test-value-modeling-scope.mjs
node --test scripts/ci/__tests__/check-migration-versions.test.mjs
node scripts/ci/check-migration-versions.mjs --inventory > migration-version-inventory.json
```

The targeted DB suite creates separate test databases, uses actual repository
baseline/identity/model SQL, reproduces the original missing-column failure, then
checks fresh apply, populated backfill, negative tenant/organization collision
access, old/new writes, atomic rejection, rollback/reapply, and preservation of
incompatible TEXT user IDs. A populated consolidation must fail before deleting data.
These checks are not a substitute for full-chain PostgreSQL CI, Supabase CLI or real
Supabase Auth testing.

The version inventory contains filenames and SHA-256 digests. Both normal and
`--inventory` modes exit nonzero on existing or new collisions. There is no baseline
exception. The independent CI job retains the inventory even on failure, while the
clean-apply job can still reveal downstream SQL defects.

## Evidence needed to resolve #2664 safely

For each actual target environment, an authorized database operator must provide:

1. Environment label and collection time; no connection strings or credentials.
2. Read-only migration history (`version`, `name`) from
   `supabase_migrations.schema_migrations`, ordered by version. If that table or
   either column is absent, report the actual schema rather than fabricating history.
3. The deployed Git SHA or release artifact and its migration-file hashes, plus
   schema-only definitions/constraints for affected tables. Version/name alone
   cannot distinguish multiple files sharing a version.
4. Whether each of the seven consolidation tables is populated (counts only;
   no customer row contents), backup/PITR reference, and an isolated restore for
   upgrade rehearsals.

Reconcile those histories with the exact CI inventory before choosing any baseline,
renumbering or repair commands. Prove both a new Supabase install and each observed
upgrade state, preserving file lineage. Data-owner and release signoff remain required.
