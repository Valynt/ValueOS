# Security & Compliance Context

## 1. Zero-Trust Intelligence

ValueOS treats AI agents as potential risks. No agent has direct write access to the Value Fabric.

### SecureInvoke Pattern

1. **Proposal:** Agent submits a JSON change request.
2. **Validation:** IntegrityAgent checks against financial guardrails (e.g., "ROI cannot be > 10,000%").
3. **Audit:** VMRT hash is generated and stored in `vos_audit_logs`.
4. **Commit:** SQL transaction executed only if `VALIDATED`.

## 2. Authentication & Authorization

- **Supabase Auth:** Email/Password, OAuth (Google/Apple), and Magic Links.
- **MFA:** TOTP (RFC 6238) support via `MFAService.ts`.
- **PKCE:** Enabled for all OAuth flows to prevent interception.
- **Guest Access:** Cryptographically secure tokens with 3-tier permissions (`view`, `comment`, `edit`).

## 3. Data Protection

- **CSRF Protection:** Enforced on all state-changing operations.
- **Rate Limiting:** `RateLimiter.ts` protects auth and API endpoints.
- **PII Masking:** Local pre-processing hashes PII before sending to LLM providers.
- **Encryption:** AES-256 at rest; TLS 1.3 in transit.

## 4. Compliance

- **SOC2 Readiness:** Continuous audit trails via VMRT and `agent_executions`.
- **GDPR:** Automated data deletion via cascading RLS-scoped deletes.
- **Auditability:** Every financial claim is linked to a verified ground truth source.

---

**Last Updated:** 2026-01-28
**Related:** `src/lib/auth/`, `src/security/`, `docs/security/`
