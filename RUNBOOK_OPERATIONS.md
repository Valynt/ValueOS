# Runbook and Operations Guide

## Overview
This runbook provides day-2 operational guidance for the ValueCanvas platform, covering the UI, Agent Fabric services, orchestration layer, and Supabase data plane. Use it alongside the infrastructure-as-code pipeline to ensure consistent deployments and fast recovery.

---

## Deployment Procedures by Service

### Frontend (Vite/React UI)
1. **Pre-flight**: Ensure `.env` contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and an LLM key (`VITE_TOGETHER_API_KEY` or `VITE_OPENAI_API_KEY`).
2. **Build**: `npm ci && npm run build` (artifacts emitted to `dist/`).
3. **Smoke test**: `npm run preview -- --host 0.0.0.0 --port 4173` and validate `/documentation` renders.
4. **Deploy**: Upload `dist/` to the CDN/edge host (e.g., Vercel/Netlify) with cache invalidation on `index.html` and `assets/*`.
5. **Post-deploy**: Run synthetic check hitting `/` and `/documentation` to confirm UI hydration and documentation search bar load.

### Agent Fabric & Lifecycle Services
1. **Pre-flight**: Confirm Supabase URL/Anon key plus LLM provider credentials are present in the runtime environment.
2. **Migrations**: Apply agent fabric migrations (`supabase db push`), ensuring vector extensions are enabled.
3. **Seed data**: Run the agent seed script to populate `agents`, `agent_tools`, and workflow metadata.
4. **Deploy**: Roll out the Node service bundle or serverless functions with the same version tag as the UI release.
5. **Validation**: Use the command bar (`⌘K`/`Ctrl+K`) to issue a sample value-case request and verify session creation in `agent_sessions`.

### Orchestration Layer (Workflow/DAG Engine)
1. **Pre-flight**: Validate access to the orchestration database tables (`workflows`, `workflow_executions`, `task_queue`).
2. **Config sync**: Align workflow definitions with Git-managed JSON/DAG specs; run schema diff to prevent drift.
3. **Deploy**: Publish the orchestrator service with feature flags set for staged rollout (`ORCHESTRATOR_ENABLED`, `REFLECTION_ENGINE_ENABLED`).
4. **Health check**: Trigger a dry-run workflow and confirm status transitions from `queued → running → completed` within SLO thresholds.

### Supabase (Database, RLS, Storage)
1. **Pre-flight**: Backup the database snapshot before schema changes.
2. **Migrations**: Apply the latest migration files in chronological order; monitor for RLS policy conflicts.
3. **Storage assets**: Sync documentation media and component registry assets to Supabase Storage buckets.
4. **Validation**: Run smoke queries against `value_cases`, `doc_pages`, and `agent_metrics` to ensure RLS access works for anon and authenticated roles.

---

## Troubleshooting Guide (Common Failures)
- **LLM provider failures (401/429)**: Rotate API keys, reduce concurrency in orchestrator config, and fall back to the alternate provider (`VITE_OPENAI_API_KEY`).
- **Supabase connection errors**: Re-issue service role keys, verify IP allowlists, and confirm PostgREST availability.
- **Documentation search returns empty**: Rebuild search indexes by re-saving affected `doc_pages`; confirm analytics tables are writable.
- **Workflow stuck in `queued`**: Inspect `task_queue` for orphaned tasks, restart orchestrator workers, and replay with idempotency keys.
- **Frontend build failures**: Clear `node_modules` and rerun `npm ci`; verify TypeScript config matches `tsconfig.app.json` presets.
- **RLS permission denials**: Check session tokens, validate policy rules in `policy_rules`, and test with a service role to isolate policy errors.

---

## Rollback Procedures by Epic
- **Epic 1: Value Fabric Data Layer**: Revert to the previous migration snapshot and restore backups of `value_tree_nodes`, `value_tree_links`, and `roi_models`; invalidate cached semantic embeddings if schemas changed.
- **Epic 2: Lifecycle Agents**: Deploy the last known-good agent bundle; clear in-flight `agent_sessions` to prevent mixed-version state; disable new runs via feature flag until validation completes.
- **Epic 3: ROI Engine & Financial Modeling**: Roll back formula interpreter deployment and restore the prior `roi_model_calculations` data snapshot; replay benchmark seed data to rehydrate lookups.
- **Epic 4: Orchestration Layer**: Drain `task_queue`, pause new dispatching, and redeploy the previous orchestrator version; replay workflows from saved checkpoints in `workflow_executions`.
- **Epic 5: Server-Driven UI (SDUI)**: Switch UI registry to the prior schema version, re-publish the earlier component manifest, and invalidate CDN caches serving SDUI payloads.
- **Epic 6: Governance & Compliance**: Restore the last version of policy rules, re-enable baseline guardrails, and re-run the Integrity Agent against recent value cases to confirm compliance.
- **Epic 7: Performance & Reliability**: Revert performance-related flags (caching, batching thresholds) to defaults and roll back observability collectors if they degrade latency.

---

## On-Call Runbook & Escalation
- **Triage windows**: P0 (immediate, user-visible outage), P1 (degraded path, SLO at risk within 1 hour), P2 (non-urgent defect).
- **First response**: Acknowledge in the incident channel within 5 minutes, capture timeline, and assign an Incident Commander (IC).
- **Stabilization checklist**:
  - Confirm LLM provider health and rotate keys if rate limits occur.
  - Verify Supabase availability and RLS policy integrity.
  - Check orchestrator worker queue depth and restart stuck workers.
  - Run UI smoke checks on `/` and `/documentation`.
- **Escalation paths**:
  - Platform/SRE for database or infra-level issues.
  - Application team for agent orchestration or SDUI regressions.
  - Security/compliance lead for policy or metadata schema incidents.
- **Communication**: Publish incident updates every 15 minutes for P0/P1, including impact, mitigation steps, and ETA.
- **Closure**: Document root cause, corrective actions, and update this runbook if new playbooks emerge.
