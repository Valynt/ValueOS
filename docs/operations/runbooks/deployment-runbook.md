---
title: Deployment Runbook
authoritative: true
owner: team-platform
review_cadence: monthly
last_reviewed: 2026-02-13
tags: [runbook, operations, deployment, ownership:team-platform, cadence:monthly]
source_reference: ../reference/deployment-reference.generated.md
---

# Deployment Runbook

## Purpose
Authoritative operational runbook for production deployments. This runbook is the source of truth for release execution, rollback, and verification.

## Preconditions
- CI pipeline green on target commit.
- Migration checks and docs-integrity checks passed.
- On-call and incident commander assigned.

## Deployment Procedure
1. Confirm release tag and environment lock.
2. Apply DB migrations using standard migration pipeline.
3. Deploy backend services, then frontend workloads.
4. Run post-deploy smoke tests for auth, tenancy isolation, billing endpoints, and workflow execution.
5. Monitor error rate, p95 latency, and queue depth for 15 minutes.

## Rollback Procedure
1. Trigger rollback in orchestrator to previous release artifact.
2. If migration-related, follow backward-compatible rollback policy and execute guarded schema rollback only if approved.
3. Validate auth, tenancy, billing, and workflow core paths.

## Evidence & Audit
- Attach CI run URL, release ID, and smoke test evidence to the release record.
- Record incident ticket reference for any degraded deploy.

## Generated Reference
Detailed command catalogs and deep background are maintained in the generated reference:
- [Deployment Reference (Generated)](../reference/deployment-reference.generated.md)
