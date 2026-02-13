# Security Allowlist Approval Process

The CI security gates are configured to block merges on **HIGH/CRITICAL** findings by default.

## Approved allowlist workflow

1. Prefer remediation over allowlisting.
2. If allowlisting is required, update only tool-native allowlist/config files:
   - `.trivyignore`
   - `.checkov.yml`
   - `.hadolint.yaml`
   - `.semgrepignore`
   - `.github/security/**`
3. Open a pull request that includes:
   - rationale,
   - expiration date,
   - ticket/reference for remediation follow-up.
4. Security reviewer approves by applying the PR label:
   - `security-allowlist-approved`
5. CI job **Allowlist Approval Gate** enforces this label whenever allowlist files are changed.

Without the approval label, the PR is blocked.
