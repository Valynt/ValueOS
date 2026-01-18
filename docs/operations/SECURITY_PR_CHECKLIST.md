# 🔒 Security PR Checklist (Mandatory)

All pull requests must pass this checklist before merging to production.

## Input & Data Handling

* [ ] All user input validated with a schema (Zod/ Joi/ similar)
* [ ] No unchecked `JSON.parse` - use schema validation
* [ ] Payload size limits enforced (< 10MB default)
* [ ] No raw user input in SQL queries (use parameterized queries)
* [ ] File uploads: type, size, and content validation

## Network & External Calls

* [ ] All outbound URLs use SSRF guard (`assertSafeUrl()`)
* [ ] No raw `fetch(url)` with user input
* [ ] No wildcard allowlists without justification
* [ ] Timeouts set on all network calls (< 30s)
* [ ] HTTPS required for production endpoints

## Frontend Security

* [ ] No `unsafe-inline` in production CSP
* [ ] CSP nonce correctly propagated to templates
* [ ] No inline scripts/styles added dynamically
* [ ] XSS prevention: input sanitization or CSP nonces
* [ ] Sensitive data never logged to console

## Authentication & Authorization

* [ ] Authorization checked server-side (never trust client)
* [ ] No client-trusted role flags
* [ ] Token scopes validated and minimal
* [ ] Session timeouts enforced (< 24h absolute)
* [ ] MFA required for privileged operations

## Logging & Observability

* [ ] No secrets logged (tokens, passwords, keys)
* [ ] Security-relevant actions logged with correlation ID
* [ ] Structured logging used (`securityEvents`)
* [ ] PII/data minimization in logs
* [ ] Alertable signals for security events

## Configuration

* [ ] Dev-only flags gated by `NODE_ENV !== 'production'`
* [ ] Secure defaults enforced (fail closed)
* [ ] Environment variables validated on startup
* [ ] No hardcoded secrets or credentials

## Dependencies & Infrastructure

* [ ] Dependencies scanned for vulnerabilities (dependabot/Snyk)
* [ ] No new high/critical CVEs introduced
* [ ] Database migrations tested in staging
* [ ] Rollback plan documented for schema changes

## Testing

* [ ] Unit tests for security logic
* [ ] Integration tests for authz flows
* [ ] Security test cases added for new features
* [ ] Fuzz testing for input validation
* [ ] Load testing doesn't expose DoS vectors

## Compliance & Legal

* [ ] Data classification reviewed (PII, PHI, etc.)
* [ ] GDPR/privacy impact assessed
* [ ] SOC2/ISO27001 controls maintained
* [ ] Third-party vendor security reviewed

## Deployment

* [ ] Feature flags used for gradual rollout
* [ ] Rollback procedure tested
* [ ] Monitoring dashboards updated
* [ ] Incident response plan updated if needed

## Sign-off

* [ ] Security team review completed
* [ ] Architecture review completed (if major changes)
* [ ] QA sign-off obtained
* [ ] Product owner approval for security trade-offs

---

## 🚨 Blocking Issues

PR cannot merge if any of these are true:

* ❌ Security test failures
* ❌ High/critical vulnerabilities introduced
* ❌ Authentication bypass possible
* ❌ Unencrypted sensitive data transmission
* ❌ SQL injection or similar injection flaws

## 📞 Security Escalation

If unsure about any item, escalate immediately to:
- Security Team: @security-team
- Architecture Review: @tech-leads

---

## 📊 Security Score

Calculate PR security score:
- 90-100%: ✅ Ready to merge
- 70-89%: ⚠️ Requires security review
- <70%: ❌ Must be reworked

Score = (Completed items / Total items) × 100