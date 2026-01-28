# Data & Infrastructure Context

## 1. Database Schema (Supabase/Postgres)

ValueOS uses PostgreSQL 15.8 with Row-Level Security (RLS).

### Core Tables

- `tenants`: Organization isolation.
- `users`: Profiles and roles (`admin`, `manager`, `user`, `viewer`).
- `value_cases`: The central "Deal" entity.
- `opportunities`: Pain points and objectives.
- `value_drivers`: Capability-to-outcome mappings.
- `financial_models`: ROI/NPV projections.
- `agent_executions`: Audit logs of all AI actions.
- `agent_memory`: Vector-enabled persistent memory (`pgvector`).

### Row-Level Security (RLS)

Tenant isolation is enforced at the database level. Every query is scoped by a cryptographic `tenant_id` from the user's JWT.

```sql
CREATE POLICY tenant_isolation ON value_cases
  FOR ALL USING (tenant_id = auth.uid_tenant_id());
```

## 2. Ground Truth Benchmark Layer

A tiered data hierarchy ensures zero-hallucination:

- **Tier 1 (Authoritative):** SEC EDGAR, XBRL (Confidence 0.95-1.0).
- **Tier 2 (High-Confidence):** Crunchbase, Census, BLS (Confidence 0.5-0.85).
- **Tier 3 (Contextual):** Industry reports, market trends (Confidence 0.2-0.6).

## 3. Infrastructure & DevContainer

- **Vite Host Binding:** Must use `0.0.0.0` for Docker port forwarding.
- **Port Mapping:** 5173 (Vite), 54321 (Supabase), 16686 (Jaeger).
- **Self-Healing:** `.devcontainer/health-check.sh` and `auto-restart.sh` monitor service availability.
- **Performance:** Async font loading and code splitting reduce Time-to-Interactive by ~97%.

---

**Last Updated:** 2026-01-28
**Related:** `supabase/migrations/`, `vite.config.ts`, `.devcontainer/`
