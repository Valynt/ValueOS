# Engineering: Database & Data Modeling

## 1. Schema Design
ValueOS uses a multi-tenant PostgreSQL schema optimized for AI and financial modeling.

### Core Tables
- **Identity**: `users`, `organizations`, `tenants`.
- **Business**: `value_cases`, `opportunities`, `value_drivers`.
- **AI/Audit**: `agent_executions`, `agent_memory`, `vos_audit_logs`.
- **Infrastructure**: `custom_domains`, `encrypted_settings`.

## 2. Row-Level Security (RLS)
RLS is the primary mechanism for tenant isolation.
```sql
CREATE POLICY tenant_isolation ON value_cases
FOR ALL USING (organization_id = current_setting('request.jwt.claims')::jsonb ->> 'organization_id');
```

## 3. Vector Intelligence
We use `pgvector` for semantic search and memory retrieval.
- **Dimensions**: 1536 (OpenAI/Modern standard).
- **Search**: `find_similar_documents` function for hybrid (Vector + FTS) retrieval.
- **Indexing**: HNSW indexes for low-latency similarity search.

## 4. Security & Encryption
- **At Rest**: AES-256 encryption for sensitive settings.
- **In Transit**: TLS 1.3 for all database connections.
- **Functions**: `encrypt_value` and `decrypt_value` using `pgcrypto`.

---
**Last Updated:** 2026-01-28
**Related:** `docs/engineering/ENGINEERING_MASTER.md`, `supabase/migrations/`
