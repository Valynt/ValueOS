# Manifest Maturity Validation Runbook

**Purpose:** Step-by-step procedure to advance each critical K8s manifest class from `Aspirational` to `Validated` in `infra/k8s/manifest-maturity-ledger.json`.

**Why this matters:** The `manifest-maturity-production-gate` job in `deploy.yml` hard-blocks every production deployment until all `"critical": true` manifest classes reach `"status": "Validated"` with populated evidence links. This is not optional.

**Current state check:**
```bash
node scripts/ci/report-manifest-maturity-gaps.mjs
```

---

## What "Validated" requires

Each critical manifest class needs three evidence artifacts and two metadata fields:

| Field | What it must contain |
|---|---|
| `evidence.rollout_artifact` | URL to a GitHub Actions artifact or run showing a successful staged rollout |
| `evidence.load_test_artifact` | URL to a k6 load test report showing the class held under target load |
| `evidence.rollback_artifact` | URL to a GitHub Actions artifact or run showing a successful rollback drill |
| `date_validated` | ISO 8601 date the class was last validated (e.g. `2026-04-15`) |
| `status_owner` | Team name responsible for maintaining this class (already set for all classes) |

Evidence values must be URLs or artifact URIs (`https://`, `s3://`, `artifact://`, etc.). Plain text descriptions are rejected by the gate script.

---

## Manifest classes and their owners

| Class | Owner | What to validate |
|---|---|---|
| `deployments` | Platform Engineering | Backend + frontend blue/green rollout, traffic switch, rollback |
| `hpa` | SRE | HPA scales up under load, scales down after, no thrashing |
| `network-policies` | Security Engineering | Zero-trust policies applied; inter-pod traffic blocked as expected |
| `external-secrets` | Platform Security | ExternalSecret objects sync from AWS Secrets Manager / Vault |
| `observability` | Observability Engineering | OTEL collector, Prometheus scrape, Grafana dashboards live |

---

## Procedure per class

### 1. `deployments`

**Owner:** Platform Engineering

**Step 1 — Staged rollout**
1. Trigger a staging deployment via `workflow_dispatch` on `deploy.yml` with `environment: staging`
2. Confirm all pods reach `Ready` state: `kubectl -n valynt-staging rollout status deployment/backend-staging`
3. Confirm smoke test passes (the workflow does this automatically)
4. Copy the GitHub Actions run URL: `https://github.com/Valynt/ValueOS/actions/runs/<run_id>`
5. Set `evidence.rollout_artifact` to this URL

**Step 2 — Load test**
1. Run the abbreviated load test against staging:
   ```bash
   k6 run tests/load/staging-24h.js --duration=15m --vus=50
   ```
2. Confirm p95 latency ≤ 200ms and error rate ≤ 0.1%
3. Upload the k6 HTML report as a GitHub Actions artifact or to S3
4. Set `evidence.load_test_artifact` to the artifact URL

**Step 3 — Rollback drill**
1. With the staging deployment live, trigger a rollback:
   ```bash
   kubectl -n valynt-staging patch service backend-active-staging \
     -p '{"spec":{"selector":{"slot":"blue"}}}'
   kubectl -n valynt-staging patch service frontend-active-staging \
     -p '{"spec":{"selector":{"slot":"blue"}}}'
   ```
2. Confirm traffic returns to the previous slot within 60 seconds
3. Run smoke test against staging to confirm health
4. Document the rollback in a GitHub Actions run or issue
5. Set `evidence.rollback_artifact` to the run/issue URL

---

### 2. `hpa`

**Owner:** SRE

**Step 1 — Rollout evidence**
Reuse the same staging deployment run URL from `deployments` step 1 (HPA is applied as part of the same `kustomize build | kubectl apply`). Set `evidence.rollout_artifact`.

**Step 2 — Load test (HPA scale-up)**
1. Run load test at 2× target RPS to trigger HPA scale-up:
   ```bash
   k6 run tests/load/staging-24h.js --duration=10m --vus=100
   ```
2. Confirm HPA scaled backend replicas above `minReplicas`:
   ```bash
   kubectl -n valynt-staging get hpa backend-hpa -w
   ```
3. After load ends, confirm scale-down within 5 minutes
4. Set `evidence.load_test_artifact` to the k6 report URL

**Step 3 — Rollback drill**
HPA rollback is implicit in the deployment rollback. Reuse the rollback artifact URL from `deployments` step 3. Set `evidence.rollback_artifact`.

---

### 3. `network-policies`

**Owner:** Security Engineering

**Step 1 — Rollout evidence**
Reuse the staging deployment run URL. Network policies are applied in the same `kubectl apply`. Set `evidence.rollout_artifact`.

**Step 2 — Policy verification test**
1. Run the network policy validation script:
   ```bash
   node scripts/ci/validate-k8s-security-policies.mjs
   ```
2. Optionally, run a connectivity test from a test pod to confirm blocked paths:
   ```bash
   kubectl -n valynt-staging run nettest --image=busybox --rm -it -- \
     wget -T 3 http://backend-staging:3001/api/health
   ```
   (Should succeed from within the namespace; should fail from outside)
3. Upload the validation output as a GitHub Actions artifact
4. Set `evidence.load_test_artifact` to the artifact URL (network policy verification serves as the "load" evidence for this class)

**Step 3 — Rollback drill**
Network policies are rolled back with the deployment. Reuse the rollback artifact URL from `deployments`. Set `evidence.rollback_artifact`.

---

### 4. `external-secrets`

**Owner:** Platform Security

**Step 1 — Rollout evidence**
Reuse the staging deployment run URL. ExternalSecret objects are applied in the same `kubectl apply`. Set `evidence.rollout_artifact`.

**Step 2 — Sync verification**
1. Confirm all ExternalSecret objects are synced:
   ```bash
   kubectl -n valynt-staging get externalsecrets -o wide
   ```
   All should show `STATUS: SecretSynced`
2. Verify the secret rotation verification workflow passes:
   ```bash
   # Check latest secret-rotation-verification workflow run
   gh run list --workflow=secret-rotation-verification.yml --limit=1
   ```
3. Upload the `kubectl get externalsecrets` output as an artifact
4. Set `evidence.load_test_artifact` to the artifact URL

**Step 3 — Rotation drill**
1. Trigger a manual secret rotation for one non-critical secret in staging
2. Confirm the ExternalSecret re-syncs within 5 minutes
3. Document in a GitHub issue or Actions run
4. Set `evidence.rollback_artifact` to the issue/run URL

---

### 5. `observability`

**Owner:** Observability Engineering

**Step 1 — Rollout evidence**
Reuse the staging deployment run URL. Observability stack (OTEL collector, Prometheus adapter, Grafana) is applied in the same overlay. Set `evidence.rollout_artifact`.

**Step 2 — Live check verification**
The `infra-conformance-post-deploy` job in `deploy.yml` already runs live checks for:
- NATS JetStream
- OTel collector
- Monitoring target present

1. Confirm the `infra-conformance-post-deploy` job passed in the staging deployment run
2. Download the `infra-conformance-<run_id>` artifact
3. Set `evidence.load_test_artifact` to the artifact URL

**Step 3 — Alert firing drill**
1. Trigger a synthetic alert in staging (e.g., temporarily lower an SLO threshold)
2. Confirm the alert fires in Alertmanager and routes to PagerDuty
3. Resolve the alert and confirm it clears
4. Document in a GitHub issue
5. Set `evidence.rollback_artifact` to the issue URL

---

## Updating the ledger

Once all three evidence artifacts are collected for a class, update `infra/k8s/manifest-maturity-ledger.json`:

```json
{
  "class": "deployments",
  "critical": true,
  "status": "Validated",
  "minimum_maturity_by_environment": {
    "staging": "Aspirational",
    "production": "Validated"
  },
  "status_owner": "Platform Engineering",
  "date_validated": "2026-04-15",
  "evidence": {
    "rollout_artifact": "https://github.com/Valynt/ValueOS/actions/runs/12345678",
    "load_test_artifact": "https://github.com/Valynt/ValueOS/actions/runs/12345678/artifacts/987654",
    "rollback_artifact": "https://github.com/Valynt/ValueOS/actions/runs/12345679"
  }
}
```

The PR that updates the ledger will be validated by `check-k8s-manifest-maturity.mjs` in `--mode=transition-check`, which verifies that the transition from `Aspirational` to `Validated` includes all required fields.

**Verify locally before pushing:**
```bash
node scripts/ci/report-manifest-maturity-gaps.mjs
node scripts/ci/check-k8s-manifest-maturity.mjs \
  --mode=environment-gate \
  --environment=production \
  --ledger-path=infra/k8s/manifest-maturity-ledger.json \
  --require-critical-evidence-links=true \
  --require-production-evidence-artifacts=true
```

Both commands must exit 0 before the production gate will pass.
