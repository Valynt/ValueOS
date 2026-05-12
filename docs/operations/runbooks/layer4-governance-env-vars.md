---
title: Layer 4 Governance Environment Variables
authoritative: true
owner: team-platform
backstage_owner: team:platform-engineering
backstage_system: value-engineering-platform
review_cadence: monthly
last_reviewed: 2026-05-12
tags:
  [
    runbook,
    governance,
    layer4,
    environment-variables,
    ownership:team-platform,
    cadence:monthly,
  ]
status: active
---

# Layer 4 Governance Environment Variables (Authoritative)

This runbook is the single source of truth for **Layer 4 governance environment variables** loaded by `packages/backend/src/config/governance.ts` and validated by `validateGovernanceConfigOrThrow`.

## Startup validation contract (fail-before-traffic)

- `validateGovernanceConfigOrThrow()` is the startup gate for governance configuration.
- If any validation error exists, startup throws `Governance configuration validation failed` and the service must not accept traffic.
- Deployment policy: run startup validation in pre-traffic checks and block rollout on any governance config error.

Reference implementation: `packages/backend/src/config/governance.ts`.

## Runtime stage resolution and strict-prod behavior

Runtime stage is resolved as:

1. `RUNTIME_STAGE` (preferred), else `STAGE`, else `NODE_ENV` fallback.
2. `prod` strict mode is active when:
   - `RUNTIME_STAGE=prod` or `RUNTIME_STAGE=production`, or
   - `STAGE=prod` or `STAGE=production`, or
   - `NODE_ENV=production`.

Strict mode affects required variables:

- In `prod`, these are **required and non-empty**:
  - `GOVERNANCE_STAGE_REQUIRED_FIELDS`
  - `GOVERNANCE_DESTRUCTIVE_ACTIONS`
  - `GOVERNANCE_ELEVATED_ROLES`
  - `GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS`
  - `GOVERNANCE_SCHEMA_HASH_EXPECTED`
  - `APP_MIGRATION_HEAD`
  - `REQUIRED_PAYLOAD_CONTRACT_VERSION`
- In non-prod (`dev`, `staging`), requiredness is relaxed per the table below.

## Variable catalog

| Variable                                    | Required in prod | Allowed format / validation                                                                                                             | Default / fallback behavior                                                                                                                                         | Startup failure behavior                                                          |
| ------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `GOVERNANCE_PERMISSION_CACHE_TTL_MS`        | No               | Integer, `1000..300000`                                                                                                                 | Default `30000`                                                                                                                                                     | Fails if outside range or non-numeric                                             |
| `GOVERNANCE_PERMISSION_CACHE_MAX`           | No               | Integer, `1..10000`                                                                                                                     | Default `2000`                                                                                                                                                      | Fails if outside range or non-numeric                                             |
| `GOVERNANCE_DESTRUCTIVE_ACTIONS`            | **Yes**          | CSV list, at least one non-empty token                                                                                                  | Non-prod fallback to built-in set (delete actions)                                                                                                                  | In prod, fails if missing/empty or parsed to zero entries                         |
| `GOVERNANCE_ELEVATED_ROLES`                 | **Yes**          | CSV list, at least one non-empty token                                                                                                  | Non-prod fallback: `admin,owner`                                                                                                                                    | In prod, fails if missing/empty or parsed to zero entries                         |
| `GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS` | **Yes**          | CSV list, at least one non-empty token                                                                                                  | Non-prod fallback: `proposal.publish,value_model.finalize,commitment.publish`                                                                                       | In prod, fails if missing/empty or parsed to zero entries                         |
| `GOVERNANCE_STAGE_REQUIRED_FIELDS`          | **Yes**          | JSON object with keys `dev`, `staging`, `prod`; each value array of non-empty strings; `staging` and `prod` must have at least one item | Non-prod fallback object: `{"dev":[],"staging":["changeTicketId"],"prod":["changeTicketId","riskAcceptanceId"]}` + warning log `governance.config.fallback_applied` | In prod, fails if missing/empty, malformed JSON, missing keys, or schema mismatch |
| `GOVERNANCE_SCHEMA_HASH_EXPECTED`           | **Yes**          | Non-empty trimmed string                                                                                                                | None                                                                                                                                                                | In prod, fails if missing/empty                                                   |
| `APP_MIGRATION_HEAD`                        | **Yes**          | Non-empty trimmed string                                                                                                                | None                                                                                                                                                                | In prod, fails if missing/empty                                                   |
| `REQUIRED_PAYLOAD_CONTRACT_VERSION`         | **Yes**          | Non-empty trimmed string                                                                                                                | None                                                                                                                                                                | In prod, fails if missing/empty                                                   |

## `GOVERNANCE_STAGE_REQUIRED_FIELDS` JSON format

Required JSON shape:

```json
{
  "dev": [],
  "staging": ["changeTicketId"],
  "prod": ["changeTicketId", "riskAcceptanceId"]
}
```

Validation details:

- `dev`: array of non-empty strings (can be empty).
- `staging`: array of non-empty strings (**minimum 1**).
- `prod`: array of non-empty strings (**minimum 1**).
- Any malformed JSON or wrong type fails validation.

## Environment examples

### Dev example

```bash
RUNTIME_STAGE=dev
GOVERNANCE_PERMISSION_CACHE_TTL_MS=30000
GOVERNANCE_PERMISSION_CACHE_MAX=2000
# Optional in dev; defaults are used when omitted:
# GOVERNANCE_DESTRUCTIVE_ACTIONS
# GOVERNANCE_ELEVATED_ROLES
# GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS
# GOVERNANCE_STAGE_REQUIRED_FIELDS
# GOVERNANCE_SCHEMA_HASH_EXPECTED
# APP_MIGRATION_HEAD
# REQUIRED_PAYLOAD_CONTRACT_VERSION
```

### Staging example

```bash
RUNTIME_STAGE=staging
GOVERNANCE_PERMISSION_CACHE_TTL_MS=45000
GOVERNANCE_PERMISSION_CACHE_MAX=3000
GOVERNANCE_DESTRUCTIVE_ACTIONS=value_model.delete,case.delete,tenant.delete,user.delete
GOVERNANCE_ELEVATED_ROLES=admin,owner,security_review
GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS=proposal.publish,value_model.finalize,commitment.publish
GOVERNANCE_STAGE_REQUIRED_FIELDS={"dev":[],"staging":["changeTicketId"],"prod":["changeTicketId","riskAcceptanceId"]}
GOVERNANCE_SCHEMA_HASH_EXPECTED=sha256:ab12cd34ef56
APP_MIGRATION_HEAD=20260512000100_layer4_governance
REQUIRED_PAYLOAD_CONTRACT_VERSION=2.4.0
```

### Prod example (strict mode)

```bash
RUNTIME_STAGE=prod
GOVERNANCE_PERMISSION_CACHE_TTL_MS=30000
GOVERNANCE_PERMISSION_CACHE_MAX=2000
GOVERNANCE_DESTRUCTIVE_ACTIONS=value_model.delete,case.delete,tenant.delete,user.delete,artifact.delete,commitment.delete,value_tree.delete,integration.delete,api_key.delete
GOVERNANCE_ELEVATED_ROLES=admin,owner
GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS=proposal.publish,value_model.finalize,commitment.publish
GOVERNANCE_STAGE_REQUIRED_FIELDS={"dev":[],"staging":["changeTicketId"],"prod":["changeTicketId","riskAcceptanceId"]}
GOVERNANCE_SCHEMA_HASH_EXPECTED=sha256:f00dbabe1234
APP_MIGRATION_HEAD=20260512000100_layer4_governance
REQUIRED_PAYLOAD_CONTRACT_VERSION=2.4.0
```

## Deployment checklist requirement

Before enabling traffic in staging or production:

1. Confirm all prod-required governance variables are set and non-empty.
2. Confirm `GOVERNANCE_STAGE_REQUIRED_FIELDS` is valid JSON and schema-compliant.
3. Confirm application startup executes `validateGovernanceConfigOrThrow()`.
4. Block promotion if startup validation fails in any pod.

## Related references

- Layer 4 readiness standard: `docs/security-compliance/layer4-governance-drift-readiness.md`
- Governance drift runbook: `docs/operations/runbooks/governance-drift.md`
- Deployment runbook: `docs/operations/runbooks/deployment-runbook.md`
