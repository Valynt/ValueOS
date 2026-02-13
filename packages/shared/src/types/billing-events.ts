/**
 * Billing Domain Events
 *
 * Typed event contracts for billing, metering, and subscription lifecycle.
 * Follows the same discriminated union pattern as other domain events.
 */

// ============================================================================
// Meter keys
// ============================================================================

export type MeterKey = 'ai_tokens' | 'api_calls' | 'llm_tokens' | 'agent_executions' | 'storage_gb' | 'user_seats';

// ============================================================================
// Subscription status
// ============================================================================

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled';

// ============================================================================
// Enforcement mode
// ============================================================================

export type EnforcementMode = 'hard_lock' | 'bill_overage' | 'grace_then_lock';

// ============================================================================
// Approval status
// ============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'canceled';

export type ApprovalActionType =
  | 'plan_change'
  | 'seat_change'
  | 'enable_overage'
  | 'increase_cap'
  | 'billing_cycle_change'
  | 'cancel';

// ============================================================================
// Price version status
// ============================================================================

export type PriceVersionStatus = 'draft' | 'active' | 'archived';

// ============================================================================
// Billing events
// ============================================================================

export type BillingEvent =
  | {
      type: 'billing.usage.recorded';
      payload: {
        tenantId: string;
        occurredAt: string;
        meterKey: MeterKey;
        quantity: number;
        idempotencyKey: string;
        dimensions?: Record<string, string>;
        sourceRef?: string;
      };
    }
  | {
      type: 'billing.subscription.changed';
      payload: {
        tenantId: string;
        before: { status: SubscriptionStatus; priceVersionId: string; planTier: string };
        after: { status: SubscriptionStatus; priceVersionId: string; planTier: string };
        effectiveAt: string;
        actorUserId?: string;
        reason: string;
      };
    }
  | {
      type: 'billing.invoice.drafted';
      payload: {
        tenantId: string;
        invoiceId: string;
        periodStart: string;
        periodEnd: string;
        pricingVersionId: string;
        totals: { subtotal: number; tax: number; total: number };
        lineItemRefs: string[];
      };
    }
  | {
      type: 'billing.invoice.finalized';
      payload: {
        tenantId: string;
        invoiceId: string;
        periodStart: string;
        periodEnd: string;
        pricingVersionId: string;
        totals: { subtotal: number; tax: number; total: number };
        lineItemRefs: string[];
      };
    }
  | {
      type: 'billing.payment.status_updated';
      payload: {
        tenantId: string;
        externalInvoiceId?: string;
        externalPaymentIntentId?: string;
        status: string;
        occurredAt: string;
        idempotencyKey: string;
      };
    }
  | {
      type: 'billing.approval.requested';
      payload: {
        tenantId: string;
        approvalId: string;
        actionType: ApprovalActionType;
        requestedBy: string;
        payload: Record<string, unknown>;
      };
    }
  | {
      type: 'billing.approval.decided';
      payload: {
        tenantId: string;
        approvalId: string;
        status: ApprovalStatus;
        decidedBy?: string;
        reason?: string;
      };
    }
  | {
      type: 'billing.entitlement.snapshot_created';
      payload: {
        tenantId: string;
        snapshotId: string;
        subscriptionId: string;
        priceVersionId: string;
        effectiveAt: string;
      };
    }
  | {
      type: 'billing.usage.cap_reached';
      payload: {
        tenantId: string;
        meterKey: MeterKey;
        cap: number;
        used: number;
        resetAt: string;
      };
    };

// ============================================================================
// Type helpers
// ============================================================================

export type BillingEventType = BillingEvent['type'];

export type BillingEventPayload<T extends BillingEventType> =
  Extract<BillingEvent, { type: T }>['payload'];
