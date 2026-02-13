# Bug Bounty & Coordinated Vulnerability Disclosure (CVD) Program

**Status:** Implemented  
**Owner:** Security Engineering  
**Effective Date:** 2026-02-13  
**Review Cadence:** Semi-annual

---

## Program Goals

- Provide a safe channel for external security researchers.
- Reduce mean time to triage and remediation for valid findings.
- Reward high-quality, impactful reports.

---

## Submission Process

1. Researcher submits a report via the security contact channel with reproduction details.
2. Triage team acknowledges receipt and validates scope.
3. Vulnerability is severity-rated using the matrix below.
4. Engineering owner is assigned and remediation starts.
5. Fix is validated and reporter receives closure update.
6. Disclosure timing is coordinated after fix deployment.

### Required Report Content

- Affected endpoint/component.
- Reproduction steps and proof of concept.
- Impact statement.
- Suggested mitigation (optional).

---

## Safe Harbor & Research Rules

Allowed:

- Testing only against owned ValueOS assets in program scope.
- Non-destructive proof-of-concept testing.
- Immediate reporting of discovered vulnerabilities.

Not allowed:

- Data exfiltration beyond minimum proof.
- Service disruption (DoS/DDoS, destructive testing).
- Social engineering, phishing, or physical intrusion.

Researchers acting in good faith within these rules will be treated under a safe-harbor posture.

---

## Service Levels (SLA)

| Stage | SLA Target |
| --- | --- |
| Initial acknowledgment | 24 hours |
| Triage decision (valid/duplicate/out-of-scope) | 3 business days |
| Severity assignment and owner assignment | 5 business days |
| Remediation target (Critical) | 7 calendar days |
| Remediation target (High) | 14 calendar days |
| Remediation target (Medium) | 30 calendar days |
| Remediation target (Low) | 90 calendar days |
| Reporter closure communication | 5 business days after fix validation |

---

## Severity Matrix

| Severity | Typical Impact | Examples | Remediation Expectation |
| --- | --- | --- | --- |
| Critical | Direct compromise of confidentiality/integrity/availability at scale | Remote code execution, auth bypass for admin privilege | 7 days |
| High | Significant security impact with practical exploitation | Tenant isolation bypass, sensitive data exposure requiring auth | 14 days |
| Medium | Security weakness with constrained exploitability/impact | Stored XSS in constrained context, SSRF with limited reach | 30 days |
| Low | Limited impact or hard-to-exploit issue | Missing security headers without exploit path | 90 days |
| Informational | Best-practice improvement | Verbose error handling, hardening suggestions | Backlog |

---

## Reward and Recognition Model

- Eligible valid findings may receive bounty rewards based on severity, report quality, and novelty.
- Duplicate or previously known issues are not bounty-eligible.
- Out-of-scope findings are acknowledged but not rewarded.

---

## Program Metrics

Tracked monthly and reported quarterly:

- Number of submitted, valid, duplicate, and out-of-scope reports.
- Mean time to triage.
- Mean time to remediate by severity.
- SLA attainment percentage.

---

## Evidence and Compliance Linkage

- All reports are logged in the security issue tracker.
- Severity and remediation data feed quarterly compliance reviews.
- High/Critical findings are linked to incident management artifacts when applicable.

