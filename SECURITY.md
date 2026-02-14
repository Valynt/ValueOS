# Security Policy

## Coordinated Vulnerability Disclosure

If you discover a security vulnerability in ValueOS, please report it privately so we can investigate and remediate it before public disclosure.

### Report channel

- Email: **security@valueos.ai**
- Subject line: `Security Disclosure: <short title>`
- Include affected component(s), impact, reproduction steps, and any proof-of-concept.

If encrypted exchange is required, note that in your report and we will provide a secure channel for follow-up.

## Response and SLA

We follow these target service levels for coordinated disclosure:

- **Acknowledgement**: within **1 business day**.
- **Initial triage decision**: within **3 business days**.
- **Remediation plan**: within **7 business days** for confirmed issues.
- **Status updates**: at least **weekly** until closure.

Complex issues may require more time; if so, we will communicate scope and revised timelines.

## Severity handling

Severity is assessed using CVSS-informed impact and exploitability criteria and mapped to internal priorities:

- **Critical (P0)**: active exploitation, tenant data compromise, auth bypass, or RCE. Immediate mitigation and emergency release workflow.
- **High (P1)**: significant confidentiality/integrity/availability risk without full critical blast radius. Prioritized patch release.
- **Medium (P2)**: meaningful but constrained risk. Scheduled fix in normal release cadence.
- **Low (P3)**: low exploitability or limited impact. Backlog with documented risk acceptance when appropriate.

Public disclosure timing is coordinated with the reporter after a fix or mitigating control is available.

## Safe harbor

We support good-faith security research. For activities consistent with this policy, ValueOS will not pursue legal action against researchers who:

- Avoid privacy violations, data destruction, service disruption, and social engineering.
- Test only against accounts/data they own or have explicit permission to access.
- Do not exfiltrate, alter, or retain customer data beyond what is minimally necessary to demonstrate the issue.
- Provide us a reasonable opportunity to remediate before public disclosure.

Out-of-scope or malicious activity (e.g., extortion, denial of service, or unauthorized persistence) is not covered by safe harbor.

## Preferred report template

Please include:

1. Vulnerability type and affected location.
2. Preconditions and attack path.
3. Reproduction steps and expected vs actual behavior.
4. Security impact and affected assets/tenants.
5. Suggested remediation (if available).
