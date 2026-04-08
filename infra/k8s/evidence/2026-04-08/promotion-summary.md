# Manifest Promotion Evidence Summary (2026-04-08)

Targeted manifests/classes:
- `infra/k8s/base/network-policies.yaml` → `network-policies`
- `infra/k8s/base/hpa.yaml` → `hpa`
- `infra/k8s/overlays/production/` → `deployments`

## Staging rollout + health evidence
- `artifact://infra/k8s/evidence/2026-04-08/03-staging-rollout-and-healthchecks.txt`
- `artifact://infra/k8s/evidence/2026-04-08/05-kustomize-staging-dryrun.txt`

## Controlled load evidence
- `artifact://infra/k8s/evidence/2026-04-08/08-controlled-load-test-k6.txt`
- `artifact://infra/k8s/evidence/2026-04-08/04-controlled-load-test.txt`
- `artifact://infra/k8s/evidence/2026-04-08/02-network-policy-validation.txt`

## Rollback rehearsal evidence
- `artifact://infra/k8s/evidence/2026-04-08/07-rollback-rehearsal.txt`
- `artifact://infra/k8s/evidence/2026-04-08/06-production-overlay-dryrun.txt`

## Readiness decision
Readiness for `deployments`, `hpa`, and `network-policies` has been set to `Validated` in the ledger with dated evidence links and metadata signoff fields.

## Security-owner signoff
- Security Owner: `Priya Nair (Security Engineering)`
- Signoff Date: `2026-04-08`
- Scope: `network-policies`, `hpa`, and production overlay deployment controls.
