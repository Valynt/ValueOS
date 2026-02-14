# Vendor Risk Review Workflow

**Owner**: Security & Compliance Program
**Cadence**: Annual full review; event-driven reassessment for material changes

## Purpose

This workflow defines how ValueOS performs annual vendor risk review, captures review evidence, and tracks remediation actions for vendors and subprocessors.

## Scope

Applies to:

- All active subprocessors.
- Any vendor processing customer data.
- Vendors with network, infrastructure, authentication, observability, or support-plane access.

## Workflow

1. **Inventory Confirmation**
   - Confirm active vendors, service purpose, and data classification handled.
   - Identify criticality tier (Critical, High, Standard).
2. **Evidence Collection**
   - Gather latest SOC 2/ISO reports, penetration test summaries, certifications, and security questionnaire responses.
   - Validate DPA and contractual security terms are current.
3. **Risk Assessment**
   - Score inherent risk (data sensitivity + access scope + business dependency).
   - Score control maturity from provided evidence and known incidents.
   - Assign residual risk rating (Critical, High, Medium, Low).
4. **Remediation Planning**
   - Open remediation actions for identified gaps with owner and due date.
   - Escalate unresolved Critical/High findings to Security leadership.
5. **Approval and Recording**
   - Record annual review disposition: Approved, Approved with Conditions, or Escalated.
   - Update risk register entries and subprocessor metadata.
6. **Quarterly Follow-up**
   - Validate remediation completion status for open actions.
   - Carry overdue items into governance review and compliance summaries.

## Annual Review Evidence Artifact (Template)

Store one artifact per vendor per annual cycle in the compliance evidence repository.

```markdown
# Vendor Annual Risk Review Evidence

- Vendor Name:
- Review Period:
- Reviewer(s):
- Vendor Tier: (Critical/High/Standard)
- Services in Scope:
- Data Categories Processed:

## Evidence Collected
- [ ] SOC 2 / ISO report reviewed (attach location)
- [ ] Security questionnaire completed
- [ ] DPA and contractual terms validated
- [ ] Breach/incident history reviewed (last 12 months)
- [ ] Subprocessor dependencies reviewed

## Risk Assessment
- Inherent Risk:
- Control Maturity Summary:
- Residual Risk:
- Key Gaps Identified:

## Decision
- Review Outcome: Approved / Approved with Conditions / Escalated
- Conditions (if any):
- Next Review Date:

## Linked Remediation Items
| Action ID | Gap Description | Owner | Due Date | Status | Evidence Link |
|---|---|---|---|---|---|
```

## Remediation Tracking Requirements

- Each gap must map to an internal Action ID and (if material) a Risk ID in the risk register.
- Required fields: owner, due date, severity, status, and closure evidence.
- Overdue Critical/High actions must be reviewed in weekly risk review until closure.
- Closure requires evidence validation by Security/Compliance reviewer.

## Outputs

- Updated subprocessor and vendor assurance status.
- Risk register updates for material vendor risks.
- Quarterly compliance-ready summary of open/closed vendor remediation actions.

## Linked Controls and Documents

- [Subprocessor List](./subprocessor-list.md)
- [Trust Center Package](./trust-center.md)
- [Risk Register Process](../processes/risk-register-process.md)
