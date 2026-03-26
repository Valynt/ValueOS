---
title: Agent Handoff Allowlist
owner: security-architect
system: valueos-platform
status: active
review_cadence: quarterly
related_controls: CC6.6-WI
---

# Agent Handoff Allowlist

Human-readable approval record for all permitted agent-to-agent and service-to-agent communication edges. This document is the authoritative source for policy changes to `agent-pairwise-authorization-policies.yaml`.

**Every edge in `agent-pairwise-authorization-policies.yaml` must have a corresponding entry here. Any edge not listed is denied by the base deny-all policy.**

## How to add a new edge

1. Add a row to this document with source, destination, action, and justification.
2. Add a corresponding `AuthorizationPolicy` to `agent-pairwise-authorization-policies.yaml` using the SPIFFE principal from `agent-identity-contract.md`.
3. Update `agent-communication-graph.yaml` with the new DAG edge.
4. Both files must be updated in the same PR. Partial changes are not permitted.
5. PR must be approved by the Security Architect.

## Backend Orchestrator → All Agents

The backend API is the sole external initiator of agent invocations. It may invoke any registered agent.

| Source | Destination | Action | Justification |
|---|---|---|---|
| `services/backend-api` | `agents/opportunity` | `agent:invoke` | Backend orchestrates the lifecycle DAG entry point |
| `services/backend-api` | `agents/target` | `agent:invoke` | Backend may invoke target directly for targeted analysis |
| `services/backend-api` | `agents/financial-modeling` | `agent:invoke` | Backend may invoke financial modeling for standalone model runs |
| `services/backend-api` | `agents/integrity` | `agent:invoke` | Backend invokes integrity checks on demand |
| `services/backend-api` | `agents/realization` | `agent:invoke` | Backend may invoke realization for post-approval tracking |
| `services/backend-api` | `agents/expansion` | `agent:invoke` | Backend may invoke expansion for upsell analysis |
| `services/backend-api` | `agents/narrative` | `agent:invoke` | Backend invokes narrative for document generation |
| `services/backend-api` | `agents/compliance-auditor` | `agent:invoke` | Backend invokes compliance auditor for control checks |
| `services/backend-api` | `agents/context-extraction` | `agent:invoke` | Backend invokes context extraction for document ingestion |
| `services/backend-api` | `agents/deal-assembly` | `agent:invoke` | Backend invokes deal assembly for case packaging |
| `services/backend-api` | `agents/discovery` | `agent:invoke` | Backend invokes discovery for opportunity identification |

## Lifecycle DAG Edges

Pairwise agent-to-agent handoffs following the value lifecycle DAG. Source: `packages/backend/src/data/lifecycleWorkflows.ts`.

| Source | Destination | Action | Justification |
|---|---|---|---|
| `agents/discovery` | `agents/opportunity` | `agent:handoff` | Discovery feeds identified opportunities into the opportunity stage |
| `agents/opportunity` | `agents/target` | `agent:handoff` | Opportunity analysis produces target account/segment inputs |
| `agents/opportunity` | `agents/financial-modeling` | `agent:handoff` | Opportunity context seeds the financial model |
| `agents/opportunity` | `agents/context-extraction` | `agent:handoff` | Opportunity triggers document context extraction |
| `agents/context-extraction` | `agents/opportunity` | `agent:handoff` | Extracted context enriches the opportunity record |
| `agents/financial-modeling` | `agents/target` | `agent:handoff` | Financial model outputs refine target sizing |
| `agents/financial-modeling` | `agents/integrity` | `agent:handoff` | Financial model outputs are validated by integrity checks |
| `agents/target` | `agents/realization` | `agent:handoff` | Target analysis feeds realization planning |
| `agents/target` | `agents/integrity` | `agent:handoff` | Target outputs are validated by integrity checks |
| `agents/target` | `agents/deal-assembly` | `agent:handoff` | Target analysis contributes to deal package assembly |
| `agents/integrity` | `agents/realization` | `agent:handoff` | Integrity-validated outputs proceed to realization |
| `agents/realization` | `agents/expansion` | `agent:handoff` | Realized value feeds expansion opportunity identification |
| `agents/expansion` | `agents/integrity` | `agent:handoff` | Expansion proposals are validated by integrity checks |
| `agents/deal-assembly` | `agents/narrative` | `agent:handoff` | Assembled deal package is narrated for customer delivery |

## Explicitly Denied Paths

The following paths are explicitly not permitted and must never be added without a security review:

| Source | Destination | Reason |
|---|---|---|
| Any agent | Any agent (cross-tenant) | Tenant isolation invariant — see `authorization-claim-model.md` |
| `agents/narrative` | Any agent | Narrative is a terminal node; it does not initiate downstream calls |
| `agents/compliance-auditor` | Any agent | Compliance auditor is invoked by backend only; it does not chain to other agents |
| Any external workload | Any agent (direct) | All agent invocations must go through `services/backend-api` |

## Change History

| Date | Change | Approved by |
|---|---|---|
| 2026-04-23 | Initial allowlist established from lifecycle DAG and agent-communication-graph.yaml | Security Architect |

## Related Files

| File | Purpose |
|---|---|
| `infra/k8s/security/agent-pairwise-authorization-policies.yaml` | Istio AuthorizationPolicy enforcement |
| `infra/k8s/security/agent-communication-graph.yaml` | Machine-readable DAG definition |
| `infra/k8s/security/deny-by-default-policy.yaml` | Base deny-all policy |
| `docs/security-compliance/agent-identity-contract.md` | SPIFFE ID registry |
| `docs/security-compliance/authorization-claim-model.md` | Claim schema |
