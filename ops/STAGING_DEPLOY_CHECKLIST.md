# Staging Deployment Checklist

Pre-flight checklist for the first staging deploy. Infrastructure is Docker Compose
(`ops/compose/compose.staging.yml`), not Kubernetes. K8s manifests in `infra/k8s/` are
aspirational and not used for v1.

## Prerequisites

- [ ] Supabase project provisioned (or self-hosted instance running)
- [ ] Redis instance available (managed or Docker) with TLS (`rediss://`)
- [ ] Domain with DNS pointing to staging server
- [ ] `.env.staging` created from `ops/env/.env.staging.template` (run `bash scripts/setup-env.sh staging`)
- [ ] All required vars populated (the script flags empty critical vars)
- [ ] Secrets populated: `supabase_service_key.txt`, `openai_api_key.txt`

## Database

- [ ] Migrations applied: `supabase db push --db-url "$DATABASE_URL"`
- [ ] RLS policies verified: `pnpm run test:rls` (requires DB connection)
- [ ] Seed data loaded (if applicable)

## Build & Deploy

- [ ] `docker compose -f ops/compose/compose.staging.yml --env-file ops/env/.env.staging up -d --build`
- [ ] All containers healthy: `docker compose -f ops/compose/compose.staging.yml ps`
- [ ] Backend responds: `curl -s https://<domain>/api/health/ready`
- [ ] Frontend loads: `curl -s https://<domain>/health`

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
