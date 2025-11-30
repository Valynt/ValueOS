# ✅ Billing Stack - Phase 1 Complete!

**Date:** 2024-11-29  
**Status:** Foundation Complete - Ready for Phase 2

---

## 🎉 What Was Completed

### 1. **Database Schema** ✅
**File:** `supabase/migrations/20241129000008_billing_infrastructure.sql`

**Tables Created (9 tables):**
- `billing_customers` - Tenant → Stripe customer mapping
- `subscriptions` - Active subscriptions per tenant
- `subscription_items` - Metered line items (5 metrics per subscription)
- `usage_events` - Raw usage events (queue source)
- `usage_aggregates` - Batched usage for Stripe submission
- `invoices` - Invoice storage for history/UI
- `usage_quotas` - Plan limits + current usage (cached)
- `usage_alerts` - Quota warning history (80%/100%/120%)
- `webhook_events` - Stripe webhook processing log

**Functions Created:**
- `get_current_usage(tenant_id, metric, period)` - Calculate current usage
- `is_over_quota(tenant_id, metric)` - Check if over limit
- `get_usage_percentage(tenant_id, metric)` - Get usage %

**RLS Policies:**
- Admins: Full access to all billing data
- Users: View own tenant's billing data only

---

### 2. **Stripe Products Setup Script** ✅
**File:** `infrastructure/billing/stripe-products-setup.sh`

**Creates 5 Products with 3 Price Tiers Each:**

| Product | Free Tier | Standard Tier | Enterprise Tier |
|---------|-----------|---------------|-----------------|
| **LLM Tokens** | 10K included, no overage | $0.01/1K tokens | $0.005/1K tokens |
| **Agent Executions** | 100 included, no overage | $0.10/execution | $0.05/execution |
| **API Calls** | 1K included, no overage | $0.001/call | $0.0005/call |
| **Storage** | 1 GB hard cap | $0.50/GB overage | $0.25/GB overage |
| **User Seats** | 3 hard cap | $5/seat overage | Unlimited |

**Usage:**
```bash
cd infrastructure/billing
./stripe-products-setup.sh
```

**Output:** `stripe-config.json` with all product/price IDs

---

### 3. **Billing Configuration** ✅
**File:** `src/config/billing.ts`

**Plan Definitions:**

#### Free Plan ($0/month)
- 10K LLM tokens (soft cap)
- 100 agent executions (soft cap)
- 1K API calls (soft cap)
- 1 GB storage (hard cap)
- 3 user seats (hard cap)
- No overage allowed - upgrade required

#### Standard Plan ($99/month)
- 1M LLM tokens + $0.01/1K overage
- 5K agent executions + $0.10 overage
- 100K API calls + $0.001 overage
- 100 GB storage + $0.50/GB overage
- 25 user seats + $5/seat overage

#### Enterprise Plan ($499/month)
- 10M LLM tokens + $0.005/1K overage
- 50K agent executions + $0.05 overage
- 1M API calls + $0.0005 overage
- 1 TB storage + $0.25/GB overage
- Unlimited user seats

**Helper Functions:**
```typescript
getPlan(tier: PlanTier): PlanConfig
getQuota(tier: PlanTier, metric: BillingMetric): number
isHardCap(tier: PlanTier, metric: BillingMetric): boolean
calculateOverageCost(tier, metric, usage): number
calculateMonthlyCost(tier, usage): CostBreakdown
```

**Configuration Constants:**
- Usage alert thresholds: 80%, 100%, 120%
- Grace period: 24 hours
- Cache TTL: 60 seconds
- Aggregation interval: 1 minute
- Stripe submission interval: 5 minutes

---

## 📊 Database Schema Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BILLING TABLES                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  billing_customers                                           │
│    ├─ tenant_id (FK)                                        │
│    ├─ stripe_customer_id ✓                                  │
│    ├─ payment_method                                        │
│    └─ status                                                 │
│       ↓                                                      │
│  subscriptions                                               │
│    ├─ billing_customer_id (FK)                              │
│    ├─ stripe_subscription_id ✓                              │
│    ├─ plan_tier (free/standard/enterprise)                  │
│    ├─ status (active/past_due/canceled)                     │
│    └─ current_period_start/end                              │
│       ↓                                                      │
│  subscription_items (5 items per subscription)               │
│    ├─ subscription_id (FK)                                  │
│    ├─ stripe_subscription_item_id ✓                         │
│    ├─ metric (llm_tokens/agent_executions/etc.)            │
│    └─ included_quantity                                      │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │         USAGE PIPELINE                         │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  usage_events (raw events from services)                    │
│    ├─ tenant_id                                             │
│    ├─ metric                                                │
│    ├─ amount                                                │
│    ├─ request_id (idempotency)                             │
│    └─ processed (false → true)                              │
│       ↓ (aggregated every 1 minute)                         │
│  usage_aggregates (batched for Stripe)                      │
│    ├─ tenant_id                                             │
│    ├─ metric                                                │
│    ├─ total_amount                                          │
│    ├─ period_start/end                                      │
│    ├─ idempotency_key                                       │
│    └─ submitted_to_stripe (false → true)                    │
│       ↓ (submitted every 5 minutes)                         │
│  [STRIPE API] usage_records                                 │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │         QUOTAS & ENFORCEMENT                   │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  usage_quotas (plan limits + current usage)                 │
│    ├─ tenant_id                                             │
│    ├─ metric                                                │
│    ├─ quota_amount                                          │
│    ├─ current_usage (cached from Stripe)                    │
│    ├─ hard_cap (true/false)                                 │
│    └─ last_synced_at                                        │
│                                                              │
│  usage_alerts (warnings)                                     │
│    ├─ tenant_id                                             │
│    ├─ metric                                                │
│    ├─ threshold_percentage (80/100/120)                     │
│    ├─ alert_type (warning/critical/exceeded)                │
│    └─ acknowledged                                          │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │         INVOICES & WEBHOOKS                    │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  invoices (Stripe invoice storage)                          │
│    ├─ billing_customer_id (FK)                              │
│    ├─ stripe_invoice_id ✓                                   │
│    ├─ amount_due/paid                                       │
│    ├─ status (draft/open/paid/void)                         │
│    ├─ line_items (JSON)                                     │
│    └─ invoice_pdf_url                                       │
│                                                              │
│  webhook_events (Stripe webhook log)                        │
│    ├─ stripe_event_id ✓                                     │
│    ├─ event_type                                            │
│    ├─ payload (JSON)                                        │
│    ├─ processed                                             │
│    └─ error_message                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps (Phase 2-9)

### Phase 2: Stripe Integration Services
- [ ] `StripeService.ts` - Core Stripe client
- [ ] `CustomerService.ts` - Create/manage customers
- [ ] `SubscriptionService.ts` - Subscription CRUD
- [ ] `UsageMeteringService.ts` - Submit usage to Stripe
- [ ] `InvoiceService.ts` - Invoice retrieval
- [ ] `WebhookService.ts` - Webhook handling

### Phase 3: Usage Metering Pipeline
- [ ] `UsageEmitter.ts` - Emit from services
- [ ] `UsageAggregator.ts` - Batch aggregation (1-min cron)
- [ ] `UsageSink.ts` - Submit to Stripe (5-min cron)
- [ ] `UsageCache.ts` - Redis for real-time quotas

### Phase 4: Plan Enforcement
- [ ] `planEnforcementMiddleware.ts` - Pre-request check
- [ ] `usageTrackingMiddleware.ts` - Post-request emission
- [ ] `nginx-plan-enforcement.conf` - Gateway enforcement
- [ ] `istio-plan-enforcement.yaml` - Istio enforcement

### Phase 5: Webhooks & Invoicing
- [ ] Webhook endpoint & handlers
- [ ] Invoice storage
- [ ] Subscription status sync
- [ ] Payment failure handling

### Phase 6: Frontend UI
- [ ] `BillingDashboard.tsx` - Main billing page
- [ ] `PlanSelector.tsx` - Plan selection
- [ ] `UsageMeter.tsx` - Usage display
- [ ] `InvoiceList.tsx` - Invoice history
- [ ] `QuotaWarning.tsx` - Alert banners

### Phase 7: API Endpoints
- [ ] `/api/billing/subscription` endpoints
- [ ] `/api/billing/usage` endpoints
- [ ] `/api/billing/invoices` endpoints
- [ ] `/api/billing/webhooks` endpoint

### Phase 8: Integration
- [ ] Integrate into `llm.ts`
- [ ] Integrate into `queue.ts`
- [ ] Integrate into `AgentChatService.ts`
- [ ] Update `UsageTrackingService.ts`

### Phase 9: Testing & Docs
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E billing flow test
- [ ] Documentation

---

## 📋 Deployment Checklist

### 1. Database Setup
```bash
# Apply migration
psql -f supabase/migrations/20241129000008_billing_infrastructure.sql

# Verify tables
psql -c "\dt public.billing*"
psql -c "\dt public.subscriptions"
psql -c "\dt public.usage*"
psql -c "\dt public.invoices"
```

### 2. Stripe Setup
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Create products and prices
cd infrastructure/billing
./stripe-products-setup.sh

# Copy product IDs to .env
```

### 3. Environment Variables
```bash
# Add to .env.local
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # After creating webhook

# Stripe price IDs (from stripe-config.json)
STRIPE_PRICE_LLM_TOKENS_FREE=price_...
STRIPE_PRICE_LLM_TOKENS_STANDARD=price_...
STRIPE_PRICE_LLM_TOKENS_ENTERPRISE=price_...
# ... (repeat for all metrics and tiers)
```

### 4. Redis Setup (for usage cache)
```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Or use existing Redis instance
```

---

## 🧪 Testing Phase 1

### Database Functions
```sql
-- Test get_current_usage
SELECT get_current_usage(
  'tenant-uuid',
  'llm_tokens',
  date_trunc('month', NOW()),
  date_trunc('month', NOW()) + INTERVAL '1 month'
);

-- Test is_over_quota
SELECT is_over_quota('tenant-uuid', 'llm_tokens');

-- Test get_usage_percentage
SELECT get_usage_percentage('tenant-uuid', 'llm_tokens');
```

### Configuration
```typescript
import { getPlan, calculateMonthlyCost } from './src/config/billing';

// Get plan details
const standardPlan = getPlan('standard');
console.log(standardPlan);

// Calculate costs
const usage = {
  llm_tokens: 1_500_000,  // 1.5M (500K overage)
  agent_executions: 5_500,  // 5.5K (500 overage)
  api_calls: 120_000,  // 120K (20K overage)
  storage_gb: 105,  // 105 GB (5 GB overage)
  user_seats: 27,  // 27 seats (2 overage)
};

const costs = calculateMonthlyCost('standard', usage);
console.log(costs);
// {
//   baseCost: 99,
//   overageCosts: {
//     llm_tokens: 5,
//     agent_executions: 50,
//     api_calls: 20,
//     storage_gb: 2.5,
//     user_seats: 10,
//   },
//   totalOverage: 87.5,
//   totalCost: 186.5
// }
```

---

## 📚 Documentation

- **Database Schema:** See migration file for complete schema
- **Configuration:** See `src/config/billing.ts` for all constants
- **Stripe Setup:** See `stripe-products-setup.sh` for product creation

---

## ✅ Phase 1 Summary

**Files Created:** 3
- Database migration (500+ lines)
- Stripe setup script (400+ lines)
- Billing configuration (400+ lines)

**Database Objects:** 9 tables + 3 functions + RLS policies

**Ready for:** Phase 2 (Stripe Integration Services)

**Estimated Time to Complete:** 2 hours ✅

---

**Phase 1 Complete! Ready to proceed with Phase 2.** 🚀
