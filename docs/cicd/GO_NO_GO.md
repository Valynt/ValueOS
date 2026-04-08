# GO / NO-GO Criteria for Production Launch

This document defines the binary decision criteria for promoting a release to production.  
**Every GO criterion must be met. A single NO-GO criterion blocks the release.**

---

## Automated gates (machine-enforced)

These are evaluated by `release-gate-contract` in `deploy.yml`. The job fails if any result is not `success`.

| Gate | GO | NO-GO |
|---|---|---|
| `release-manifest-gate` | Manifest exists for this SHA, all fields populated | Manifest missing or incomplete |
| `trivy-backend` | 0 critical CVEs, 0 high CVEs | Any critical or high CVE |
| `trivy-frontend` | 0 critical CVEs, 0 high CVEs | Any critical or high CVE |
| `e2e-gate` | 0 Playwright test failures | Any test failure |
| `dast-gate` | 0 high findings, ≤ 5 medium findings | Any high finding, or > 5 medium |
| `rls-gate` | All tenant-scoped tables have RLS enabled | Any table missing RLS |
| `migration-chain-integrity` | Clean apply from zero succeeds | Any migration error |
| `migration-rollback-files` | Every forward migration has a rollback file | Any missing rollback |
| `secret-scan` | 0 secrets in diff and full history | Any secret detected |
| `codeql` | 0 new high/critical findings | Any new high/critical finding |
| `dependency-audit` | 0 high/critical CVEs | Any high/critical CVE |
| `reproducibility` | Identical digests across two independent builds | Any digest mismatch |
| `supply-chain-verify` | Cosign signature verifies against OIDC issuer | Signature missing or invalid |
| `reliability-indicators` | SLO burn rate, error rate, latency within bounds | Any indicator out of bounds |
| `secret-rotation-evidence` | All secrets rotated within policy window | Any secret overdue |
| `coverage-overall` | Lines ≥ 75%, functions ≥ 70%, branches ≥ 70% | Below threshold |
| `coverage-agents` | 100% | Below 100% |
| `coverage-security-billing` | ≥ 95% | Below 95% |
| `ts-error-ratchet` | TypeScript error count ≤ baseline | Count exceeds baseline |
| `lint-ratchet` | Warning count ≤ baseline per package | Count exceeds baseline |
| `compliance-controls` | All critical SOC2/ISO27001 controls green | Any critical control red |

---

## Human review gates (release owner judgment)

These are verified manually in Phase 5 of the release checklist.

| Criterion | GO | NO-GO |
|---|---|---|
| Open incidents | No P0 or P1 incidents open | Any P0 or P1 open |
| Localization regressions | No unresolved localization regressions in shipped locales (`en`, `es`), or approved time-bound exception with owner | Any unresolved shipped-locale regression without owner/escalation plan |
| Previous rollback | Post-mortem closed, or no previous rollback | Post-mortem open |
| Staging soak | ≥ 30 min with no anomalies | Soak incomplete or anomalies observed |
| On-call coverage | On-call engineer confirmed available | No on-call coverage |
| Rollback plan | Migration rollback SQL tested in staging | Rollback untested |
| Backup confirmed | Pre-deploy snapshot ID in deploy audit artifact | No snapshot taken |
| Change window | Approved (if org requires change management) | Change window not approved |

---

## Confidence scoring (agent outputs)

ValueOS produces financial and commitment-level outputs. Before a release that changes agent behavior, verify:

| Agent tier | Minimum accept threshold | NO-GO condition |
|---|---|---|
| `financial` | 0.75 | Any financial output below 0.75 in staging smoke tests |
| `commitment` | 0.70 | Any commitment output below 0.70 in staging smoke tests |
| `compliance` | 0.80 | Any compliance output below 0.80 in staging smoke tests |
| `narrative` | 0.65 | Any narrative output below 0.65 in staging smoke tests |
| `discovery` | 0.55 | Any discovery output below 0.55 in staging smoke tests |

These thresholds are defined in `docs/AGENTS.md` and enforced by `HardenedAgentRunner`. A release that lowers these thresholds without a documented risk acceptance is a NO-GO.

---

## Post-deploy monitoring thresholds (5-minute window)

If any threshold is breached within 5 minutes of the production traffic swap, initiate rollback immediately.

| Metric | GO | Rollback trigger |
|---|---|---|
| HTTP error rate (5xx) | < 1% | > 5% sustained > 2 min |
| p95 response latency | < 5000ms | > 10,000ms sustained > 2 min |
| p99 response latency | < 10,000ms | > 15,000ms sustained > 2 min |
| Auth endpoint errors | 0 5xx on `/api/auth/*` | Any 5xx |
| Tenant endpoint errors | 0 5xx on `/api/tenants/*` | Any 5xx |
| Agent GovernanceVetoError rate | < 0.1% | > 1% |
| Cross-tenant access in audit log | 0 | Any detected |
| Queue depth (BullMQ) | < 100 pending | > 1000 sustained > 5 min |

---

## Decision authority

| Scenario | Decision authority |
|---|---|
| All automated gates green, human review complete | Release owner (any senior engineer) |
| One or more automated gates red | Blocked — no override |
| Human review item borderline | Engineering lead + security lead joint decision |
| P0 incident open | CTO approval required |
| Emergency bypass (staging only, never production) | 2 code-owner approvals + incident ticket + post-deploy security scan within 30 min |

Production deploys **cannot** use `skip_tests=true`. The `deploy.yml` workflow enforces this at the `emergency-bypass-authorization` job level.

### Localization escalation policy (release gate)

- Any unresolved localization regression on shipped locales (`en`, `es`) is a **NO-GO** unless there is:
  1. a documented temporary exception with expiration date,
  2. an assigned DRI (`@team/frontend`), and
  3. explicit escalation acknowledgement from `@team/owners` before production approval.
- Regressions that remain unresolved across one release cycle must be escalated to release captain + engineering leadership and tracked as a launch blocker in the next release candidate.

---

## GO declaration template

When all criteria are met, the release owner records the GO decision:

```
Release: <version or SHA>
Date: <UTC timestamp>
Release owner: <name>
On-call: <name>

Automated gates: ALL GREEN (release-gate-contract job: <run_id>)
Staging soak: <duration> min, no anomalies
Backup snapshot: <snapshot_id>
Migration rollback tested: YES / N/A (no schema changes)
Open incidents: NONE
Post-mortem status: CLOSED / N/A

GO — proceeding to production deploy.
```

This declaration is posted as a comment on the deploy workflow run before the production approval is granted.
