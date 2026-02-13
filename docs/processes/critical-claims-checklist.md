# Critical Claims Checklist

This checklist captures the minimum control claims we expect to remain true for each release train. Every claim must point to a repository artifact that can be validated in CI.

## 1) Security gates

- [ ] CI workflow executes baseline quality + security gates (`.github/workflows/ci.yml`).
- [ ] Deployment workflow exists and is version-controlled (`.github/workflows/deploy.yml`).
- [ ] Security regression script exists for agent-level checks (`scripts/test-agent-security.sh`).
- [ ] Security log validation script exists (`scripts/test-security-logs.js`).

## 2) Branch protection controls

- [ ] PR template exists to standardize control attestations (`.github/pull_request_template.md`).
- [ ] CODEOWNERS exists for protected review routing (`.github/CODEOWNERS`).
- [ ] Workflow documentation exists for required checks governance (`.github/workflows/README.md`).

## 3) Disaster recovery (DR) checks

- [ ] DR runbook exists (`docs/runbooks/disaster-recovery.md`).
- [ ] Emergency runbook exists (`docs/runbooks/emergency-procedures.md`).
- [ ] Operations incident response guide exists (`docs/operations/incident-response.md`).

## 4) Release readiness steps

- [ ] Deployment runbook exists with release execution steps (`docs/runbooks/deployment-runbook.md`).
- [ ] Operations deployment guide exists (`docs/operations/deployment-guide.md`).
- [ ] Launch readiness checklist exists (`docs/operations/launch-readiness.md`).

## Control update coupling (PR policy)

For control updates, keep implementation and documentation synchronized in the same pull request:

- Security/deployment workflow changes under `.github/workflows/**` **must** include updates in one or more control docs under:
  - `docs/security-compliance/**`
  - `docs/operations/deployment-guide.md`
  - `docs/runbooks/deployment-runbook.md`
  - `docs/runbooks/disaster-recovery.md`
- Control doc changes in those paths **must** include corresponding workflow updates under `.github/workflows/**`.

This policy is enforced by CI through `scripts/validate-critical-claims.js`.
