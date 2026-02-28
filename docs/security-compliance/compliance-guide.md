# Compliance Guide

**Last Updated**: 2026-02-13

**Consolidated from 6 source documents**

---

## Table of Contents

1. [Multi-Tenancy Security Audit](#multi-tenancy-security-audit)
2. [Code Review Checklist](#code-review-checklist)
3. [SOC 2 Type II Policy Documentation](#soc-2-type-ii-policy-documentation)
4. [Epic 6 Compliance and Governance Gap Closure](#epic-6-compliance-and-governance-gap-closure)
5. [Compliance checklists](#compliance-checklists)
6. [ValueCanvas Compliance & Security Audit](#valuecanvas-compliance-&-security-audit)
7. [HIPAA Applicability and Control Mapping](#hipaa-applicability-and-control-mapping)
8. [Third-Party Penetration Test Program](#third-party-penetration-test-program)

---

## Third-Party Penetration Test Program

ValueOS requires an **independent third-party penetration test at least annually** for in-scope production systems, APIs, and tenant isolation controls.

### Program Requirements

- Testing must be performed by a qualified external assessor independent of implementation teams.
- Scope must include external attack surface, authentication/authorization paths, tenant isolation, and high-risk integrations.
- Retesting is required for any unresolved Critical/High finding before attestation closeout.
- Findings must be entered into the risk register with owner, severity, and mitigation due date alignment.

### Evidence Artifact Checklist

For each annual test cycle, retain the following evidence artifacts in the compliance evidence repository:

- Signed statement of work or engagement letter (scope, dates, assessor).
- Final penetration test report with methodology and finding severity ratings.
- Executive summary suitable for customer trust review.
- Raw finding tracker mapped to internal Risk IDs.
- Remediation plan with assigned owners and committed due dates.
- Retest or validation evidence for Critical/High findings.
- Management attestation confirming closure status and residual risk acceptance.

Evidence retention should follow the policy baseline used for audit artifacts and remain accessible for customer and auditor review.


## HIPAA Applicability and Control Mapping

### Applicability by Product Use Case and Environment

- **Default platform posture**: HIPAA is **not required** for standard ValueOS workloads that exclude protected health information (PHI).
- **HIPAA-triggering posture**: HIPAA Security Rule controls become **in-scope** when a tenant stores, processes, transmits, or supports workflows containing PHI (for example: patient identifiers, treatment context, claims, or clinical operations data).
- **Environment scoping**:
  - **Production** handling PHI: in-scope for HIPAA administrative, technical, and physical safeguards.
  - **Staging/non-production**: must use de-identified/synthetic data unless explicitly designated as HIPAA in-scope and covered by equivalent safeguards.
  - **Developer local environments**: out-of-scope for PHI; PHI is prohibited outside approved managed environments.

Reference architecture and environment controls:

- [Security Architecture](../architecture/security-architecture.md)
- [Infrastructure Architecture](../architecture/infrastructure-architecture.md)
- [Production Environment](../environments/production-environment.md)

### HIPAA Security Rule Safeguard Mapping

| Safeguard domain | HIPAA reference | ValueOS control implementation |
| --- | --- | --- |
| Administrative safeguards | 45 CFR §164.308 | Security governance ownership, workforce security responsibilities, and documented response workflows in [Incident Response Runbook](../operations/incident-response.md) and [Emergency Procedures](../runbooks/emergency-procedures.md). |
| Technical safeguards: access controls | 45 CFR §164.312(a) | Tenant-scoped authorization, role-based access patterns, and least-privilege service access; see [Security Overview](./security-overview.md) and [Audit Logging](./audit-logging.md). |
| Technical safeguards: audit controls | 45 CFR §164.312(b) | Centralized, immutable audit trail requirements with traceability and retention expectations in [Audit Logging](./audit-logging.md) and incident handling validation in [Monitoring & Observability](../operations/monitoring-observability.md). |
| Technical safeguards: transmission security | 45 CFR §164.312(e) | Encryption in transit (TLS) and controlled egress/integration patterns per [Production Contract](./production-contract.md) and [Deployment Guide](../operations/deployment-guide.md). |
| Administrative + technical: incident response/security incidents | 45 CFR §164.308(a)(6) | Detection, triage, containment, eradication, and post-incident review in [Incident Response](../operations/incident-response.md) and [Disaster Recovery Runbook](../runbooks/disaster-recovery.md). |
| Physical safeguards | 45 CFR §164.310 | Inherited controls through cloud providers and hosting vendors; enforce vendor assurance and contractual obligations via annual vendor review and BAA requirements below. |

### PHI Classification and Data Boundaries

- **Data classification**:
  - **Restricted-PHI**: any individually identifiable health information; highest handling requirements.
  - **Confidential**: sensitive non-PHI business data.
  - **Internal/Public**: non-sensitive operational and published content.
- **Storage and processing boundaries**:
  - PHI is only permitted in approved production data stores and services that are explicitly designated HIPAA-capable.
  - PHI is excluded from analytics, observability, and debugging sinks unless those sinks are approved and contractually covered.
  - Backups containing PHI must follow encrypted storage, strict access review, and restore test procedures documented in [Disaster Recovery Runbook](../runbooks/disaster-recovery.md).
- **Operational linkage**:
  - Incident and breach workflow: [Incident Response Runbook](../operations/incident-response.md).
  - Platform data flow and trust boundaries: [Data Architecture](../architecture/data-architecture.md) and [Architecture Overview](../architecture/architecture-overview.md).

### Third-Party BAA Requirements

- Any vendor that stores, processes, transmits, or can access PHI on behalf of ValueOS or a tenant must have a signed **Business Associate Agreement (BAA)** before PHI onboarding.
- Vendor onboarding for PHI-enabled tenants must include:
  - Security review and risk classification.
  - Verification of HIPAA support and breach-notification terms.
  - Evidence of encryption, access controls, and auditability.
- No PHI-enabled integration may be promoted to production without BAA confirmation and legal/compliance sign-off.

### Compliance Review Cadence and Evidence Checkpoints

- **Monthly**: Access review and audit-log sampling for PHI-enabled tenants.
- **Quarterly**: HIPAA safeguard control review (administrative/technical/physical), incident-response tabletop, and vendor/BAA status validation.
- **Annually**: Full policy review, risk assessment refresh, and training attestation.


### Quarterly Compliance Evidence Bundle Checklist

Use this checklist at the end of each quarter to assemble and attest the evidence bundle:

- [ ] Confirm the latest successful `Compliance Evidence Export` workflow run for the quarter.
- [ ] Verify bundle contains all required directories: `security-scans/`, `privacy/`, `rls/`, and `metadata/`.
- [ ] Validate immutable metadata fields: commit SHA, run ID, run attempt, ref, and UTC export timestamp.
- [ ] Confirm DSR/privacy and RLS outputs are from the expected test suites and include pass/fail status.
- [ ] Review security scan outputs for unresolved critical findings and document approved exceptions.
- [ ] Attach the artifact link and manifest to quarterly governance review records.
- [ ] Download and archive the `.tar.gz` bundle to the long-term compliance archive location defined in CI/CD policy.
- [ ] Record reviewer name, review date, and sign-off outcome in the compliance tracker.

Evidence checkpoints are tracked in CI/governance workflows:

- CI evidence and artifact retention requirements: [CI/CD Pipeline](../operations/ci-cd-pipeline.md).
- Governance/compliance review checkpoints and ownership: this guide's checklist and audit sections.

---

## Multi-Tenancy Security Audit

*Source: `compliance/multi-tenancy-checklist.md`*

## 1. Request Context & Tenant Binding

- [x] Every HTTP request extracts `organization_id` from JWT claims (evidence: packages/backend/src/middleware/auth.ts)
- [x] `organization_id` stored in request context (not URL parameter for core data) (evidence: packages/backend/src/middleware/tenantContext.ts)
- [x] All database queries filtered by `organization_id` (evidence: packages/backend/src/middleware/tenantDbContext.ts, packages/backend/src/api/workflow.ts, packages/backend/src/repositories/WorkflowStateRepository.ts)
- [ ] No exceptions for "admin" users without explicit role checks
  - Location: packages/backend/src/middleware/rbac.ts
- [ ] Agent execution scoped to request organization
  - Location: packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts
- [ ] API key scopes include organization_id restriction
  - Location: packages/backend/src/middleware/apiKeyRateLimiter.ts

## 2. Data Access Layer

- [x] All ORM queries use `.filter(Model.organization_id == org_id)` (evidence: packages/backend/src/repositories/WorkflowStateRepository.ts)
- [x] Raw SQL queries include tenant filter in WHERE clause (evidence: packages/backend/src/api/workflow.ts)
- [ ] No SELECT \* without WHERE organization_id = ?
  - Location: packages/backend/src/repositories/WorkflowStateRepository.ts
- [ ] Joins across tables include organization_id in join conditions
  - Location: packages/backend/src/services/TenantAwareService.ts
- [ ] Subqueries filtered by organization_id
  - Location: packages/backend/src/services/TenantAwareService.ts
- [ ] Aggregate functions (COUNT, SUM) filtered by organization_id
  - Location: packages/backend/src/services/TenantAwareService.ts

## 3. Agent & Orchestration Layer

- [ ] Agent initialization includes organization_id parameter
  - Location: packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts
- [ ] Agent memory (vector store, cache) namespaced by organization_id
  - Location: packages/backend/src/services/memory/MemoryPipeline.ts
- [ ] Agent tools receive organization context
  - Location: packages/backend/src/services/MCPTools.ts
- [ ] Agent outputs filtered before returning to user
  - Location: packages/backend/src/services/AgentOutputListener.ts
- [ ] No cross-tenant data in agent prompts/context
  - Location: packages/backend/src/lib/agent-fabric/TaskContext.ts

## 4. Cache Layer (Redis/Memcached)

- [x] Cache keys prefixed with organization_id: `{org_id}:model:{model_id}` (evidence: packages/backend/src/services/CacheService.ts)
- [x] Cache invalidation on multi-tenant boundary (evidence: packages/backend/src/services/CacheService.ts, packages/backend/src/services/__tests__/CacheService.tenant.test.ts)
- [x] No global caches without organization scoping by default (evidence: packages/backend/src/services/CacheService.ts, packages/backend/src/services/__tests__/CacheService.tenant.test.ts)

## 5. Search & Indexing

- [ ] Elasticsearch/similar: documents include organization_id field
  - Location: packages/backend/src/services/VectorSearchService.ts
- [ ] Search queries include organization_id filter
  - Location: packages/backend/src/services/VectorSearchService.ts
- [ ] Full-text search scoped to tenant
  - Location: packages/backend/src/services/VectorSearchService.ts

## 6. File Storage & CDN

- [ ] S3 keys include organization_id: `s3://bucket/{org_id}/...`
  - Location: packages/backend/src/config/schema.ts
- [ ] Pre-signed URLs scoped to organization
  - Location: packages/backend/src/config/schema.ts
- [ ] CloudFront cache behaviors include organization in headers
  - Location: packages/backend/src/config/schema.ts

## 7. Audit & Logging

- [ ] Every data access logged with organization_id
  - Location: packages/backend/src/services/security/AuditTrailService.ts
- [ ] Audit log queries include organization_id filter
  - Location: packages/backend/src/services/security/AuditTrailService.ts
- [ ] No cross-tenant log aggregation without filtering
  - Location: packages/backend/src/services/security/AuditTrailService.ts

## 8. Authentication & Secrets

- [ ] JWT payload includes organization_id (claim: 'org_id')
  - Location: packages/backend/src/middleware/auth.ts
- [ ] API keys scoped to organization
  - Location: packages/backend/src/middleware/apiKeyRateLimiter.ts
- [ ] Service-to-service tokens include organization context
  - Location: packages/backend/src/middleware/serviceIdentityMiddleware.ts
- [ ] No hardcoded secrets in code or config
  - Location: packages/backend/src/config/secretsManager.ts
- [ ] Secrets rotated every 90 days
  - Location: packages/backend/src/services/security/APIKeyRotationService.ts
- [ ] AWS Secrets Manager or HashiCorp Vault used
  - Location: packages/backend/src/config/secrets/AWSSecretProvider.ts

## 9. Error Handling

- [x] 404 returned for non-existent or unauthorized resources (not 403) (evidence: packages/backend/src/middleware/tenantContext.ts, packages/backend/src/api/workflow.ts)
- [x] No data leakage in error messages (evidence: packages/backend/src/middleware/tenantContext.ts, packages/backend/src/services/TenantAwareService.ts)
- [ ] Error logs don't expose tenant data
  - Location: packages/backend/src/middleware/globalErrorHandler.ts

## 10. Testing

### Tenant isolation acceptance criteria

- [x] Middleware binds tenant context per request and blocks spoofed tenant headers (evidence: packages/backend/src/middleware/tenantContext.ts, packages/backend/src/middleware/__tests__/tenantContext.test.ts)
- [x] Database request context applies tenant binding at transaction scope (`SET LOCAL app.tenant_id`) (evidence: packages/backend/src/middleware/tenantDbContext.ts, packages/backend/src/middleware/__tests__/tenantDbContext.test.ts)
- [x] Application cache operations are tenant-scoped for reads/writes and invalidation (evidence: packages/backend/src/services/CacheService.ts, packages/backend/src/services/__tests__/CacheService.tenant.test.ts)

- [x] Unit tests verify organization_id filtering (evidence: src/lib/rules/**tests**/RulesEnforcer.test.ts)
- [x] Integration tests verify cross-tenant isolation (evidence: packages/backend/src/api/__tests__/workflow.integration.test.ts, supabase/tests/database/multi_tenant_rls.test.sql in secure CI RLS stage)
- [ ] Penetration tests attempt cross-tenant access
  - Location: tests/compliance/

---

## Code Review Checklist

*Source: `compliance/code-review-checklist.md`*

This checklist is a framework for ensuring code quality, consistency, and adherence to architectural principles.

---

## Code Style & Consistency (TypeScript/JavaScript)

- **ESLint Compliance**: Code passes `npm run lint` with no errors. Avoid disabling rules without justification.
- **Prettier Formatting**: Code is formatted automatically by Prettier (if configured). Consistency is key.
- **Type Safety**:
  - Use TypeScript throughout. Avoid `any` type unless absolutely necessary and justified.
  - Use utility types (`Partial`, `Omit`, `Pick`, etc.) to create robust types.
  - Interfaces and types are well-defined and organized, preferably in `src/types`.
- **Import Organization**: Imports are grouped (e.g., external libs, absolute paths from `src`, relative paths). An ESLint rule should enforce this.
- **Naming Conventions**:
  - `PascalCase` for components, classes, and types (e.g., `MyComponent`, `class UserService`, `type UserProfile`).
  - `camelCase` for functions, variables, and methods (e.g., `getUser`, `const userData`).
  - Constants can be `UPPER_SNAKE_CASE` (e.g., `const MAX_RETRIES = 3`).
- **Component Organization**:
  - React components are functional components using hooks.
  - One component per file (unless they are very small, related sub-components).
  - Props are defined with a `type` or `interface`.
- **Async/Await Patterns**:
  - Use `async/await` for all asynchronous operations. Avoid `.then()` chaining where possible for better readability.
  - Proper `try/catch` error handling is used for all awaited calls.

---

## Performance & Optimization

- **Database Queries**:
  - Avoid making database calls inside loops (N+1 problem).
  - Use Supabase's query features to select only the columns you need (`select('id, name')`).
  - Fetch data server-side or in loaders (e.g., React Router loaders) where possible to avoid waterfalls.
- **Caching**:
  - For expensive queries, consider a Redis cache layer with tenant-prefixed keys.
  - Client-side data fetching libraries (like TanStack Query) should be used to cache data and avoid redundant requests.
- **Bundle Size & Code Splitting**:
  - Use dynamic `import()` for large components or libraries that are not needed on the initial page load.
  - Regularly analyze the bundle with a tool like `vite-bundle-visualizer`.
- **Unused Dependencies**: Run `npx depcheck` or similar tools to identify and remove unused packages from `package.json`.
- **React Performance**:
  - Use `React.memo` for components that re-render unnecessarily.
  - Use `useCallback` and `useMemo` to memoize functions and values, especially when passed as props to memoized children.
  - Avoid anonymous functions in props (`<div onClick={() => ...} />`).

---

## Frontend UX/UI Review

- **Architecture & Component Structure**:
  - Components are small, single-purpose, and reusable (e.g., Atomic Design).
  - Project structure separates concerns (components, hooks, services, styles, assets).
  - State is colocated with usage; avoid excessive prop drilling with appropriate state management.
- **User Experience & Interactivity**:
  - UI provides immediate feedback (loading states, skeletons, success/error messages, disabled controls).
  - Optimistic UI is used for high-confidence actions to improve perceived speed.
  - Smooth animations and transitions target 60fps; prefer CSS animations over JS-heavy ones.
  - Progressive disclosure is used for complex features (modals, accordions, tooltips).
  - URLs reflect current views for shareability and navigation history.
- **Visual Design & Theming**:
  - Styling approach is consistent and scalable (CSS Modules, Tailwind, Styled Components).
  - Design tokens exist for color, typography, spacing, and elevation; theming supports dark/light modes.
  - Visualizations are clear, labeled, and interactive with appropriate charting libraries.
  - Micro-interactions support affordances without distracting from primary tasks.
- **Responsive & Accessible UI**:
  - Layouts are tested across breakpoints and devices for consistent behavior.
  - Semantic HTML and ARIA attributes are used for interactive components.
  - Keyboard navigation is supported across critical flows.
  - Color contrast meets accessibility guidelines (WCAG).

---

## Security Vulnerabilities

- **Supabase RLS**: All tables containing tenant data **must** have Row-Level Security enabled and policies that enforce tenant isolation.
- **XSS Prevention**:
  - When using `dangerouslySetInnerHTML`, the content must be sanitized with a library like `dompurify`.
  - Never construct HTML from user input directly.
- **Authentication & Authorization**:
  - All API routes and server-side logic must be protected and verify the user's JWT.
  - Business logic must check user roles or permissions where necessary (e.g., an 'admin' role).
- **Secret Management**:
  - No hardcoded secrets (API keys, JWT secrets) in the frontend or backend code.
  - All secrets must be loaded from environment variables and managed via a secure secret manager (e.g., Supabase Vault, AWS Secrets Manager).
- **Dependency Vulnerabilities**: Run `npm audit` or `snyk test` regularly and fix high-severity vulnerabilities.
- **Rate Limiting**: API endpoints exposed to the public (including the billing webhook) must have rate limiting.

---

## Testing Coverage

- **Unit Tests**: Aim for >80% code coverage on critical services, utilities, and business logic. Use Vitest.
- **Integration Tests**: Write tests that interact with a real (or dockerized) Supabase instance to verify RLS policies and data integrity.
- **E2E Tests**: Use Playwright to automate critical user flows, such as login, creating a model, and checking multi-tenant access restrictions.
- **Mocking**: External services (like Stripe or an LLM API) should be mocked in unit and integration tests.
- **Test Isolation**: Tests should be runnable independently and should clean up after themselves.

---

## Documentation

- **README**: Must contain clear, up-to-date instructions for setup, running tests, and deploying.
- **API Documentation**: The backend API (even if minimal) should be documented. If using a framework that supports OpenAPI, generate a spec.
- **Architecture Decisions**: Important decisions should be documented in ADRs (Architecture Decision Records) in the `docs/adr` folder.
- **Component Library**: If using Storybook, components should have stories that document their props and states.

---

## Multi-Tenancy & Architecture

- **Tenant Isolation**: `organization_id` must be the primary key for all tenant-scoped data access and caching.
- **Agent Orchestration**: Agents must receive tenant context (`organizationId`) and should not be able to access data outside their scope.
- **Configuration Management**: Use the centralized `Settings` object (`src/config.ts` or similar) and do not spread `process.env` access across the codebase.
- **Structured Logging**: Use a centralized logger (e.g., Pino, Winston) that injects context (`org_id`, `user_id`, `requestId`) into every log message. Avoid `console.log`.
- **Error Handling**: Use centralized error handling middleware and custom error classes. Frontend should have Error Boundaries.

---

## SOC 2 Type II Policy Documentation

*Source: `compliance/SOC2_SECURITY_POLICIES.md`*

**Version**: 1.0
**Effective Date**: January 1, 2026
**Last Review**: December 29, 2025
**Next Review**: March 29, 2026
**Owner**: Security Team
**Approver**: Chief Security Officer

---

## Table of Contents

1. [Data Classification and Handling Policy](#1-data-classification-and-handling-policy)
2. [Incident Response Policy](#2-incident-response-policy)
3. [Access Control Policy](#3-access-control-policy)
4. [Change Management Policy](#4-change-management-policy)
5. [Business Continuity and Disaster Recovery](#5-business-continuity-and-disaster-recovery)
6. [Vendor Management Policy](#6-vendor-management-policy)
7. [Encryption and Key Management](#7-encryption-and-key-management)
8. [Monitoring and Logging Policy](#8-monitoring-and-logging-policy)

---

## 1. Data Classification and Handling Policy

### Purpose

Establish a framework for classifying and protecting data based on sensitivity and regulatory requirements.

### Scope

All data processed, stored, or transmitted by ValueOS systems.

### Data Classification Levels

#### Level 1: Public

- **Definition**: Information intended for public disclosure
- **Examples**: Marketing materials, public documentation
- **Protection**: Standard access controls
- **Retention**: No specific requirements

#### Level 2: Internal

- **Definition**: Information for internal use only
- **Examples**: Internal documentation, process guidelines
- **Protection**: Authentication required, internal network only
- **Retention**: 3 years minimum

#### Level 3: Confidential

- **Definition**: Sensitive business information
- **Examples**: Financial projections, business strategies, customer data
- **Protection**: Encryption at rest and in transit, role-based access
- **Retention**: 7 years (regulatory compliance)
- **Handling**:
  - Access logged and audited
  - MFA required for access
  - No external sharing without approval

#### Level 4: Restricted (PII/PHI)

- **Definition**: Regulated personally identifiable information
- **Examples**: SSN, credit cards, health records, EU citizens' data (GDPR)
- **Protection**: AES-256 encryption, database-level encryption, tokenization
- **Retention**: Minimal necessary, right to deletion honored
- **Handling**:
  - Strict need-to-know access
  - All access logged with justification
  - Data minimization enforced
  - Breach notification within 72 hours

### Data Lifecycle Management

```
Collection → Processing → Storage → Access → Disposal
     ↓            ↓           ↓         ↓         ↓
  Minimal    Purpose      Encrypted  Audited  Secure
  Required   Limitation   At Rest    Access   Deletion
```

### Data Handling Requirements

| Classification | Encryption         | Access Control   | Audit Logging | Retention  |
| -------------- | ------------------ | ---------------- | ------------- | ---------- |
| Public         | Optional           | None             | No            | Indefinite |
| Internal       | TLS in transit     | Authentication   | Optional      | 3 years    |
| Confidential   | TLS + AES-256      | RBAC + MFA       | Yes           | 7 years    |
| Restricted     | E2E + Tokenization | Zero Trust + MFA | All access    | Minimal    |

### Compliance Mappings

- **SOC 2 CC6.1**: Logical and physical access controls
- **GDPR Article 32**: Security of processing
- **HIPAA §164.312**: Technical safeguards

---

## 2. Incident Response Policy

### Purpose

Define procedures for detecting, responding to, and recovering from security incidents.

### Incident Severity Levels

#### P0 - Critical

- **Definition**: Active data breach, system-wide outage, ransomware
- **Response Time**: Immediate (< 15 minutes)
- **Escalation**: CEO, CSO, Legal immediately
- **Communication**: Customer notification within 4 hours

#### P1 - High

- **Definition**: Unauthorized access attempt, service degradation
- **Response Time**: < 1 hour
- **Escalation**: Security team, Engineering lead
- **Communication**: Internal stakeholders within 2 hours

#### P2 - Medium

- **Definition**: Policy violations, suspicious activity
- **Response Time**: < 4 hours
- **Escalation**: Security team
- **Communication**: Weekly security report

#### P3 - Low

- **Definition**: Minor vulnerabilities, informational
- **Response Time**: < 24 hours
- **Escalation**: Security analyst
- **Communication**: Monthly roundup

### Incident Response Process

```
1. DETECTION
   ↓
2. TRIAGE (Severity assessment)
   ↓
3. CONTAINMENT (Isolate affected systems)
   ↓
4. ERADICATION (Remove threat)
   ↓
5. RECOVERY (Restore normal operations)
   ↓
6. POST-MORTEM (Document lessons learned)
```

### Incident Response Team (IRT)

| Role                | Responsibility            | Contact                 |
| ------------------- | ------------------------- | ----------------------- |
| Incident Commander  | Overall coordination      | oncall@valueos.com      |
| Security Lead       | Technical investigation   | security@valueos.com    |
| Communications Lead | Stakeholder notifications | comms@valueos.com       |
| Legal Counsel       | Regulatory compliance     | legal@valueos.com       |
| Engineering Lead    | System remediation        | engineering@valueos.com |

### Breach Notification Requirements

**GDPR (EU customers)**:

- Notification to supervisory authority within 72 hours
- Customer notification without undue delay if high risk

**CCPA (California customers)**:

- Notification to California AG and affected individuals without unreasonable delay

**SOC 2**:

- Notification to affected customers and auditors
- Incident documented in audit report

### Post-Incident Review

Within 5 business days of incident resolution:

- Root cause analysis document
- Timeline of events
- Remediation actions taken
- Preventive measures implemented
- Process improvements identified

### Compliance Mappings

- **SOC 2 CC7.3**: Incident response procedures
- **GDPR Article 33**: Breach notification
- **NIST CSF PR.IP-9**: Response and recovery plans

---

## 3. Access Control Policy

### Purpose

Ensure that access to systems and data is granted based on the principle of least privilege.

### Access Principles

1. **Zero Trust**: Verify explicitly, assume breach, least privilege
2. **Need-to-Know**: Access only to required resources
3. **Time-Bound**: Regular review and revocation
4. **Auditable**: All access logged and monitored

### Role-Based Access Control (RBAC)

Implemented via `/src/types/security.ts`:

| Role      | Permissions                          | Use Case              |
| --------- | ------------------------------------ | --------------------- |
| ADMIN     | All permissions                      | System administrators |
| CFO       | VIEW_FINANCIALS, APPROVE_RISK        | Financial executives  |
| DEVELOPER | VIEW_TECHNICAL_DEBT, EXECUTE_AGENT   | Engineering team      |
| ANALYST   | VIEW_FINANCIALS, VIEW_TECHNICAL_DEBT | Business analysts     |
| AGENT     | EXECUTE_AGENT                        | AI autonomous agents  |

### Authentication Requirements

**Human Users**:

- Minimum 16-character password OR passkey
- MFA required for production access
- Session timeout: 8 hours (4 hours for admin)
- Failed login lockout: 5 attempts = 15-minute lockout

**Service Accounts (AI Agents)**:

- API key + JWT token
- Short-lived tokens (1 hour max)
- Scoped permissions
- Credential rotation every 90 days

### Access Request Process

```
1. Request submitted via ServiceNow (or approved ticketing system)
   ↓
2. Manager approval required
   ↓
3. Security review (for elevated access)
   ↓
4. Provisioning (automated via IaC)
   ↓
5. Access granted + notification
   ↓
6. Quarterly access review
```

### Access Revocation

**Immediate revocation upon**:

- Termination
- Role change
- Security incident
- Policy violation

**Automated checks**:

- Inactive accounts disabled after 90 days
- Stale permissions removed after 180 days
- Admin access reviewed quarterly

### Production Access Controls

- All production access via bastion host
- Session recording enabled
- Just-in-time (JIT) access for emergency changes
- Break-glass procedures documented

### Compliance Mappings

- **SOC 2 CC6.1, CC6.2**: Logical access controls
- **GDPR Article 32(1)(b)**: Ongoing confidentiality
- **ISO 27001 A.9**: Access control

---

## 4. Change Management Policy

### Purpose

Ensure all changes to production systems are reviewed, tested, and documented.

### Change Classifications

#### Standard Change

- **Definition**: Pre-approved, low-risk changes
- **Examples**: Scaling instances, routine patches
- **Approval**: Automated via CI/CD
- **Testing**: Unit + integration tests

#### Normal Change

- **Definition**: Planned, documented changes
- **Examples**: Feature deployments, configuration updates
- **Approval**: Tech lead + peer review
- **Testing**: Full test suite + staging deployment

#### Emergency Change

- **Definition**: Urgent fixes for critical issues
- **Examples**: Security patches, P0 incident remediation
- **Approval**: On-call engineer + post-hoc review
- **Testing**: Smoke tests minimum

### Change Request Process

```
1. RFC Created (Jira/Linear/GitHub)
   ↓
2. Impact Analysis (blast radius, rollback plan)
   ↓
3. Peer Review (2+ approvers for production)
   ↓
4. Testing (staging environment)
   ↓
5. CAB Approval (for high-risk changes)
   ↓
6. Deployment (blue-green or canary)
   ↓
7. Verification (smoke tests, monitoring)
   ↓
8. Documentation (changelog, runbook update)
```

### Change Advisory Board (CAB)

**Members**: CTO, Security Lead, SRE Lead, Product Manager

**Meeting Frequency**: Weekly (or ad-hoc for emergency changes)

**Scope**: Reviews high-risk changes (> 10% of user base)

### Deployment

Windows

- **Production**: Tuesday/Thursday 10 AM - 2 PM PST
- **Staging**: Anytime
- **Hotfixes**: Anytime with CAB approval

**Blackout Periods**:

- Major holidays
- End of fiscal quarter (last 3 days)
- During active incidents

### Rollback Procedures

- All deployments must have rollback plan
- Automated rollback triggers:
  - Error rate > 5%
  - Latency > 2x baseline
  - Critical alert fired

### Compliance Mappings

- **SOC 2 CC8.1**: Change management procedures
- **ISO 27001 A.12.1.2**: Change management
- **ITIL Change Management**: Industry best practice

---

## 5. Business Continuity and Disaster Recovery

### Purpose

Ensure ValueOS can continue operations during and after a disaster.

### Recovery Objectives

| System         | RTO        | RPO        | Criticality |
| -------------- | ---------- | ---------- | ----------- |
| Production API | 1 hour     | 15 minutes | Critical    |
| Database       | 1 hour     | 5 minutes  | Critical    |
| Auth System    | 30 minutes | 1 minute   | Critical    |
| Analytics      | 4 hours    | 1 hour     | High        |
| Reporting      | 24 hours   | 4 hours    | Medium      |

**RTO** = Recovery Time Objective (max downtime)
**RPO** = Recovery Point Objective (max data loss)

### Backup Strategy

**Database Backups**:

- Continuous: Point-in-time recovery (Supabase)
- Snapshots: Every 6 hours
- Retention: 30 days hot, 1 year cold storage
- Encryption: AES-256 at rest

**Application Backups**:

- Infrastructure as Code (Terraform state)
- Configuration stored in Git
- Secrets in Supabase Vault (encrypted)

**Testing**:

- Backup restoration test: Monthly
- Full DR drill: Quarterly
- Documented in runbook

### Disaster Scenarios

#### Scenario 1: Database Failure

1. Automatic failover to replica (Supabase HA)
2. Verify data consistency
3. Monitor replication lag
4. Investigate root cause

#### Scenario 2: Region Outage

1. Failover to secondary region (if multi-region)
2. Update DNS to new region
3. Verify application health
4. Monitor cost impact

#### Scenario 3: Ransomware Attack

1. Isolate affected systems
2. Restore from clean backup
3. Rotate all credentials
4. Forensic analysis
5. Law enforcement notification

### Communication Plan

**Internal**:

- Status page: status.valueos.com
- Slack #incidents channel
- Email to all-hands@valueos.com

**External**:

- Customer status page
- Email to affected customers
- Social media updates (if widespread)

###Compliance Mappings

- **SOC 2 CC9.1**: Business continuity
- **ISO 27001 A.17**: Information security aspects of BCM
- **GDPR Article 32(1)(c)**: Ability to restore availability

---

## 6. Vendor Management Policy

### Purpose

Ensure third-party vendors meet ValueOS security and compliance standards.

### Vendor Risk Assessment

All vendors handling Confidential or Restricted data must:

- Complete security questionnaire
- Provide SOC 2 Type II report (or equivalent)
- Sign Data Processing Agreement (DPA)
- Undergo annual security review

### Vendor Classification

| Tier      | Risk Level | Examples                        | Review Period |
| --------- | ---------- | ------------------------------- | ------------- |
| Critical  | High       | Cloud providers (AWS, Supabase) | Quarterly     |
| Important | Medium     | LLM APIs (OpenAI, Anthropic)    | Semi-annual   |
| Standard  | Low        | Analytics tools                 | Annual        |

### Required Vendor Documentation

- SOC 2 Type II report (preferred) or ISO 27001 certification
- Privacy policy and DPA (for data processors)
- SLA with uptime commitments
- Incident notification procedures
- Data residency confirmation

### Vendor Onboarding Checklist

- [ ] Security questionnaire completed
- [ ] Compliance certificates reviewed
- [ ] DPA signed
- [ ] Access controls configured (least privilege)
- [ ] Monitoring alerts set up
- [ ] Offboarding process documented

### Vendor Monitoring

- Monthly review of security incidents
- Quarterly SLA compliance check
- Annual contract renewal with security review

### Compliance Mappings

- **SOC 2 CC9.2**: Vendor management
- **GDPR Article 28**: Processor obligations
- **ISO 27001 A.15**: Supplier relationships

---

## 7. Encryption and Key Management

### Purpose

Protect data confidentiality through encryption and secure key management.

### Encryption Standards

**Data at Rest**:

- Algorithm: AES-256-GCM
- Key Management: Supabase Vault + AWS KMS
- Coverage: All databases, file storage, backups

**Data in Transit**:

- TLS 1.3 minimum (TLS 1.2 deprecated)
- Perfect Forward Secrecy (PFS) required
- Certificate pinning for mobile apps

**End-to-End Encryption** (for PII/PHI):

- Client-side encryption before transmission
- Tokenization for credit cards
- Zero-knowledge architecture where feasible

### Key Management Hierarchy

```
Master Key (AWS KMS)
    ↓
Data Encryption Keys (DEK)
    ↓
Field-Level Encryption Keys
```

### Key Rotation Policy

| Key Type              | Rotation Frequency | Auto-Rotation         | Priority     |
| --------------------- | ------------------ | --------------------- | ------------ |
| **Together.ai API**   | **90 days**        | **Yes (VOS-SEC-005)** | **CRITICAL** |
| OpenAI API            | 90 days            | Yes (VOS-SEC-005)     | High         |
| Anthropic API         | 90 days            | Yes (VOS-SEC-005)     | High         |
| AWS IAM Keys          | 90 days            | Yes (VOS-SEC-005)     | High         |
| Master Keys           | Annual             | Yes (AWS KMS)         | Critical     |
| Database Keys         | Annual             | Yes (Supabase)        | Critical     |
| JWT Signing Keys      | 180 days           | Yes                   | Medium       |
| Supabase Service Role | 180 days           | Manual notification   | Critical     |
| User Passwords        | On compromise      | N/A                   | N/A          |

**Note**: Together.ai is the primary LLM provider for ValueOS, handling 100% of AI inference traffic. Its API key rotation is prioritized as CRITICAL and automated via VOS-SEC-005.

**Rotation Implementation**: All API key rotations include:

- 2-hour grace period (zero-downtime rotation)
- Pre-activation validation testing
- Automatic audit logging
- Admin notifications (for manual steps)

### Secure Key Storage

- **Never in code**: No hardcoded secrets
- **Supabase Vault**: For application secrets
- **AWS Secrets Manager**: For infrastructure secrets
- **Environment variables**: Encrypted at rest

### Key Lifecycle

```
1. GENERATION (HSM or KMS)
   ↓
2. DISTRIBUTION (Secure channel)
   ↓
3. USAGE (Access logged)
   ↓
4. ROTATION (Automated schedule)
   ↓
5. DESTRUCTION (Cryptographic erasure)
```

### Compliance Mappings

- **SOC 2 CC6.1, CC6.7**: Encryption
- **GDPR Article 32**: Encryption as security measure
- **PCI DSS 3.4**: Key management

---

## 8. Monitoring and Logging Policy

### Purpose

Detect security incidents and maintain audit trail for compliance.

### Log Collection

**What We Log**:

- Authentication events (login, logout, failed attempts)
- Authorization decisions (access granted/denied)
- Administrative actions
- System errors and exceptions
- API requests (method, endpoint, user, timestamp)
- Database queries (for sensitive tables)
- Infrastructure changes

**What We Don't Log**:

- Passwords or secrets
- Full credit card numbers
- Unencrypted PII
- Health information (HIPAA)

### Log Retention

| Log Type         | Retention | Storage                        | Compliance Requirement |
| ---------------- | --------- | ------------------------------ | ---------------------- |
| Security Events  | 7 years   | Hot: 90 days, Archive: 7 years | SOC 2                  |
| Access Logs      | 1 year    | Hot: 30 days, Archive: 1 year  | GDPR                   |
| Application Logs | 90 days   | Hot only                       | Operational            |
| Audit Logs       | 7 years   | Immutable storage              | SOC 2                  |

### Log Protection

- **Integrity**: Hash-based verification (Merkle trees)
- **Encryption**: AES-256 at rest
- **Access Control**: Admin-only via ProtectedComponent
- **Immutability**: Write-once storage (WORM)

### Monitoring & Alerting

**Security Alerts** (PagerDuty):

- Failed login spike (> 10/minute)
- Unauthorized access attempt
- Privilege escalation
- Anomalous data access pattern

**Operational Alerts** (Sentry/DataDog):

- Error rate > 1%
- Latency > 500ms (p95)
- Infrastructure resource exhaustion

### Security Information and Event Management (SIEM)

**Tool**: Supabase + Custom Dashboard (or Splunk/ELK in future)

**Use Cases**:

- Real-time threat detection
- Compliance reporting
- Forensic investigation
- User behavior analytics

### Compliance Mappings

- **SOC 2 CC7.2**: Monitoring for security events
- **GDPR Article 30**: Records of processing activities
- **ISO 27001 A.12.4**: Logging and monitoring

---

## Policy Review and Updates

### Review Schedule

- **Quarterly**: Security team reviews all policies
- **Annual**: Full audit and update cycle
- **Ad-hoc**: After major incidents or regulatory changes

### Approval Process

- Draft reviewed by Security Team
- Legal review for compliance
- CSO approval
- Board approval for major changes

### Version Control

All policies stored in Git with:

- Version history
- Change log
- Approval signatures (digital)

---

## Enforcement

Violations of these policies may result in:

- Warning (first offense, minor)
- Access suspension (repeat or moderate)
- Termination (severe or repeated)
- Legal action (criminal or regulatory violations)

---

## Contact Information

**Policy Owner**: security@valueos.com
**Security Team**: security@valueos.com
**Legal Team**: legal@valueos.com
**Report Incident**: incidents@valueos.com
**Compliance Questions**: compliance@valueos.com

---

**Document Control**:

- **ID**: SEC-POL-001
- **Version**: 1.0
- **Status**: Active
- **Classification**: Internal
- **Next Review**: 2026-03-29

---

## Epic 6 Compliance and Governance Gap Closure

*Source: `compliance/epic6-compliance-governance.md`*

This document specifies the technical design, implementation approach, and validation plan to close two critical gaps: (1) missing compliance stamps on outputs and (2) an enhanced audit framework with cross-stage traceability and anomaly detection. All controls are designed to be non-disruptive, align with SOX, GDPR, and applicable financial regulations, and to complete within the current sprint pending security review.

## 1. Compliance Stamp Framework

### 1.1 Metadata schema

Add a mandatory, append-only compliance stamp to every system output (UI payloads, generated files, APIs, analytics exports, and financial-model outputs). Fields are enforced as required unless otherwise noted.

| Field                   | Description                               | Format / Enum                                                                                                          | Source                  | Validation                                                                                      |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `stamp_version`         | Schema version for forward compatibility. | `v1`                                                                                                                   | Static                  | Must equal current version.                                                                     |
| `timestamp_utc`         | Time of final materialization.            | ISO-8601 UTC                                                                                                           | Runtime                 | Must be present and after upstream lineage timestamps.                                          |
| `data_classification`   | Sensitivity level.                        | Enum: `public`, `internal`, `confidential`, `restricted`                                                               | Policy engine           | Must match policy for data domain and user role.                                                |
| `regulatory_compliance` | Applicable frameworks.                    | Array enum: `SOX`, `GDPR`, `FINRA`, `CCPA`, `PCI-DSS`, etc.                                                            | Policy engine           | Cannot be empty; must include SOX for financial statements and GDPR when personal data present. |
| `approval_status`       | Release gate.                             | Enum: `draft`, `pending-approval`, `approved`, `rejected`                                                              | Workflow                | Must be `approved` before external egress; UI enforces disabled export otherwise.               |
| `data_lineage`          | Provenance details.                       | Object: `producer_id`, `source_assets[]`, `transformations[]`, `model_version`, `input_hash`, `request_id`, `trace_id` | Runtime instrumentation | `producer_id` and `request_id` required; source assets must have immutable IDs.                 |
| `integrity`             | Tamper evidence.                          | HMAC over payload + stamp                                                                                              | Stamp service           | Must validate before consumption.                                                               |

### 1.2 Stamp generation and propagation

- **Stamp service**: Add a `ComplianceStampService` module callable from SDUI and financial engines. Provides `attachStamp(payload, context)` that returns `{ payload, stamp }` with HMAC integrity protection.
- **Middleware hooks**: HTTP/gRPC middleware injects stamps on responses; background jobs wrap exports before write; UI download endpoints must serialize stamp alongside data.
- **Lineage capture**: Intercept data pipeline DAG events to populate `source_assets`, `transformations`, and `model_version`. Attach `trace_id` shared with audit trail for cross-stage linking.
- **Storage**: Persist stamps in an append-only `compliance_stamps` collection/table keyed by `trace_id` + `request_id` to allow offline validation.
- **Multi-format rendering**:
  - **JSON**: Embed under `_compliance` top-level field.
  - **CSV**: Emit sidecar `.stamp.json` file with the same basename.
  - **PDF/Reports**: Render a footer block listing classification, frameworks, approval status, timestamp, and hash.
  - **UI tiles**: Show a badge with classification + approval; detailed stamp available via “View provenance”.

### 1.3 Validation rules and enforcement

- **Pre-egress validator**: Block any output where required stamp fields are missing, `approval_status != approved` for external channels, or HMAC verification fails. Responses return `422` with remediation hints.
- **Schema guards**: JSON Schema for `_compliance` and TypeScript types enforce compile-time guarantees in SDUI; financial batch jobs validate using the schema before file write.
- **Policy hooks**: Data-classification and regulatory sets computed by a policy decision point (PDP) with dynamic context (user role, region). PDP denial prevents stamp issuance.
- **CI/CD checks**: Add contract tests to ensure new routes and exporters call `ComplianceStampService.attachStamp`.
- **Runtime dashboards**: Metrics for `stamps_missing`, `stamps_rejected`, and `approval_blocked` with alerts >0 for 5 minutes.

## 2. Enhanced Audit Framework

### 2.1 Architecture and trace linking

- **Global identifiers**: Every user action and batch job issues a `trace_id` and `request_id`; stamps and audit logs share these IDs to enable hop-by-hop reconstruction.
- **Structured events**: Standard envelope: `{ timestamp_utc, trace_id, request_id, actor, tenant, stage, action, resource, before, after, outcome, latency_ms, stamp_hash }`.
- **Pipelines**:
  - **SDUI**: Instrument component actions (load, edit, export) via a client logger buffering to a server-side ingestion API with retry/backpressure.
  - **Financial models**: Wrap model execution, validation, approvals, and publication steps with server-side emitters that include model version, dataset IDs, and control totals.
- **Storage**: Write to an append-only log store (e.g., Kafka topic + WORM (Write Once Read Many) object storage) with daily snapshots to a SOX-compliant archive. Enable partitioning by tenant and data domain for GDPR access/erasure workflows.
- **Immutability controls**: Use object-lock/retention on archive buckets; hash-chains per `trace_id` to detect tampering.

### 2.2 Real-time anomaly detection

- **Rule layer**: Deterministic checks (e.g., export without `approved` stamp, cross-border access for restricted data, model outputs missing control totals).
- **Statistical layer**: EWMA (Exponentially Weighted Moving Average)/Z-score detectors over event frequency and value distributions per actor, tenant, and action. Maintain baselines per 1h and 24h windows.
- **Sequence layer**: Detect audit trail breaks by ensuring sequential stage ordering per `trace_id` (e.g., `ingest -> transform -> validate -> approve -> publish`). Missing or reordered stages trigger alerts.
- **Output correlation**: Compare `stamp_hash` against stored stamps; mismatch flags potential tampering.

### 2.3 Alerting and observability

- **Alert routing**: Pager/Slack/email via alert manager with severity mapping (P1 for trail breaks or tamper evidence; P2 for rule violations; P3 for statistical anomalies only).
- **Dashboards**: Panels for event volume, anomaly counts, trail completeness %, and top offenders. Drilldowns by `trace_id` to reconstruct full journey.
- **Runbooks**: Link alerts to remediation steps (replay missing stage, revoke token, freeze export queue) and to the security review checklist.

## 3. Implementation timeline (current sprint)

- **Day 1–2**: Implement `ComplianceStampService`, JSON Schema/TypeScript definitions, and middleware hooks; stub sidecar writers for CSV/PDF exports.
- **Day 3–4**: Instrument SDUI actions and financial pipelines with trace IDs and stamp attachment; build pre-egress validator and CI contract tests.
- **Day 5**: Stand up audit ingestion API, Kafka topic, and archival sink; emit structured events from SDUI and financial stages.
- **Day 6**: Implement rule + EWMA anomaly detectors and trail sequence checker; configure alerts and dashboards.
- **Day 7**: End-to-end testing, security review sign-off, and deploy behind feature flags with progressive rollout.

## 4. Risks and mitigations

- **False positives in anomaly detection**: Start with conservative thresholds; allow per-tenant overrides; maintain feedback loop to tune baselines.
- **Performance overhead**: Use async/batch logging with backpressure; cache PDP decisions; HMAC using hardware acceleration where available.
- **Data residency/GDPR conflicts**: Partition logs by region; apply data-subject erasure via keyed delete of personal fields while retaining hash envelope; ensure DPA (Data Processing Agreement) coverage with vendors.
- **Operational disruption**: Deploy stamping and audit hooks behind feature flags; enable shadow mode logging before enforcement; provide rollback playbooks.
- **Security review dependencies**: Pre-submit threat model and data-flow diagrams; schedule review mid-sprint; block GA until approval.

## 5. Testing and validation

- **Unit**: Stamp generation, HMAC validation, policy evaluation outcomes, and schema validation for SDUI/financial payloads.
- **Integration**: End-to-end export flows verifying stamps on JSON/CSV/PDF; audit ingestion with cross-stage trace reconstruction; negative tests for missing/invalid stamps returning `422`.
- **Load**: Backpressure and throughput tests for audit logging and stamping under peak load; ensure <5% latency overhead.
- **Security/Compliance**: SOX control mapping (existence, completeness, approval), GDPR data minimization checks, and tamper-evidence validation.
- **User acceptance**: UI badge rendering, export gating on `approved`, and alert runbook execution dry-runs.

## 6. Integration plan

- **Touchpoints**: SDUI front-end logger, backend API middleware, financial model runners, export services, and data pipelines.
- **Migration**: Backfill stamps for recent exports using historical lineage; mark legacy artifacts as `stamp_version=legacy` and restrict egress.
- **Feature flags**: `compliance.stamps.v1` for stamping enforcement; `audit.enhanced.v1` for new audit ingestion/detection. Rollout per tenant.
- **Interoperability**: Ensure `trace_id`/`request_id` propagation through message buses and background workers; include stamp hash in audit events.
- **Documentation and training**: Add runbooks, developer guides for stamp APIs, and dashboards for compliance leads; include in onboarding.

---

## Compliance checklists

*Source: `compliance/compliance-checklists.md`*

## SOC 2/GDPR control mapping

- **Auditability (CC7.x / Art.30)**: Immutable audit logs in `public.audit_logs` and `public.security_audit_log` track actor, action, and IP/user agent metadata; new request-level audit middleware ensures every API call is captured with a request ID.【F:supabase/migrations/20250101000000_baseline_schema.sql†L258-L293】【F:src/middleware/requestAuditMiddleware.ts†L11-L63】
- **Data minimization & retention (Art.5.1e)**: Audit rotation function plus daily CronJob moves aging audit entries into an archive table and prunes primaries after 180 days; S3 lifecycle for backups enforces 90-day storage windows.【F:supabase/migrations/20250601110000_audit_request_retention.sql†L6-L83】【F:infra/infra/k8s/security-audit-retention-cronjob.yaml†L1-L22】【F:scripts/backup-database.sh†L11-L154】
- **Data subject rights (Art.15-17)**: DSR utility locates, exports, or anonymizes user data across key tables and logs each action for traceability.【F:scripts/data-subject-request.js†L9-L111】
- **Security monitoring (CC7.2)**: Security audit log captures event type/severity and is fed by request middleware plus existing audit hooks for agents and authorization changes.【F:supabase/migrations/20250101000000_baseline_schema.sql†L272-L293】【F:src/backend/server.ts†L8-L31】

## Operational checklist

- [ ] Run `scripts/backup-database.sh` daily via cron or CI with S3 credentials; alert on failures and record upload/checksum metrics.
- [ ] Ensure `infra/infra/k8s/security-audit-retention-cronjob.yaml` is applied with the `valuecanvas-database` secret and `audit-ops` service account bound; verify 180-day primary/archived lifecycles are enforced.
- [ ] Perform quarterly restore dry-runs using `scripts/restore-database.sh` in staging and record RPO/RTO results and any manual steps in the incident log.
- [ ] Validate DSR automation monthly using a test account; export and anonymize flows should both write audit entries and the audit log should be reviewed for the expected request ID.
- [ ] Run `scripts/backup-database.sh` daily via cron or CI with S3 credentials and confirm successful uploads.
- [ ] Ensure `infra/infra/k8s/security-audit-retention-cronjob.yaml` is applied with the `valuecanvas-database` secret and `audit-ops` service account bound.
- [ ] Monitor the `security-audit-retention` CronJob for a recent `lastSuccessfulTime`, alert on `suspend: true`, and verify the `audit_request_events_archive` table keeps appending rows without unexpected deletes.
- [ ] Perform quarterly restore dry-runs using `scripts/restore-database.sh` in staging and record RPO/RTO results in the incident log.
- [ ] Validate DSR automation monthly using a test account; export and anonymize flows should both write audit entries.
- [ ] Keep onboarding training updated with locations of PII-bearing tables and the audit/retention flows documented in `docs/data-protection-overview.md`.

---

## ValueCanvas Compliance & Security Audit

*Source: `compliance/COMPLIANCE_AUDIT.md`*

**Audit Date:** December 5, 2025
**Auditor:** ValueCanvas Security Team
**Scope:** Platform security, data privacy, compliance readiness

---

## Executive Summary

ValueCanvas has been audited for security best practices, data privacy compliance (GDPR, CCPA), and system integrity. This report documents findings, remediations, and ongoing compliance requirements.

**Overall Status:** ✅ **COMPLIANT** (with recommended improvements)

---

## Security Audit

### Authentication & Authorization

| Control                               | Status       | Evidence                           |
| ------------------------------------- | ------------ | ---------------------------------- |
| Multi-factor authentication supported | ✅ Pass      | Supabase Auth MFA enabled          |
| Password complexity requirements      | ✅ Pass      | Min 8 chars, enforced by Supabase  |
| Session timeout configured            | ✅ Pass      | 1 hour idle timeout                |
| Row-level security (RLS) enabled      | ✅ Pass      | All tables have RLS policies       |
| API key rotation process              | ⚠️ Recommend | Manual process, automate quarterly |

**Recommendations:**

- Implement automated API key rotation (90-day cycle)
- Add session activity monitoring

---

### Data Protection

| Control                          | Status  | Evidence                                    |
| -------------------------------- | ------- | ------------------------------------------- |
| Data encryption at rest          | ✅ Pass | Supabase encrypts all data (AES-256)        |
| Data encryption in transit       | ✅ Pass | HTTPS/TLS 1.3 enforced                      |
| Database backups enabled         | ✅ Pass | Daily automated backups, 7-day retention    |
| Sensitive data redaction in logs | ✅ Pass | Logger configured to redact PII             |
| Secrets management               | ✅ Pass | Environment variables, not committed to Git |

**Recommendations:**

- Extend backup retention to 30 days
- Implement field-level encryption for highly sensitive data

---

### Input Validation & Sanitization

| Control                   | Status  | Evidence                                   |
| ------------------------- | ------- | ------------------------------------------ |
| SDUI payload sanitization | ✅ Pass | `SDUISanitizer` with DOMPurify             |
| SQL injection prevention  | ✅ Pass | Supabase client uses parameterized queries |
| XSS prevention            | ✅ Pass | React auto-escaping + CSP headers          |
| CSRF protection           | ✅ Pass | Supabase auth tokens                       |
| Prompt injection defense  | ✅ Pass | LLM prompt templating                      |

**Findings:**

- SDUI sanitizer successfully blocks `<script>` tags
- CSP headers configured appropriately
- No vulnerabilities found in penetration testing

---

### API Security

| Control                        | Status     | Evidence                                      |
| ------------------------------ | ---------- | --------------------------------------------- |
| Rate limiting implemented      | ⚠️ Partial | Supabase rate limits, but no app-level limits |
| API authentication required    | ✅ Pass    | All endpoints require JWT                     |
| CORS policy configured         | ✅ Pass    | Production domain whitelisted only            |
| Error messages don't leak info | ✅ Pass    | Generic errors returned to client             |

**Recommendations:**

- Implement application-level rate limiting (100 req/min per user)
- Add API request logging for audit trail

---

### Infrastructure & Cloud Security

**Score:** 3 (Established)

**Strengths**

- CI pipeline includes deterministic CycloneDX SBOM generation with structural validation, container builds, and vulnerability scanning before deployment.
- Dedicated security scan workflow covers dependency audits, CodeQL, Trivy filesystem/image scans, Semgrep, secret scanning, and IaC checks (Checkov).
- Secret handling guidance discourages committing secrets and recommends secret managers for production deployments.

**Gaps**

- No explicit documentation of network isolation, container hardening baselines, or secrets rotation within infrastructure docs in the reviewed sources.
- Compliance audit calls out manual API key rotation, indicating incomplete operational hardening for credentials.

**Recommendations (to move to 4)**

- Add a documented cloud security baseline (network segmentation, container runtime hardening, CIS benchmarks) and operationalize verification.
- Automate API key rotation and secret lifecycle management with an auditable schedule (e.g., 90-day rotation).

---

## Privacy Compliance

### GDPR Compliance

| Requirement                         | Status       | Implementation                             |
| ----------------------------------- | ------------ | ------------------------------------------ |
| **Right to Access**                 | ✅ Compliant | Data export API available                  |
| **Right to Rectification**          | ✅ Compliant | Users can edit all personal data           |
| **Right to Erasure**                | ✅ Compliant | Account deletion API implemented           |
| **Right to Portability**            | ✅ Compliant | JSON export of all user data               |
| **Data Processing Agreement (DPA)** | ✅ Compliant | DPA with Supabase & Together.ai            |
| **Consent Management**              | ✅ Compliant | Cookie consent banner, opt-in analytics    |
| **Data Breach Notification**        | ✅ Compliant | Incident response plan documented          |
| **Privacy by Design**               | ✅ Compliant | Minimal data collection, encrypted storage |

**Data Processing Locations:**

- Primary: US (Supabase US East)
- LLM Processing: US (Together.ai)
- Analytics: EU (Posthog EU Cloud)

**Data Retention:**

- User data: Retained until account deletion
- Logs: 90 days
- Backups: 30 days
- Analytics: 12 months (anonymized after 6 months)

---

### CCPA Compliance

| Requirement                      | Status       | Implementation                            |
| -------------------------------- | ------------ | ----------------------------------------- |
| **Right to Know**                | ✅ Compliant | Privacy policy details all data collected |
| **Right to Delete**              | ✅ Compliant | Account deletion workflow                 |
| **Right to Opt-Out of Sale**     | ✅ Compliant | We do not sell user data                  |
| **Do Not Track honored**         | ✅ Compliant | Analytics respects DNT header             |
| **Privacy notice at collection** | ✅ Compliant | Displayed during signup                   |

---

## Audit Logging

| Event Type            | Logged | Retention |
| --------------------- | ------ | --------- |
| User authentication   | ✅ Yes | 90 days   |
| Agent task execution  | ✅ Yes | 90 days   |
| Data access           | ✅ Yes | 90 days   |
| Configuration changes | ✅ Yes | 1 year    |
| Security events       | ✅ Yes | 1 year    |
| SDUI generation       | ✅ Yes | 30 days   |

**Audit Log Sample:**

```json
{
  "event_type": "agent_task_executed",
  "user_id": "user-123",
  "agent_id": "opportunity-v1",
  "timestamp": "2025-12-05T04:41:00Z",
  "metadata": {
    "task_id": "task-456",
    "duration_ms": 3420,
    "success": true
  }
}
```

---

## Vulnerability Management

### Dependency Scanning

```bash
# Snyk scan results (last run: 2025-12-05)
npm run security-scan

# Results:
✓ No high or critical vulnerabilities
⚠ 2 medium severity (non-blocking)
ℹ 5 low severity (informational)
```

**Medium Vulnerabilities:**

1. `axios` - Potential ReDoS (v0.21.1) → **Mitigated:** Not using affected feature
2. `lodash` - Prototype pollution (v4.17.15) → **Remediated:** Upgraded to 4.17.21

---

### Penetration Testing

**Last Test:** November 2025
**Tester:** Third-party security firm
**Scope:** Web application, API endpoints, authentication

**Findings:**

- ✅ No critical vulnerabilities
- ✅ No high vulnerabilities
- ⚠️ 1 medium: Missing security headers on older pages → **Fixed**
- ℹ️ 3 low: Informational findings

**Next Test:** Scheduled for February 2026 (quarterly)

---

## Incident Response

### Incident Classification

| Severity          | Definition                             | Response Time |
| ----------------- | -------------------------------------- | ------------- |
| **P0 - Critical** | Data breach, complete outage           | < 15 min      |
| **P1 - High**     | Partial outage, security vulnerability | < 1 hour      |
| **P2 - Medium**   | Performance degradation, minor bug     | < 4 hours     |
| **P3 - Low**      | Cosmetic issue, feature request        | < 24 hours    |

### Incident Response Plan

1. **Detection** → Automated alerts (Sentry, Uptime)
2. **Triage** → On-call engineer assesses severity
3. **Containment** → Isolate affected systems
4. **Investigation** → Root cause analysis
5. **Remediation** → Deploy fix
6. **Communication** → Notify affected users (if P0/P1)
7. **Post-Mortem** → Document learnings, update runbook

**Data Breach Notification:**

- GDPR: Within 72 hours of discovery
- CCPA: Without unreasonable delay
- Users: Email notification + in-app alert

---

## Third-Party Risk Assessment

| Vendor      | Service        | Data Shared               | Compliance  | Risk Level |
| ----------- | -------------- | ------------------------- | ----------- | ---------- |
| Supabase    | Database, Auth | All user data             | SOC 2, GDPR | Low        |
| Together.ai | LLM inference  | Prompts (no PII)          | SOC 2       | Low        |
| Vercel      | Hosting        | None (static assets)      | SOC 2, GDPR | Low        |
| Sentry      | Error tracking | Error logs (PII redacted) | GDPR        | Low        |
| Posthog     | Analytics      | Usage events (anonymized) | GDPR        | Low        |

**Vendor Review:** Annual security questionnaire + DPA renewal

---

## Compliance Checklist

### Pre-Launch

- [x] Security review completed
- [x] Penetration testing passed
- [x] Privacy policy published
- [x] Terms of service published
- [x] Cookie consent implemented
- [x] Data processing agreements signed
- [x] Incident response plan documented
- [x] Backup and recovery tested
- [x] Monitoring and alerting configured

### Ongoing

- [ ] Quarterly security reviews
- [ ] Annual penetration testing
- [ ] Monthly dependency scanning
- [ ] Quarterly access reviews
- [ ] Bi-annual disaster recovery drills
- [ ] Annual vendor reassessments

---

## Recommendations for Continuous Improvement

### High Priority

1. **Implement automated API key rotation** (90-day cycle)
2. **Add application-level rate limiting** (per-user and per-IP)
3. **Extend backup retention** to 30 days
4. **Implement session activity monitoring** for anomaly detection

### Medium Priority

5. **Add field-level encryption** for sensitive user data
6. **Implement API request audit logging**
7. **Add automated security header validation** in CI/CD
8. **Create incident response simulation** (tabletop exercises)

### Low Priority

9. **Expand bug bounty scope coverage to additional integrations**
10. **Add automated compliance monitoring dashboard**
11. **Implement data lineage tracking**
12. **Add security awareness training** for team

---


### Vulnerability Disclosure Program Status

- Bug bounty and CVD are implemented with documented intake, SLA, severity taxonomy, and governance requirements.
- See [Bug Bounty and Coordinated Vulnerability Disclosure (CVD) Program](./bug-bounty-cvd-program.md) for active process details.

---

## Certification Readiness

| Certification    | Status         | Timeline                    |
| ---------------- | -------------- | --------------------------- |
| **SOC 2 Type I** | Ready          | Q1 2026                     |
| **ISO 27001**    | Preparation    | Q3 2026                     |
| **HIPAA**        | Conditional    | Required for PHI in-scope tenants |
| **PCI DSS**      | Not applicable | N/A (no payment processing) |

---

## Audit Trail

| Date       | Auditor         | Scope               | Result    |
| ---------- | --------------- | ------------------- | --------- |
| 2025-12-05 | Security Team   | Full platform audit | Compliant |
| 2025-11-15 | External Firm   | Penetration testing | Pass      |
| 2025-10-01 | Compliance Team | GDPR readiness      | Compliant |

---

## Sign-Off

**Audited by:** ValueCanvas Security Team
**Approved by:** CTO, ValueCanvas
**Date:** December 5, 2025

**Next Audit:** March 5, 2026 (quarterly review)

---

## Appendices

- [A] Penetration Test Report (Confidential)
- [B] Data Processing Agreements
- [C] Incident Response Runbook
- [D] Vendor Security Questionnaires
- [E] Backup & Recovery Test Results

---
