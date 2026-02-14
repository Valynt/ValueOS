---
title: Incident Response
owner: team-sre
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Incident Response

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Failure Playbook

*Source: `FAILURE_PLAYBOOK.md`*

This guide covers common issues encountered in the ValueOS development environment and how to resolve them.

## Incident Evidence Flow

When opening or updating an incident, include the following evidence artifacts:

1. Deploy workflow emergency skip audit artifact (`emergency-skip-audit-<run_id>.json`) when `skip_tests=true`.
2. Post-deploy verification artifact (`post-deploy-verification-<env>-<run_id>.json`) with health, rollback readiness, and key metrics.
3. Periodic access review automation output (`access-review-evidence-<run_id>` artifact from `.github/workflows/access-review-automation.yml`) attached directly to the incident record for compliance and remediation tracking.

Incident updates are incomplete without the periodic access review automation evidence.

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
