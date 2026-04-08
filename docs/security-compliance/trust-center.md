# Trust Center Package

**Owner**: Security & Compliance Program
**Last Updated**: 2026-04-08
**Review Cadence**: Quarterly and after material control/process changes

## Purpose

This canonical trust package provides a customer-facing baseline for ValueOS security, privacy, and vendor governance commitments.

## Data Ownership and Access Commitments

- Customer data is owned by the customer; ValueOS acts as a processor/service provider under customer direction.
- ValueOS uses customer content only to provide, secure, and support contracted services.
- ValueOS does not sell customer data or use customer content for unrelated advertising purposes.
- Access to production customer data is limited to authorized personnel with role-based need, logged access, and least-privilege controls.
- Customer data return/export and deletion workflows are available through support and documented lifecycle procedures.

References:
- [Data Ownership Statement](./data-ownership-statement.md)
- [Production Contract](./production-contract.md)
- [Security Overview](./security-overview.md)

## Subprocessors and Vendor Oversight

- ValueOS maintains a published subprocessor inventory with service purpose, data categories, and assurance posture.
- New subprocessors are reviewed before onboarding for security, privacy, legal terms, and regional transfer implications.
- Material changes to subprocessor use are reflected in the maintained subprocessor list and contract documentation.
- Annual reassessment is required for critical/high-impact vendors.

References:
- [Subprocessor List](./subprocessor-list.md)
- [Vendor Risk Review Workflow](./vendor-risk-review-workflow.md)

## DPA and Contractual Terms Baseline

ValueOS Data Processing Addendum (DPA) commitments include:

- Documented controller/processor roles and processing instructions.
- Confidentiality obligations for personnel handling customer data.
- Technical and organizational security controls aligned to platform control summaries.
- Subprocessor flow-down obligations and due diligence requirements.
- Support for data subject rights handling where applicable.
- Cross-border transfer safeguards where required by law/contract.
- Deletion or return of customer data at end of service (subject to legal retention requirements).
- Audit and assurance support via control summaries, evidence artifacts, and scoped questionnaires.

References:
- [Control Summaries (Customer-Facing)](./control-summaries.md)
- [Compliance Guide](./compliance-guide.md)

## Security Incident and Breach Notification Commitments

ValueOS breach communications follow contractual and legal requirements, with baseline commitments:

- Initial customer notice without undue delay after confirming a notifiable security incident affecting customer data.
- Target initial notice window: within 72 hours of confirmation for incidents meeting contractual/legal notification thresholds.
- Follow-up updates include known scope, impacted systems/data categories, containment actions, and next steps.
- Post-incident communications include remediation actions and prevention controls when available.

Operational process reference:
- [Incident Response](../operations/incident-response.md)

## Public Vulnerability Disclosure Program (VDP/CVD)

ValueOS maintains a public Coordinated Vulnerability Disclosure policy so external researchers have a clear reporting path and safe-harbor expectations.

- Public policy: [Bug Bounty and Coordinated Vulnerability Disclosure (CVD) Program](./bug-bounty-cvd-program.md)
- Intake channel: `security@valueos.com` (mailto:security@valueos.com)
- Preferred intake payload: affected endpoint/component, reproduction steps, impact assessment, and proof-of-concept details sufficient for triage reproduction.

### Disclosure SLA targets

| SLA metric | Target |
|---|---|
| Triage completion (intake validation + severity assignment) | <= 5 business days from submission |
| Time-to-first-response (acknowledgment to reporter) | <= 2 business days |
| Remediation window — Critical | <= 7 calendar days |
| Remediation window — High | <= 30 calendar days |
| Remediation window — Medium | <= 90 calendar days |
| Remediation window — Low | <= 180 calendar days (planned hardening cycle) |

### Ownership and escalation for missed disclosure SLAs

- **Primary owner:** Security Engineering (program operations and reporter communications).
- **Remediation owner:** Assigned engineering service owner for the impacted system/control.
- **Escalation trigger:** any disclosure ticket that crosses the SLA target without approved exception.
- **Escalation path:** Security Engineering on-call -> Head of Platform Engineering -> Security & Compliance Program leadership.
- **Required escalation artifacts:** overdue justification, containment status, revised due date, and executive visibility note in the weekly governance review packet.

## Audit and Assurance Cadence

ValueOS audit and assurance activities are scheduled as follows:

- **Quarterly**: internal control and evidence review across security/compliance domains.
- **Annually**: independent third-party penetration testing for in-scope systems.
- **Annually**: vendor reassessment for critical/high-risk subprocessors.
- **As needed**: ad hoc evidence package refresh following significant architecture/control changes.

Program evidence references:
- [Evidence Index](./evidence-index.md)
- [Compliance Guide](./compliance-guide.md)

## Customer Assurance Artifacts Available on Request

- Current control summary package.
- Subprocessor list and annual review attestation status.
- Latest penetration test executive summary and remediation posture.
- Recent compliance evidence pack manifest and integrity ledger summary.
- Incident response process overview.

## Live Control and Risk Transparency Links

Customer-facing trust artifacts are linked to current control/risk snapshots so readers can validate posture against the latest governance evidence.

- Current control status snapshot: [`docs/security-compliance/control-status.json`](./control-status.json)
- Current risk register snapshot: [`docs/security-compliance/risk-register.json`](./risk-register.json)
- Evidence index and artifact chain: [`docs/security-compliance/evidence-index.md`](./evidence-index.md)
- CI-generated trust KPI artifact set (release/PR evidence):
  - `artifacts/security/governance/trust-kpi-snapshot.json`
  - `artifacts/security/governance/open-risks.json`
  - `artifacts/security/governance/stale-controls.json`
  - `artifacts/security/governance/vdp-kpis.json` (quarterly VDP/CVD SLA and throughput snapshot)
  - `artifacts/security/governance/data-residency-status.json` (tenant-to-region residency assertions for data stores/exports + signature envelope)
  - Policy input used by the gate: `docs/security-compliance/data-residency-controls.json`

For customer assurance responses, include the latest workflow run URL and the artifact files above so control assertions map to timestamped evidence.
