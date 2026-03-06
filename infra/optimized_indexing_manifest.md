# Optimized Indexing Manifest (2026-02-08)

## Composite Indexes (Tenant-First)

### High-Volume Tables

- `llm_usage`: `(tenant_id, created_at)`
- `user_sessions`: `(tenant_id, user_id)`
- `transactions`: `(tenant_id, created_at)`
- `usage_aggregates`: `(tenant_id, period_start DESC, metric)`
- `usage_alerts`: `(tenant_id, created_at DESC, metric, alert_type)`
- `audit_logs`: `(organization_id, action, created_at DESC)`
- `security_audit_events`: `(tenant_id, action, timestamp DESC)`
- `agent_runs`: `(tenant_id, status, created_at DESC, id DESC)`
- `workflow_states`: `(tenant_id, status, started_at DESC, id DESC)`
- `cases`: `(tenant_id, status, updated_at DESC, id DESC)`
- `shared_artifacts`: `(tenant_id, case_id, created_at DESC)`
- `initiatives`: `(tenant_id, created_at DESC)`
- `memory_benchmark_versions`: `(tenant_id)`
- `memory_benchmark_slices`: `(tenant_id)`
- `memory_benchmark_run_locks`: `(tenant_id)`
- `memory_model_run_evidence`: `(tenant_id)`

## Vector Indexes (PGVector)

- `memory_artifact_chunks.embedding`: `USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`
- `memory_entities.embedding`: `USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`
- `memory_facts.embedding`: `USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`

## Full-Text & JSONB Indexes

- GIN on FTS columns for all semantic/memory tables
- GIN on metadata for docs_embeddings, cases, workflows, agents, shared_artifacts

## RLS

- All tenant/organization-scoped tables have RLS enabled and enforced

---

**See migrations in `infra/supabase/migrations/` for full DDL.**

## Index Maintenance Playbook (Operational Cadence)

### Bloat & Health Checks

- **Daily**: `pg_stat_user_tables` dead tuple ratio review for tenant-critical tables (`workflow_states`, `agent_runs`, `shared_artifacts`, `cases`).
- **Daily**: `pg_stat_user_indexes` scan-vs-size review to identify unused/overgrown indexes.
- **Weekly**: capture top query fingerprints and verify index utility against `total_exec_time` leaders.

### Maintenance Cadence

- **Weekly (low traffic window)**: `VACUUM (ANALYZE)` on high-churn tenant tables.
- **Monthly**: `REINDEX CONCURRENTLY` for indexes with sustained bloat > 20%.
- **After major migrations**: mandatory `EXPLAIN (ANALYZE, BUFFERS)` comparison against baselines in `docs/operations/query-plan-baselines.md`.

### Triggered Remediation

- If query fingerprint mean latency regresses > 25% from baseline, run targeted `ANALYZE`, then reassess.
- If dead tuple percentage remains > 20% post-vacuum, schedule `REINDEX CONCURRENTLY` and follow up with baseline replay.
