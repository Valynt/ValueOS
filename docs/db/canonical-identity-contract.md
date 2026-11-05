# Canonical identity schema and release contract

Status: **candidate reconciliation / not yet deployed** (2026-11-05). See
[release readiness issue #2650](https://github.com/Valynt/ValueOS/issues/2650)
and the repair PR #2662. No production sign-off is implied.

## Authoritative IDs and ownership

| Object | ID type | Authority | Trust boundary |
| --- | --- | --- | --- |
| `auth.users.id` | UUID | Supabase Auth (GoTrue) | Owns authentication and account lifecycle |
| `public.users.id` | UUID, FK to `auth.users.id` | App-owned profile mirror | No credentials or independent auth identities |
| `public.user_tenants.user_id` | TEXT | Membership mapping | Stores exact `auth.uid()::text` for compatibility; does not change to UUID in place |
| `public.tenants.id` | TEXT | Tenant record | Legacy canonical storage, may contain UUID-formatted strings |
| `public.organizations.id` | UUID | Organization | Linked to `public.organizations.tenant_id` TEXT |

The user profile has exactly one `tenant_id` and `organization_id`
**home assignment** whose pair is validated against `organizations`.
That assignment is not an authorization source for other tenants.
A subject may have memberships in more than one tenant through
`public.user_tenants`; `security.user_has_tenant_access` remains the
membership authority.

## Schema and least privilege

The new `20260317010000_canonical_public_users_identity.sql` migration
creates `public.users` only when missing. It rejects an existing
incompatible users table rather than coercing TEXT IDs to UUID or
guessing a missing organization's tenant. Existing deployments require
an explicit inventory, data mapping, backup and dry-run before any
in-place alteration. The migration uses an Auth UUID FK, a composite
organization/tenant FK, RLS, and a service-role-only provisioning path.

Authenticated sessions may SELECT their own profile and UPDATE only
`name`, `display_name` and `avatar_url`; they cannot assign their
own tenant, organization, role, metadata or Auth identity. Service role
writes must be authorized and validated server-side. The later
`20260922000000_rls_gap_remediation.sql` retains the same UUID own-row
comparison and column-level grants rather than broadening UPDATE.

## Privacy and analytics compatibility

The DSR function now uses the UUID profile key and the TEXT home tenant
when matching a user, and refuses a tenant-local erase that would
anonymize a user with active memberships in other tenants. Such requests
require coordinated, documented privacy handling rather than silently
scrubbing a globally shared Auth identity.

Academy rollups that use `public.users.organization_id` reflect **home
organization** membership, not all users with multi-tenant memberships.
This difference must be accepted or corrected through a separate
membership-source analytics change before analytics are certified.
`last_signed_in` is available for the active-user index and API.

## Required verification

1. Apply all active migrations to a disposable Supabase-compatible
   database. Do not insert demo Auth accounts via schema migrations.
2. Run `scripts/ci/verify-canonical-users.sql` at the canonical
   migration boundary. Its transaction asserts UUID/TEXT types,
   Auth FK rejection, organization/tenant pairing, own-row RLS,
   cross-user negative access and least-privilege UPDATE, then rolls back.
3. Test the same contract in real Supabase Auth with at least two tenants
   and negative JWT/RLS cases. The bare-Postgres Auth schema in CI is a
   strictly test-only compatibility fixture, not a production substitute.
4. Prove rollback on an empty isolated prerequisite state; require
   an explicit error (no CASCADE and no data loss) for populated or
   dependent tables. Preserve already-applied migration history.
5. Confirm a single candidate release SHA passes complete checks,
   including G1–G8, with authenticated owner approval.

## Additional migration-history blocker

The repository already contains multiple active migrations sharing
the same 14-digit Supabase migration version (including versions
`20260318000000`, `20260319000000` and `20261008000000`).
The new bootstrap collision was removed by consolidating its tables
under `20260213000004`, but historical collisions remain. A sorted
raw-psql clean apply does **not** prove that Supabase CLI migration
tracking can safely deploy this complete chain. Reconcile historical
versions against applied-environment records before production use.
Do not rename already-deployed migrations blindly.

**Status:** G5 remains NO-GO until clean apply, real Auth negative
tests, historical migration reconciliation, data-owner signoff and
release evidence are complete. Do not represent this contract as
a verified live deployment.
