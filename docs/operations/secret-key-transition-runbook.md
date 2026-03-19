---
title: Secret Key Transition Runbook
owner: team-operations
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Secret Key Transition Runbook

## Goal

Migrate all environments to canonical kebab-case Kubernetes secret keys and canonical backend env names.

## Pre-deploy checklist

1. Confirm `infra/k8s/base/external-secrets.yaml` contains only kebab-case `secretKey` values.
2. Confirm env files and CI variables use `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_KEY`).
3. Run `node scripts/ci/validate-secret-key-contract.mjs`.

## Rollout steps

1. Apply ExternalSecret updates in dev.
2. Verify pods read canonical keys from `valynt-secrets`.
3. Promote to staging, then production.
4. Monitor startup logs for fail-fast alias errors.

## Service identity key rotation

Use this procedure whenever rotating HMAC service identity keys or JWT shared secrets used by `SERVICE_IDENTITY_CONFIG_JSON`.

### Preconditions

1. Inventory every internal caller that signs requests with `addServiceIdentityHeader(...)`.
2. Confirm the target environment has a complete `hmacKeys` and/or `jwtIssuers` definition for each non-local service.
3. Prepare the new key version with a unique `keyId` and overlap window for zero-downtime rollout.

### HMAC rotation procedure

1. Add the new `hmacKeys` entry to `SERVICE_IDENTITY_CONFIG_JSON` with:
   - the same `serviceId`
   - a new `keyId`
   - `status: "active"`
   - the correct `audience`
2. Deploy the updated secret/config to the outbound caller first.
3. Set `SERVICE_IDENTITY_OUTBOUND_KEY_ID` on that caller to the new `keyId`.
4. Verify a signed request succeeds and logs `Service identity verified` with the new `keyId`.
5. Roll the same config to the receiving services so both old and new keys are accepted during the overlap window.
6. After all callers have moved, mark the previous key as `revoked` or remove it from `hmacKeys`.

### JWT shared-secret rotation procedure

1. Add the replacement JWT issuer secret to `jwtIssuers` while keeping the previous shared secret active for the overlap window.
2. Set `SERVICE_IDENTITY_JWT_ISSUER` on the caller if multiple issuers are present.
3. Restart the caller so `addServiceIdentityHeader(...)` signs new bearer assertions with the replacement secret.
4. Verify the receiver accepts the new JWT and records the expected `issuer` in logs.
5. Remove the superseded shared secret after all callers are migrated.

### Verification checklist

- Send a signed GET and POST request from each internal caller path.
- Confirm requests signed only with the legacy `X-Service-Identity` header are rejected with HTTP 401.
- Confirm backend startup fails in staging/production if cryptographic assertions are missing.
- Capture deployment evidence in the incident/change record, including the old/new key IDs, rollout timestamps, and verification commands.

## Failure modes

- Error: `Deprecated environment variable SUPABASE_SERVICE_KEY is set...`
  - Fix by renaming to `SUPABASE_SERVICE_ROLE_KEY`.
- Error: `SUPABASE_SERVICE_KEY_SECRET_NAME is deprecated...`
  - Fix by renaming to `SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME`.
- Error: `FATAL: Service identity strict mode requires cryptographic assertions.`
  - Fix by supplying `SERVICE_IDENTITY_CONFIG_JSON` with valid `hmacKeys` and/or `jwtIssuers` before restarting non-local environments.
- Error: `Unable to create outbound service identity assertion.`
  - Fix the caller configuration so `addServiceIdentityHeader(...)` can select a non-revoked HMAC key or a JWT issuer with `sharedSecret`.

## CI guard

The contract check script validates:

- Required secret keys are present for dev/staging/production ExternalSecrets.
- Keys are kebab-case.
- Required env variables exist in compose/env definitions.
