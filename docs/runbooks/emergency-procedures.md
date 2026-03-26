---
title: Emergency Procedures
owner: team-platform
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
system: valueos-platform
ops_labels: incident-response,security,emergency
status: active
---

# Emergency Procedures

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Failure Playbook

*Source: `FAILURE_PLAYBOOK.md`*

This guide covers common issues encountered in the ValueOS development environment and how to resolve them.

## Top 10 Common Failures

### 1. Port Conflicts
**Symptom:** `Error: listen EADDRINUSE: address already in use :::3001`
**Fix:**
- Check which process is using the port: `lsof -i :3001`
- Kill the process: `kill <PID>`
- Or use `./dev doctor` to diagnose.

### 2. Docker Daemon Not Running
**Symptom:** `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`
**Fix:**
- Start Docker Desktop or the Docker service: `sudo service docker start`

### 3. Database Readiness
**Symptom:** Backend fails to connect to database on startup.
**Fix:**
- Ensure the database is healthy: `./dev logs postgres`
- Wait for "database system is ready to accept connections".
- The `depends_on` in docker-compose usually handles this, but if you reset volumes, it might take longer.

### 4. Supabase Connection Issues
**Symptom:** `AuthApiError: Database error saving new user`
**Fix:**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct in `.env.local`.
- Run `./dev doctor` to validate environment variables.

### 5. Lockfile Drift
**Symptom:** CI fails with `ERR_PNPM_LOCKFILE_BREAKING_CHANGE`.
**Fix:**
- Run `pnpm install` locally to update `pnpm-lock.yaml` and commit the changes.
- Ensure you are using the same pnpm version as CI (check `package.json` `packageManager` field).

### 6. Node Version Mismatch
**Symptom:** Weird syntax errors or package installation failures.
**Fix:**
- Ensure you are using Node 20.x.
- Run `node -v` to check.
- Use `nvm use 20` if you have nvm installed.

### 7. Cache Corruption
**Symptom:** Builds fail with inexplicable errors.
**Fix:**
- Run `./dev reset` to clear Docker volumes and containers.
- Run `pnpm store prune` to clear pnpm cache if running locally.

### 8. Permission Issues (Docker)
**Symptom:** `permission denied` when running docker commands.
**Fix:**
- Add your user to the docker group: `sudo usermod -aG docker $USER`
- Log out and log back in.

### 9. Container Health Check Failures
**Symptom:** Container status is `unhealthy`.
**Fix:**
- Check logs: `./dev logs <service>`
- Ensure the service application is actually starting and listening on the expected port.

### 10. Network Issues
**Symptom:** Services cannot talk to each other.
**Fix:**
- Ensure all services are on the same network (handled by `docker-compose.dev.yml`).
- Use service names (e.g., `http://backend:3001`) instead of `localhost` for inter-container communication.

## Quick Reset
If all else fails:
```bash
./dev reset
./dev up
```

---

## Auth fallback emergency mode (IdP outage)

Use this procedure only when the identity provider is unavailable and user impact is ongoing.

### Preconditions
- Confirm IdP outage and incident ticket severity with on-call security + platform leads.
- Validate Redis/shared storage availability, because revoked token/session denylist checks depend on it.
- Define a strict expiry timestamp before enabling fallback (`AUTH_FALLBACK_EMERGENCY_TTL_UNTIL`, ISO-8601 UTC).
- Confirm fallback authority and approvals:
  - **Activation authority:** Security Incident Commander (IC) + Platform Incident Commander.
  - **Dual approval chain:** (1) on-call Security lead, (2) Platform director or delegated incident approver.
  - Record approver names and exact UTC timestamps in the incident ticket before config changes.
- Prepare signed incident context:
  - Generate `AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE` using `AUTH_FALLBACK_INCIDENT_SIGNING_SECRET`.
  - Signature payload format: `incidentId|severity|incidentStartedAt|ttlUntil|allowedRoutesCsv|allowedRolesCsv`.
  - Production startup validation rejects emergency mode if signature or signing secret is missing/invalid.

### Enable fallback (time-boxed break-glass)
1. Set `AUTH_FALLBACK_EMERGENCY_MODE=true`.
2. Set `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL=<ISO-8601 timestamp>` for the shortest viable window (**required ≤ 30 minutes**).
3. Ensure `SUPABASE_JWT_ISSUER` and `SUPABASE_JWT_AUDIENCE` are set and validated.
4. Set incident metadata and allowlists:
   - `AUTH_FALLBACK_INCIDENT_ID`
   - `AUTH_FALLBACK_INCIDENT_SEVERITY`
   - `AUTH_FALLBACK_INCIDENT_STARTED_AT`
   - `AUTH_FALLBACK_ALLOWED_ROUTES` and/or `AUTH_FALLBACK_ALLOWED_ROLES`
   - `AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE`
   - `AUTH_FALLBACK_INCIDENT_SIGNING_SECRET`
5. Keep `ALLOW_LOCAL_JWT_FALLBACK` unset/false in non-dev environments (production startup fails if enabled).
6. Deploy config and monitor high-severity audit event `auth.jwt_fallback_activated`.

### Required monitoring while active
- Watch audit events for route, tenant, and fallback reason details.
- Alert if fallback activation frequency exceeds configured threshold:
  - `AUTH_FALLBACK_ALERT_THRESHOLD` activations
  - within `AUTH_FALLBACK_ALERT_WINDOW_SECONDS`.
- Treat threshold breach as a security incident escalation.

### Disable fallback
1. Set `AUTH_FALLBACK_EMERGENCY_MODE=false` immediately when IdP recovers.
2. Remove/expire `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL`.
3. Validate Supabase/IdP token verification has resumed and fallback events stop.

### Post-incident review (required)
- Review all `auth.jwt_fallback_activated` audit entries and impacted tenants/routes.
- Verify no requests were served with revoked `jti`/session IDs during outage.
- Document timeline, residual risk, and remediation actions in the incident postmortem.
- Mandatory key rotation and closure tasks:
  1. Rotate `AUTH_FALLBACK_INCIDENT_SIGNING_SECRET` within 24 hours of incident closure.
  2. Rotate `SUPABASE_JWT_SECRET`/upstream signing material if integrity concerns exist.
  3. Confirm old key material is revoked/disabled in secret manager.
  4. Attach rotation evidence (secret version IDs + operator + UTC timestamp) to the incident record.


## Credential rotation evidence (default-secret remediation)

When default or placeholder credentials are detected in IaC, execute immediate rotation and capture evidence in this runbook.

### Rotation actions
1. Rotate RDS master passwords for affected environments (dev/staging/prod where applicable) via AWS console/CLI and update secret stores.
2. Rotate Secrets Manager values that previously used placeholder content.
3. Re-run Terraform plan/apply using external secret references only (no inline secret literals).
4. Confirm application health after restart and credential propagation.

### Evidence log
| Date (UTC) | Environment | Secret/Credential | Rotation Evidence | Operator | Ticket/Incident |
| --- | --- | --- | --- | --- | --- |
| 2026-02-13 | development | `db_master_password` | Terraform updated to `var.db_master_password`; value rotated in secure backend and verified via `terraform plan` with no literal password in code | Platform Security | SEC-2417 |
| 2026-02-13 | staging | `db_master_password`, `staging_app_secrets` | Terraform updated to secure variable references; Secrets Manager secret payload replaced from secure source and validated in CI Checkov custom policies | Platform Security | SEC-2417 |
| 2026-02-13 | shared module | `jwt_secret_string`, `db_password_secret_string` | Module placeholders removed; secret values now injected from secret manager/vault pipeline; audit trail attached to change ticket | Platform Security | SEC-2417 |

## Service identity key compromise or emergency rotation

Use this procedure when a service identity HMAC secret, JWT signing secret, or private key is suspected to be exposed, misused, or unverifiable.

### Detection triggers
- Repeated `Service identity verification failed` responses on protected internal routes.
- Unexpected `servicePrincipal`, `issuer`, or `keyId` values in backend audit/application logs.
- Discovery that a shared secret or signing key was exposed in chat, logs, tickets, CI output, or a developer workstation.
- Evidence that a caller is still attempting the removed legacy `X-Service-Identity` header.

### Immediate containment
1. Declare a security incident and page Platform + Security through the escalation path above.
2. Identify affected environments, caller services, and protected routes.
3. Add the compromised service principal to `SERVICE_IDENTITY_REVOKED_SERVICES` if active abuse is suspected.
4. For HMAC compromise:
   - mark the impacted `hmacKeys[].keyId` as revoked, or
   - remove the compromised key from `SERVICE_IDENTITY_CONFIG_JSON` after a successor key is staged.
5. For JWT compromise:
   - remove or revoke the compromised signing secret/private key,
   - rotate the verifier material if the trust root changed, and
   - shorten acceptance windows so previously minted assertions expire quickly.
6. Restart or roll deployments as required so all pods load the replacement configuration.

### Recovery
1. Generate successor service identity material in the approved secret manager.
2. Roll callers forward first and verify each caller emits the new assertion format from `addServiceIdentityHeader(...)`.
3. Validate protected internal routes with an integration or smoke test that succeeds with the successor key and fails with the retired key.
4. Review logs/metrics for any continued traffic signed by the compromised `keyId` or `issuer`.
5. Remove emergency revocations only after verification shows all callers are healthy on the successor key.

### Post-incident actions
- Capture timeline, affected services, old/new key IDs, and evidence links in the incident record.
- Audit the last known exposure window for protected-route access made with the compromised principal.
- Rotate adjacent credentials if the compromise source could have exposed additional secrets.
- Add or update regression tests when the incident reveals a missing control, detection gap, or unsafe caller path.
