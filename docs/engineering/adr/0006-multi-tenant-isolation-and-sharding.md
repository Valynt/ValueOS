# ADR 0006: Multi-Tenant Data Isolation and Sharding Strategy

- **Status:** Accepted
- **Date:** 2026-03-06
- **Scope:** Production tenancy model, tenant isolation guarantees, and scale-out strategy for data persistence and retrieval
- **Supersedes:** N/A

## Context

ValueOS is a multi-tenant platform that must maintain strict tenant isolation while supporting sustained growth in workload volume, data size, and query concurrency. Existing architecture emphasizes RLS and tenant-scoped query filters, but we need an explicit, durable decision that defines:

1. the canonical tenancy model to operate today,
2. the isolation guarantees and non-negotiable constraints,
3. when and how we transition to a more distributed tenancy strategy,
4. how migration is executed without cross-tenant data exposure.

The decision must align with current compliance and safety expectations: no cross-tenant data transfer, mandatory `organization_id`/`tenant_id` filters, and tenant-scoped memory/vector retrieval.

## Decision

### 1. Chosen tenancy model

**Adopt a shared-schema, shared-database multi-tenant model as the default and current production strategy.**

- Tenant-owned tables include `organization_id` (or `tenant_id`) as a required partitioning key.
- Row-Level Security (RLS) policies enforce tenant isolation in the database layer.
- Application and service queries are required to include tenant predicates even when RLS is present (defense in depth).
- Vector and memory retrieval flows must include tenant metadata constraints (`tenant_id`) in every query.

### 2. Rationale, constraints, and isolation guarantees

#### Rationale

- **Operational simplicity:** shared schema minimizes migration and deployment complexity at current scale.
- **Feature velocity:** one schema evolution path reduces drift risk and accelerates rollout.
- **Cost efficiency:** avoids early operational overhead of per-tenant schema/database management.
- **Strong isolation with existing controls:** RLS + request context + query linting/test gates provide robust tenant boundaries.

#### Constraints

- Every tenant-scoped table must maintain and index `organization_id`/`tenant_id`.
- RLS is mandatory on tenant data tables before launch readiness sign-off.
- `service_role` use remains restricted to narrowly scoped platform operations.
- No cross-tenant copy/export/move flows are permitted in application logic.
- Auditability is required for sensitive state mutations and export-like actions.

#### Isolation guarantees

With controls correctly configured and continuously validated:

- tenant A cannot read, update, or delete tenant B rows,
- vector/memory retrieval cannot return embeddings or memories from other tenants,
- cross-tenant access attempts fail launch chaos/smoke gates,
- bypass-capable operations are constrained and auditable.

### 3. Growth thresholds and sharding trigger conditions

Shared-schema remains the default until one or more trigger conditions are met consistently.

#### Observability window for triggering

A trigger condition must be met for **14 consecutive days** (or immediately for critical compliance incidents) before mandatory sharding planning begins.

#### Trigger conditions

Initiate sharding design and migration planning when any condition is true:

1. **Data volume concentration:**
   - any single tenant exceeds **1 TB** logical data size in primary transactional tables, or
   - top 1% tenants account for **>35%** of database storage or write IOPS.
2. **Performance isolation pressure:**
   - p95 query latency for tenant-scoped transactional endpoints exceeds **400 ms** for 14 days despite index/query remediation, or
   - noisy-neighbor behavior causes repeated SLO breaches attributable to a small tenant subset.
3. **Operational contention:**
   - sustained connection pool saturation above **80%** at peak for 14 days, or
   - maintenance/migration windows become blocked by tenant hotspot lock contention.
4. **Compliance or contractual drivers:**
   - contractual data residency/isolation requirements mandate stronger physical/logical partitioning than shared-schema can provide.

### 4. Migration path between strategies

If triggers are met, migrate progressively from shared-schema to sharded topology using a no-cross-tenant-leak path.

#### Target intermediate strategy

Adopt **tenant cohort sharding (shared schema per shard)** before considering schema-per-tenant.

- Partition tenants into shard cohorts (e.g., by geography, size tier, compliance profile).
- Keep a consistent schema across shards to preserve operational ergonomics.
- Route by tenant-to-shard mapping in control-plane metadata.

#### Migration phases

1. **Readiness and classification**
   - classify tenants by size, workload, and compliance constraints,
   - define shard map and routing table,
   - validate all tenant queries are route-aware and tenant-scoped.
2. **Dual-write and verification**
   - enable tenant-scoped dual writes for selected pilot tenants,
   - run row-count and checksum parity checks,
   - verify RLS and tenant predicates on destination shards.
3. **Read cutover (tenant by tenant)**
   - switch reads for pilot tenants via routing layer,
   - monitor latency/error/SLO deltas,
   - expand cutover cohorts after successful bake period.
4. **Write cutover and decommission**
   - complete write cutover,
   - keep rollback window with reversible routing,
   - decommission old tenant partitions only after parity and audit sign-off.

#### Rollback guarantees

- rollback occurs at tenant cohort granularity,
- routing metadata controls rollback without cross-tenant remapping,
- no data movement between tenant identities is permitted,
- audit logs record all cutover and rollback actions.

## Alternatives considered

1. **Schema-per-tenant from day one**
   - Rejected for now due to high operational overhead, migration complexity, and reduced feature rollout speed at current scale.
2. **Database-per-tenant from day one**
   - Rejected for now due to significant platform management burden and cost profile mismatch for early/mid growth phases.
3. **No explicit thresholds; decide ad hoc**
   - Rejected because it increases risk, delays planning, and makes scale transitions reactive rather than controlled.

## Consequences

### Positive

- Clear default tenancy posture with enforceable isolation invariants.
- Explicit scale triggers reduce ambiguity and improve capacity planning.
- Migration path reduces risk by using phased, tenant-aware cutovers.

### Negative

- Requires disciplined telemetry and threshold monitoring.
- Adds control-plane and routing complexity once sharding begins.
- Introduces temporary dual-write overhead during migration windows.

### Operational follow-ups

- Keep launch readiness checks for cross-tenant isolation as blocking gates.
- Review trigger metrics quarterly and during major customer growth events.
- Add implementation playbook for tenant cohort shard migration when first trigger is observed.
