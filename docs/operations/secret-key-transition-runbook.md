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

## Failure modes

- Error: `Deprecated environment variable SUPABASE_SERVICE_KEY is set...`
  - Fix by renaming to `SUPABASE_SERVICE_ROLE_KEY`.
- Error: `SUPABASE_SERVICE_KEY_SECRET_NAME is deprecated...`
  - Fix by renaming to `SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME`.

## CI guard

The contract check script validates:

- Required secret keys are present for dev/staging/production ExternalSecrets.
- Keys are kebab-case.
- Required env variables exist in compose/env definitions.
