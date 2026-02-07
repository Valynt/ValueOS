# Active Architectural Decisions

This document captures the key architectural decisions and security requirements extracted from the production readiness audit. These decisions guide the implementation and must be maintained for production stability.

## 1. Row Level Security (RLS) Policy Enforcement

**Decision:** Enforce strict tenant isolation at the database level using RLS policies.

**Rationale:** Prevent cross-tenant data leakage, which is a critical security risk.

**Implementation:**

- All tables must have RLS enabled
- Policies must check tenant_id explicitly
- NULL tenant_id values are rejected
- Audit triggers log suspicious access attempts

**Affected Tables:**

- agent_sessions
- agent_predictions
- workflow_executions
- canvas_data

**Status:** Requires implementation of migration script `20241213000000_fix_rls_tenant_isolation.sql`

## 2. Agent Error Handling and Circuit Breakers

**Decision:** All agent implementations must use secureInvoke() with circuit breaker protection.

**Rationale:** Prevent agent failures from crashing workflows and ensure cost controls on LLM calls.

**Implementation:**

- BaseAgent provides secureInvoke() method
- Circuit breaker integration for resilience
- Confidence scoring and validation
- Cost limits per call and timeout controls
- Structured error logging

**Status:** Requires refactoring all agents (OpportunityAgent, RealizationAgent, ExpansionAgent, IntegrityAgent) to use secureInvoke()

## 3. Logger Security - Secret Redaction

**Decision:** Implement automatic redaction of sensitive data in logs.

**Rationale:** Prevent exposure of secrets, API keys, passwords in CloudWatch/Datadog logs.

**Implementation:**

- Redact sensitive keys: password, token, secret, api_key, authorization, cookie
- Recursive redaction for nested objects
- Apply to all log levels and outputs
- Maintain log usability while protecting data

**Status:** Requires update to `src/lib/logger.ts` with redactSensitiveData function

## 4. SDUI Error Boundaries

**Decision:** Implement comprehensive error boundaries for Server-Driven UI components.

**Rationale:** Prevent single component failures from crashing the entire application.

**Implementation:**

- SDUIErrorBoundary component with graceful fallbacks
- Component-level isolation
- Error logging to monitoring systems
- Retry mechanisms for transient failures
- User-friendly error displays

**Status:** Requires implementation of `src/sdui/components/SDUIErrorBoundary.tsx` and integration into renderer

## 5. Deep Health Checks

**Decision:** Health checks must verify actual service connectivity, not just API responsiveness.

**Rationale:** Prevent routing traffic to broken instances with database or Redis failures.

**Implementation:**

- Check database connectivity with actual queries
- Verify Redis ping and operations
- Test agent service availability
- Return appropriate HTTP status codes (200/503)
- Include response times and error details

**Status:** Requires update to `src/api/health.ts` with deep dependency checks

## 6. Environment Variable Validation

**Decision:** Strict validation of environment variables at startup with clear error messages.

**Rationale:** Fail fast on configuration issues rather than runtime errors.

**Implementation:**

- Zod-based validation schema
- Required vs optional variables
- Pattern matching and custom validators
- Cross-dependency checks
- Security warnings for placeholder values

**Status:** Implemented in `scripts/env-validate.ts`

## 7. Secret Management in Environment Files

**Decision:** Never commit real secrets to version control; use placeholders and CI/CD secrets.

**Rationale:** Prevent credential exposure in repositories.

**Implementation:**

- Environment files contain placeholder values
- CI/CD pipelines inject real secrets
- Validation script warns on placeholder values
- Separate env files for different environments

**Status:** Environment files created with placeholders in `deploy/envs/`

## 8. Caddy Production Configuration

**Decision:** Use Caddy as production reverse proxy with automatic HTTPS and security headers.

**Rationale:** Simplify SSL management and provide security hardening.

**Implementation:**

- Automatic Let's Encrypt certificates
- Security headers (HSTS, CSP, etc.)
- Request body size limits
- Structured JSON logging
- Health check endpoints

**Status:** Configured in `infra/caddy/` with production-ready settings

## 9. Docker Compose Separation

**Decision:** Separate development dependencies from production deployment strategy.

**Rationale:** Development environments need flexibility; production needs optimization.

**Implementation:**

- `ops/compose/core.yml` for dev services (postgres, redis)
- `infra/docker/docker-compose.prod.yml` for production deployment
- Optimized images and resource limits
- Secrets management via Docker secrets

**Status:** Separated configurations implemented

## Success Criteria

- 0 RLS bypass vulnerabilities verified
- 100% agent calls wrapped in circuit breakers
- 0 secrets in production logs
- SDUI components have error boundaries
- Health checks verify all dependencies
- Environment validation passes before deployment
- Secrets never committed to version control
- Production deployment uses optimized Docker images

## References

- PRODUCTION_READINESS_CRITICAL_GAPS.md (audit/)
- CADDY_IMPLEMENTATION_SUMMARY.md (caddy/)
- scripts/env-validate.ts
