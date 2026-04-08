# Risk Register Process

**Owner**: Security & Compliance Program
**Cadence**: Weekly review, monthly executive summary, quarterly integrated risk + compliance review

## Purpose

This process defines how ValueOS identifies, classifies, tracks, and mitigates organizational security, compliance, vendor, and operational risks. It also defines quarterly review outputs tied to incident and compliance evidence streams.

## Inputs and Trigger Sources

Risk intake must include (at minimum):

- Incident postmortems and corrective actions.
- Vulnerability disclosures (including bug bounty/CVD submissions).
- Internal/external audit findings.
- Compliance evidence exceptions and control test failures.
- Architecture/security review outcomes.
- Vendor risk review findings.

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
- **Source** (Incident, Audit, CVD, Vendor Review, Compliance Test, Other)
- **Created Date**
- **Target Due Date** (for mitigation or accepted exception review)
- **Current Status** (Open, In Progress, Mitigated, Accepted, Closed)
- **Mitigation Plan** (specific controls/actions)
- **Linked Incident ID(s)** (if applicable)
- **Linked Compliance Evidence ID(s)** (if applicable)
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

## Trust KPI Definitions and Targets

The risk program publishes the following trust KPIs in each weekly governance packet and quarterly executive summary.

| KPI | Definition | Formula | Target | Source |
| --- | --- | --- | --- | --- |
| Control freshness | Share of controls that are not stale against the snapshot date. A control is stale if it is open and `targetDate` is before the snapshot date. | `(total controls - stale controls) / total controls * 100` | >= 95% | `docs/security-compliance/control-status.json` + CI snapshot artifact `trust-kpi-snapshot.json` |
| Open critical risk age | Age in days of the oldest open Critical risk from created date to snapshot date. | `max(snapshot_date - created_date)` for open Critical risks | <= 30 days (or approved exception) | `docs/security-compliance/risk-register.json` |
| Evidence completeness | Share of controls with non-empty evidence references suitable for reviewer verification. | `controls with evidenceLocation / total controls * 100` | 100% for Critical/High controls, >= 98% overall | `docs/security-compliance/control-status.json` |
| Disclosure SLA adherence | Percent of notifiable incidents that met initial customer disclosure SLA. | `incidents meeting SLA / total notifiable incidents * 100` | 100% within 72 hours | Incident communication log + quarterly incident summary |

### KPI publication and evidence requirements

- KPI snapshots are generated in CI and scheduled governance runs using `node scripts/ci/extract-governance-risk-control-kpis.mjs` and attached as artifacts.
- Governance reviewers must attach the latest `trust-kpi-snapshot.json`, `open-risks.json`, `stale-controls.json`, and `vdp-kpis.json` outputs to quarterly records.
- Any KPI target breach requires either a dated remediation commitment or an approved risk acceptance record with expiry.

## Quarterly Integrated Review Process

Quarterly review is mandatory and links risk posture to incident and compliance outputs.

### Required preparation artifacts

- Incident summary for quarter (including Sev1/Sev2 corrective action status).
- Compliance evidence summary (control failures, exceptions, unresolved attestations).
- Vendor review remediation status for Critical/High vendors.
- Open-risk aging and overdue-risk report.

### Quarterly review steps

1. Reconcile newly opened risks against incident and compliance outputs.
2. Validate closure evidence quality for risks closed during the quarter.
3. Re-score residual risk where controls changed materially.
4. Confirm owner/due-date completeness for all open risks.
5. Approve quarterly remediation priorities for next quarter.

### Quarterly outputs

- Signed quarterly risk review summary.
- Top residual risk list with owner commitments.
- Exception register updates (accepted risks + expiry dates).
- Compliance-ready risk posture snapshot for audits/customer requests.

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
- **Quarterly**: Board/compliance-ready summary with top residual risks, incident linkage, and control exception status.

## Exit Criteria for a Healthy Register

- 100% of open risks have an assigned owner and due date.
- 100% of Critical/High risks have active mitigation plans.
- 0 overdue Critical risks without documented executive exception.
- Risk evidence links are present for all mitigated/closed entries.
