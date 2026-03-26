---
title: Agent Workload Identity Contract
owner: security-architect
system: valueos-platform
status: active
review_cadence: quarterly
related_controls: CC6.1-WI, CC6.6-WI, CC6.7-WI
---

# Agent Workload Identity Contract

Defines the SPIFFE workload identity model for all ValueOS runtime principals. This document is the authoritative reference for identity issuance, trust boundaries, and the process for registering new agents.

## Trust Domain

```
valueos.internal
```

All SPIFFE IDs issued by the ValueOS SPIRE deployment use this trust domain. IDs from any other trust domain are rejected by `serviceIdentityMiddleware`.

## SPIFFE ID Namespace Shape

```
spiffe://valueos.internal/ns/{k8s-namespace}/{principal-type}/{slug}
```

| Segment | Values |
|---|---|
| `k8s-namespace` | `valynt` (production), `valynt-staging` (staging) |
| `principal-type` | `agents` \| `services` \| `workers` |
| `slug` | Kebab-case identifier unique within the principal type |

## Registered Agent Identities

| Agent Class | SPIFFE ID | K8s ServiceAccount | Namespace |
|---|---|---|---|
| OpportunityAgent | `spiffe://valueos.internal/ns/valynt/agents/opportunity` | `opportunity-agent` | `valynt` |
| TargetAgent | `spiffe://valueos.internal/ns/valynt/agents/target` | `target-agent` | `valynt` |
| FinancialModelingAgent | `spiffe://valueos.internal/ns/valynt/agents/financial-modeling` | `financial-modeling-agent` | `valynt` |
| IntegrityAgent | `spiffe://valueos.internal/ns/valynt/agents/integrity` | `integrity-agent` | `valynt` |
| RealizationAgent | `spiffe://valueos.internal/ns/valynt/agents/realization` | `realization-agent` | `valynt` |
| ExpansionAgent | `spiffe://valueos.internal/ns/valynt/agents/expansion` | `expansion-agent` | `valynt` |
| NarrativeAgent | `spiffe://valueos.internal/ns/valynt/agents/narrative` | `narrative-agent` | `valynt` |
| ComplianceAuditorAgent | `spiffe://valueos.internal/ns/valynt/agents/compliance-auditor` | `compliance-auditor-agent` | `valynt` |
| ContextExtractionAgent | `spiffe://valueos.internal/ns/valynt/agents/context-extraction` | `context-extraction-agent` | `valynt` |
| DealAssemblyAgent | `spiffe://valueos.internal/ns/valynt/agents/deal-assembly` | `deal-assembly-agent` | `valynt` |
| DiscoveryAgent | `spiffe://valueos.internal/ns/valynt/agents/discovery` | `discovery-agent` | `valynt` |

## Registered Service Identities

| Service | SPIFFE ID | K8s ServiceAccount |
|---|---|---|
| Backend API | `spiffe://valueos.internal/ns/valynt/services/backend-api` | `backend` |
| DecisionRouter | `spiffe://valueos.internal/ns/valynt/services/decision-router` | `decision-router` |
| ExecutionRuntime | `spiffe://valueos.internal/ns/valynt/services/execution-runtime` | `execution-runtime` |
| PolicyEngine | `spiffe://valueos.internal/ns/valynt/services/policy-engine` | `policy-engine` |
| ContextStore | `spiffe://valueos.internal/ns/valynt/services/context-store` | `context-store` |
| ArtifactComposer | `spiffe://valueos.internal/ns/valynt/services/artifact-composer` | `artifact-composer` |
| RecommendationEngine | `spiffe://valueos.internal/ns/valynt/services/recommendation-engine` | `recommendation-engine` |

## Excluded Principals

`GroundTruthAnalyzer` is an internal library utility, not an independently deployed workload. It does not receive a SPIFFE ID. If it is ever extracted into a standalone service, it must go through the registration process below.

## mTLS Enforcement Policy

- `PeerAuthentication` mode: **STRICT** for both `valynt` and `valynt-agents` namespaces.
- No plaintext fallback. All intra-mesh traffic requires mutual TLS.
- Configured in: `infra/k8s/security/mesh-authentication.yaml`

## Authorization Model

- Base layer: deny-all `AuthorizationPolicy` in `valynt-agents` and `valynt` namespaces (`infra/k8s/security/deny-by-default-policy.yaml`).
- Explicit ALLOW policies per approved communication edge (`infra/k8s/security/agent-pairwise-authorization-policies.yaml`).
- All ALLOW policies use SPIFFE ID principals from the `valueos.internal` trust domain.
- Approved edges are documented in `docs/security-compliance/agent-handoff-allowlist.md`.

## Backend Integration

`serviceIdentityMiddleware` in `packages/backend/src/middleware/serviceIdentityMiddleware.ts`:

- Extracts SPIFFE ID from the `x-spiffe-id` header or mTLS peer certificate (via ingress attestation).
- Validates the ID against the `valueos.internal` trust domain and the registered slug allowlist.
- Attaches `req.serviceIdentity: { spiffeId, principalType, slug, namespace }` on success.
- Returns `403` if the SPIFFE ID is from an unrecognized trust domain.
- Returns `401` if no valid identity assertion is present on protected routes.

## Process: Registering a New Agent

A new agent receives a SPIFFE ID only when it is a named, deployed runtime workload with clear trust boundaries. Planned agents do not receive registrations.

**Required PR checklist items:**

1. Add a `ServiceAccount` and `ClusterSPIFFEID` to `infra/k8s/security/spire-workload-registrations.yaml`.
2. Add the agent slug to `REGISTERED_AGENT_SLUGS` in `serviceIdentityMiddleware.ts`.
3. Add `AuthorizationPolicy` entries for all approved edges to `agent-pairwise-authorization-policies.yaml`.
4. Add the agent to `agent-handoff-allowlist.md` with all approved handoffs.
5. Update `agent-communication-graph.yaml` with the new DAG edges.
6. Update `control-registry.json` if the agent introduces new governed paths.
7. Update this document's registered agent table.

All seven items must be in the same PR. Partial registrations are not permitted.

## SVID Rotation

SPIRE issues X.509 SVIDs with a default TTL of 1 hour. Rotation is automatic via the SPIRE agent workload API. Workloads must use the SPIRE socket at `/run/spire/sockets/agent.sock` to receive rotated SVIDs without restart.

## Related Files

| File | Purpose |
|---|---|
| `infra/k8s/security/spire-server.yaml` | SPIRE server deployment and config |
| `infra/k8s/security/spire-agent.yaml` | SPIRE agent DaemonSet and config |
| `infra/k8s/security/spire-workload-registrations.yaml` | ClusterSPIFFEID registrations |
| `infra/k8s/security/mesh-authentication.yaml` | PeerAuthentication STRICT policies |
| `infra/k8s/security/deny-by-default-policy.yaml` | Base deny-all AuthorizationPolicy |
| `infra/k8s/security/agent-pairwise-authorization-policies.yaml` | Explicit ALLOW policies |
| `docs/security-compliance/agent-handoff-allowlist.md` | Human-readable approved edge list |
| `docs/security-compliance/authorization-claim-model.md` | Claim schema for authz decisions |
| `packages/backend/src/middleware/serviceIdentityMiddleware.ts` | Runtime identity validation |
| `packages/backend/src/types/express.d.ts` | `req.serviceIdentity` type declaration |
