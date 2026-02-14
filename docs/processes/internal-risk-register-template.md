# Internal Risk Register Template

**Owner**: Security & Compliance Program
**Use With**: [Risk Register Process](./risk-register-process.md)

## Purpose

This template standardizes internal risk entries and quarterly review records so incident and compliance findings map cleanly to remediation tracking.

## Risk Entry Template

Use one row per risk in the operating register.

| Field | Required | Guidance |
|---|---|---|
| Risk ID | Yes | Immutable unique ID (e.g., RISK-2026-0012). |
| Created Date | Yes | Date risk was logged. |
| Title | Yes | Short, specific summary of risk. |
| Description | Yes | Threat scenario + affected asset/process. |
| Source | Yes | Incident / Audit / CVD / Vendor Review / Compliance Test / Other. |
| Category | Yes | Security / Privacy / Availability / Compliance / Vendor / Operational. |
| Severity | Yes | Critical / High / Medium / Low. |
| Likelihood | Yes | Rare / Unlikely / Possible / Likely / Almost Certain. |
| Impact | Yes | Minor / Moderate / Major / Severe. |
| Risk Owner | Yes | Single accountable owner. |
| Status | Yes | Open / In Progress / Mitigated / Accepted / Closed. |
| Target Due Date | Yes | Must align with severity SLA unless exception approved. |
| Mitigation Plan | Yes | Actionable steps with measurable completion criteria. |
| Linked Incident ID(s) | Conditional | Required when sourced from incidents. |
| Linked Compliance Evidence ID(s) | Conditional | Required when sourced from control tests/audits. |
| Remediation Ticket(s) | Yes | Link to implementation/change records. |
| Mitigation Evidence | Yes at closure | Test output, diff, config snapshot, attestation, etc. |
| Residual Risk | Yes at closure | Re-assessed level after mitigation. |
| Last Reviewed Date | Yes | Updated at weekly/quarterly review. |
| Reviewer Sign-Off | Yes at closure | Security/Compliance reviewer name + date. |

## Quarterly Review Record Template

Create one quarterly record to capture governance evidence.

```markdown
# Quarterly Risk Review Record

- Quarter: 2026-QX
- Review Date:
- Facilitator:
- Attendees:

## Input Artifacts
- Incident summary reference:
- Compliance evidence summary reference:
- Vendor remediation summary reference:
- Open/overdue risk export reference:

## Review Outcomes
- New risks opened this quarter:
- Risks closed this quarter:
- Overdue Critical/High risks:
- Top residual risks entering next quarter:
- Accepted risk exceptions (with expiry):

## Decisions and Commitments
| Risk ID | Decision | Owner | Due Date | Notes |
|---|---|---|---|---|

## Approvals
- Security Lead:
- Compliance Lead:
- Engineering Lead:
```

## Governance Rules

- Quarterly record must be completed within 10 business days of quarter close.
- Any unresolved overdue Critical risk requires executive escalation entry.
- Quarterly output must be archived with compliance evidence artifacts.
