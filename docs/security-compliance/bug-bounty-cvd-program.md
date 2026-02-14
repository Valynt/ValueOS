# Bug Bounty and Coordinated Vulnerability Disclosure (CVD) Program

**Owner**: Security Engineering
**Status**: Implemented
**Last Updated**: 2026-02-14

## Program Goals

- Provide a clear, safe channel for external security researchers.
- Improve detection and remediation of vulnerabilities before customer impact.
- Standardize severity assignment, response SLA, and closure evidence.

## Submission and Intake Process

1. Researcher submits a report through the designated security contact channel.
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
| Initial acknowledgment | <= 2 business days |
| Triage + severity assignment | <= 5 business days |
| Remediation plan for High/Critical | <= 7 calendar days from validation |
| Closure notice to reporter | <= 5 business days after fix validation |

If a report is invalid, duplicate, or out-of-scope, triage documents rationale and notifies the reporter.

## Severity Matrix

| Severity | Typical Criteria | Fix Target |
|---|---|---|
| Critical | Remote code execution, auth bypass with broad compromise, cross-tenant data exposure, active exploitation risk | 7 calendar days |
| High | Privilege escalation, significant sensitive data exposure, impactful injection flaws with practical exploitability | 30 calendar days |
| Medium | Bounded data leakage, limited exploitability misconfiguration, moderate integrity/control weaknesses | 90 calendar days |
| Low | Informational weaknesses or hardening opportunities with low exploitability/impact | Planned hardening cycle (<= 180 days) |

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
- Program metrics are reviewed quarterly: time-to-acknowledge, time-to-remediate, open by severity, recurrence trends.

## Related Documents

- [Risk Register Process](../processes/risk-register-process.md)
- [Trust Center Package](./trust-center.md)
- [Compliance Guide](./compliance-guide.md)
