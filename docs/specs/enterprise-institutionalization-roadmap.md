# Spec: Enterprise Institutionalization Roadmap — Phases 1–3

## Problem Statement

ValueOS has security and compliance intent documented across multiple files but lacks enforceable, testable controls. Specifically:

1. **Identity gap**: SPIRE/SPIFFE manifests exist in `infra/k8s/security/` but only cover a generic `backend` workload and a catch-all `agent` selector — no per-agent workload identities are registered.
2. **Authorization gap**: Istio `AuthorizationPolicy` exists for 5 lifecycle agents but there is no global deny-by-default policy; unregistered communication paths are implicitly allowed.
3. **Control crosswalk gap**: SOC 2 and FedRAMP mappings exist but no SOC 2 TSC ↔ ISO 27001:2022 Annex A crosswalk with per-control ownership, evidence source, and test cadence.
4. **CI gate gap**: No CI enforcement prevents production promotion of changes that lack evidence mapping.
5. **Evidence architecture gap**: Hash-chained `audit_logs` exist in Supabase but no immutable schema spec, retention policy, or trusted timestamp strategy is defined.
6. **Observability gap**: No continuous compliance posture engine, no drift detection, no customer-facing live control status.
7. **Resilience gap**: No chaos program, no tenant-isolation adversarial tests, no billing bypass detection tests.

---

## Scope

All three phases are in scope. Phase 1 is fully detailed. Phases 2 and 3 are specified with enough detail to implement sequentially.

**In scope:**
- Infra + config: SPIRE registrations, Istio deny-by-default, K8s manifests, CI gates
- App code: backend middleware, `ComplianceJanitorAgent`, Trust Portal API + `/trust` route in ValyntApp
- Docs: SOC 2 ↔ ISO 27001 crosswalk, evidence schema, retention policy, chaos runbooks

**Out of scope:**
- SPIFFE IDs for agents not yet deployed as named runtime workloads
- `GroundTruthAnalyzer` workload identity (internal library, not an independent execution principal)
- FedRAMP authorization package submission
- HSM hardware procurement

---

## Phase 1 — Foundations & Control Architecture

**Objective:** Turn security/compliance intent into enforceable, testable controls. Establish identity, authorization, and evidence architecture.

---

### Workstream 1: Control Crosswalk + Ownership

#### Requirements

**R1.1 — SOC 2 TSC ↔ ISO 27001:2022 Annex A crosswalk**

Create `docs/security-compliance/soc2-iso27001-crosswalk.md` mapping every SOC 2 Trust Services Criteria to its ISO 27001:2022 Annex A counterpart(s). Seed from existing `control-traceability-matrix.md` and `fedramp-control-mapping.md`. Each row must include:

| Field | Description |
|---|---|
| `soc2_control_id` | e.g. `CC6.1` |
| `iso_control_id` | e.g. `A.8.3` |
| `control_title` | Human-readable label |
| `control_owner` | Role: Security Architect / Platform Lead / Compliance Lead / SRE Lead |
| `evidence_source` | File path or service that produces evidence |
| `test_cadence` | `continuous` / `weekly` / `monthly` / `quarterly` |
| `automated` | `true` if evidence is produced by CI |

**R1.2 — Machine-readable control registry**

Create `docs/security-compliance/control-registry.json` — a JSON array where each entry mirrors the crosswalk row plus a `status` field (`mapped` | `unmapped` | `exception`). This file is the source of truth for CI gate evaluation.

**R1.3 — CI gate: path-sensitive PR blocking**

Add a CI check (new `control-coverage.yml` or extend `pr-fast.yml`) that:
- Reads `control-registry.json`
- Fails if any control with `automated: true` has `status: unmapped`
- Scopes blocking to PRs touching governed paths:
  - `packages/backend/src/lib/agent-fabric/`
  - `packages/backend/src/services/security/`
  - `packages/backend/src/services/auth/`
  - `packages/backend/src/middleware/`
  - `infra/k8s/security/`
  - `infra/supabase/supabase/migrations/`
  - `docs/security-compliance/`

**R1.4 — CI gate: deploy-time revalidation**

In `.github/workflows/deploy.yml`, add a `control-coverage-gate` step that re-reads `control-registry.json` and blocks promotion if any governed control is `unmapped`. Runs after build, before deploy.

**R1.5 — Exception process**

Extend `docs/security-compliance/audit-exceptions-policy.md` with the override procedure. Overrides require: explicit justification, approver, expiry date. Override records written to `control-registry.json` as `status: exception`.

---

### Workstream 2: Agent Identity Baseline

#### Requirements

**R2.1 — SPIFFE namespace design**

Trust domain: `valueos.internal`

Namespace shape:
```
spiffe://valueos.internal/ns/{k8s-namespace}/agents/{agent-slug}
spiffe://valueos.internal/ns/{k8s-namespace}/services/{service-slug}
spiffe://valueos.internal/ns/{k8s-namespace}/workers/{worker-slug}
```

Agent slugs for the 11 currently deployed agents:

| Agent class | SPIFFE ID |
|---|---|
| OpportunityAgent | `spiffe://valueos.internal/ns/valynt/agents/opportunity` |
| TargetAgent | `spiffe://valueos.internal/ns/valynt/agents/target` |
| FinancialModelingAgent | `spiffe://valueos.internal/ns/valynt/agents/financial-modeling` |
| IntegrityAgent | `spiffe://valueos.internal/ns/valynt/agents/integrity` |
| RealizationAgent | `spiffe://valueos.internal/ns/valynt/agents/realization` |
| ExpansionAgent | `spiffe://valueos.internal/ns/valynt/agents/expansion` |
| NarrativeAgent | `spiffe://valueos.internal/ns/valynt/agents/narrative` |
| ComplianceAuditorAgent | `spiffe://valueos.internal/ns/valynt/agents/compliance-auditor` |
| ContextExtractionAgent | `spiffe://valueos.internal/ns/valynt/agents/context-extraction` |
| DealAssemblyAgent | `spiffe://valueos.internal/ns/valynt/agents/deal-assembly` |
| DiscoveryAgent | `spiffe://valueos.internal/ns/valynt/agents/discovery` |

Future agents are added to this table when they become named runtime workloads with clear trust boundaries. No placeholder registrations.

Runtime service slugs: `backend-api`, `decision-router`, `execution-runtime`, `policy-engine`, `context-store`, `artifact-composer`, `recommendation-engine`.

**R2.2 — SPIRE server + agent manifests**

Extend `infra/k8s/security/spire-server.yaml` and `spire-agent.yaml`:
- Set trust domain to `valueos.internal`
- Configure node attestation via `k8s_sat` (Kubernetes Service Account Token)
- Enable workload API socket at `/run/spire/sockets/agent.sock`

**R2.3 — Per-agent ClusterSPIFFEID registrations**

Replace the generic `core-agent-workloads` `ClusterSPIFFEID` in `infra/k8s/security/spire-workload-registrations.yaml` with one `ClusterSPIFFEID` per agent, each with:
- Explicit `podSelector.matchLabels` using `app.kubernetes.io/name: {agent-slug}-agent`
- `spiffeIDTemplate` resolving to the canonical namespace shape
- Dedicated Kubernetes `ServiceAccount` per agent

**R2.4 — mTLS default-on**

In `infra/k8s/security/mesh-authentication.yaml`, add a `PeerAuthentication` policy in `STRICT` mode for the `valynt-agents` namespace. No plaintext fallback.

**R2.5 — serviceIdentityMiddleware**

Create or extend `packages/backend/src/middleware/serviceIdentityMiddleware.ts`:
- Extract SPIFFE ID from the `x-spiffe-id` header or mTLS peer certificate
- Validate against the registered agent slug allowlist
- Attach `req.serviceIdentity: { spiffeId, agentSlug, namespace }` to the request
- Reject `403` if SPIFFE ID is absent or unrecognized on protected internal routes

**R2.6 — Identity contract document**

Create `docs/security-compliance/agent-identity-contract.md` documenting:
- Trust domain and namespace shape
- Per-agent SPIFFE ID table
- mTLS enforcement policy
- Process for registering new agents (required PR checklist items)

---

### Workstream 3: Authorization Contract

#### Requirements

**R3.1 — Global deny-by-default policy**

Add `infra/k8s/security/deny-by-default-policy.yaml` containing an Istio `AuthorizationPolicy` with `action: DENY` and no `rules` applied at namespace level to `valynt-agents`. Explicit ALLOW policies override it.

**R3.2 — Complete agent pairwise ALLOW policies**

Extend `infra/k8s/security/agent-pairwise-authorization-policies.yaml` to cover all 11 agents. Each policy must:
- Use SPIFFE ID principals (not just service account names)
- Declare only the edges present in `agent-communication-graph.yaml`
- Include the backend orchestrator as an allowed initiator for all agents

**R3.3 — Tenant-scoped claim model**

Define the authorization claim schema in `docs/security-compliance/authorization-claim-model.md`:

```typescript
interface AuthorizationClaim {
  subject: string;       // SPIFFE ID of the calling workload
  tenant_id: string;     // Organization/tenant UUID
  action: string;        // e.g. "agent:invoke", "evidence:write", "audit:read"
  environment: string;   // "production" | "staging" | "dev"
  issued_at: number;     // Unix timestamp
  expires_at: number;
}
```

**R3.4 — Explicit handoff allowlist**

Create `docs/security-compliance/agent-handoff-allowlist.md` as the human-readable companion to `agent-communication-graph.yaml`. Every agent-to-agent handoff must list: source agent, destination agent, action, justification. This document is the approval record for policy changes.

**R3.5 — Non-prod enforcement first**

Apply deny-by-default + ALLOW policies to the staging overlay (`infra/k8s/overlays/staging/`) before production. Add a kustomize patch enabling strict enforcement in staging. Production overlay follows after Phase 1 exit criteria are met.

---

### Workstream 4: Evidence Architecture

#### Requirements

**R4.1 — Immutable evidence schema**

Create `docs/security-compliance/evidence-schema.md` defining the canonical schema for all compliance evidence records:

```typescript
interface EvidenceRecord {
  id: string;                    // UUID
  tenant_id: string;
  control_id: string;            // e.g. "CC6.1", "A.8.3"
  framework: "SOC2" | "ISO27001" | "FedRAMP" | "GDPR" | "ISO27001";
  event_type: string;
  payload: Record<string, unknown>;
  collected_at: string;          // ISO 8601
  collected_by: string;          // SPIFFE ID of the collecting workload
  previous_hash: string;         // SHA-256 of previous record in chain
  integrity_hash: string;        // SHA-256 of this record's canonical fields
  trusted_timestamp: string;     // RFC 3161 timestamp token (base64) or TSA URL
  legal_hold: boolean;
  retention_expires_at: string | null;
}
```

**R4.2 — Retention policy**

Create `docs/security-compliance/evidence-retention-policy.md`:

| Evidence class | Retention | Legal hold override |
|---|---|---|
| SOC 2 audit evidence | 7 years | Yes — indefinite |
| ISO 27001 control evidence | 3 years | Yes |
| Incident forensic bundles | 5 years | Yes |
| Routine telemetry | 90 days | No |
| Key rotation records | 7 years | Yes |

**R4.3 — Trusted timestamp strategy**

Document in `evidence-schema.md`: use RFC 3161 timestamps from a public TSA (e.g. Sectigo, DigiCert) for evidence records requiring legal defensibility. For high-volume routine records, use server-side `NOW()` with a periodic anchor record carrying a real RFC 3161 token.

**R4.4 — Hash-chain validation script**

Create `scripts/compliance/verify-evidence-chain.mjs` that:
- Reads a time-bounded set of `audit_logs` records
- Recomputes `integrity_hash` for each record
- Verifies `previous_hash` linkage
- Outputs pass/fail with the first broken link if any

---

### Phase 1 Exit Criteria

| Criterion | Verification |
|---|---|
| 100% production controls mapped to SOC 2 + ISO control IDs | `control-registry.json` has zero `unmapped` entries |
| 100% agents assigned unique workload identity | 11 `ClusterSPIFFEID` entries in `spire-workload-registrations.yaml`, one per agent |
| Deny-by-default enforced in non-prod | `PeerAuthentication STRICT` + deny-all `AuthorizationPolicy` applied to staging overlay |
| Evidence schema approved | `evidence-schema.md` and `evidence-retention-policy.md` merged to main |
| CI gates active | PR and deploy gates blocking on unmapped governed controls |

---

## Phase 2 — Enforcement, Telemetry, and Trust Portal

**Objective:** Move from "defined" to "enforced and observable." Build continuous compliance posture and customer-facing trust transparency.

---

### Workstream 5: Micro-Segmentation Enforcement

**R5.1** Promote deny-by-default + ALLOW policies from staging to production overlay.

**R5.2** Create `scripts/compliance/detect-policy-drift.mjs`:
- Queries live Istio `AuthorizationPolicy` resources via `kubectl`
- Diffs against declared `agent-pairwise-authorization-policies.yaml`
- Writes drift report to `compliance_control_evidence` table
- Exits non-zero if drift is detected (used in CI and as a K8s CronJob)

**R5.3** Add `infra/k8s/cronjobs/policy-drift-detection.yaml` running the drift script hourly.

**R5.4** Each policy change must produce a signed attestation written to the immutable evidence store before the change is applied. Implement as a pre-apply hook in the deploy workflow.

---

### Workstream 6: Compliance Janitor Agent

**R6.1** Create `packages/backend/src/lib/agent-fabric/agents/ComplianceJanitorAgent.ts` extending `BaseAgent`:
- `lifecycleStage: "compliance"`
- Ingestion handlers for: config change events, access log events, key rotation events, IAM events
- Append-only writes to `compliance_control_evidence` (never update/delete)
- Legal hold flag propagation from source event metadata
- Zod schemas for all ingested event types

**R6.2** Add `POST /api/admin/compliance/evidence` endpoint for evidence ingestion. Requires `system.admin` role. Validates against the evidence schema.

**R6.3** Add `GET /api/admin/compliance/evidence/export` endpoint:
- Query params: `control_id`, `framework`, `from`, `to`
- Returns time-bounded, control-scoped evidence records
- Response includes `integrity_hash` chain for auditor verification
- Requires `system.admin` role

**R6.4** Add `legal_hold` column to `compliance_control_evidence` via migration. Records with `legal_hold: true` are excluded from automated retention cleanup.

---

### Workstream 7: Trust Portal v1

**R7.1** Add `/trust` route to ValyntApp with sub-routes:
- `/trust` — control health overview
- `/trust/controls` — per-control pass/fail/freshness status
- `/trust/audit` — tenant-scoped audit trail
- `/trust/compliance` — framework coverage view

**R7.2** Create `GET /api/trust/control-status` backend endpoint:
- Returns `{ control_id, framework, status: "pass"|"fail"|"stale", last_checked, freshness_ttl_seconds, signed_snapshot_hash }[]`
- Tenant-scoped via `req.tenantId`
- Freshness TTL: continuous controls = 1h, weekly = 7d, monthly = 30d

**R7.3** Implement `ControlStateEngine` in `packages/backend/src/services/compliance/ControlStateEngine.ts`:
- Reads latest evidence records per control
- Computes pass/fail based on evidence recency vs. TTL
- Produces signed status snapshots (HMAC-SHA256 with a rotating signing key)
- Caches in Redis with TTL matching the shortest control freshness window

**R7.4** Trust Portal shows live status for the top 15 controls. Configurable list in `config/trust-portal-controls.json`.

**R7.5** Historical trend view: `GET /api/trust/control-status/history?control_id=CC6.1&days=30` returns daily pass/fail snapshots.

---

### Workstream 8: Crypto & Key Lifecycle

**R8.1** Document envelope encryption model in `docs/security-compliance/key-lifecycle-policy.md`:
- Data keys encrypted with KMS/HSM master key
- Key hierarchy: master key → data encryption key → per-tenant key
- KMS provider configurable via env

**R8.2** Automate rotation schedules as K8s CronJobs:
- `infra/k8s/cronjobs/key-rotation-data-keys.yaml` — 90-day rotation
- `infra/k8s/cronjobs/key-rotation-signing-keys.yaml` — 30-day rotation

**R8.3** Extend `docs/runbooks/emergency-procedures.md` with key compromise and break-glass procedures.

---

### Phase 2 Exit Criteria

| Criterion | Verification |
|---|---|
| Segmentation drift alerts fire in test drills | Drift detection CronJob produces alert on intentional policy mutation |
| Immutable evidence ingestion stable 14 consecutive days | No gaps in `compliance_control_evidence` daily record counts |
| Trust Portal shows live status for top 15 controls | `/trust/controls` renders with real data, freshness TTL respected |
| Key rotation jobs passing on schedule | CronJob success records in K8s + evidence records in store |

---

## Phase 3 — Resilience, FinOps Density, and Launch Certification

**Objective:** Validate at-scale behavior and tenant isolation under chaos. Certify launch readiness with objective pass/fail gates.

---

### Workstream 9: High-Density Orchestration

**R9.1** Define workload classes in `config/workload-classes.json`:

```json
{
  "interactive":      { "agents": ["opportunity", "discovery"],                                                    "priority": "high",   "preemptible": false, "scale_to_zero": false },
  "standard":         { "agents": ["target", "financial-modeling", "narrative"],                                   "priority": "normal", "preemptible": false, "scale_to_zero": false },
  "batch":            { "agents": ["realization", "expansion"],                                                    "priority": "low",    "preemptible": true,  "scale_to_zero": false },
  "rare-specialist":  { "agents": ["compliance-auditor", "context-extraction", "deal-assembly", "integrity"],      "priority": "normal", "preemptible": true,  "scale_to_zero": true  }
}
```

**R9.2** Add K8s `ResourceQuota` and `LimitRange` manifests in `infra/k8s/base/` per workload class to enforce noisy-neighbor guardrails.

**R9.3** Document MIG (Multi-Instance GPU) partitioning strategy in `docs/engineering/gpu-partitioning.md` for eligible inference workloads. Applies only when GPU nodes are present.

---

### Workstream 10: Scale-to-Zero with SLO Controls

**R10.1** Apply scale-to-zero only to `rare-specialist` class agents via KEDA `ScaledObject` manifests in `infra/k8s/base/`.

**R10.2** Cold-start target: p95 < 2s. Implement prewarm triggers:
- Schedule a prewarm pod 30s before predicted demand based on BullMQ queue depth
- Prewarm trigger as a BullMQ worker in `packages/backend/src/workers/`

**R10.3** Automatic fallback: if agent startup exceeds 5s, route to a warm fallback instance or return `503` with `Retry-After: 10`. Document in `docs/runbooks/agent-cold-start-fallback.md`.

**R10.4** Add cold-start SLO definition in `infra/observability/` (Prometheus recording rules + Grafana panel).

---

### Workstream 11: Release-Gated Chaos Program

**R11.1** Create `docs/security-compliance/chaos-program.md` defining the three mandatory scenarios:

**Scenario A — Tenant isolation breach attempt**
- Procedure: authenticated tenant A session attempts to read/write tenant B data via API
- Expected: `403`/`404` response + audit log entry with `cross_tenant_attempt: true`
- Pass criteria: zero successful cross-tenant data reads in two consecutive runs

**Scenario B — Billing bypass at high volume**
- Procedure: submit 1,000 agent invocations with manipulated billing headers
- Expected: all successful tasks metered; bypass attempts logged and blocked
- Pass criteria: metering integrity rate = 100% in two consecutive runs

**Scenario C — Scale 1→100→1 with SLO and integrity checks**
- Procedure: scale agent replicas from 1 to 100 under load, then back to 1
- Expected: p95 latency within SLO, no data integrity violations, no lost audit records
- Pass criteria: passes in two consecutive runs

**R11.2** Implement chaos test harnesses in `tests/chaos/`:
- `tenant-isolation-breach.test.ts`
- `billing-bypass-detection.test.ts`
- `scale-slo-integrity.test.ts`

**R11.3** Add chaos scenarios to release gate in `.github/workflows/deploy.yml` — must pass before production promotion.

---

### Workstream 12: Incident Response Automation

**R12.1** Extend `docs/operations/incident-response.md` with:
- Severity classification matrix (P0–P3) with auto-assignment rules
- SOC 2 / ISO 27001 control-impact linkage per severity class

**R12.2** Create `packages/backend/src/services/incidents/IncidentPacketService.ts`:
- On incident creation, auto-generates a forensic bundle containing:
  - Relevant `audit_logs` records (time-bounded around incident)
  - Active `AuthorizationPolicy` snapshot
  - Agent identity state at time of incident
  - Linked control IDs from `control-registry.json`
- Bundle written to immutable evidence store with `legal_hold: true`

**R12.3** Add `POST /api/admin/incidents` endpoint that triggers `IncidentPacketService`.

**R12.4** Test incident packet automation in at least one live game-day before Phase 3 exit. File report in `docs/operations/game-day-reports/`.

---

### Phase 3 Exit Criteria

| Criterion | Verification |
|---|---|
| All 3 chaos scenarios pass in two consecutive runs | CI chaos gate green on two sequential deploy runs |
| p95 latency, error budget, cold-start SLOs within thresholds | Grafana SLO dashboard green |
| Billing integrity: no unmetered successful tasks | Scenario B passes with 100% metering rate |
| Incident packet automation tested in one live game-day | Game-day report filed in `docs/operations/game-day-reports/` |

---

## Program Governance

### Weekly Cadence

| Day | Activity |
|---|---|
| Monday | Control health + blocker review — `control-registry.json` status, open CI gate failures |
| Wednesday | Red-team/chaos drill slice — run one chaos scenario or sub-scenario |
| Friday | Evidence completeness review + launch gate scoreboard |

### Required Roles

| Role | Responsibilities |
|---|---|
| Security Architect | Identity (SPIFFE/SPIRE), segmentation, mTLS |
| Platform Lead | K8s, autoscaling, MIG, KEDA |
| Compliance Lead | SOC 2/ISO evidence, crosswalk, retention |
| SRE Lead | SLOs, resilience, chaos program |
| Product/Customer Trust Lead | Trust Portal, customer communications |

### Core KPIs

| KPI | Target |
|---|---|
| % controls with automated evidence | 100% |
| % service paths covered by deny-by-default | 100% |
| Tenant-isolation violation count | 0 |
| Metering integrity rate | 100% billed successful tasks |
| Cold-start p95 for specialist agents | < 2s |
| Incident packet completion time | < 15 min automated |

---

## Minimum Launch Exit Standard (Go/No-Go)

All six must be true before production launch:

| Gate | Condition |
|---|---|
| Security | All agent-to-agent communication is identity-bound (SPIFFE) and policy-authorized (Istio ALLOW) |
| Compliance | SOC 2/ISO control set has continuous evidence and auditor-export capability |
| Isolation | Cross-tenant chaos scenario fails safely in every run |
| Billing Integrity | Bypass attempts are detected and blocked/charged |
| Scalability | 1→100→1 autoscale passes with no data integrity issues |
| Transparency | Trust Portal control states are live, fresh, and signed |

---

## Implementation Order

### Phase 1

1. Create `docs/security-compliance/soc2-iso27001-crosswalk.md`
2. Create `docs/security-compliance/control-registry.json`
3. Add path-sensitive CI gate (`control-coverage.yml`)
4. Add `control-coverage-gate` step to `.github/workflows/deploy.yml`
5. Extend `infra/k8s/security/spire-server.yaml` and `spire-agent.yaml` for `valueos.internal` trust domain
6. Replace generic `ClusterSPIFFEID` with 11 per-agent registrations in `spire-workload-registrations.yaml`
7. Add `PeerAuthentication STRICT` to `infra/k8s/security/mesh-authentication.yaml`
8. Create `infra/k8s/security/deny-by-default-policy.yaml`
9. Extend `agent-pairwise-authorization-policies.yaml` to cover all 11 agents with SPIFFE principals
10. Create/extend `packages/backend/src/middleware/serviceIdentityMiddleware.ts`
11. Create `docs/security-compliance/agent-identity-contract.md`
12. Create `docs/security-compliance/authorization-claim-model.md`
13. Create `docs/security-compliance/agent-handoff-allowlist.md`
14. Create `docs/security-compliance/evidence-schema.md`
15. Create `docs/security-compliance/evidence-retention-policy.md`
16. Create `scripts/compliance/verify-evidence-chain.mjs`
17. Apply deny-by-default to staging overlay in `infra/k8s/overlays/staging/`

### Phase 2

18. Promote segmentation policies to production overlay
19. Create `scripts/compliance/detect-policy-drift.mjs`
20. Add `infra/k8s/cronjobs/policy-drift-detection.yaml`
21. Create `ComplianceJanitorAgent.ts`
22. Add evidence ingestion (`POST /api/admin/compliance/evidence`) and export (`GET /api/admin/compliance/evidence/export`) endpoints
23. Add `legal_hold` migration to `compliance_control_evidence`
24. Create `packages/backend/src/services/compliance/ControlStateEngine.ts`
25. Add `/trust` route and sub-routes to ValyntApp
26. Add `GET /api/trust/control-status` and `/history` endpoints
27. Create `config/trust-portal-controls.json`
28. Create `docs/security-compliance/key-lifecycle-policy.md` and rotation CronJobs
29. Extend `docs/runbooks/emergency-procedures.md` with key compromise procedures

### Phase 3

30. Create `config/workload-classes.json` and K8s `ResourceQuota`/`LimitRange` manifests
31. Add KEDA `ScaledObject` manifests for rare-specialist agents
32. Implement prewarm trigger BullMQ worker
33. Add cold-start SLO recording rules and Grafana panel
34. Create `docs/security-compliance/chaos-program.md`
35. Implement chaos test harnesses in `tests/chaos/`
36. Add chaos gate to `.github/workflows/deploy.yml`
37. Create `IncidentPacketService.ts` and `POST /api/admin/incidents` endpoint
38. Conduct live game-day and file report in `docs/operations/game-day-reports/`
