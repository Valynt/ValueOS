# Proposal: Billing V2

## Intent

Implement ValueOS-native billing with versioned pricing, metered usage tracking, entitlement enforcement, enterprise approval workflows, and Stripe payment collection integration.

## Scope

In scope:
- Billing meters catalog (ai_tokens, api_calls)
- Versioned pricing with immutable active versions
- Entitlement snapshots and hard-lock enforcement
- Grace period policies per tenant
- Subscription state machine
- Billing approval workflows for spend-changing actions
- Deterministic invoice math engine
- Stripe invoice mirroring and webhook hardening
- Usage event idempotency and tamper evidence

Out of scope:
- Custom pricing per tenant (Phase 3)
- Temporary cap increase workflows (Phase 3)
- Finance reconciliation exports (Phase 3)

## Approach

ValueOS owns pricing logic, entitlements, and enforcement. Stripe owns payment methods, charge outcomes, and tax. Three implementation phases: Foundation (meters, pricing, entitlements, state machine), Self-Serve + Enforcement (APIs, approval workflows, cap enforcement), Invoice Engine (deterministic math, Stripe mirroring).
