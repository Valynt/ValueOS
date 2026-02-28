# Implementation Plan: Billing V2

This plan details the implementation of Phase 0-3 of the ValueOS-Native Billing system.

## Phases

### Phase 0: Foundation
- [ ] **0.1 Database Migration** - Create tables: `billing_meters`, `billing_price_versions`, `usage_policies`, `billing_approval_policies`, `billing_approval_requests`, `entitlement_snapshots`.
- [ ] **0.2 Billing Meters Catalog** - Seed `billing_meters` and update `config/billing.ts`.
- [ ] **0.3 Price Version Service** - CRUD for price versions and pinning logic.
- [ ] **0.4 Entitlement Snapshots** - Computation of entitlements from price versions.
- [ ] **0.5 Subscription State Machine** - Transition logic for plan lifecycle.
- [ ] **0.6 Domain Event Types** - Define billing events (`UsageRecorded`, `SubscriptionChanged`, etc.).
- [ ] **0.7 Stripe Customer + Payment Method Setup** - SetupIntent and payment method listing.
- [ ] **0.8 Webhook Ingestion Hardening** - Audit trail for provider events.

### Phase 1: Self-Serve + Enforcement
- [ ] **1.1 Billing API Routes** - REST layer for summaries, plans, and approvals.
- [ ] **1.2 Billing Approval Service** - Approval-gated change workflows.
- [ ] **1.3 EntitlementsService (Hard Lock Enforcement)** - Usage allowance checks.
- [ ] **1.4 Enforcement Middleware** - 402-shaped error payload for AI/API routes.
- [ ] **1.5 Usage Policy Service** - Active policy management.

### Phase 2: Invoice Engine + Collection
- [ ] **2.1 Invoice Math Engine** - Deterministic line item computation with math breakdown.
- [ ] **2.2 Stripe Invoice Mirroring** - Collection and finalization integration.
- [ ] **2.3 Usage Ingestion Hardening** - Evidence chain and hash-verifiable aggregates.

### Phase 3: Enterprise + Reconciliation
- [ ] **3.1 Custom Pricing per Tenant** - Overrides and contract mode.
- [ ] **3.2 Temporary Cap Increase Workflows** - Approval-gated temporary increases.
- [ ] **3.3 Finance Exports** - Reconciliation dashboard endpoints.
