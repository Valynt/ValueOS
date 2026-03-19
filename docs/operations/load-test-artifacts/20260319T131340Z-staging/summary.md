# Load Test Validation Snapshot

- Timestamp: `2026-03-19T13:13:40.094Z`
- Environment: `staging`
- Target: `https://staging.valueos.app`
- Canonical production path: `infra/k8s/overlays/production`
- Status: **FAILED**
- Stable artifact: `docs/operations/load-test-artifacts/20260319T131340Z-staging/summary.json`

## Preflight

- Health endpoint: https://staging.valueos.app/api/health
- Health status code: unavailable
- Preflight error: curl: (56) CONNECT tunnel failed, response 403

## Load test

- Status: not_run

## Scaling policy

- Status: not_run

## Infra telemetry

- Pod counts available: false
- Queue depth available: false

## Failure reason

- Target preflight failed before k6 execution: curl: (56) CONNECT tunnel failed, response 403
