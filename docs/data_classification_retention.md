# Data Classification & Retention (Phase 3)

## Classification
- Levels: Public, Internal, Confidential, Restricted.
- Suggested mappings:
  - Prompts/Outputs: Confidential
  - Embeddings: Restricted
  - Audit Logs: Restricted
  - Metrics/Health: Internal

## Retention (days)
- Prompts/Outputs: 30
- Transient Artifacts: 7
- Audit Logs: 365 (immutable/WORM)
- Adjust per tenant/regional policy.

## Enforcement Tasks
- Add RLS/ABAC per tenant for Confidential/Restricted tables.
- Apply TTL jobs to prompts/outputs/transient artifacts (DB cron or background worker).
- Ensure WORM/append-only storage for audit logs; prevent deletes/updates.
- Add masking/redaction for sensitive fields in logs/exports.

