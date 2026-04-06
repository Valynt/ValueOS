# Deployment Strategy

**Runtime platform:** Kubernetes  
**Strategy:** Blue/green with automated smoke-test rollback  
**Environments:** dev (local) → staging → production

---

## Environment matrix

| Concern | Dev (local) | Staging | Production |
|---|---|---|---|
| Runtime | Docker Compose (`ops/compose/`) | Kubernetes | Kubernetes |
| Namespace | n/a | `valynt-staging` | `valynt` |
| Kustomize overlay | n/a | `infra/k8s/overlays/staging/` | `infra/k8s/overlays/production/` |
| Deploy trigger | developer | push to `main` (auto) | manual approval in `deploy.yml` |
| Cluster auth secret | n/a | `KUBE_CONFIG_STAGING` | `KUBE_CONFIG_PRODUCTION` |
| Blue/green active slot | n/a | blue (default) | blue (default) |
| Replica count | 1 | backend: 2, frontend: 1 | backend: 3, frontend: 2 |
| WAF | n/a | optional | AWS WAFv2 (ALB annotation) |
| Database | local Supabase | Supabase staging project | Supabase production project |

---

## Blue/green mechanics

The base manifests define two idle deployments per service:

```
backend-blue   (slot: blue)   ← active by default (replicas: 3 in prod)
backend-green  (slot: green)  ← idle (replicas: 0)
frontend-blue  (slot: blue)   ← active
frontend-green (slot: green)  ← idle
```

A single `backend-active` Service selects the live slot via label:

```yaml
selector:
  app: backend
  slot: blue   # ← this is the only thing that changes during a swap
```

### Deploy sequence

```
1. Pre-flight
   ├── Verify release-manifest.json exists for this SHA
   ├── Verify Cosign signatures on both images
   ├── Run DAST gate against staging
   └── Verify all release-gate-contract jobs are green

2. Migration (pre-deploy)
   ├── Take point-in-time snapshot (Supabase PITR or pg_dump)
   ├── Apply forward migrations to target database
   ├── Run migration integrity check (verify tables + RLS)
   └── Record migration checkpoint ID

3. Scale up idle slot
   ├── Patch idle deployment image tag to new SHA
   ├── Scale idle slot to target replicas
   └── Wait for all pods Ready (kubectl rollout status, timeout 300s)

4. Smoke tests against idle slot (internal traffic only)
   ├── GET /health/live → 200
   ├── GET /health/ready → 200
   ├── POST /api/auth/session (synthetic user) → 200
   ├── GET /api/tenants/:id (RLS check) → 200 or 403 (not 500)
   └── Agent fabric ping (OpportunityAgent dry-run) → no error

5. Traffic swap
   ├── Patch backend-active Service selector: slot → <new>
   ├── Patch frontend-active Service selector: slot → <new>
   └── Verify ingress routes to new slot (curl probe)

6. Post-swap smoke tests (live traffic)
   ├── Repeat health + critical path probes
   ├── Check error rate in Prometheus (< 1% over 2 min window)
   └── Check p95 latency (< 5000ms per quality-baselines.json)

7. Scale down old slot
   └── Set old slot replicas: 0 (keep deployment for fast rollback)

8. Emit deployment audit artifact
   └── Record: SHA, slot, migration checkpoint, actor, timestamp
```

### Rollback procedure

Rollback is triggered automatically if step 6 smoke tests fail, or manually via `workflow_dispatch`.

```
1. Immediate traffic revert
   ├── Patch active Service selector back to previous slot
   └── Verify traffic returns to old slot (probe)

2. Scale up old slot (if it was already scaled down)
   └── kubectl scale deployment/<old-slot> --replicas=<target>

3. Migration rollback (if schema changed)
   ├── Identify migration checkpoint from deploy audit artifact
   ├── Apply rollback SQL files in reverse order
   │   (scripts/ci/apply-and-rollback-migrations.sh)
   └── Verify schema matches pre-deploy state

4. Incident record
   ├── Create GitHub issue (label: incident-followup)
   ├── Record: rollback reason, affected SHA, migration state
   └── Page on-call if production

5. Post-mortem gate
   └── Next production deploy requires post-mortem issue closed
```

**RTO target:** < 5 minutes (traffic swap is instant; migration rollback adds 2–10 min depending on schema complexity)

---

## Canary option (future)

The current blue/green setup can be extended to canary by using weighted routing at the ingress layer (AWS ALB weighted target groups or Nginx `split_clients`). The active Service selector approach remains; a second Service is added for the canary slot with a small weight.

Canary is recommended when:
- Releasing agent behavior changes (financial model outputs)
- Releasing schema changes that affect query plans
- Any change touching the HardenedAgentRunner confidence thresholds

---

## Environment promotion gates

```
dev (local)
    │  developer runs pnpm ci:verify locally
    ▼
staging
    │  All pr-fast + main-verify + release gates green
    │  DAST gate green
    │  Smoke tests pass
    ▼
production
    │  All staging gates green
    │  Manual approval (GitHub environment protection rule)
    │  No open P0/P1 incidents
    │  Post-mortem closed (if previous rollback occurred)
    │  Secret rotation evidence within policy window
    │  Reliability indicators gate green
```

---

## Kubernetes rollout configuration

Both blue and green deployments use:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0   # zero-downtime within a slot
```

PodDisruptionBudgets (`backend-pdb.yaml`, `frontend-pdb.yaml`) ensure at least one pod remains available during node maintenance.

HPAs (`hpa.yaml`, `worker-hpa.yaml`) scale on CPU + custom Prometheus metrics (queue depth, agent execution rate).

---

## Secret management

Secrets are injected via Kubernetes ExternalSecrets (AWS Secrets Manager in production, Vault in staging). The `external-secrets.yaml` base manifest defines the ExternalSecret resources. Environment-specific patches (`external-secrets-aws-patch.yaml`, `external-secrets-vault-patch.yaml`) configure the provider.

No secrets are stored in kustomize overlays or ConfigMaps. The `check-browser-provider-secrets` and `check-frontend-bundle-service-role` CI gates verify no secrets leak into the frontend bundle.
