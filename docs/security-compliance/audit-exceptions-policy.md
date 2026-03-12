# Audit Exceptions and Expiry Policy

This policy defines how dependency audit findings are treated for compliance evidence exports.

## Scope

- Workflow: `.github/workflows/compliance-evidence-export.yml`
- Audit tool: `pnpm audit`
- Audit severity threshold: `high`

## Accepted Exception Categories

Exceptions are only allowed when remediation cannot be applied immediately and one of these categories is documented:

1. **No upstream fix available**
   - Vulnerability has no published patch or upgrade path.
2. **False positive / non-exploitable in context**
   - The vulnerable code path is not reachable in ValueOS runtime.
3. **Breaking remediation risk**
   - Available fix requires a breaking major upgrade that needs scheduled migration work.

## Required Exception Record

Every exception must include:

- Package name and advisory/CVE identifier
- Severity and CVSS (if available)
- Business and technical justification
- Compensating controls in place
- Owner (team or individual)
- Approval date
- **Expiry date**

## Expiry Windows

- **Critical**: maximum 7 calendar days
- **High**: maximum 30 calendar days
- **Medium**: maximum 90 calendar days
- **Low**: maximum 180 calendar days

On expiry, the exception is invalid and must be renewed (with justification) or remediated.

## Evidence Export Requirements

- The audit step is strict and records pass/fail status in `evidence/metadata/run-metadata.json`.
- Artifact collection is best-effort and always runs to preserve evidence, even if audit fails.
- Any active exception referenced by an audit finding should be included in the compliance evidence package or linked from the runbook.
