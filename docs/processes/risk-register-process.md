# Risk Register Process

**Owner**: Security & Compliance Program
**Cadence**: Weekly review, monthly executive summary, quarterly control attestation

## Purpose

This process defines how ValueOS identifies, classifies, tracks, and mitigates organizational security and compliance risk.

## Risk Register Minimum Fields

Every risk entry must include the following fields:

- **Risk ID** (immutable unique identifier)
- **Title**
- **Description** (threat scenario and affected asset/process)
- **Category** (Security, Privacy, Availability, Compliance, Vendor, Operational)
- **Severity** (Critical, High, Medium, Low)
- **Likelihood** (Rare, Unlikely, Possible, Likely, Almost Certain)
- **Impact** (Minor, Moderate, Major, Severe)
- **Risk Owner** (single accountable person)
- **Created Date**
- **Target Due Date** (for mitigation or accepted exception review)
- **Current Status** (Open, In Progress, Mitigated, Accepted, Closed)
- **Mitigation Plan** (specific controls/actions)
- **Mitigation Evidence** (ticket links, runbook updates, test evidence)
- **Residual Risk** (post-mitigation severity)
- **Last Reviewed Date**

## Severity Taxonomy

| Severity | Description | Target Mitigation Due Date |
| --- | --- | --- |
| Critical | Active exploitation, systemic control failure, or high-probability compromise with material customer/legal impact. | 7 calendar days |
| High | Significant exploitability or major control gap with meaningful business/customer impact. | 30 calendar days |
| Medium | Credible weakness with bounded impact or strong compensating controls. | 90 calendar days |
| Low | Limited exploitability or low business impact; acceptable until planned hardening cycle. | Next planned release or <= 180 days |

## Workflow

1. **Intake**
   - Sources: incident reviews, vulnerability disclosures, pentests, audits, architecture reviews, and vendor assessments.
   - Security triage creates/updates risk register entries within 2 business days of identification.
2. **Assessment**
   - Security assigns provisional severity and validates likelihood/impact.
   - Risk owner is assigned and confirms remediation approach.
3. **Planning**
   - Owner defines mitigation tasks with measurable completion criteria.
   - Due date must align with severity taxonomy unless exception approved.
4. **Execution and Tracking**
   - Owners update status weekly until closure.
   - Missed due dates require escalation to Engineering Leadership + Compliance.
5. **Validation and Closure**
   - Security verifies mitigation evidence and determines residual risk.
   - Risk can be closed only when evidence is attached and reviewer sign-off is recorded.

## Mitigation Tracking Requirements

- All mitigation work must be traceable to backlog items or change tickets.
- Evidence must include at least one of: merged code diff, test output, configuration snapshot, audit log proof, or control owner attestation.
- Accepted risks require:
  - documented rationale,
  - compensating controls,
  - explicit expiration/re-review date,
  - approval from Security + relevant executive owner.

## Reporting and Governance

- **Weekly**: Open-risk review with owners (focus: overdue and Critical/High).
- **Monthly**: Trend report (new, closed, overdue, by severity/category).
- **Quarterly**: Board/compliance-ready summary with top residual risks and mitigation progress.

## Exit Criteria for a Healthy Register

- 100% of open risks have an assigned owner and due date.
- 100% of Critical/High risks have active mitigation plans.
- 0 overdue Critical risks without documented executive exception.
- Risk evidence links are present for all mitigated/closed entries.
