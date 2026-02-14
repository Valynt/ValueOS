# Security Policy

## Coordinated Vulnerability Disclosure

ValueOS welcomes responsible security research and follows a coordinated vulnerability disclosure process.

- Report suspected vulnerabilities privately through **security@valueos.com**.
- Do **not** disclose vulnerability details publicly until ValueOS confirms remediation or provides disclosure guidance.
- Include reproducibility details (affected endpoint/service, impact, prerequisites, proof of concept, and suggested remediation if available).
- Encrypt sensitive report details when possible (PGP key available on request).

## Reporting SLA

ValueOS targets the following service levels for incoming reports:

1. **Acknowledgement**: within **1 business day**.
2. **Initial triage decision** (valid / need more information / out of scope): within **3 business days**.
3. **Severity assessment and owner assignment**: within **5 business days**.
4. **Status updates**: at least every **5 business days** until closure.
5. **Remediation target windows** (from validation date):
   - **Critical**: 7 calendar days
   - **High**: 30 calendar days
   - **Medium**: 90 calendar days
   - **Low**: next planned release cycle

If remediation requires an exception, the assigned risk owner must document compensating controls and revised due date in the risk register.

## Safe Harbor

When acting in good faith under this policy, ValueOS considers your activities authorized and will not pursue legal action for:

- Testing against systems you own or are explicitly authorized to test.
- Reasonable, non-destructive testing that avoids privacy violations, data exfiltration, and service degradation.
- Prompt reporting of discovered issues without extortion, ransom demands, or unauthorized disclosure.

Researchers must:

- Avoid intentional disruption (DoS/DDoS), social engineering, phishing, physical attacks, and malware deployment.
- Stop testing and notify ValueOS immediately if sensitive data is exposed.
- Provide ValueOS a reasonable remediation period before public disclosure.

## Scope and Exclusions

In-scope targets include ValueOS-managed production services and APIs unless otherwise documented.

Out of scope:

- Third-party services not controlled by ValueOS.
- Vulnerabilities requiring privileged physical access.
- Best-practice findings without demonstrable security impact.

## Preferred Report Template

- Reporter name/handle and contact method
- Affected asset(s)
- Vulnerability type and severity estimate
- Reproduction steps
- Impact statement
- Proof-of-concept artifacts (logs/screenshots)
- Suggested fix or mitigation

Thank you for helping keep ValueOS and its customers secure.
