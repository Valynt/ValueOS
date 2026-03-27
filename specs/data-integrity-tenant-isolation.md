# Spec: Data Integrity & Tenant Isolation

**Status:** Ready for implementation  
**Priority:** P0 — At Risk  
**Tracks:** RLS remediation · CacheService Redis isolation · Tenant context middleware hardening

---

## Problem Statement

ValueOS is a multi-tenant system where a breach of tenant isolation is a critical security failure. Three systemic gaps exist:

1. **RLS coverage is incomplete and unenforced.** The "17 tables missing RLS" finding is a point-in-time snapshot that is already partially stale. The real problem is structural: there is no permanent, CI-enforced guarantee that every public table has RLS enabled with a correct tenant-scoping policy. New tables and partition children can be introduced without RLS and no gate will catch it.

2. **CacheService.clear() has no Redis implementation.** The in-memory `Map` path correctly scopes `clear()` to the current tenant prefix. The Redis-backed path has no `clear()` implementation at all — it silently does nothing. Any caller that relies on `clear()` to invalidate a tenant's cache when a Redis client is active gets a no-op, leaving stale cross-request data in place.

3. **Tenant context resolution is fail-open across five sources.** `tenantContextMiddleware.ts` resolves tenant ID from TCT → service-header → user-claim → route-param → user-lookup. This chain is too wide: route-param and user-lookup are weak, unauthenticated-adjacent sources. There is no deny-on-conflict behavior when two sources disagree. Misresolution is not auditable because the resolution source is not logged consistently.

---

## Requirements

### Track 1 — RLS: Full Defense-in-Depth

**R1.1 — Authoritative baseline audit**  
Before writing any migration, enumerate all tables in the `public` schema (including partition children, archive tables, and join tables) and classify each as:
- `tenant_scoped` — carries `tenant_id` or `organization_id`; requires RLS + tenant-scoping policy
- `service_only` — no user-facing access; requires RLS + `service_role`-only policy
- `global_readonly` — shared reference data; requires RLS + read-only authenticated policy
- `auth_managed` — Supabase-managed (e.g., `auth.users`); excluded from public-schema RLS work

Specifically investigate whether a `public.users` or `public.profiles` table exists. If it does, classify and remediate it. If it does not, document the `users` finding from the original report as a false positive against `auth.users`.

**R1.2 — Policy correctness, not just presence**  
For every `tenant_scoped` table:
- RLS must be `ENABLED`
- At least one `SELECT` policy must scope rows by `tenant_id` or `organization_id` (or via `security.user_has_tenant_access()`)
- `service_role` must have an unrestricted policy (it bypasses RLS anyway, but the policy must be explicit)
- No policy may use `USING (true)` for the `authenticated` role — this is a permissive bypass

**R1.3 — Partition children**  
PostgreSQL does not automatically enable RLS on partition children when the parent has it. Every partition child must have `ENABLE ROW LEVEL SECURITY` called explicitly. The `create_next_monthly_partitions()` function (already patched in `20260917`) must remain the canonical template for future partition creation.

**R1.4 — `tenant_scope_inventory` completeness**  
`infra/supabase/tests/database/tenant_scope_inventory.sql` must include every table identified in the baseline audit. Tables not in the inventory are invisible to the existing `rls_enabled_tables.test.sql` gate.

**R1.5 — CI enforcement (permanent control)**  
The existing `rls_lint.test.sql` and `check-permissive-rls.sh` gates must be extended or supplemented so that:
- Any PR introducing a new `CREATE TABLE` in the `public` schema without a corresponding `ENABLE ROW LEVEL SECURITY` fails CI
- Any PR introducing a policy with `TO authenticated USING (true)` fails CI
- Partition children created by `create_next_monthly_partitions()` are covered by the lint check

**R1.6 — `llm_calls` table**  
`llm_calls` is in `tenant_scope_inventory` but has no migration enabling RLS or adding policies. A migration must add `ENABLE ROW LEVEL SECURITY` and a `service_role`-only policy (LLM call records are written by backend workers, not directly by authenticated users).

---

### Track 2 — CacheService: Redis Namespace Isolation

**R2.1 — Versioned namespace invalidation (primary strategy)**  
Implement `clear()` for the Redis-backed path using a versioned namespace counter:
- Each tenant+namespace combination has a version key: `tenant:{tid}:{namespace}:_v`
- All cache keys include the current version: `tenant:{tid}:{namespace}:v{n}:{key}`
- `clear()` atomically increments the version counter via `INCR`
- Old keys become unreachable immediately (logical invalidation) and expire via TTL
- This is O(1), cluster-safe, and race-condition-free

**R2.2 — SCAN/UNLINK fallback (maintenance path only)**  
Provide a separate `purge()` method (not `clear()`) that uses Redis `SCAN` + `UNLINK` to physically remove keys matching a prefix. This is for maintenance/admin use only, not the hot path. Document the cluster limitation: `SCAN` on a Redis Cluster only scans the local node; a full cluster purge requires iterating all nodes.

**R2.3 — TTL enforcement**  
Every `set()` call must apply a TTL. The default TTL must be configurable (default: 3600s). Keys without TTL are a memory leak risk and make the versioned invalidation strategy less effective.

**R2.4 — Tenant namespace mismatch remains a hard error**  
The existing guard in `set()` that throws on namespace prefix mismatch must be preserved. It is a correct defense-in-depth check.

**R2.5 — Tests**  
Unit tests must cover:
- `clear()` with in-memory store: only current tenant's keys are removed
- `clear()` with Redis mock: version counter is incremented; subsequent `get()` returns null
- `set()` with mismatched namespace: throws
- `deleteMany()` with explicit namespace: only named keys are removed
- Concurrent `clear()` calls: no race condition (version increment is atomic)

---

### Track 3 — Tenant Context Middleware: Fail-Closed Resolution

**R3.1 — Reduce resolution sources to three**  
Remove the `route-param` fallback (`tenantSource = 'request'`). Route parameters are user-controlled input and the weakest possible source for a security-critical value. The trusted chain becomes:

| Priority | Source | Condition |
|---|---|---|
| 1 | TCT JWT (`x-tenant-context` header) | Verified HS256 signature |
| 2 | Service header (`x-tenant-id`) | `serviceIdentityVerified === true` only |
| 3 | User JWT claim (`tenant_id` / `organization_id`) | Authenticated user |
| 4 | User lookup (DB) | Authenticated user, no claim present |

**R3.2 — Deny on conflict**  
If two sources produce different tenant IDs, the request must be rejected with `403`. Currently, the middleware only checks for divergence on agent-scoped paths. This check must apply to all routes.

**R3.3 — Structured audit logging on every resolution**  
Every request that passes through the middleware must emit a structured log entry containing:
- `tenantId` (resolved value)
- `tenantSource` (which source won)
- `userId` (if present)
- `path`
- `conflictDetected: boolean`

This makes misresolution detectable in production without changing behavior.

**R3.4 — Fail-closed on missing tenant (enforce=true default)**  
The `enforce` parameter defaults to `true`. When `enforce=true` and no tenant can be resolved, the middleware must return `403`. This is already the behavior; it must not be weakened.

**R3.5 — Tests**  
Unit tests must cover:
- TCT path: valid token → resolves correctly
- TCT path: invalid token → 401
- TCT path: token tid ≠ request tenantId → 403
- Service header: `serviceIdentityVerified=false` → 403
- Service header: `serviceIdentityVerified=true` → resolves correctly
- User claim: present → resolves correctly
- User lookup: no claim, userId present → resolves via DB
- Route param: present → **ignored** (no longer a resolution source)
- Conflict: TCT tid ≠ user claim → 403
- No tenant resolved, enforce=true → 403
- No tenant resolved, enforce=false → next() called
- Agent-scoped path: claim ≠ resolved → 403 (existing behavior preserved)

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|---|---|
| AC-1 | Every `public` schema table has RLS enabled | `rls_lint.test.sql` passes with zero exceptions |
| AC-2 | Every tenant-scoped table has a policy scoping rows by `tenant_id`/`organization_id` | `rls_enabled_tables.test.sql` passes; `tenant_scope_inventory` is complete |
| AC-3 | No `authenticated` role policy uses `USING (true)` | `check-permissive-rls.sh` passes |
| AC-4 | `llm_calls` has RLS enabled with a `service_role`-only policy | Migration applied; lint passes |
| AC-5 | `public.users` finding is resolved (either remediated or documented as false positive) | Entry in spec or migration comment |
| AC-6 | `CacheService.clear()` with Redis active increments the version counter | Unit test passes |
| AC-7 | `CacheService.clear()` with Redis active: subsequent `get()` returns null | Unit test passes |
| AC-8 | `CacheService.set()` applies TTL on every write | Unit test passes |
| AC-9 | Route-param tenant resolution source is removed | No `tenantSource = 'request'` in middleware |
| AC-10 | Conflicting tenant sources → 403 on all routes | Unit test passes |
| AC-11 | Every resolved request emits a structured log with `tenantSource` | Log output verified in test |
| AC-12 | `pnpm run test:rls` passes with ≥10 tests | CI gate passes |
| AC-13 | New `CREATE TABLE` without RLS fails CI | `rls_lint.test.sql` or equivalent CI check |

---

## Implementation Steps

### Phase 1 — Baseline audit (prerequisite for all other work)

1. Query the live database (or apply all migrations to a clean DB) to enumerate all `public` schema tables, their RLS status, and their policies. Produce a gap list.
2. Determine whether `public.users` or `public.profiles` exists. Document the finding.
3. Update `tenant_scope_inventory.sql` to include any tables currently missing from it.

### Phase 2 — RLS migrations

4. Write migration `YYYYMMDD_rls_llm_calls.sql`: enable RLS on `llm_calls`, add `service_role`-only policy.
5. Write migration `YYYYMMDD_rls_remaining_gaps.sql`: for each table identified in Phase 1 that still lacks RLS or correct policies, add `ENABLE ROW LEVEL SECURITY` and the appropriate policy (tenant-scoped or service-only).
6. Verify `create_next_monthly_partitions()` still calls `ENABLE ROW LEVEL SECURITY` on new children (already done in 20260917 — confirm it is not regressed).
7. Run `pnpm run test:rls` and `rls_lint.test.sql` against the patched schema. All must pass.

### Phase 3 — CacheService Redis isolation

8. Add a version key helper: `private versionKey(): string` → `tenant:{tid}:{namespace}:_v`.
9. Modify `fullKey()` to fetch the current version and include it in the key: `tenant:{tid}:{namespace}:v{n}:{key}`.
10. Implement `clear()` for the Redis path: `INCR` the version key. In-memory path unchanged.
11. Add `purge()` method using `SCAN` + `UNLINK` for maintenance use. Document cluster limitation.
12. Enforce TTL on every `set()` call (default 3600s, configurable via constructor).
13. Write unit tests per R2.5.

### Phase 4 — Middleware hardening

14. Remove the `route-param` resolution block from `tenantContextMiddleware.ts`.
15. Extend the conflict-detection check (currently agent-scoped only) to all routes.
16. Add structured log emission on every resolution (source, tenantId, userId, path, conflictDetected).
17. Write unit tests per R3.5.

### Phase 5 — CI enforcement

18. Extend `rls_lint.test.sql` or add a new CI script that fails if any `CREATE TABLE` in a new migration file lacks a corresponding `ENABLE ROW LEVEL SECURITY` in the same or earlier migration.
19. Verify `check-permissive-rls.sh` covers partition children (it currently checks migration files, not the live schema — confirm scope).
20. Confirm `pnpm run test:rls` CI gate asserts ≥10 passing tests (already in `pr-fast.yml` at line 543 — verify it is not skippable).

---

## Files Affected

| File | Change |
|---|---|
| `infra/supabase/supabase/migrations/YYYYMMDD_rls_llm_calls.sql` | New migration |
| `infra/supabase/supabase/migrations/YYYYMMDD_rls_remaining_gaps.sql` | New migration (scope determined by Phase 1 audit) |
| `infra/supabase/tests/database/tenant_scope_inventory.sql` | Add missing tables |
| `packages/backend/src/services/CacheService.ts` | Versioned namespace, Redis clear(), TTL enforcement |
| `packages/backend/src/services/__tests__/CacheService.test.ts` | Replace stub tests with real isolation tests |
| `packages/backend/src/middleware/tenantContext.ts` | Remove route-param source, extend conflict check, add audit log |
| `packages/backend/src/middleware/__tests__/tenantContext.test.ts` | Tests per R3.5 |
| `scripts/ci/check-permissive-rls.sh` | Extend scope if needed |

---

## Out of Scope

- `auth.users` (Supabase-managed; not a public-schema RLS concern unless a mirror table exists)
- Redis Cluster multi-node `purge()` (documented limitation; not a hot-path requirement)
- Changes to `service_role` call-site allowlist (governed by existing `AGENTS.md` rule 3)
- Frontend tenant isolation tests (tracked separately as issue #1542)
- Dependency vulnerability remediation (separate security track)
