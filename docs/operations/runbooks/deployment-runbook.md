---
title: Deployment Runbook
authoritative: true
owner: team-platform
backstage_owner: team:platform-engineering
backstage_system: value-engineering-platform
review_cadence: monthly
last_reviewed: 2026-03-26
tags:
  [runbook, operations, deployment, ownership:team-platform, cadence:monthly]
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
- Launch-readiness canonical inputs reviewed: [`docs/launch-readiness-inputs.md`](../../launch-readiness-inputs.md).
- Launch chaos/smoke gate passed (`node scripts/chaos/launch-chaos-smoke.mjs`) with machine-readable evidence (`artifacts/chaos-launch/**/launch-chaos-results.json`).
- On-call and incident commander assigned.

## Deployment Procedure

1. Confirm release tag and environment lock.
2. Apply DB migrations using standard migration pipeline.
3. Validate service identity assertions for every non-local environment before rollout.
   - Confirm `SERVICE_IDENTITY_CONFIG_JSON` is present for the target environment.
   - Confirm every workload that calls protected internal routes sets `SERVICE_IDENTITY_CALLER_ID`.
   - Confirm outbound assertions are configured with either:
     - `hmacKeys` containing an active key for the caller service, or
     - `jwtIssuers` containing an active signing key/secret for the caller service.
   - Reject the deploy if the environment still depends on the legacy shared `X-Service-Identity` token.
4. Execute a single deterministic overlay rollout command for the target environment (security policies are included automatically via overlay dependencies):
   - Staging: `kustomize build infra/k8s/overlays/staging | kubectl apply -f -`
   - Production: `kustomize build infra/k8s/overlays/production | kubectl apply -f -`
5. Run post-deploy smoke tests for auth, tenancy isolation, billing endpoints, workflow execution, and at least one protected internal route using per-request service assertions.
   - Include blocking chaos/smoke release suite: `node scripts/chaos/launch-chaos-smoke.mjs`.
6. Monitor error rate, p95 latency, queue depth, and `Service identity verification failed` / `Service principal revoked` log volume for 15 minutes.

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
  - `cluster.local/ns/valueos-agents/sa/<agent-name>-agent`
  - `cluster.local/ns/valueos/sa/valueos-backend`
- If the cluster trust domain is not `cluster.local`, update `infra/k8s/security/mesh-authentication.yaml` and re-run validation prior to deployment.


## Ingress TLS and WAF annotation policy (required)

Source of truth for runtime ingress security identifiers:

- **IaC overlay variables**
  - `infra/k8s/overlays/staging/ingress-annotations.env` → `ALB_CERTIFICATE_ARN`
  - `infra/k8s/overlays/production/ingress-annotations.env` → `ALB_CERTIFICATE_ARN`, `ALB_WAFV2_ACL_ARN`
- **CI/CD secret inputs (authoritative values)**
  - `STAGING_INGRESS_CERTIFICATE_ARN`
  - `PRODUCTION_INGRESS_CERTIFICATE_ARN`
  - `PRODUCTION_INGRESS_WAFV2_ACL_ARN`
- **WAF IaC origin**
  - Production WAF ACL ARN is produced by Terraform resource `aws_wafv2_web_acl.prod` in `infra/environments/prod/terraform/main.tf`.

Promotion is blocked unless rendered manifests satisfy policy:

```bash
node scripts/ci/check-k8s-ingress-security-annotations.mjs
```

Policy requirements:

- Staging + production ingress: `alb.ingress.kubernetes.io/certificate-arn` must be non-empty after render.
- Production internet-facing ingress: `alb.ingress.kubernetes.io/wafv2-acl-arn` must be present and non-empty after render.

## Evidence & Audit

- Attach CI run URL, release ID, and smoke test evidence to the release record.
- Record incident ticket reference for any degraded deploy.

## Service identity key rotation (required)

1. Create or confirm the change ticket and identify the caller services, target audiences, and protected routes affected by the rotation.
2. Generate the successor key pair or shared secret in the approved secret manager. Do not distribute keys through Git, chat, tickets, or `.env` attachments.
3. Add the successor material to `SERVICE_IDENTITY_CONFIG_JSON` alongside the currently active key:
   - For HMAC, add a new `hmacKeys[]` entry with a new `keyId` and leave the current key active during overlap.
   - For JWT, add the new signing key/secret under `jwtIssuers[]` and preserve the currently trusted verifier during overlap.
4. Roll out callers first by setting `SERVICE_IDENTITY_OUTBOUND_KEY_ID` to the new key where applicable and confirming `addServiceIdentityHeader(...)` emits the successor assertion.
5. Roll out verifiers next and confirm protected routes accept the successor assertion in each environment.
6. Revoke the predecessor key by marking it revoked or removing it from the runtime secret source after all callers have cut over.
7. Capture evidence in the release record:
   - secret-manager version or key ID
   - rollout timestamps by environment
   - smoke test / integration test evidence
   - audit log or metrics confirmation showing traffic on the successor key only
8. Schedule follow-up verification within 24 hours to confirm there is no residual traffic for the retired key ID.

## Generated Reference

Detailed command catalogs and deep background are maintained in the generated reference:

- [Deployment Reference (Generated)](../reference/deployment-reference.generated.md)


> **Legacy section (`[legacy-id]`):** historical mesh policies may still show `valynt-*` principals. Keep those strings only in archived evidence or migration notes.
