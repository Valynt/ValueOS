# Indexing Strategy & Query Optimization (Multi-Tenant SaaS)

## Tables & Key Columns

| Table | Tenant Key | Primary Key | Frequently Queried Columns | Notes |
| --- | --- | --- | --- | --- |
| organizations | id | id | name, slug, tier | Tenant root. |
| users | organization_id | id | email, status, role, created_at | Tenant-scoped users. |
| api_keys | organization_id | id | user_id, key_hash, created_at | Service-to-service auth. |
| audit_logs | organization_id | id | created_at, action, resource_type, resource_id | High-volume, append-only. |
| cases | organization_id | id | status, priority, created_at, updated_at, user_id, title | Core workflow records. |
| workflows | organization_id | id | name, is_active, updated_at | Versioned definitions. |
| workflow_states | organization_id | id | workflow_id, case_id, status, started_at | Execution history. |
| shared_artifacts | organization_id | id | case_id, artifact_type, created_at, created_by | Shared artifacts. |
| agents | organization_id | id | name, agent_type, is_active | Agent registry. |
| agent_runs | organization_id | id | agent_id, user_id, status, created_at | High-volume execution events. |
| agent_memory | organization_id | id | agent_id, created_at | Vector search + metadata. |
| models | organization_id | id | name, status, created_at | Business value models. |
| kpis | organization_id | id | model_id, category | KPI definitions. |

## Access Patterns & Index Strategy

### 1) List recent events by tenant (audit logs, agent runs)
**Pattern**: `WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?` with cursor pagination.

**Indexes**
- `idx_audit_logs_org_created_id` → `(organization_id, created_at DESC, id DESC)`
- `idx_agent_runs_org_status_created_id` → `(organization_id, status, created_at DESC, id DESC)`

**Rationale**
- `organization_id` is the leading key to support tenant isolation.
- `created_at DESC` enables index-only, ordered retrieval.
- `id DESC` is a tie-breaker for stable cursor pagination.

### 2) Search cases/models/workflows by name/title
**Pattern**: keyword search, partial matches, or FTS ranking.

**Indexes**
- Trigram: `idx_cases_title_trgm`, `idx_models_name_trgm`, `idx_workflows_name_trgm`
- FTS: `idx_cases_fts`, `idx_models_fts`

**Rationale**
- Trigram indexes serve `ILIKE`/fuzzy matching for partial strings.
- FTS indexes serve ranked full-text search for long-form fields.

### 3) Filter by status + updated_at (tenant-scoped)
**Pattern**: `WHERE organization_id = ? AND status = ? ORDER BY updated_at DESC`.

**Index**
- `idx_cases_org_status_updated_id` → `(organization_id, status, updated_at DESC, id DESC)`

**Rationale**
- `status` is low-cardinality; combined with `organization_id` and a time column it is selective.
- Supports high-frequency filters and cursor pagination.

### 4) Join to users (tenant-scoped lookups)
**Pattern**: `JOIN users ON cases.user_id = users.id` with tenant filter.

**Existing Indexes**
- `idx_cases_user` → `(organization_id, user_id, created_at DESC)`
- `idx_users_org_email` → `(organization_id, email)`

**Rationale**
- `organization_id` ensures tenant-local lookups.
- Joins can remain efficient with composite tenant keys.

### 5) Filter on JSONB metadata/config
**Pattern**: `WHERE metadata ->> 'source' = 'api'` or `definition @> '{...}'`.

**Indexes**
- `idx_cases_metadata_gin`
- `idx_workflows_definition_gin`
- `idx_agents_config_gin`
- `idx_shared_artifacts_content_gin`

**Rationale**
- GIN indexes are essential for JSONB containment and key/value lookups.

## High- vs. Low-Cardinality Columns

| Column | Cardinality | Guidance |
| --- | --- | --- |
| organization_id | High | Always lead composite indexes for tenant isolation. |
| id (UUID) | High | Good tie-breaker for cursor pagination. |
| created_at / updated_at | High | Use for ordering and time-window filters. |
| status / role / is_active | Low | Only index when combined with tenant + time. |
| agent_type / artifact_type | Medium | Add to composite indexes when frequently filtered. |
| resource_type | Medium | Consider composite with organization_id when filtered. |

## Avoiding Slow OFFSET Pagination

**Do not** use:
```sql
SELECT *
FROM audit_logs
WHERE organization_id = $1
ORDER BY created_at DESC
OFFSET 1000 LIMIT 50;
```

**Use cursor pagination instead**:
```sql
SELECT *
FROM audit_logs
WHERE organization_id = $1
  AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

**Benefits**: stable performance at high offsets, avoids full scan/skip costs.

## Example Optimized Queries

### Recent audit activity for a tenant
```sql
SELECT id, action, resource_type, resource_id, created_at
FROM audit_logs
WHERE organization_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 100;
```

### Search cases by title (fuzzy)
```sql
SELECT id, title, status, updated_at
FROM cases
WHERE organization_id = $1
  AND lower(title) ILIKE lower($2 || '%')
ORDER BY updated_at DESC, id DESC
LIMIT 50;
```

### Full-text search cases
```sql
SELECT id, title, ts_rank_cd(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')),
  plainto_tsquery('english', $2)
) AS rank
FROM cases
WHERE organization_id = $1
  AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
      @@ plainto_tsquery('english', $2)
ORDER BY rank DESC, updated_at DESC
LIMIT 50;
```

### Filter by status + updated_at with cursor
```sql
SELECT id, title, status, updated_at
FROM cases
WHERE organization_id = $1
  AND status = $2
  AND (updated_at, id) < ($3, $4)
ORDER BY updated_at DESC, id DESC
LIMIT 50;
```

### JSONB filter on workflow definition
```sql
SELECT id, name, updated_at
FROM workflows
WHERE organization_id = $1
  AND definition @> $2::jsonb
ORDER BY updated_at DESC, id DESC
LIMIT 25;
```

## EXPLAIN / ANALYZE Guidance

When validating queries:
- **Look for Index Scan / Index Only Scan** on the composite tenant index.
- **Avoid Seq Scan** on high-volume tables unless filtering is highly selective.
- **Check actual vs. estimated rows**; large mismatches often indicate stale stats.
- **Watch for Sort nodes**; if present on `(created_at, id)`, consider missing DESC index.
- **Confirm filter recheck**: for GIN indexes, expect `Bitmap Index Scan + Bitmap Heap Scan`.

Recommended workflow:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...
```
- Ensure the **index condition includes organization_id**.
- Check **buffer hits** for read-heavy queries.
- Validate query stability with different cursor positions.

## Migration Reference

The index changes are codified in:
- `scripts/migrations/002_indexing_strategy.sql`
