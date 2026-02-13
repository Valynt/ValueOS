# Trust Center Package

**Owner:** Security & Compliance  
**Version:** 1.0  
**Last Reviewed:** 2026-02-13  
**Review Cadence:** Quarterly

---

## 1) Data Ownership and Control

ValueOS customers retain ownership of all customer content and metadata processed through the platform.

### Commitments

- Customer data is processed only to provide contracted services and support.
- We do not sell customer data.
- Customers can request export and deletion of tenant data based on contractual terms.
- Access to production data is role-based, least-privilege, and logged.

### Shared Responsibility Highlights

- **ValueOS:** platform security, infrastructure hardening, monitoring, incident handling.
- **Customer:** identity lifecycle management, data classification, lawful data use.

---

## 2) Subprocessor Transparency

ValueOS maintains a subprocessor inventory and performs annual reassessment.

| Subprocessor | Service Category | Data Elements Processed | Region / Residency Controls | Assurance Signals |
| --- | --- | --- | --- | --- |
| Supabase | Database + Auth | Customer content, auth metadata | Region selection by environment | SOC 2, DPA |
| Together.ai | Model inference | Prompt/response payloads per request | Contractual restrictions + retention controls | SOC 2 |
| Vercel | Hosting / Edge delivery | Application delivery telemetry | Region-aware deployment controls | SOC 2 |
| Sentry | Error monitoring | Redacted logs and traces | Data scrubbing + retention controls | Security program + DPA |
| PostHog | Product analytics | Pseudonymized usage events | Configurable collection + retention | DPA |

### Subprocessor Management Controls

- Security and privacy due diligence before onboarding.
- DPA (or equivalent terms) required before production use.
- Material subprocessor changes are reflected in this package and internal register.

---

## 3) Data Processing Agreement (DPA) Terms

ValueOS supports DPA execution for customers requiring contractual privacy controls.

### Standard DPA Coverage

- Roles and scope of processing (controller/processor or equivalent).
- Confidentiality obligations and access restrictions.
- Technical and organizational security measures.
- Data subject request support workflows.
- Deletion/return obligations at contract termination.
- Subprocessor flow-down obligations.
- Cross-border transfer mechanisms where applicable.

### Contract Operations

- DPA requests are routed through Legal + Security.
- Signed DPAs are retained in the compliance evidence repository.
- DPA terms are reviewed at renewal and on regulatory changes.

---

## 4) Breach Notification Commitments

ValueOS maintains an incident response process with defined external communications.

### Notification Targets

- Initial customer notice of confirmed qualifying breach: **without undue delay, target within 72 hours** of confirmation.
- Ongoing updates: every 24 hours (or as contractually required) until containment and recovery milestones are complete.
- Post-incident report: within 10 business days after incident closure unless contract specifies otherwise.

### Notification Content Baseline

- Incident summary and affected service scope.
- Data categories potentially impacted.
- Containment actions and current customer-facing risk.
- Required customer actions (if any).
- Follow-up timeline and point of contact.

---

## 5) Audit and Assurance Cadence

ValueOS uses a multi-layer audit model for operational and compliance assurance.

| Control Area | Cadence | Evidence Artifact |
| --- | --- | --- |
| Access review | Quarterly | Access review report + approvals |
| Vulnerability management | Monthly + continuous CI scanning | Scan reports + remediation tickets |
| Incident response tabletop | Bi-annual | Exercise plan + after-action report |
| Vendor risk reassessment | Annual | Vendor review packet + remediation tracker |
| Compliance readiness review | Quarterly | Compliance scorecard + action log |

### External Assessment Posture

- Annual third-party penetration test.
- Ongoing internal security validation.
- Audit artifacts are controlled and available under NDA/request.

---

## 6) Trust Center Artifact Index

- Security overview: `docs/security-compliance/security-overview.md`
- Compliance baseline: `docs/security-compliance/compliance-guide.md`
- Vendor risk workflow: `docs/security-compliance/vendor-risk-review-workflow.md`
- Coordinated vulnerability disclosure: `docs/security-compliance/bug-bounty-cvd-program.md`

