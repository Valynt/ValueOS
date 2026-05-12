# Governance stage-sensitive required fields configuration

The backend governance engine reads stage-sensitive required fields from configuration at startup via:

- `GOVERNANCE_STAGE_REQUIRED_FIELDS` (JSON string)

## Required keys

`GOVERNANCE_STAGE_REQUIRED_FIELDS` must be valid JSON with all three keys:

- `dev`: `string[]`
- `staging`: `string[]` (must contain at least 1 field)
- `prod`: `string[]` (must contain at least 1 field)

If the env var is present but malformed (invalid JSON, missing keys, wrong types), backend startup validation fails fast.

## Backward-compatible fallback (deprecated)

If `GOVERNANCE_STAGE_REQUIRED_FIELDS` is absent, ValueOS falls back to legacy defaults and logs a deprecation warning:

```json
{
  "dev": [],
  "staging": ["changeTicketId"],
  "prod": ["changeTicketId", "riskAcceptanceId"]
}
```

Set `GOVERNANCE_STAGE_REQUIRED_FIELDS` explicitly in every environment to remove fallback behavior.

## Environment examples

### dev

```bash
export GOVERNANCE_STAGE_REQUIRED_FIELDS='{"dev":["devTicketId"],"staging":["changeTicketId"],"prod":["changeTicketId","riskAcceptanceId"]}'
```

### staging

```bash
export GOVERNANCE_STAGE_REQUIRED_FIELDS='{"dev":[],"staging":["changeTicketId","releaseWindowId"],"prod":["changeTicketId","riskAcceptanceId"]}'
```

### prod

```bash
export GOVERNANCE_STAGE_REQUIRED_FIELDS='{"dev":[],"staging":["changeTicketId"],"prod":["changeTicketId","riskAcceptanceId","cabApprovalId"]}'
```

## Related governance env vars

- `GOVERNANCE_PERMISSION_CACHE_TTL_MS`
- `GOVERNANCE_PERMISSION_CACHE_MAX`
- `GOVERNANCE_DESTRUCTIVE_ACTIONS`
- `GOVERNANCE_ELEVATED_ROLES`
- `GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS`
