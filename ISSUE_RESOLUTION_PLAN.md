# Issue Resolution Plan

## Repo understanding summary

- **Architecture:** pnpm monorepo with the production frontend in `apps/ValyntApp` and the primary API runtime in `packages/backend`. Runtime orchestration is centered on six backend runtime services and an eight-agent fabric. The canonical domain model lives in `packages/shared/src/domain/`. 
- **Primary constraints:** tenant isolation on every data access, no direct agent LLM calls outside `secureInvoke`, no `req as any` casts in backend request handling, and strict TypeScript/no-`any` expectations. 
- **Operational lanes:** `pnpm run lint`, `pnpm run check`, `pnpm test`, `pnpm run test:rls`, targeted Vitest commands, and CI guard scripts under `scripts/ci/`. 
- **Safety-critical surfaces relevant to the current issue set:** migration rollback governance, health-check/degraded-state signaling, service de-duplication policy, CI coverage thresholds, DR validation workflow, load/chaos validation artifacts, and ADR/documentation consistency.

## Issue clustering summary

### Cluster 1 — Production safety / release blockers
- **#1546** migration rollback safety
- **#1545** SLO/SLI documentation and alert linkage
- **#1541** MFA production enforcement signaling
- **#1552 / #1553** backup, recovery, and DR drill evidence
- **#1135–#1143** environment/infrastructure prerequisites for real cloud delivery

### Cluster 2 — Architecture debt / code health
- **#1544** TypeScript `any` reduction
- **#1547** ValueTreeService de-duplication / canonical ownership
- **#1548** legacy root directory cleanup and future import bans
- **#1549** oversized backend service decomposition
- **#1550** CI coverage thresholds
- **#1551** ADR capture for architecture decisions
- **#1540 / #1542 / #1543** auth cleanup, tenant-isolation verification, and OpenAPI expansion

### Cluster 3 — Verification / resilience maturity
- **#1554** load-test baselines
- **#1555** chaos scenario expansion
- **#1552 / #1553** also feed this cluster because backup/DR evidence is part of operational maturity

## Shared root causes

1. **Documentation drift vs. implementation drift**
   - Several “open” issues already have substantial implementation evidence in repo, but lack a consolidated closure audit.
2. **Reliability evidence scattered across docs, CI, and ad hoc scripts**
   - SLOs, backup/DR docs, chaos checks, and load-test artifacts exist, but acceptance evidence is spread across multiple files.
3. **Historical architecture churn**
   - Sprint debt around duplicate services, legacy roots, and oversized files stems from prior layout transitions.
4. **Validation harness gaps**
   - Some tests existed in spirit but did not map tightly enough to issue acceptance language (especially chaos/reliability acceptance criteria).
5. **Infrastructure issues depend on off-repo environment changes**
   - #1135–#1143 require cloud resources, GitHub settings, and AWS/GitHub administration that are not fully solvable in-repo.

## Dependency graph summary

```text
#1135 Foundation & Identity
├─ #1136 Provision EKS cluster
├─ #1137 AWS CI/CD credentials
│  └─ #1141 GitHub secrets config
├─ #1138 External Secrets IAM role
│  └─ #1142 AWS Secrets Manager population
└─ #1139 DNS/TLS provisioning

#1140 Agent dependency wiring
├─ blocked by #1135
├─ #1141 GitHub secrets config
├─ #1142 AWS Secrets Manager population
└─ #1143 GitHub environments

#1546 Migration rollback safety ─┐
#1545 SLO/SLI docs              ├─ inform Wave 1 safety baseline
#1541 MFA prod enforcement      ┘

#1552 Backup/recovery strategy ─┐
#1553 DR drill                 ├─ prerequisite evidence track for Wave 3 reliability
#1554 Load baselines           ┤
#1555 Chaos scenarios          ┘

#1549 Oversized file refactor ─┐
#1547 Service de-duplication   ├─ architectural debt seam
#1548 Legacy roots cleanup     ┤
#1544 TS debt reduction        ├─ coordinated code health wave
#1550 Coverage thresholds      ┘

#1551 ADRs document decisions revealed by #1547/#1548/#1549/#1550.
```

## Execution waves

### Wave 1 — Blockers / safety / prerequisites
| Issue | Type | Status | Implementability | Dependency | Risk | Recommended batch | Closure strategy |
|---|---|---:|---|---|---|---|---|
| #1135 Foundation & Identity | infra | Open | **B** blocked/off-repo | Cloud account + GitHub admin | High | Separate infra program | Requires real EKS/IAM/DNS provisioning and cannot be completed from repo alone. |
| #1136 Provision EKS Cluster | infra | Open | **B** blocked/off-repo | AWS account | High | Separate infra PR/ops change | Terraform + cluster validation in live AWS. |
| #1137 AWS Credential Provisioning | infra | Open | **B** blocked/off-repo | #1136 | High | Separate ops change | IAM/OIDC + GitHub secret provisioning. |
| #1138 IAM Role ARN Patching | infra | Open | **B** blocked/off-repo | #1136, #1137 | High | Separate infra PR | Needs live IAM role ARN values. |
| #1139 DNS/TLS Provisioning | infra | Open | **B** blocked/off-repo | #1136 | High | Separate infra PR | Needs Route53/ACM resources. |
| #1140 Secrets & Connectivity | infra | Open | **B** blocked | #1135 | High | Separate ops program | Follows infra readiness. |
| #1141 GitHub Secrets Config | infra | Open | **B** blocked/off-repo | #1136, #1137 | High | Separate ops change | GitHub settings, not code. |
| #1142 AWS Secrets Manager Population | infra | Open | **B** blocked/off-repo | #1138 | High | Separate ops change | Secret values/admin access required. |
| #1143 GitHub Environments | infra | Open | **B** blocked/off-repo | GitHub admin | Medium | Separate ops change | GitHub environment creation. |
| #1546 Critical migration rollbacks | infra/code | Open | **C** partially resolved | none | High | Safety close-out PR | Repo already contains rollback guardrails and widespread rollback pairing; needs evidence audit if issue remains open. |
| #1545 Define SLOs/SLIs | docs/ops | Open | **C** partially resolved | none | Medium | Reliability close-out PR | Core doc and alert mappings exist; close-out should verify acceptance against actual Prometheus rules. |
| #1541 Enforce MFA in production | code/docs | Open | **C** partially resolved | none | Medium | Safety close-out PR | Startup/env validation and health warning surfaces exist; close-out should reconcile acceptance vs. current stronger fail-fast behavior. |

### Wave 2 — Architectural debt / code health
| Issue | Type | Status | Implementability | Dependency | Risk | Recommended batch | Closure strategy |
|---|---|---:|---|---|---|---|---|
| #1544 TypeScript debt reduction | code | Open | **C** partially resolved | none | Medium | Code-health batch | Existing debt dashboards and prior reductions exist; needs fresh measurement and focused touched-module cleanup, not random repo-wide churn. |
| #1547 De-duplicate ValueTreeService | architecture/code | Open | **D** grouped remediation | #1549 | Medium | Code-health batch | Canonical ownership is now documented; remaining decision is whether shim retention is intentional governance, not raw deletion. |
| #1548 Remove legacy root directories | code/governance | Open | **C** partially resolved | none | Low | Code-health batch | Root directories appear removed and ESLint ban exists; likely needs closure audit only. |
| #1549 Refactor oversized files | code | Open | **C** partially resolved | none | Medium | Code-health batch | Canonical extracted modules already exist; needs evidence review against targeted files. |
| #1550 Increase CI coverage thresholds | test/ci | Open | **C** partially resolved | none | Medium | Code-health batch | CI already enforces 75/70/70/75 in `ci.yml`; remaining gap is evidence and any package-level holes. |
| #1551 Write missing ADRs | docs/architecture | Open | **C** partially resolved | #1547/#1549 context | Low | Code-health close-out | ADR-0015/0016/0017 already exist; likely closure-evidence update only. |
| #1540 Remove dead auth files | code | Open | **C** partially resolved | none | Medium | Separate/auth cleanup | Needs concrete file inventory before deletion claim. |
| #1542 Verify frontend tenant isolation | code/test | Open | **A** implementable now | none | High | Security test batch | Candidate future work: audit callsites and add explicit tenant-isolation tests if gaps remain. |
| #1543 Expand OpenAPI specification | docs/code | Open | **A** implementable now but larger | none | Medium | Separate API-doc batch | Large diff, should remain separate from reliability work. |

### Wave 3 — Verification / resilience / operational maturity
| Issue | Type | Status | Implementability | Dependency | Risk | Recommended batch | Closure strategy |
|---|---|---:|---|---|---|---|---|
| #1552 Backup and recovery strategy | docs/ops | Open | **C** partially resolved | none | Medium | Reliability close-out batch | Core doc exists; verify schedule/retention/RTO/RPO/restore steps are explicit and linked. |
| #1553 First DR drill | docs/ops | Open | **C** partially resolved | #1552 | Medium | Reliability close-out batch | Workflow and drill log exist; may still need first completed drill entry/evidence if not yet committed. |
| #1554 Load test baselines | test/docs | Open | **C** partially resolved | SLO definitions help | Medium | Reliability close-out batch | Baseline doc exists; verify staging evidence remains aligned to acceptance criteria. |
| #1555 Expand chaos test scenarios | test/docs | Open | **A** implementable now | none | Medium | **Current implementation batch** | Tighten test acceptance to explicitly cover DB connection failure structured 503 and Redis/BullMQ unavailability handling; add runbook-style README. |

## Critical path

1. **Off-repo infra blockers**: #1135 → #1136/#1137 → #1138/#1139 → #1140/#1141/#1142/#1143.
2. **In-repo production safety evidence**: #1546 + #1545 + #1541.
3. **Reliability validation evidence**: #1552 → #1553 and in parallel #1554 + #1555.
4. **Architecture debt close-out**: #1549/#1547/#1548 plus #1551 documentation capture.
5. **Larger follow-on backlog**: #1542, #1543, #1544, #1540.

## Proposed PR strategy

### PR 1 — Reliability evidence and chaos acceptance hardening
- **Proposed title:** `reliability: harden chaos acceptance evidence and operational issue close-out`
- **Issues targeted together:** #1555, with close-out evidence touchpoints for #1552, #1553, #1554.
- **Why batch together:** Same resilience/test/docs seam; low rollout risk; improves operational evidence without broad app refactor.

### PR 2 — Safety close-out audit
- **Proposed title:** `safety: reconcile migration, MFA, and SLO acceptance evidence`
- **Issues targeted together:** #1546, #1545, #1541.
- **Why batch together:** Shared production-safety concern and docs/health/CI guard surfaces.

### PR 3 — Code health governance close-out
- **Proposed title:** `governance: reconcile service deduplication, legacy path cleanup, ADRs, and CI coverage`
- **Issues targeted together:** #1547, #1548, #1549, #1550, #1551.
- **Why batch together:** Same architectural-governance seam; mainly evidence reconciliation with selective cleanup.

### Keep separate
- **#1543 OpenAPI expansion** — large surface area and reviewer load; separate PR.
- **#1542 frontend tenant isolation** — security-sensitive test/code changes; separate PR.
- **#1544 TS debt reduction** — should be module-clustered and intentional, not mixed into reliability/docs.
- **#1135–#1143** — require live infra/admin changes; track as operational program, not a normal repo PR.

## This execution cycle

I am starting with **PR 1 / Wave 3’s test-acceptance gap** because it is:
- directly implementable in-repo,
- low-risk,
- test-backed,
- and the clearest remaining mismatch between issue acceptance language and current evidence.
