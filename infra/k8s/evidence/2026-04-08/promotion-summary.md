# Manifest Promotion Evidence Summary (2026-04-08)

Targeted manifests/classes:
- `infra/k8s/base/network-policies.yaml` → `network-policies`
- `infra/k8s/base/hpa.yaml` → `hpa`
- `infra/k8s/overlays/production/` → `deployments`

## Staging rollout + health evidence
- `artifact://infra/k8s/evidence/2026-04-08/09-staging-rollout-and-healthchecks.txt`
- `artifact://infra/k8s/evidence/2026-04-08/06-production-overlay-dryrun.txt`

## Controlled load evidence
- `artifact://infra/k8s/evidence/2026-04-08/10-controlled-load-test-k6.txt`

## Rollback rehearsal evidence
- `artifact://infra/k8s/evidence/2026-04-08/11-rollback-rehearsal.txt`

## Readiness decision
Readiness for `deployments`, `hpa`, and `network-policies` remains `Validated` in `infra/k8s/manifest-maturity-ledger.json`, with the evidence links above attached as the promotion source-of-truth artifacts.

## Security-owner signoff
- Security Owner: `Priya Nair (Security Engineering)`
- Signoff Date: `2026-04-08`
- Approval: `Approved`
- Signoff Reference: `SEC-4821`
- Scope: `base/network-policies.yaml`, `base/hpa.yaml`, and `overlays/production/`
