-- Semantic-memory hot-path performance indexes.
--
-- Audit source: scripts/database-performance-optimization.sql (legacy ad-hoc
-- bundle).
--
-- Findings from the audit:
--   * The legacy script indexed a non-canonical memory_entries table rather
--     than the active semantic_memory table introduced in
--     20260322000000_persistent_memory_tables.sql.
--   * Current production services consistently begin with organization_id and
--     then filter by type, artifact identity, or tenant-context metadata.
--   * Existing single-column org/type/created indexes plus metadata GIN were
--     insufficient for the highest-volume list, cleanup, and summary paths.
--
-- This migration adds tenant-leading indexes for those canonical memory query
-- shapes while retaining the existing ANN and GIN support.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- semantic_memory: tenant timeline listing
-- Query shape:
--   WHERE organization_id = $1
--   ORDER BY created_at DESC
-- Services:
--   - packages/backend/src/lib/memory/SupabaseSemanticStore.ts
--   - packages/shared/src/lib/SemanticMemory.ts
--   - infra/supabase/supabase/migrations/20260326000000_semantic_memory_stats_rpc.sql
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_created_at
  ON public.semantic_memory (organization_id, created_at DESC);

COMMENT ON INDEX public.idx_semantic_memory_org_created_at IS
  'Tenant-scoped semantic memory timeline and stats lookups ordered by created_at DESC.';

-- ---------------------------------------------------------------------------
-- semantic_memory: tenant + type listing
-- Query shape:
--   WHERE organization_id = $1
--     AND type = $2
--   ORDER BY created_at DESC
-- Services:
--   - packages/backend/src/lib/memory/SupabaseSemanticStore.ts
--   - packages/shared/src/lib/SemanticMemory.ts
--   - packages/backend/src/lib/memory/SupabaseVectorStore.ts
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_created_at
  ON public.semantic_memory (organization_id, type, created_at DESC);

COMMENT ON INDEX public.idx_semantic_memory_org_type_created_at IS
  'Tenant-and-type semantic memory retrieval ordered by created_at DESC for semantic fact listings and typed memory recall.';

-- ---------------------------------------------------------------------------
-- semantic_memory: artifact chunk cleanup
-- Query shape:
--   WHERE organization_id = $1
--     AND metadata->>''artifact_id'' = $2
-- Services:
--   - packages/backend/src/lib/memory/SupabaseVectorStore.ts
-- Notes:
--   Partial expression index keeps the working set small while preserving the
--   tenant-leading predicate.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_artifact_id
  ON public.semantic_memory (organization_id, ((metadata ->> 'artifact_id')))
  WHERE metadata ? 'artifact_id';

COMMENT ON INDEX public.idx_semantic_memory_org_artifact_id IS
  'Tenant-scoped semantic chunk cleanup by metadata.artifact_id, used by SupabaseVectorStore.deleteByArtifactId.';

-- ---------------------------------------------------------------------------
-- semantic_memory: tenant context summaries
-- Query shape:
--   WHERE organization_id = $1
--     AND metadata @> ''{"context_type":"tenant_context"}''
--   ORDER BY created_at DESC
--   LIMIT 20
-- Services:
--   - packages/backend/src/services/tenant/TenantContextIngestionService.ts
-- Notes:
--   The metadata GIN index handles containment, while this partial tenant-first
--   btree covers the ordered top-N summary path.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_tenant_context_created_at
  ON public.semantic_memory (organization_id, created_at DESC)
  WHERE metadata @> '{"context_type":"tenant_context"}'::jsonb;

COMMENT ON INDEX public.idx_semantic_memory_org_tenant_context_created_at IS
  'TenantContextIngestionService summary/cleanup path for tenant_context rows ordered by created_at DESC.';
