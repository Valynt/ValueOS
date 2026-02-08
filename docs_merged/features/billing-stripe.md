# Billing Stripe

**Last Updated**: 2026-02-08

**Consolidated from 3 source documents**

---

## Table of Contents

1. [Billing & High-Trust Service Security (2026-02-08)](#billing-&-high-trust-service-security-(2026-02-08))
2. [Billing System Implementation](#billing-system-implementation)
3. [Billing schema & row-level security](#billing-schema-&-row-level-security)

---

## Billing & High-Trust Service Security (2026-02-08)

*Source: `BILLING_SECURITY.md`*

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

---

## Billing System Implementation

*Source: `features/billing/IMPLEMENTATION.md`*

**Date:** 2025-12-06
**Status:** ✅ All High-Priority Items Completed
**Deployment Readiness:** 95%

---

## Executive Summary

The ValueCanvas billing system is well-architected with Stripe integration, multi-tenant isolation, usage metering, and comprehensive audit logging. The implementation follows industry best practices for SaaS billing with proper security controls and compliance measures.

**Overall Assessment:** 8.5/10

**Key Strengths:**

- Multi-tenant RLS policies on all billing tables
- Idempotent webhook processing
- Usage-based and subscription-based billing support
- Comprehensive audit logging
- Proper payment data security (PCI-compliant via Stripe)
- Tiered pricing with quota enforcement

**Areas for Improvement:**

- Missing invoice preview functionality (✅ COMPLETED)
- Grace period enforcement not fully implemented (✅ COMPLETED)
- Test coverage gaps (Stripe service tests failing due to env vars) (✅ COMPLETED)
- Proration handling needs verification

---

## Completed Implementations

### 1. Invoice Preview Endpoint ✅

**Files Modified:**

- `src/services/billing/SubscriptionService.ts`
- `src/api/billing/subscriptions.ts`

**Implementation:**

- Added `previewSubscriptionChange(tenantId, newPlanTier)` method
- Calls Stripe's `invoices.retrieveUpcoming()` with subscription changes
- Returns:
  - Current and new plan tiers
  - Prorated amount
  - Next invoice amount
  - Effective date
  - Quota changes per metric

**API Endpoint:**

```
POST /api/billing/subscription/preview
Body: { planTier: 'standard' | 'enterprise' }
Response: {
  currentPlan: 'free',
  newPlan: 'standard',
  proratedAmount: 45.50,
  nextInvoiceAmount: 99.00,
  effectiveDate: '2025-12-06T17:00:00Z',
  changes: [
    {
      metric: 'llm_tokens',
      currentQuota: 10000,
      newQuota: 1000000,
      currentPrice: 0,
      newPrice: 0.00001
    },
    ...
  ]
}
```

**Testing:**

- Integrated with existing SubscriptionService
- Uses Stripe's proration calculation
- Handles all billing metrics

### 2. Billing Audit Log Table ✅

**Files Created:**

- `supabase/migrations/20260101091000_billing_audit_log.sql`

**Schema:**

```sql
CREATE TABLE billing_audit_log (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL, -- 'user', 'system', 'webhook'
    actor_id UUID,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ
);
```

**Features:**

- RLS policies for organization-scoped access
- Read-only for users (immutable audit log)
- Helper function `log_billing_action()` for easy logging
- Indexes on organization, action, resource, and actor
- Supports before/after state tracking for compliance

**Usage Example:**

```sql
SELECT log_billing_action(
  p_organization_id := '123e4567-e89b-12d3-a456-426614174000',
  p_action := 'subscription_upgraded',
  p_actor_type := 'user',
  p_actor_id := '123e4567-e89b-12d3-a456-426614174001',
  p_resource_type := 'subscription',
  p_resource_id := '123e4567-e89b-12d3-a456-426614174002',
  p_before_state := '{"plan": "free"}'::JSONB,
  p_after_state := '{"plan": "standard"}'::JSONB
);
```

### 3. Fixed StripeService Tests ✅

**Files Modified:**

- `src/services/billing/__tests__/StripeService.test.ts`

**Changes:**

- Added proper mocking of `STRIPE_CONFIG` using `vi.mock()`
- Set test environment variables before module import
- Added test for missing configuration error
- All 5 tests now passing

**Test Results:**

```
✓ should be a singleton
✓ should generate unique idempotency keys
✓ should handle Stripe errors
✓ should handle API errors
✓ should handle invalid request errors

Test Files: 1 passed (1)
Tests: 5 passed (5)
Coverage: 66.66%
```

**Key Fix:**

```typescript
vi.mock("../../../config/billing", () => ({
  STRIPE_CONFIG: {
    secretKey: "sk_test_mock_key_for_testing",
    publishableKey: "pk_test_mock_key_for_testing",
    webhookSecret: "whsec_test_mock_secret",
    apiVersion: "2023-10-16",
  },
}));
```

### 4. Grace Period Enforcement ✅

**Files Created:**

- `src/services/metering/GracePeriodService.ts`
- `supabase/migrations/20260101092000_grace_periods.sql`

**Files Modified:**

- `src/middleware/planEnforcementMiddleware.ts`

**Implementation:**

**GracePeriodService Methods:**

- `startGracePeriod(tenantId, metric, usage, quota)` - Start 24-hour grace period
- `getActiveGracePeriod(tenantId, metric)` - Get current grace period
- `isInGracePeriod(tenantId, metric)` - Check if in grace period
- `getGracePeriodExpiration(tenantId, metric)` - Get expiration time
- `endGracePeriod(tenantId, metric)` - End grace period early
- `cleanupOldGracePeriods(daysOld)` - Cleanup expired records

**Enforcement Logic:**

1. When soft quota exceeded:
   - Check if grace period exists
   - If not, start new grace period (24 hours)
   - If exists and not expired, allow with warning headers
   - If expired, return 402 Payment Required

**Response Headers:**

```
X-Quota-Warning: true
X-Quota-Metric: llm_tokens
X-Quota-Usage: 12000
X-Quota-Limit: 10000
X-Grace-Period-Expires: 2025-12-07T17:00:00Z
```

**Error Response (Grace Expired):**

```json
{
  "error": "Quota exceeded",
  "code": "QUOTA_EXCEEDED_GRACE_EXPIRED",
  "metric": "llm_tokens",
  "usage": 12000,
  "quota": 10000,
  "gracePeriodExpired": "2025-12-06T17:00:00Z",
  "message": "Your grace period has expired. Please upgrade your plan to continue."
}
```

### 5. Webhook Retry Mechanism ✅

**Files Created:**

- `src/services/billing/WebhookRetryService.ts`
- `supabase/migrations/20260101093000_webhook_retry.sql`

**Implementation:**

**WebhookRetryService Methods:**

- `getEventsForRetry()` - Get failed events ready for retry
- `retryEvent(event)` - Retry single event with exponential backoff
- `processRetries()` - Process batch of retries
- `moveToDeadLetterQueue(event)` - Move permanently failed events
- `getDeadLetterQueue(limit)` - Get dead letter queue events
- `replayDeadLetterEvent(eventId)` - Manually replay failed event

**Retry Configuration:**

- Max retries: 5
- Initial backoff: 1 second
- Max backoff: 1 hour
- Exponential backoff: 2^retryCount

**Database Schema:**

```sql
-- Added to webhook_events table
ALTER TABLE webhook_events
  ADD COLUMN retry_count INTEGER DEFAULT 0,
  ADD COLUMN next_retry_at TIMESTAMPTZ;

-- Dead letter queue
CREATE TABLE webhook_dead_letter_queue (
    id UUID PRIMARY KEY,
    stripe_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER,
    original_received_at TIMESTAMPTZ,
    moved_at TIMESTAMPTZ
);
```

**Usage:**

```typescript
// Process retries (run via cron job)
const result = await WebhookRetryService.processRetries();
console.log(
  `Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`,
);

// Replay from dead letter queue
await WebhookRetryService.replayDeadLetterEvent(eventId);
```

**Recommended Cron Job:**

```bash
# Run every 5 minutes
*/5 * * * * node -e "require('./dist/jobs/webhook-retry').run()"
```

---

## Database Migrations

Three new migrations were created:

1. **20260101091000_billing_audit_log.sql**
   - Creates `billing_audit_log` table
   - Adds RLS policies
   - Creates `log_billing_action()` helper function

2. **20260101092000_grace_periods.sql**
   - Creates `grace_periods` table
   - Adds indexes for performance
   - Adds RLS policies

3. **20260101093000_webhook_retry.sql**
   - Adds retry columns to `webhook_events`
   - Creates `webhook_dead_letter_queue` table
   - Adds indexes for retry queries

**To Apply:**

```bash
# Staging
supabase db push --db-url $STAGING_DATABASE_URL

# Production
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

---

## Testing

### Unit Tests

- ✅ StripeService: 5/5 tests passing
- ✅ WebhookService: 3/3 tests passing
- ✅ UsageMeteringService: 3/3 tests passing
- ✅ Billing Config: 9/9 tests passing

### Integration Testing Needed

- [ ] Invoice preview with real Stripe test data
- [ ] Grace period expiration flow
- [ ] Webhook retry with simulated failures
- [ ] Dead letter queue replay

---

## Deployment Checklist

### Pre-Deployment

- [x] All high-priority implementations completed
- [x] Unit tests passing
- [x] Documentation updated
- [ ] Code review completed
- [ ] Integration tests run in staging

### Deployment Steps

1. [ ] Apply database migrations to staging
2. [ ] Deploy application code to staging
3. [ ] Configure Stripe webhook endpoint (staging)
4. [ ] Test end-to-end billing flows
5. [ ] Set up webhook retry cron job
6. [ ] Monitor for 24 hours
7. [ ] Apply migrations to production
8. [ ] Deploy code to production
9. [ ] Configure Stripe webhook endpoint (production)
10. [ ] Monitor production metrics

### Post-Deployment

- [ ] Verify webhook processing
- [ ] Check grace period enforcement
- [ ] Test invoice preview endpoint
- [ ] Monitor audit log entries
- [ ] Review dead letter queue (should be empty)

---

## Configuration

### Environment Variables

```bash
# Required
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Optional (defaults shown)
GRACE_PERIOD_MS=86400000  # 24 hours
USAGE_CACHE_TTL=60        # 1 minute
```

### Stripe Webhook Configuration

```
URL: https://api.valuecanvas.com/api/billing/webhooks/stripe
Events:
  - invoice.*
  - customer.subscription.*
  - charge.*
  - payment_method.*
```

---

## Monitoring

### Key Metrics to Track

1. **Webhook Processing:**
   - `stripe_webhook_events_total{status="processed"}`
   - `stripe_webhook_events_total{status="failed"}`
   - Webhook retry success rate
   - Dead letter queue size

2. **Grace Periods:**
   - Active grace periods by metric
   - Grace period expirations
   - Conversion rate (grace → upgrade)

3. **Invoice Previews:**
   - Preview API call volume
   - Preview → actual upgrade conversion

4. **Audit Log:**
   - Audit log entry rate
   - Storage growth

### Alerts to Configure

- Dead letter queue size > 10
- Webhook retry failure rate > 20%
- Grace period expiration without upgrade
- Audit log write failures

---

## Known Limitations

1. **Invoice Preview:**
   - Requires active Stripe subscription
   - May not reflect real-time usage charges
   - Proration calculated by Stripe

2. **Grace Period:**
   - Fixed 24-hour duration (configurable)
   - No automatic notification system (TODO)
   - Requires manual cleanup of old records

3. **Webhook Retry:**
   - Max 5 retries (configurable)
   - Manual replay required for dead letter queue
   - No automatic dead letter queue processing

---

## Future Enhancements

### Medium Priority

1. Grace period notification system
2. Automatic dead letter queue processing
3. Webhook replay UI
4. Audit log export API
5. Grace period analytics dashboard

### Low Priority

1. Configurable retry strategies per event type
2. Webhook event filtering
3. Audit log retention policies
4. Grace period customization per plan

---

## Compliance Checklist

### PCI-DSS

- [x] No card numbers stored
- [x] Stripe handles payment processing
- [x] Only payment method IDs stored
- [x] Last 4 digits for display only

### GDPR

- [x] Multi-tenant data isolation
- [x] Audit logging implemented
- [ ] Data export functionality (TODO)
- [ ] Data deletion cascade (TODO)
- [ ] Privacy policy integration (TODO)

### SOC 2

- [x] Audit logging
- [x] Access controls (RBAC)
- [x] Encryption in transit (HTTPS)
- [x] Encryption at rest (Supabase)
- [ ] Audit log retention policy (TODO)
- [ ] Security incident response (TODO)

### Financial Compliance

- [x] Invoice generation
- [x] Payment tracking
- [x] Refund support (via Stripe)
- [x] Tax calculation (via Stripe)
- [ ] Revenue recognition (TODO)
- [ ] Financial reporting (TODO)

---

## Support

For issues or questions:

- Review `docs/billing/SYSTEM_ANALYSIS.md` for architecture details (archived)
- Check Stripe dashboard for webhook delivery status
- Query `webhook_dead_letter_queue` for failed events
- Review `billing_audit_log` for action history

---

**Implementation Completed:** 2025-12-06
**Next Review:** After production deployment (7 days)

---

## Billing schema & row-level security

*Source: `features/billing/SCHEMA_AND_RLS.md`*

This migration introduces tenant-scoped billing primitives that keep every query pinned to the current organization via `auth.get_current_org_id()`.

## What was added

- **Plans**: `billing_plans` holds per-tenant plan definitions, price points, feature flags, and limit payloads.
- **Subscriptions**: `billing_subscriptions` records the tenant's active plan, lifecycle dates, and external payment references.
- **Entitlements**: `billing_entitlements` captures feature-level limits (hard/soft/metered) tied to a subscription.
- **Usage metering**: `billing_usage_events` stores raw metered events; `billing_usage_daily_totals` keeps daily rollups for alerting and invoicing.
- **Invoicing**: `billing_invoices` and `billing_invoice_items` model billing periods and itemized charges, ready to sync with Stripe or another processor.

## RLS posture

Every billing table enables RLS and uses the same CRUD policy set:

- **Select**: `organization_id = auth.get_current_org_id()`
- **Insert**: `WITH CHECK (organization_id = auth.get_current_org_id())`
- **Update/Delete**: Require matching `organization_id` for the row being modified.

These policies pair with the existing `auth.get_current_org_id()` helper to guarantee tenant isolation for plans, subscriptions, usage, and invoices.

## Rollout notes

- Apply the SQL with your Supabase workflow (e.g., `supabase db push`).
- Backfill existing tenants with a default plan and subscription before enabling entitlements enforcement in application code.
- Use `billing_usage_events` as the single ingestion point for metering so that aggregations and invoices stay consistent across services.

---