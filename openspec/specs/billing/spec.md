# Billing Specification

## Purpose

Usage-based billing with versioned pricing, entitlement enforcement, metered usage tracking, and enterprise approval workflows. ValueOS owns pricing logic, entitlements, and enforcement; Stripe owns payment collection.

Consolidated from: `conductor/tracks/billing-v2/spec.md`

## Requirements

### Requirement: Metered usage tracking

The system SHALL track usage events for billing meters (ai_tokens, api_calls) with idempotency and tamper evidence.

#### Scenario: Usage event recording

- GIVEN an agent or API call consumes metered resources
- WHEN a usage event is emitted
- THEN the event is recorded with tenant_id, meter_key, quantity, timestamp, and idempotency_key
- AND duplicate events with the same idempotency_key are deduplicated

#### Scenario: Usage aggregation

- GIVEN raw usage events exist for a billing period
- WHEN aggregation runs
- THEN totals are computed per meter per tenant per period
- AND each aggregate includes source_event_count and source_hash for audit

### Requirement: Versioned pricing

The system SHALL support immutable, versioned pricing definitions that can be activated and archived.

#### Scenario: Price version lifecycle

- GIVEN a price version is created in `draft` status
- WHEN it is activated
- THEN it becomes the current active version for its plan tier
- AND the previous active version is archived
- AND active or archived versions cannot be modified

#### Scenario: Subscription pinned to version

- GIVEN a tenant subscribed under price version v1
- WHEN price version v2 is activated for new subscribers
- THEN the existing tenant remains on v1
- AND billing calculations use v1 definitions until the tenant is explicitly migrated

### Requirement: Entitlement enforcement

The system MUST enforce usage caps based on the tenant's current entitlement snapshot.

#### Scenario: Usage within cap

- GIVEN a tenant has used 900 of 1000 allowed ai_tokens
- WHEN a request consuming 50 tokens is made
- THEN the request is allowed

#### Scenario: Usage exceeds hard cap

- GIVEN a tenant has used 1000 of 1000 allowed ai_tokens with hard_lock enforcement
- WHEN a request consuming 1 token is made
- THEN the request is blocked with HTTP 402
- AND the response includes: meter_key, cap, used, requested, reset_at, and upgrade_url

#### Scenario: Grace period enforcement

- GIVEN a tenant has a usage_policy with grace_then_lock and 5% grace
- WHEN usage exceeds the cap but is within the 5% grace threshold
- THEN the request is allowed
- AND the tenant is warned they are in the grace period

#### Scenario: Grace period exceeded

- GIVEN a tenant has exceeded both cap and grace threshold
- WHEN a new request is made
- THEN the request is blocked with HTTP 402

### Requirement: Subscription state machine

The system SHALL enforce valid subscription state transitions.

#### Scenario: Valid transition

- GIVEN a subscription in `active` status
- WHEN a `payment_failed` event is received
- THEN the subscription transitions to `past_due`
- AND a `SubscriptionChanged` domain event is emitted

#### Scenario: Invalid transition

- GIVEN a subscription in `canceled` status (terminal)
- WHEN any transition event is received
- THEN the transition is rejected with a descriptive error

### Requirement: Billing approval workflows

The system SHALL support approval-gated workflows for spend-changing actions in enterprise tenants.

#### Scenario: Action requires approval

- GIVEN a tenant has a billing_approval_policy with delta_mrr_usd threshold of $500
- WHEN a plan change would increase MRR by $600
- THEN the change is not applied immediately
- AND a billing_approval_request is created with status `pending`
- AND a `BillingApprovalRequested` domain event is emitted

#### Scenario: Approval granted

- GIVEN a pending billing_approval_request exists
- WHEN an authorized approver approves it
- THEN the original action is applied
- AND the request status changes to `approved`
- AND a `BillingApprovalDecided` event is emitted

#### Scenario: Approval rejected

- GIVEN a pending billing_approval_request exists
- WHEN an authorized approver rejects it
- THEN the action is not applied
- AND the request status changes to `rejected`

### Requirement: Invoice math determinism

The system MUST compute invoice line items deterministically — same inputs always produce the same output.

#### Scenario: Reproducible invoice

- GIVEN a tenant's usage aggregates and price version for a billing period
- WHEN invoice line items are computed twice with the same inputs
- THEN the outputs are identical (hash-verifiable)
- AND each line item includes: meter_key, included_quantity, used_quantity, billable_quantity, rate, formula_string, and computed_amount

### Requirement: Stripe integration

The system SHALL mirror invoice data to Stripe for payment collection while keeping pricing logic in ValueOS.

#### Scenario: Webhook idempotency

- GIVEN a Stripe webhook event is received
- WHEN the same event ID is received again (replay)
- THEN no duplicate ledger entries are created
- AND a `PaymentStatusUpdated` domain event is emitted only once

### Requirement: Tenant isolation for billing data

The system MUST enforce tenant isolation on all billing tables.

#### Scenario: Billing data scoped to tenant

- GIVEN billing data (subscriptions, usage, invoices, approvals) belongs to tenant A
- WHEN a user from tenant B queries billing data
- THEN no data from tenant A is returned
