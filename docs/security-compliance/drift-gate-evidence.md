# Architecture Drift Gate Evidence

**Script:** `scripts/ci/check-architecture-doc-drift.mjs`  
**Last verified:** 2026-03-26  
**Last passing commit:** `595d165c0` (security: deep-history scanning, PSA+Kyverno, readiness/drift CI gates)  
**Result:** PASS — 0 failures, 0 warnings

---

## What the gate checks

The script verifies that runtime code matches architecture documentation claims in `docs/AGENTS.md`:

### A. Eventing stack claims
- `MessageBus` source file exists at the claimed path
- `MessageBus` implements CloudEvents-style envelope (`trace_id`, `event_type`)
- `MessageBus` enforces `tenant_id`/`organization_id` on messages
- BullMQ is declared in `packages/backend/package.json`
- BullMQ worker files exist in `packages/backend/src/workers/`
- `MeteringQueue.ts` references NATS JetStream
- NATS JetStream K8s manifest exists
- `kustomization.yaml` references `redis-streams.yaml`

### B. Deployment claims — named entities
- All 11 agents exist: `OpportunityAgent`, `TargetAgent`, `FinancialModelingAgent`, `IntegrityAgent`, `RealizationAgent`, `ExpansionAgent`, `NarrativeAgent`, `ComplianceAuditorAgent`, and 3 others
- Runtime services exist: `DecisionRouter`, `ExecutionRuntime`, `PolicyEngine`, `ContextStore`, `ArtifactComposer`, `RecommendationEngine`
- `MessageBus` at claimed path
- Docker images have corresponding Dockerfiles
- Agent count is consistent

---

## CI enforcement

The gate runs in:
- `main-verify.yml` → `critical-workflows-gate` job
- `pr-fast.yml` → `security-gate` job

It is also listed in `scripts/ci/release-gate-manifest.json` as a required gate.

---

## Re-verification procedure

Run locally before any production promotion:

```bash
node scripts/ci/check-architecture-doc-drift.mjs
```

Expected output: `Architecture drift gate: PASS (0 failures, 0 warnings)`

Update this document with the new commit SHA and date after each verification.
