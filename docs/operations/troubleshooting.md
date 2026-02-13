# Troubleshooting

**Last Updated**: 2026-02-08

**Consolidated from 4 source documents**

---

## Table of Contents

1. [Webhook Failures (Delivery Errors)](#webhook-failures-(delivery-errors))
2. [DX Troubleshooting Guide](#dx-troubleshooting-guide)
3. [Agent Stalls (Queues Not Draining)](#agent-stalls-(queues-not-draining))
4. [RLS / Auth Failures (Permission Denied)](#rls--auth-failures-(permission-denied))

---

## Webhook Failures (Delivery Errors)

*Source: `operations/troubleshooting/webhook-failures.md`*

**Goal:** Restore outbound webhook delivery when partners report missing callbacks or repeated retries.

## Symptoms
- Partner systems report missing events or duplicated deliveries.
- Delivery dashboard shows high retry counts or `5xx` responses.
- Queue backlog increases on the `webhook:pending` stream.

## First-Response Checklist
1. Confirm whether failures are global or scoped to a single destination URL.
2. Capture one failing delivery ID and the associated tenant/application.
3. Notify **Integrations Owner** and **On-Call SRE**; open an incident ticket.

## Triage Procedure
1. **Check delivery metrics**
   - Grafana panel `Webhooks › Success vs Failure` should show recent spikes.
   - If failures correlate with a single subscriber, proceed with targeted disablement.
2. **Inspect failing deliveries**
   - Pull latest failing attempts:
     ```sql
     SELECT id, target_url, status, error_message, attempted_at
     FROM webhook_delivery_attempts
     WHERE status = 'failed'
     ORDER BY attempted_at DESC
     LIMIT 20;
     ```
   - If the same `target_url` repeats, consider pausing that subscription.
3. **Validate signing and headers**
   - Recompute signature to confirm key drift:
     ```bash
     printf "%s" "$WEBHOOK_PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET"
     ```
   - Ensure `X-Tenant-Id` and `X-Request-Id` headers are present at the gateway.
4. **Replay from dead letter queue**
   - Identify DLQ size: `redis-cli -u "$REDIS_URL" LLEN webhook:dlq`
   - Requeue a single payload to validate path end-to-end:
     ```bash
     redis-cli -u "$REDIS_URL" RPOPLPUSH webhook:dlq webhook:pending
     ```
5. **Network and TLS checks**
   - Use mTLS health check for partners requiring client certs:
     ```bash
     curl -v --cert client.pem --key client.key https://partner.example.com/webhook/health
     ```
   - If DNS issues are suspected, test from another VPC subnet.
6. **Validate recovery**
   - Confirm `webhook:pending` length returns to baseline and success rate >99% for 15 minutes.
   - Communicate resolution and provide retry window to partners.

## Observability Queries
- **Loki (LogQL) to find failing target URLs**
  ```logql
  sum by(target) (rate({app="webhook-dispatcher", status!~"2.."} [5m]))
  ```
- **Loki to detect signature mismatches**
  ```logql
  count_over_time({app="webhook-dispatcher"} |= "signature" |= "mismatch" [10m])
  ```
- **SQL to find noisy subscriptions**
  ```sql
  SELECT subscription_id, target_url, count(*) AS failures_last_hour
  FROM webhook_delivery_attempts
  WHERE status = 'failed' AND attempted_at > now() - interval '1 hour'
  GROUP BY subscription_id, target_url
  ORDER BY failures_last_hour DESC
  LIMIT 10;
  ```

## Escalation
- If >10% of deliveries fail for more than 10 minutes, classify as P1 and coordinate rollback per `docs/operations/runbooks/rollback.md`.
- For single destination outages, disable the subscription temporarily via the admin console and inform the partner of auto-retry policy.

---

## DX Troubleshooting Guide

*Source: `DX_TROUBLESHOOTING.md`*

## Error Codes Reference

### DX_ERR_001: Missing Observability Module


Symptoms:

- Backend crashes with `ERR_MODULE_NOT_FOUND` for `../lib/observability`

Root Cause:

Code imports from `../lib/observability` but the directory or `index.ts` file doesn't exist.

Fix:

```bash
# Validate all imports
pnpm run dx:validate-imports

# Create missing module (if needed)
mkdir -p packages/backend/src/lib/observability
# Add observability/index.ts with required exports
```


Prevention: Import validation runs in CI via `.github/workflows/dx-e2e.yml`.

---

### DX_ERR_002: Port Conflict Detected

Symptoms:

- DX startup fails with "address already in use"
- Services can't bind to required ports (3001, 5173, 5432, 6379, 54321-54323)


Root Cause:

Another process is using a required port.

Fix:

```bash
# Find process using port (replace PORT with actual number)
lsof -ti:PORT

# Kill the process
lsof -ti:PORT | xargs kill -9

# Or use the sanitize script
pnpm run dx:sanitize
```


Prevention: Run `pnpm run dx:sanitize` before starting DX.

---

### DX_ERR_003: Backend Health Check Failed

Symptoms:

- Backend starts but health endpoint returns 500 or doesn't respond
- Frontend can't connect to backend API


Root Cause:

- Database connection failed
- Missing environment variables
- Module import errors
- Unhandled exceptions in startup code


Fix:

```bash
# Check backend logs
tail -f /tmp/dx-backend.log

# Check trace log
cat .dx-trace.log | grep ERROR

# Verify environment
cat .env.local | grep DATABASE_URL

# Test backend directly
curl -v http://localhost:3001/health
```


Prevention: Module contract tests in `packages/backend/src/__tests__/module-contracts.test.ts`.

---

### DX_ERR_004: Database Connection Refused

Symptoms:

- Migrations fail with "connection refused"
- Backend can't connect to Postgres


Root Cause:

- Postgres container not running
- Wrong host/port in DATABASE_URL
- Container network issue in DevContainer


Fix:

```bash
# Check if postgres is running
docker ps | grep postgres

# Check postgres logs
docker logs valueos-postgres

# Restart postgres
docker compose -f docker-compose.deps.yml up -d postgres

# Test connection
PGPASSWORD=dev_password psql -h localhost -p 5432 -U postgres -d valuecanvas_dev -c 'SELECT 1'
```


Prevention: Orchestrator checks Docker availability in preflight.

**Prevention:** Orchestrator checks Docker availability in preflight.

### DX_ERR_005: Supabase DB Port Binding Failed


Symptoms:

- `supabase start` fails with "dial tcp 127.0.0.1:54322: connect: connection refused"
- Supabase Kong container is not running


Root Cause:

- Port 54322 already in use
- Supabase DB container failed to start
- Race condition in healthcheck


Fix:

```bash
# Kill process on 54322
lsof -ti:54322 | xargs kill -9

# Hard reset Supabase
cd infra/supabase
supabase stop --workdir . || true
docker compose -f docker-compose.yml down -v --remove-orphans
supabase start --workdir . --debug

# Check Supabase status
supabase status --workdir infra/supabase
```


Prevention: DX falls back to `valueos-postgres` if Supabase fails.

---

### DX_ERR_006: Migration TLS Error

Symptoms:

- `supabase db push` fails with "tls error (server refused TLS connection)"
- Migrations work on one environment but not another


Root Cause:

- Postgres container doesn't support TLS
- Connection string has conflicting SSL parameters
- Client is attempting TLS despite `sslmode=disable`


Fix:

```bash
# Force disable TLS
export PGSSLMODE=disable

# Run migrations with explicit sslmode
supabase db push \
  --workdir infra/supabase \
  --db-url "postgresql://postgres:dev_password@localhost:5432/valuecanvas_dev?sslmode=disable" \
  --debug
```


Prevention: Orchestrator removes invalid SSL params from connection strings.

---

### DX_ERR_007: Module Not Found at Runtime

Symptoms:

- `ERR_MODULE_NOT_FOUND` at runtime
- Import path looks correct but Node can't resolve it


Root Cause:

- File doesn't exist at import path
- Casing mismatch (Linux is case-sensitive)
- Missing `.js` extension in ESM import
- Directory import without `index.ts`


Fix:

```bash
# Validate all imports
pnpm run dx:validate-imports

# Check file exists (note: case-sensitive)
ls -la packages/backend/src/lib/observability

# For ESM, add .js extension to imports
# ✅ import { foo } from './lib/bar.js'
```


Prevention: Import resolution tests run in CI.

---

### DX_ERR_008: Docker Not Available

Symptoms:

- "Cannot connect to Docker daemon"
- "docker: command not found"

Root Cause:

- Docker Desktop not running
- Docker socket not accessible
- User not in `docker` group (Linux)


Fix:

```bash
# Start Docker Desktop (macOS/Windows)
open -a Docker

# Check Docker status (Linux)
sudo systemctl status docker

# Add user to docker group (Linux, requires logout)
sudo usermod -aG docker $USER

# Test Docker
docker ps
```


Prevention: Orchestrator checks Docker availability in preflight.

---

### DX_ERR_009: Environment Variable Not Set

Symptoms:

- Services fail with "env var not set" errors
- Database URL is undefined


Root Cause:

- `.env.local` file missing or incomplete
- Environment not regenerated after changes


Fix:

```bash
# Regenerate environment
pnpm run dx:env

# Validate environment
pnpm run dx:env:validate

# Check generated file
cat .env.local
```


Prevention: Setup script generates `.env.local` automatically.

---

### DX_ERR_010: Supabase Containers Not Running

Symptoms:

- Supabase API unreachable
- Kong container status shows "Exited"


Root Cause:

- Container startup failure
- Healthcheck timeout
- Volume corruption


Fix:

```bash
# Check container status
docker ps -a | grep supabase

# View logs
docker compose -f infra/supabase/docker-compose.yml logs --tail=100

# Hard reset (WARNING: deletes local data)
cd infra/supabase
supabase stop --workdir . || true
docker compose -f docker-compose.yml down -v --remove-orphans
docker volume prune -f
supabase start --workdir . --debug
```


Prevention: Orchestrator provides structured error output with context.

---

## General Debugging Steps

1. Check Trace Log

```bash
# View execution trace
cat .dx-trace.log | jq '.'

# Filter errors only
cat .dx-trace.log | jq 'select(.level == "ERROR")'
```

2. Sanitize Environment

```bash
# Clean state and check ports
pnpm run dx:sanitize

# Force clean (stops containers)
pnpm run dx:sanitize:force
```

3. Validate Imports

```bash
# Check all backend imports resolve
pnpm run dx:validate-imports
```

4. Run Tests

```bash
# Module contract tests
pnpm test packages/backend/src/__tests__/module-contracts.test.ts

# Import resolution tests
pnpm test packages/backend/src/__tests__/import-resolution.test.ts
```

5. Check Checkpoints

```bash
# View last checkpoint (shows where failure occurred)
cat .dx-checkpoints.json | jq '.[-1]'
```

## Getting Help


Collect diagnostics:

```bash
# Capture full state
cat .dx-trace.log > /tmp/dx-debug.log
docker ps -a >> /tmp/dx-debug.log
cat .env.local >> /tmp/dx-debug.log
```

Share context:

- Error code (e.g., DX_ERR_003)
- Trace log excerpt
- Output of `docker ps`
- Output of `pnpm run dx:doctor`

Open issue: Include diagnostic output and steps to reproduce.

---

## Agent Stalls (Queues Not Draining)

*Source: `operations/troubleshooting/agent-stalls.md`*

**Goal:** Restore forward progress when background agents appear hung or queues stop draining.

## Symptoms
- Task queue depth grows while throughput trends to zero.
- Agent heartbeats stop updating in Redis or the database.
- API callers wait indefinitely for agent-produced results.

## First-Response Checklist
1. Page the **On-Call SRE** and notify the **Feature Owner** for the affected service.
2. Announce the investigation in `#incidents` with the ticket link and time started.
3. Capture current queue metrics screenshots (Grafana "Worker/Queue Overview").

## Quick Health Checks
- Redis availability: `redis-cli -u "$REDIS_URL" PING`
- Queue visibility: `redis-cli -u "$REDIS_URL" LLEN agent:pending`
- Worker pods: `kubectl get pods -l app=agent-worker`

## Triage Procedure
1. **Confirm queue congestion**
   - If LLEN > baseline for 5+ minutes, treat as active stall.
   - Compare against alerts in Grafana panel `Queues › Backlog`.
2. **Check worker liveness**
   - Inspect pod readiness and restarts: `kubectl describe pod <name>`.
   - Review worker logs for retry storms or unhandled exceptions.
3. **Validate Redis connectivity and auth**
   - Run `redis-cli -u "$REDIS_URL" INFO clients` and verify `blocked_clients` < 5.
   - If `MISCONF` appears, persistence is failing—fail over to the replica.
4. **Identify blocked jobs**
   - List stuck jobs older than 10 minutes:
     ```sql
     SELECT id, task_type, status, updated_at
     FROM agent_jobs
     WHERE status IN ('running', 'retry')
       AND updated_at < now() - interval '10 minutes'
     ORDER BY updated_at ASC
     LIMIT 50;
     ```
   - If many jobs are stuck on one task type, open the corresponding service logs.
5. **Restart unhealthy workers**
   - Drain one pod at a time to avoid thundering herds:
     ```bash
     kubectl cordon <node-with-bad-pod>
     kubectl delete pod <agent-worker-pod>
     ```
   - Verify new pod pulls the latest image and reconnects to Redis.
6. **Redis inspection**
   - Look for oversized payloads causing timeouts:
     ```bash
     redis-cli -u "$REDIS_URL" --bigkeys | head -n 20
     ```
   - If `agent:pending` entries exceed 100k, enable rate limiting on producers until drain catches up.
7. **Validate recovery**
   - Ensure LLEN decreases for 10 consecutive minutes.
   - Close the incident only after backlog returns to baseline and no retries are piling up.

## Observability Queries
- **Loki (LogQL) to find stalled task types**
  ```logql
  sum by(task_type) (rate({app="agent-worker", level="error"} |= "timeout" [5m]))
  ```
  A spike on a single `task_type` points to a bad upstream dependency.
- **Loki to find reconnect loops**
  ```logql
  count_over_time({app="agent-worker"} |= "ECONNREFUSED" [10m])
  ```
- **PostgreSQL to confirm heartbeats**
  ```sql
  SELECT worker_id, max(heartbeat_at) AS last_seen
  FROM agent_worker_heartbeats
  GROUP BY worker_id
  ORDER BY last_seen ASC;
  ```

## Escalation
- If Redis is unavailable for >10 minutes, fail over to the replica and open a P1 infrastructure incident.
- If a code regression is suspected, ask the **Release Captain** to prepare rollback per `docs/operations/runbooks/rollback.md`.

---

## RLS / Auth Failures (Permission Denied)

*Source: `operations/troubleshooting/rls-failures.md`*

**Goal:** Resolve `permission denied` and `policy restriction` errors for end users and service accounts.

## Symptoms
- API responses return HTTP 401/403 with `permission denied` messages.
- Supabase/PostgreSQL logs show `policy` or `rls` violations.
- JWT audience mismatches reported in gateway or Edge Functions logs.

## First-Response Checklist
1. Identify whether the error affects **all tenants** or a **single tenant**.
2. Collect a failing request ID and JWT (redact secrets) from logs or the client.
3. Announce investigation in `#incidents` and tag the **Auth Owner**.

## Triage Procedure
1. **Reproduce with policy simulation**
   - In Supabase SQL editor or psql, set the role and claim context:
     ```sql
     set role app_user;
     select set_config('request.jwt.claims', '{"sub":"<user_id>","role":"member","tenant_id":"<tenant>"}', true);
     explain analyze select * from documents where id = '<doc_id>';
     ```
   - If the query still fails, note the rejected policy.
2. **Decode JWT locally**
   - Inspect issuer, audience, and expiration:
     ```bash
     python - <<'PY'
     import base64, json, sys
     token = sys.argv[1].split('.')[1]
     padded = token + '=' * (-len(token) % 4)
     print(json.dumps(json.loads(base64.urlsafe_b64decode(padded)), indent=2))
     PY "$JWT"
     ```
   - Ensure `aud` matches the API gateway config and `tenant_id`/`role` claims exist.
3. **Check RLS policies deployed**
   - List active policies for the table:
     ```sql
     SELECT tablename, policyname, permissive, roles, cmd
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'documents';
     ```
   - Verify policy ordering matches `docs/RLS_QUICK_REFERENCE.md`.
4. **Validate service roles and keys**
   - Ensure the calling service uses the correct `service_role` key for administrative actions.
   - Rotate leaked keys immediately via Supabase dashboard (Project Settings → API → Regenerate).
5. **Confirm gateway configuration**
   - Check Envoy/NGINX route for audience enforcement and tenant headers.
   - If misconfigured, trigger config sync via GitHub Actions: https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml

## Observability Queries
- **Loki (LogQL) to find 403 spikes by route**
  ```logql
  sum by(route) (rate({app="gateway", status="403"} [5m]))
  ```
- **Loki to identify JWT validation errors**
  ```logql
  count_over_time({app="gateway"} |= "JWT" |= "invalid" [10m])
  ```
- **SQL to find denied requests per tenant**
  ```sql
  SELECT tenant_id, count(*) AS denied_count, max(created_at) AS last_seen
  FROM audit_log
  WHERE status = 'denied'
    AND created_at > now() - interval '1 hour'
  GROUP BY tenant_id
  ORDER BY denied_count DESC;
  ```

## Common Fixes
- Missing `tenant_id` claim → update issuing service to add the claim; invalidate old tokens.
- Policy too restrictive → adjust `policyname` to include the new role, then run `supabase db push`.
- Expired JWT → confirm clock skew; if >30s, resync NTP on gateway nodes.

## Escalation
- If multiple tenants are blocked for >15 minutes, classify as P1 and prepare rollback using `docs/operations/runbooks/rollback.md`.
- For single-tenant impacts, open a P2 and provide a temporary support token while you fix the policy.

---