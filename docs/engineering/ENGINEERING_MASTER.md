# ValueOS Engineering: Master Context

**Version:** 1.0.0
**Last Updated:** 2026-01-28
**Status:** Authoritative Engineering Source

---

## 1. Engineering Philosophy
ValueOS engineering emphasizes **Anti-Fragility**, **Deterministic Reasoning**, and **Production-Grade Observability**. We follow a "Logic Plane over Storage Plane" design, ensuring that AI intelligence is grounded in a structured memory substrate.

### Three-Layer Truth Framework
1.  **Metric Truth (Reality Check)**: Statistical constraints and plausibility bounds to prevent hallucinated numbers.
2.  **Structural Truth (Logic Check)**: KPI dependencies and formula definitions (Economic Structure Graph).
3.  **Causal Truth (Impact Check)**: Action-KPI elasticities and uplift distributions (Causal Reasoning Graph).

---

## 2. API & Database Architecture
ValueOS implements an **API-first, multi-tenant architecture** with event-driven capabilities.

### Core API Patterns
- **Lifecycle Orchestration**: `/v1/lifecycle/runs` triggers multi-agent workflows.
- **Telemetry Ingestion**: `/v1/telemetry/events` captures realization data.
- **Secure Access**: Bearer token auth with scope-based permissions (`lifecycle:trigger`, `telemetry:write`).

### Database Strategy (Supabase/Postgres)
- **Tenant Isolation**: Enforced via Row-Level Security (RLS) on all tables.
- **Vector Intelligence**: `pgvector` for hybrid search (Vector + FTS) and semantic memory.
- **Auditability**: `agent_executions` and `vos_audit_logs` provide a complete reasoning trace (VMRT).

---

## 3. Production Readiness & DX
We maintain high standards for deployment and developer experience:
- **Unified Config**: Zod-validated runtime configuration (`window.__CONFIG__`).
- **Migration Safety**: Automated rollback testing and RLS verification in CI/CD.
- **Observability Stack**: OpenTelemetry, Jaeger (Tracing), Prometheus (Metrics), and Loki (Logs).
- **Caddy Edge**: Production-ready reverse proxy with automatic HTTPS and custom domain support.

---

## 4. Sub-Contexts & Specialized Docs
Detailed engineering guides are consolidated into the following specialized documents:

1.  **[API & Service Architecture](./api-services.md)**: External endpoints, internal service classes, and event-driven patterns (Kafka/Saga).
2.  **[Database & Data Modeling](./database-modeling.md)**: Schema design, RLS policies, vector search, and encryption.
3.  **[Observability & Monitoring](./observability-monitoring.md)**: OpenTelemetry instrumentation, Grafana dashboards, and alerting rules.
4.  **[Production Readiness & DX](./production-dx.md)**: Configuration management, migration safety, and Caddy implementation.

---

## 5. Technical Debt & Quality Gates
- **Quality Gates**: 80% code coverage, automated security scanning, and performance benchmarks.
- **Debt Management**: Systematic refactoring of large files (e.g., `ChatCanvasLayout.tsx`) and consolidation of fragmented configurations.

---
**Maintainer:** Engineering Team
**Related:** `docs/context/MASTER_CONTEXT.md`, `docs/architecture/overview.md`
