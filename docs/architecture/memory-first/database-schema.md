# Memory-First: Database & SQL Schema

## 1. Core Identity & Isolation

ValueOS uses a multi-tenant schema where every table is scoped by a `tenant_id`.

```sql
-- Tenant Isolation Helper
create or replace function public.get_tenant_id()
returns uuid language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;
```

## 2. Storage Layer Tables

- **`tenants`**: Corporate entity isolation.
- **`profiles`**: User roles (`admin`, `editor`, `viewer`, `guest`).
- **`value_cases`**: Deal containers with Full-Text Search (FTS).
- **`artifact_chunks`**: Vectorized segments (`vector(1536)`).
- **`entities` & `entity_edges`**: The Semantic Knowledge Graph.
- **`facts` & `fact_evidence`**: The Declarative Truth layer with provenance.
- **`model_runs`**: Computational audit logs.
- **`narratives`**: AI-generated reports.

## 3. Performance Indexing

### HNSW Vector Indexes

Optimized for cosine similarity search:

```sql
create index idx_artifact_chunks_embedding on public.artifact_chunks
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);
```

### GIN Full-Text Search Indexes

```sql
create index idx_artifact_chunks_fts on public.artifact_chunks using gin(fts);
```

## 4. Hybrid Search Utility

The `hybrid_search_chunks` function combines Vector similarity and BM25/FTS ranking:

```sql
-- Returns combined_score = (similarity * semantic_weight) + (fts_rank * full_text_weight)
```

## 5. Row-Level Security (RLS)

RLS is enabled on all tables. The default policy ensures that users can only access data belonging to their `tenant_id` or resources explicitly shared via `access_grants`.

---

**Last Updated:** 2026-01-28
**Related:** `ValueOS Memory-First Architecture Migration SQL Schema.md`
