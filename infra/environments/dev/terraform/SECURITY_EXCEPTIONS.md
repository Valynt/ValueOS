# Development Terraform Break-Glass Exceptions

This document records approved temporary exceptions for dev environment database access controls.

## Policy

- Break-glass access is allowed **only** through `db_allowed_bastion_security_group_ids`.
- Every exception entry must include:
  - **Owner** (person or team accountable)
  - **Approval ticket/reference**
  - **Expires on** date (ISO-8601, UTC)
  - **Reason** and rollback/remediation plan
- Expired entries must be removed from Terraform input variables before the next apply.

## Current exceptions

| SG ID | Owner | Approval | Expires on (UTC) | Reason | Status |
|---|---|---|---|---|---|
| _None_ | — | — | — | No active break-glass exceptions approved. | Active policy baseline |

## Example entry

| SG ID | Owner | Approval | Expires on (UTC) | Reason | Status |
|---|---|---|---|---|---|
| `sg-0123456789example` | `team-platform` | `SEC-1234` | `2026-05-15T00:00:00Z` | Emergency one-time DBA access for migration recovery. | Remove before expiry |
