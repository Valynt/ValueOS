# Billing Test Suite

Comprehensive test suite for the Stripe billing integration, covering security, resiliency, integration, and load testing.

## Overview

This test suite validates the production-readiness of the billing system with:

- **Security tests**: RLS policies, SQL injection, webhook verification, PII protection
- **Resiliency tests**: Webhook retry, idempotency, failure recovery
- **Integration tests**: E2E subscription lifecycle, usage metering, quota enforcement
- **Load tests**: High-volume operations, concurrent processing

## Test Organization

```
src/services/billing/__tests__/
├── __helpers__/              # Shared test utilities
│   ├── stripe-mocks.ts       # Stripe API mocks
│   ├── billing-factories.ts  # Test data generators
│   ├── db-helpers.ts          # Database test utilities
│   └── test-fixtures.ts      # Common test setup
│
├── security/                 # Security & compliance tests
│   ├── rls-policies.test.ts
│   ├── webhook-security.test.ts
│   ├── input-validation.test.ts
│   └── sensitive-data.test.ts
│
├── resiliency/               # Failure handling tests
│   ├── webhook-retry.test.ts
│   └── usage-idempotency.test.ts
│
└── integration/              # E2E tests
    └── subscription-lifecycle.test.ts
```

## Prerequisites

### Environment Variables

Create `.env.test` file:

```bash
# Supabase (required)
VITE_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (use test keys)
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### Database Setup

Ensure your test database has the billing schema migrated:

```bash
# Run migrations
npm run db:migrate

# Or use Supabase CLI
supabase db reset
```

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Suites

```bash
# Security tests only
npm test src/services/billing/__tests__/security

# Resiliency tests only
npm test src/services/billing/__tests__/resiliency

# Integration tests only
npm test src/services/billing/__tests__/integration
```

### Specific Test File

```bash
npm test src/services/billing/__tests__/security/rls-policies.test.ts
```

### Watch Mode

```bash
npm test -- --watch
```

### Coverage

```bash
npm test -- --coverage
```

## Test Categories

### Security Tests

**Critical for production**: Prevent data breaches and ensure compliance.

- **RLS Policies** (`rls-policies.test.ts`): Validates multi-tenant data isolation
- **Webhook Security** (`webhook-security.test.ts`): Signature verification, replay prevention
- **Input Validation** (`input-validation.test.ts`): SQL injection, XSS, validation
- **Sensitive Data** (`sensitive-data.test.ts`): PII protection, PCI compliance

### Resiliency Tests

**Critical for billing accuracy**: Ensure exactly-once processing.

- **Webhook Retry** (`webhook-retry.test.ts`): Retry logic, exponential backoff, DLQ
- **Usage Idempotency** (`usage-idempotency.test.ts`): Duplicate prevention, concurrent processing

### Integration Tests

**Critical for correctness**: Validate end-to-end flows.

- **Subscription Lifecycle** (`subscription-lifecycle.test.ts`): Create, upgrade, downgrade, cancel

## Test Helpers

### Stripe Mocks

```typescript
import {
  createMockStripeClient,
  createMockStripeCustomer,
} from "../__helpers__/stripe-mocks";

const mockStripe = createMockStripeClient();
const customer = createMockStripeCustomer({ email: "test@example.com" });
```

### Billing Factories

```typescript
import {
  createBillingCustomer,
  createCompleteBillingSetup,
} from "../__helpers__/billing-factories";

const customer = createBillingCustomer({ tenant_id: "tenant_123" });
const setup = createCompleteBillingSetup("standard", "tenant_123");
```

### Database Helpers

```typescript
import {
  getTestSupabaseClient,
  cleanupBillingTables,
  seedTestData,
} from "../__helpers__/db-helpers";

const supabase = getTestSupabaseClient();
await cleanupBillingTables(supabase);
await seedTestData(supabase, { customers: [customer] });
```

## Common Test Patterns

### Setup and Cleanup

```typescript
beforeEach(async () => {
  supabase = getTestSupabaseClient();
  await cleanupBillingTables(supabase);
});

afterEach(async () => {
  await cleanupBillingTables(supabase);
});
```

### Testing RLS Policies

```typescript
// As service role (bypasses RLS)
const { data: allData } = await supabase.from("billing_customers").select("*");

// As specific user (enforces RLS)
const { data: tenantData } = await supabase
  .from("billing_customers")
  .select("*")
  .eq("tenant_id", tenantId);
```

### Testing Webhooks

```typescript
import {
  createMockStripeEvent,
  createWebhookSignature,
} from "../__helpers__/stripe-mocks";

const event = createMockStripeEvent("invoice.payment_succeeded", {
  /* data */
});
const signature = createWebhookSignature(event);
```

## Best Practices

1. **Isolation**: Each test should be independent and clean up after itself
2. **Idempotency**: Tests should produce same results when run multiple times
3. **Realistic Data**: Use factories to create realistic test data
4. **Clear Assertions**: Test one thing per test, with clear expectations
5. **Fast Execution**: Mock external services, keep tests under 100ms each

## Test Coverage Goals

- **Security tests**: 100% coverage of RLS policies and input validation
- **Resiliency tests**: All failure scenarios and retry paths
- **Integration tests**: All critical billing flows
- **Overall**: >80% line coverage for billing services
