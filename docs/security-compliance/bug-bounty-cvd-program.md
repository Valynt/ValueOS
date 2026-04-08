# Bug Bounty and Coordinated Vulnerability Disclosure (CVD) Program

**Owner**: Security Engineering
**Status**: Implemented
**Last Updated**: 2026-04-08

## Program Goals

- Provide a clear, safe channel for external security researchers.
- Improve detection and remediation of vulnerabilities before customer impact.
- Standardize severity assignment, response SLA, and closure evidence.

## Submission and Intake Process

1. Researcher submits a report through `security@valueos.com` or GitHub private advisory intake (`https://github.com/ValueOS/ValueOS/security/advisories/new`).
2. Security triage acknowledges receipt and validates report completeness.
3. Triage assigns severity and opens internal tracking (ticket + risk register entry if applicable).
4. Engineering owner is assigned with remediation due date per SLA.
5. Reporter receives status updates through triage, remediation, and closure.
6. Disclosure timing is coordinated after fix deployment and validation.

## Safe Harbor and Researcher Expectations

- Good-faith research within stated scope is authorized under this program.
- Researchers must avoid privacy violations, data exfiltration, service disruption, and social engineering.
- Testing must not degrade availability for production customers.
- Findings must remain confidential until coordinated disclosure approval.

## Response and Remediation SLA

| Stage | SLA Target |
|---|---|
| Time-to-first-response (acknowledgment) | <= 2 business days |
| Triage completion time (severity + owner assignment) | <= 5 business days |
| Remediation plan for High/Critical | <= 7 calendar days from validation |
| Closure notice to reporter | <= 5 business days after fix validation |

Remediation windows by validated severity:

| Severity | Remediation Window |
|---|---|
| Critical | <= 7 calendar days |
| High | <= 30 calendar days |
| Medium | <= 90 calendar days |
| Low | <= 180 calendar days (planned hardening cycle) |

If a report is invalid, duplicate, or out-of-scope, triage documents rationale and notifies the reporter.

## Severity Matrix

| Severity | Typical Criteria | Fix Target |
|---|---|---|
| Critical | Remote code execution, auth bypass with broad compromise, cross-tenant data exposure, active exploitation risk | 7 calendar days |
| High | Privilege escalation, significant sensitive data exposure, impactful injection flaws with practical exploitability | 30 calendar days |
| Medium | Bounded data leakage, limited exploitability misconfiguration, moderate integrity/control weaknesses | 90 calendar days |
| Low | Informational weaknesses or hardening opportunities with low exploitability/impact | Planned hardening cycle (<= 180 days) |


## Ownership and Escalation for Missed Disclosure SLAs

- **Primary owner:** Security Engineering (triage and external communication).
- **Remediation owner:** Engineering Manager for affected system/service.
- **Escalation owner:** Head of Security & Compliance Program.

Escalation workflow for SLA misses:

1. Record SLA miss in the governance tracker within 1 business day of breach.
2. Trigger an incident-style review for any Critical/High miss and assign an executive-visible recovery date.
3. Escalate unresolved Critical/High misses to executive leadership during weekly governance review.
4. Keep the item open until updated KPI evidence is published and reporter communication is complete.

## Rewards and Recognition

- Eligible validated findings may receive bounty rewards based on severity, report quality, and novelty.
- Duplicate or previously known issues are not generally reward-eligible.
- Recognition options include hall-of-fame listing (with researcher consent).

## Evidence and Governance Requirements

- All validated reports must include:
  - internal ticket link,
  - severity rationale,
  - assigned owner and due date,
  - remediation evidence,
  - closure validation notes.
- Critical/High reports must be reflected in weekly risk review until closed.
- Program metrics are reviewed quarterly from CI-governed artifacts: `artifacts/security/governance/vdp-kpis.json`, `artifacts/security/governance/trust-kpi-snapshot.json`, `artifacts/security/governance/open-risks.json`, and `artifacts/security/governance/stale-controls.json`.

## Related Documents

- [Risk Register Process](../processes/risk-register-process.md)
- [Trust Center Package](./trust-center.md)
- [Compliance Guide](./compliance-guide.md)
