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

### Enable fallback (time-boxed break-glass)
1. Set `AUTH_FALLBACK_EMERGENCY_MODE=true`.
2. Set `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL=<ISO-8601 timestamp>` for the shortest viable window (recommended ≤ 30 minutes).
3. Ensure `SUPABASE_JWT_ISSUER` and `SUPABASE_JWT_AUDIENCE` are set and validated.
4. Keep `ALLOW_LOCAL_JWT_FALLBACK` unset/false in non-dev environments.
5. Deploy config and monitor high-severity audit event `auth.jwt_fallback_activated`.

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
- Rotate/refresh credentials if any compromise suspicion exists.


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
