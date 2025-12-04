# Deployment Runbook

**Audience:** Release Captain (primary), On-Call SRE (secondary), Feature Owners (consulted).
**Goal:** Safely promote a release to production with clear ownership and ordering for app + database changes.

## Roles & Responsibilities
- **Release Captain:** Owns decision to deploy/rollback, coordinates comms, triggers pipelines.
- **On-Call SRE:** Monitors health/alerts, executes infrastructure commands, approves rollback if needed.
- **Feature Owners:** Validate smoke tests for their surface areas; provide sign-off on risky migrations.

## Pre-Flight Checklist
1. Feature freeze announced in `#releases` (no new merges after cutoff).
2. Verify pipeline status is green on `main`: https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml
3. Confirm changelog and migration list with Feature Owners.
4. Ensure backup completed within last 24h (see `docs/backup-and-dr-playbook.md`).
5. Validate secrets and runtime config: `./scripts/verify-env.sh production`.

## Deployment Steps
1. **Tag and build**
   - Create release tag: `git tag -a v<version> -m "Release v<version>" && git push origin v<version>`
   - Trigger deploy workflow (GitHub Actions "Deploy"): https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy.yml
2. **Database migrations (ordered)**
   - Apply backward-compatible migrations first:
     ```bash
     supabase db push --file migrations/2024*-add-columns.sql
     ```
   - Apply breaking migrations only after app pods are updated and read replicas are healthy:
     ```bash
     supabase db push --file migrations/2024*-drop-columns.sql
     ```
   - Verify schema versions:
     ```sql
     select version, inserted_at from schema_migrations order by inserted_at desc limit 5;
     ```
3. **Application rollout**
   - Deploy via Helm/Kustomize: `kubectl apply -k kubernetes/overlays/production`
   - Watch rollout status:
     ```bash
     kubectl rollout status deploy/api --timeout=5m
     kubectl rollout status deploy/web --timeout=5m
     kubectl rollout status deploy/worker --timeout=5m
     ```
   - Confirm image digest matches the release tag.
4. **Smoke tests**
   - API: `npm run test:smoke -- --env production`
   - UI: hit `https://app.valuecanvas.com/health` and confirm `200` + build hash.
   - Run policy checks: `npm run lint:policies` if applicable.
5. **Post-deploy validation**
   - Check Grafana dashboard `00-Prod Overview` for error rates, latency, and queue depth.
   - Review Supabase logs for RLS errors using `docs/ops/troubleshooting/rls-failures.md` queries.
   - Announce completion with a link to the workflow run and tag Feature Owners for final sign-off.

## SLAs
- **P1 (customer-facing outage/security risk):** acknowledge in ≤5 minutes, mitigation/rollback in ≤30 minutes.
- **P2 (degraded feature or single-tenant impact):** acknowledge in ≤15 minutes, mitigation in ≤2 hours.

## Communication Templates
- **Start:** "Deploying v<version> to prod. Expected duration 30 minutes. Release Captain: <name>."
- **Rollback:** "Initiating rollback of v<version> due to <reason>. ETA to restore: 15 minutes."
- **Complete:** "v<version> deployed. Key smoke tests passed: <list>." 
