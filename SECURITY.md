# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability, please report it responsibly:

- **Email:** security@valueos.example
- **What to include:** impact, affected components, reproduction steps, and any proof-of-concept.
- **Response time:** We aim to acknowledge reports within 3 business days.

Do **not** open public GitHub issues for security vulnerabilities.

## Dependency policy

- Dependencies are updated via Dependabot and/or Renovate.
- Lockfile integrity is enforced via CI (`pnpm run lint:lockfile`).
- High severity vulnerabilities must be addressed before release.

## Supported versions

We currently support the latest `main` branch and the most recent tagged release.

# Zero-Trust Billing & Service Security (2026-02-08)

## Summary of Changes

- All billing and service scripts using `service_role` now route privileged actions through `SecurityEnforcementService` for audit logging.
- Every privileged DB write (insert/update/delete) is logged with action type, resource, tenant, and user context.
- Cross-tenant or ambiguous-tenant operations are denied or alerted.
- Tests added to assert audit logging for privileged actions.

## How to Test

- Run `pnpm run check:rls-enforcement` to validate RLS and NULL org/tenant enforcement.
- Run `pnpm run test:rls` to validate RLS policies.
- Run `pnpm test` to ensure all billing/service security tests pass.

## Developer Guidance

- Never use `service_role` for cross-tenant or ambiguous-tenant actions.
- All new privileged actions must be wrapped and logged via `SecurityEnforcementService`.
- See `docs/BILLING_SECURITY.md` and `apps/ValyntApp/src/services/SecurityEnforcementService.ts` for usage patterns.

_Last updated: 2026-02-08_
