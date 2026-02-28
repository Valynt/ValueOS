---
title: Deployment Runbook
authoritative: true
owner: team-platform
review_cadence: monthly
last_reviewed: 2026-02-13
tags: [runbook, operations, deployment, ownership:team-platform, cadence:monthly]
source_reference: ../reference/deployment-reference.generated.md
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Deployment Runbook


### Supabase migration policy (cloud-only)

- Production/staging database migrations must run against hosted Supabase projects via linked project refs.
- Do not depend on local-stack assets (`infra/supabase/config.toml`, local seed/init scripts) for deploy-time migrations.
- Local-stack scripts are optional and require explicit `LOCAL_SUPABASE_ONLY=1` acknowledgment.

## Purpose
Authoritative operational runbook for production deployments. This runbook is the source of truth for release execution, rollback, and verification.

## Preconditions
- CI pipeline green on target commit.
- Migration checks and docs-integrity checks passed.
- Launch chaos/smoke gate passed (`node scripts/chaos/launch-chaos-smoke.mjs`) with machine-readable evidence (`artifacts/chaos-launch/**/launch-chaos-results.json`).
- On-call and incident commander assigned.

## Deployment Procedure
1. Confirm release tag and environment lock.
2. Apply DB migrations using standard migration pipeline.
3. Deploy backend services, then frontend workloads.
4. Run post-deploy smoke tests for auth, tenancy isolation, billing endpoints, and workflow execution.
   - Include blocking chaos/smoke release suite: `node scripts/chaos/launch-chaos-smoke.mjs`.
5. Monitor error rate, p95 latency, and queue depth for 15 minutes.

## Rollback Procedure
1. Trigger rollback in orchestrator to previous release artifact.
2. If migration-related, follow backward-compatible rollback policy and execute guarded schema rollback only if approved.
3. Validate auth, tenancy, billing, and workflow core paths.


## Agent identity policy validation (required)
- Confirm each agent deployment in `infra/k8s/base/agents/*/deployment.yaml` uses a dedicated ServiceAccount (`<agent-name>-agent`), never `valynt-agent`.
- Validate before promotion:
  ```bash
  node scripts/ci/check-agent-service-accounts.mjs
  ```
- Confirm Istio AuthorizationPolicy principals match the expected trust domain and namespace format:
  - `cluster.local/ns/valynt-agents/sa/<agent-name>-agent`
  - `cluster.local/ns/valynt/sa/valynt-backend`
- If the cluster trust domain is not `cluster.local`, update `infra/k8s/security/mesh-authentication.yaml` and re-run validation prior to deployment.

## Evidence & Audit
- Attach CI run URL, release ID, and smoke test evidence to the release record.
- Record incident ticket reference for any degraded deploy.

## Generated Reference
Detailed command catalogs and deep background are maintained in the generated reference:
- [Deployment Reference (Generated)](../reference/deployment-reference.generated.md)
