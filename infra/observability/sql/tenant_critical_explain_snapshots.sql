-- Tenant-critical query plan snapshots.
-- Run in lower environment first and remove ANALYZE in production peak windows if needed.

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM workflow_states
WHERE tenant_id = :'tenant_id'
  AND status = ANY(ARRAY['running', 'queued'])
ORDER BY started_at DESC, id DESC
LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, status, created_at
FROM agent_runs
WHERE tenant_id = :'tenant_id'
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, case_id, created_at
FROM shared_artifacts
WHERE tenant_id = :'tenant_id'
  AND case_id = :'case_id'
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, session_id, importance
FROM public.search_agent_fabric_memories(
  :'organization_id'::uuid,
  'workflow_result',
  :'agent_type',
  :'agent_memory_type',
  :'session_id',
  false,
  :'min_importance'::double precision,
  :'limit'::integer
);
