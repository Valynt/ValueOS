# Vendor Risk Review Workflow

**Owner:** Security & Compliance  
**Version:** 1.0  
**Last Reviewed:** 2026-02-13  
**Cadence:** Annual (with event-driven reassessment)

---

## Objective

Provide a formal, auditable workflow for annual vendor risk reviews, evidence collection, and remediation tracking for all in-scope subprocessors and critical vendors.

---

## Scope and Triggers

### In Scope

- Vendors processing customer or employee data.
- Vendors supporting authentication, infrastructure, observability, analytics, or model inference.
- Vendors with privileged integration paths into production systems.

### Triggers

- Annual scheduled review.
- Material service change (new data type, architecture, region).
- Security incident at vendor.
- Renewal or contract amendment.

---

## Workflow

1. **Plan review window**
   - Confirm review owner and due date.
   - Pull prior-year findings and open actions.
2. **Collect evidence**
   - SOC reports/certifications.
   - Security questionnaire responses.
   - DPA and contractual control terms.
   - Incident and uptime history.
3. **Score risk**
   - Rate inherent risk (data sensitivity + integration depth).
   - Rate residual risk (controls + evidence quality).
4. **Approve / condition / reject**
   - Approve if residual risk is acceptable.
   - Condition approval on remediation with due dates.
   - Escalate high residual risk to leadership.
5. **Track remediation**
   - Open actions in remediation tracker.
   - Assign owners and deadlines.
   - Verify closure with objective evidence.
6. **Archive review packet**
   - Save finalized review artifact, approvals, and closure evidence.

---

## Annual Review Evidence Template

> Create one completed packet per vendor review cycle.

### Vendor Review Packet

- **Vendor name:**
- **Service category:**
- **Business owner:**
- **Security reviewer:**
- **Review period:**
- **Data classification handled:**
- **Regions used:**
- **Subprocessor dependency risk:**

#### Evidence Checklist

- [ ] Current SOC 2 / ISO report reviewed.
- [ ] Security questionnaire completed and validated.
- [ ] DPA/contractual controls verified current.
- [ ] Breach and incident notifications reviewed.
- [ ] Data retention and deletion controls verified.
- [ ] Access control/MFA posture verified.
- [ ] Disaster recovery/BCP assertions reviewed.

#### Risk Decision

- **Inherent risk:** Low / Medium / High
- **Residual risk:** Low / Medium / High
- **Decision:** Approved / Approved with conditions / Rejected
- **Approval date:**
- **Approver(s):**
- **Summary rationale:**

---

## Remediation Tracking Artifact

Track all conditions and findings in this table until closure.

| Finding ID | Vendor | Risk Severity | Gap Description | Required Action | Owner | Due Date | Status | Evidence Link | Closed Date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VR-YYYY-001 | Example Vendor | High | Missing contractual incident SLA | Add notification clause ≤72h | Legal | 2026-04-15 | Open | link-to-record | |

### Status Definitions

- **Open:** identified, not started.
- **In Progress:** remediation underway.
- **Blocked:** external dependency prevents completion.
- **Closed:** remediation validated and documented.

---

## Reporting and Governance

- Quarterly compliance meeting includes vendor remediation status rollup.
- Overdue high-severity items are escalated to CTO and Compliance owner.
- Annual summary feeds trust center updates and audit preparation.

---

## Output Artifacts

- Completed annual vendor review packet (per vendor).
- Remediation tracker export with closure evidence.
- Executive summary for quarterly compliance review.

