# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ValueOS, please report it privately:

- **Primary channel**: `security@valueos.dev`
- **Backup channel**: create a private security advisory in GitHub (Security tab) if email is unavailable.

Please include:

- A clear description of the issue and affected component(s).
- Reproduction steps or proof-of-concept.
- Potential impact and any known mitigation.
- Your preferred contact method for follow-up.

Do **not** open public issues for unpatched vulnerabilities.

## Response SLA

We follow this coordinated disclosure timeline:

- **Acknowledgement**: within **2 business days**.
- **Triage + severity assignment**: within **5 business days**.
- **Remediation target**:
  - Critical (P0): begin mitigation immediately, target fix within 7 days.
  - High (P1): target fix within 14 days.
  - Medium (P2): target fix within 30 days.
  - Low (P3): scheduled in normal backlog.

If timelines shift due to operational constraints, we will provide status updates and revised ETA.

## Severity Handling

Severity is assessed using impact + exploitability, aligned to internal P0–P3 handling:

- **P0 / Critical**: active exploitation, tenant isolation break, auth bypass, or severe data exposure.
- **P1 / High**: significant confidentiality/integrity risk requiring expedited patching.
- **P2 / Medium**: meaningful but constrained impact, compensating controls often available.
- **P3 / Low**: low-impact hardening or defense-in-depth gaps.

Security fixes are validated through CI security checks and released with appropriate urgency based on severity.

## Coordinated Disclosure & Safe Harbor

We support good-faith security research and coordinated disclosure.

When conducting research in good faith, we will not pursue legal action for:

- Testing against systems you own or are explicitly authorized to test.
- Avoiding privacy violations, service disruption, and data destruction.
- Promptly reporting findings and giving reasonable time for remediation before public disclosure.

Please avoid:

- Social engineering, phishing, or physical attacks.
- Denial-of-service attempts.
- Accessing, modifying, or exfiltrating non-public user data beyond what is minimally necessary to demonstrate impact.

We may publicly acknowledge researchers (with consent) after remediation.
