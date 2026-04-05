# HIPAA + GDPR Incident Workflows

## Purpose

Define the operational workflow when a single incident intersects HIPAA (PHI/security incident obligations) and GDPR (personal data breach and data subject rights obligations).

## Workflow A: Security breach overlap (HIPAA + GDPR)

1. Declare incident and assign incident commander.
2. Preserve forensic evidence and immutable audit chain.
3. Classify impacted data as PHI, GDPR personal data, or both.
4. Execute legal/contractual notifiability analysis:
   - HIPAA breach notification: without unreasonable delay (plus contractual terms).
   - GDPR supervisory authority notice: within 72 hours when reportable.
5. Notify customers/regulators as required.
6. Run post-incident corrective action and control verification.

Primary references:

- `docs/operations/incident-response.md`
- `docs/security-compliance/trust-center.md`
- `docs/security-compliance/evidence-retention-policy.md`

## Workflow B: DSR + disclosure/accounting overlap

1. Verify requester identity and authority.
2. Resolve tenant and subject scope boundaries.
3. Execute export/anonymization/disclosure-accounting action.
4. Ensure immutable audit logging for each action.
5. Deliver response package and retention metadata.
6. Record completion in compliance evidence artifacts.

Primary references:

- `tests/compliance/dsr-workflow.test.ts`
- `docs/security-compliance/audit-logging.md`
- `docs/security-compliance/evidence-index.md`

## Verification

The workflow definitions are CI-verified via:

- `pnpm run check:hipaa-traceability`

This check confirms both overlap workflows are present in `docs/security-compliance/evidence/hipaa/hipaa-gdpr-incident-workflows.json` and that referenced evidence paths exist.
