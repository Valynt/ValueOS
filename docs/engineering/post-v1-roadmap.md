---
title: Post-v1 Roadmap
status: draft
owner: engineering
last_updated: 2026-03-26
---

# Post-v1 Roadmap

Items deferred from v1.0 GA. Sequenced by dependency and business value.
Each item links to the debt entry or GitHub issue where it was first tracked.

---

## P1 — Next release (v1.1)

### Census Bureau API integration (`IndustryBenchmarkModule`)

`apps/ValyntApp/src/mcp-ground-truth/modules/IndustryBenchmarkModule.ts`

Replace the `getCensusBenchmark` stub with a real call to the Census Bureau API
(`https://api.census.gov/data/{year}/cbp`). Requires `CENSUS_API_KEY` env var.
Provides live revenue, establishment count, and payroll benchmarks by NAICS code.

Acceptance: `getCensusBenchmark` returns real data for at least 5 NAICS codes;
static fallback still works when key is absent.

---

### BLS wage data integration (`IndustryBenchmarkModule`)

`apps/ValyntApp/src/mcp-ground-truth/modules/IndustryBenchmarkModule.ts`

Replace the `getBLSWageData` stub with a real call to the BLS Public Data API v2
(`https://api.bls.gov/publicAPI/v2/timeseries/data/`). Requires `BLS_API_KEY`.
Provides occupation wage percentiles by SOC code and metro area.

Acceptance: `getBLSWageData` returns real percentile data for at least 3 SOC codes.

---

### LLM cache warming integration

`packages/backend/src/services/llm/LLMCache.ts`

`warmCache` now accepts an `llmCaller` callback. Wire it to a startup job that
pre-warms common system prompts (e.g. agent preambles, domain pack summaries)
using a system-level tenant context. Reduces cold-start latency for the first
agent invocation after a deployment.

Acceptance: startup log shows `Cache warm complete` with `warmed > 0` on a fresh
Redis instance.

---

### OpenAPI spec — remaining undocumented routes

`packages/backend/openapi.yaml`

Canonical OpenAPI contract location (authoritative spec for docs, tooling, and CI).

Routes added in v1.0 but not yet fully specified with request/response schemas:
- `POST /api/v1/value-commitments/:id/milestones`
- `POST /api/v1/value-commitments/:id/metrics`
- `POST /api/v1/value-commitments/:id/risks`
- `GET /api/compliance/evidence`
- `GET /api/onboarding`
- `GET /api/v1/domain-packs`

---

## P2 — v1.2 and beyond

### HPA scale-down window tuning

`infra/k8s/base/worker-hpa.yaml`

`stabilizationWindowSeconds: 300` is conservative. After load-test baselines
confirm p99 BullMQ job duration, reduce to `120` if p99 < 60s.
See `docs/operations/load-test-baselines.md` for the measurement process.

---

### pgvector migration for `MemorySystem`

`packages/backend/src/lib/agent-fabric/MemorySystem.ts`

Current in-process `MemorySystem` is documented as a placeholder for pgvector.
Migration path: `packages/memory/` already has `SupabaseSemanticStore` backed by
the `semantic_memory` table. Wire `MemorySystem` to use `SupabaseSemanticStore`
as its persistence layer and remove the in-process store.

---

### Multi-provider LLM support

`packages/backend/src/lib/agent-fabric/LLMGateway.ts`

`openai`, `anthropic`, `gemini`, and `custom` provider branches currently throw
`'Provider not implemented'`. Implement at least one additional provider
(Anthropic recommended for fallback diversity) to reduce single-provider risk.

---

### TypeScript `any` elimination — frontend and SDUI

`apps/ValyntApp/src` (249 usages), `packages/sdui/src` (175 usages)

Reduce to < 100 across both packages. Ceiling enforcement is in CI via
`scripts/check-any-count.sh`. Reduce ceilings in that script as debt is paid down.

---

### VOSAcademy `any` elimination

`apps/VOSAcademy` (99 usages)

Deferred post-GA. Target < 50 before v1.2.

---

## Intentionally out of scope (no current plan)

| Item | Reason |
|---|---|
| Kafka integration | Optional; NATS covers current messaging needs |
| Multi-region deployment | Requires sharding trigger (50M rows / tenant) not yet reached |
| Mobile app | Not in product roadmap |
