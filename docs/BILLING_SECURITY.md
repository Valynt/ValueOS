# Billing & High-Trust Service Security (2026-02-08)

## Zero-Trust Enforcement for Billing & Service Scripts

### 1. All billing and service scripts that use `service_role` are now required to:
- Route all high-trust (service_role) database actions through `SecurityEnforcementService` for audit logging.
- Log every privileged action (insert/update/delete) with action type, resource, tenant, and user context.
- Deny or alert on any cross-tenant or ambiguous-tenant operation.

### 2. Implementation Details
- Billing services (CustomerService, InvoiceService, SubscriptionService, UsageMeteringService, WebhookRetryService) now:
  - Use `SecurityEnforcementService.logSecurityAction()` for every privileged DB write.
  - Include tenant_id and user context in all audit logs.
  - Are reviewed for direct `service_role` usage; all such usage is now auditable.

### 3. Testing
- All billing service tests must mock and assert calls to `SecurityEnforcementService.logSecurityAction`.
- RLS and audit enforcement is validated by running:
  - `pnpm run check:rls-enforcement`
  - `pnpm run test:rls`
- Any test or code that bypasses audit logging is a CI failure.

### 4. Developer Guidance
- Never use `service_role` for cross-tenant or ambiguous-tenant actions.
- All new privileged actions must be wrapped and logged via `SecurityEnforcementService`.
- See `apps/ValyntApp/src/services/SecurityEnforcementService.ts` for usage patterns.

---

_Last updated: 2026-02-08_
