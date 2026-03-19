# Staging Deployment Checklist

Pre-flight checklist for the first staging deploy. Infrastructure is Docker Compose
(`ops/compose/compose.staging.yml`), not Kubernetes. K8s manifests in `infra/k8s/` are
aspirational and not used for v1.

## Secret management policy

- [ ] No production-class secrets are stored in `ops/env/.env.staging*`, `.env`, or any host-side flat env file.
- [ ] Staging secret values live in the managed-secret path and are hydrated at runtime through `packages/backend/src/server.ts` → `initSecrets()`. Note: startup-time validation by `packages/backend/src/config/secrets/SecretValidator.ts` currently runs only when `NODE_ENV=production`; for staging, validate secrets via the backend’s secret health-check endpoint/process (for example, a `/health/secrets` check) before promoting a build.
- [ ] `SECRETS_PROVIDER` is set to the active provider (`aws` or `vault`) in the bootstrap env file or CI runtime.
- [ ] `SECRETS_TENANT_ID=platform` unless a different tenant scope is explicitly approved.

## Canonical managed-secret paths

For `tenantId=platform`, use these paths and names:

| Runtime env var | Secret name | AWS Secrets Manager path | Vault KV v2 path | Rotation owner |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | `database-url` | `valuecanvas/staging/tenants/platform/database-url` | `secret/data/staging/tenants/platform/database-url` | Platform Engineering |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase-service-key` | `valuecanvas/staging/tenants/platform/supabase-service-key` | `secret/data/staging/tenants/platform/supabase-service-key` | Platform Engineering |
| `REDIS_URL` | `redis-url` | `valuecanvas/staging/tenants/platform/redis-url` | `secret/data/staging/tenants/platform/redis-url` | Platform Engineering |
| `JWT_SECRET` | `jwt-secret` | `valuecanvas/staging/tenants/platform/jwt-secret` | `secret/data/staging/tenants/platform/jwt-secret` | Application Security |
| `ENCRYPTION_KEY` | `encryption-key` | `valuecanvas/staging/tenants/platform/encryption-key` | `secret/data/staging/tenants/platform/encryption-key` | Application Security |
| `TOGETHER_API_KEY` | `together-api-key` | `valuecanvas/staging/tenants/platform/together-api-key` | `secret/data/staging/tenants/platform/together-api-key` | AI Platform |
| `OPENAI_API_KEY` | `openai-api-key` | `valuecanvas/staging/tenants/platform/openai-api-key` | `secret/data/staging/tenants/platform/openai-api-key` | AI Platform |
| `APPROVAL_ACTION_SECRET` | `approval-action-secret` | `valuecanvas/staging/tenants/platform/approval-action-secret` | `secret/data/staging/tenants/platform/approval-action-secret` | Application Security |
| `APPROVAL_WEBHOOK_SECRET` | `approval-webhook-secret` | `valuecanvas/staging/tenants/platform/approval-webhook-secret` | `secret/data/staging/tenants/platform/approval-webhook-secret` | Application Security |
| `STRIPE_SECRET_KEY` | `stripe-secret-key` | `valuecanvas/staging/tenants/platform/stripe-secret-key` | `secret/data/staging/tenants/platform/stripe-secret-key` | Finance Platform |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook-secret` | `valuecanvas/staging/tenants/platform/stripe-webhook-secret` | `secret/data/staging/tenants/platform/stripe-webhook-secret` | Finance Platform |
| `SENTRY_DSN` | `sentry-dsn` | `valuecanvas/staging/tenants/platform/sentry-dsn` | `secret/data/staging/tenants/platform/sentry-dsn` | Platform Engineering |

## Prerequisites

- [ ] Supabase project provisioned (or self-hosted instance running)
- [ ] Redis instance available (managed or Docker) with TLS (`rediss://`)
- [ ] Domain with DNS pointing to staging server
- [ ] `ops/env/.env.staging.bootstrap` created with **bootstrap metadata only** (non-secret values and managed-secret metadata)
- [ ] Backend secret name variables in bootstrap/CI match the canonical names above
- [ ] Rotation owners have confirmed the managed-secret values are current before deploy

## Database

- [ ] Migrations applied: `supabase db push --db-url "$DATABASE_URL"`
- [ ] RLS policies verified: `pnpm run test:rls` (requires DB connection)
- [ ] Seed data loaded (if applicable)

## Build & Deploy

- [ ] Secret paths exist in AWS Secrets Manager or Vault before deployment
- [ ] Bootstrap env file contains only non-sensitive values (`APP_DOMAIN`, `ACME_EMAIL`, `VITE_*`, provider selection, secret-name metadata)
- [ ] `docker compose -f ops/compose/compose.staging.yml --env-file ops/env/.env.staging.bootstrap up -d --build`
- [ ] All containers healthy: `docker compose -f ops/compose/compose.staging.yml ps`
- [ ] Backend responds: `curl -s https://<domain>/api/health/ready`
- [ ] Frontend loads: `curl -s https://<domain>/health`

## Kubernetes staging manifests (reference path)

If you are validating the aspirational staging K8s manifests under `infra/k8s/overlays/staging/`:

- [ ] Apply `infra/k8s/base/external-secrets.yaml`
- [ ] Apply `infra/k8s/overlays/staging/external-secrets-aws-patch.yaml`
- [ ] Confirm the staging `ExternalSecret` remote refs point at `valuecanvas/staging/tenants/platform/*`
- [ ] Do not reintroduce literal secret values into overlay YAML

## Smoke Tests

- [ ] Auth flow: signup → login → logout
- [ ] Tenant creation: new org provisioned with RLS
- [ ] Agent invocation: invoke one agent, verify response
- [ ] WebSocket: SDUI real-time updates work
- [ ] Rate limiting: auth endpoints return 429 after threshold

## Test Suites (run against staging DB)

- [ ] Unit tests pass: `pnpm test`
- [ ] Agent security suite: `bash scripts/test-agent-security.sh`
- [ ] Cross-tenant isolation: verify tenant A cannot access tenant B data

## Post-Deploy

- [ ] Zero-downtime deploy verified (rolling restart with no 5xx)
- [ ] Logs flowing to structured output (JSON, no raw console.log)
- [ ] Health check returns degraded status when Redis is down
- [ ] Document any gaps found during deploy in this file
