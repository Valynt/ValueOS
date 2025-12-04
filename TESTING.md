# Testing Guide - Real Database Integration Tests

## Overview

**All tests use the REAL Supabase database** - no mocks!

This ensures:
- ✅ Tests verify actual database behavior
- ✅ RLS policies are tested in production-like environment
- ✅ Real queries, real data, real transactions
- ✅ Integration tests are meaningful

## Database Connection

Tests connect to:
- **Database:** `https://bxaiabnqalurloblfwua.supabase.co`
- **Schema:** `public`
- **Tables:** 19+ tables created via migrations

## Test Configuration

### Location: `test/setup.ts`

Real Supabase credentials are configured:
```typescript
process.env.VITE_SUPABASE_URL = 'https://bxaiabnqalurloblfwua.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJ...';
```

### Location: `src/lib/supabase.ts`

**No mock client** - fails fast if credentials missing:
```typescript
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration missing!');
}
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Specific Test Files
```bash
# Environment & Supabase config tests
npm test src/config/__tests__/environment.test.ts

# Security & CSP tests
npm test src/api/__tests__/security-integration.test.ts

# Password breach API tests
npm test src/security/__tests__/PasswordValidator.test.ts

# Dev container tests
npm test test/integration/devcontainer-config.test.ts
```

### With Coverage
```bash
npm test -- --coverage
```

## Test Categories

### 1. Environment Configuration Tests
**File:** `src/config/__tests__/environment.test.ts`

Tests:
- ✅ Supabase URL loads from environment
- ✅ Supabase anon key loads correctly
- ✅ URL format validation
- ✅ Key prefix validation
- ✅ CORS origins configuration
- ✅ Security settings enabled

### 2. Security Integration Tests
**File:** `src/api/__tests__/security-integration.test.ts`

Tests:
- ✅ CSP includes password breach API
- ✅ `pwnedpasswords.com` in connect-src
- ✅ Secure CSP directives maintained
- ✅ No wildcard origins
- ✅ HTTPS enforced for external resources

### 3. Password Validation Tests
**File:** `src/security/__tests__/PasswordValidator.test.ts`

Tests:
- ✅ Password breach checking via real API
- ✅ Network error handling
- ✅ K-anonymity implementation

### 4. Dev Container Tests
**File:** `test/integration/devcontainer-config.test.ts`

Tests:
- ✅ Docker Compose configuration
- ✅ Network setup
- ✅ Volume mounts
- ✅ Service connectivity

## Database Tables Available for Testing

Core tables created and available:
- `agent_sessions` - Agent workflow sessions
- `agent_predictions` - AI predictions with confidence
- `llm_usage` - LLM API usage tracking
- `llm_calls` - Detailed LLM call logs
- `confidence_violations` - Low confidence tracking
- `cases` - User cases/tickets
- `workflows` - Workflow instances
- `messages` - Conversation messages
- `tenant_integrations` - Third-party integrations
- `login_attempts` - Account security
- `approval_requests` - Approval workflows
- `retention_policies` - Data retention
- `audit_logs` - Immutable audit trail
- `billing_customers` - Billing data
- `subscriptions` - Subscription management

## Writing New Tests

### Always Use Real Database

```typescript
import { supabase } from '@/lib/supabase';

test('should query real database', async () => {
  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .limit(1);
  
  expect(error).toBeNull();
  expect(data).toBeDefined();
});
```

### Test Cleanup

Always clean up test data:
```typescript
afterEach(async () => {
  // Delete test data
  await supabase
    .from('test_table')
    .delete()
    .eq('test_id', testId);
});
```

## API Contract Validation

Run the OpenAPI validation gate in CI to block breaking changes and missing examples:
```bash
npm run lint:openapi
```
The script verifies schema validity, operation descriptions, and examples on every request and response body.

### Test Isolation

Use unique identifiers:
```typescript
const testId = `test-${Date.now()}-${Math.random()}`;
```

## Troubleshooting

### Tests Fail with "Supabase configuration missing"
**Cause:** Credentials not set in test environment

**Fix:** Check `test/setup.ts` has credentials configured

### Tests Fail with "relation does not exist"
**Cause:** Database table not created

**Fix:** Run migrations:
```bash
export SUPABASE_ACCESS_TOKEN=your-token
supabase db push
```

### Tests Timeout
**Cause:** Network issues or slow database

**Fix:** Increase timeout in test:
```typescript
test('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### RLS Policy Errors
**Cause:** Anon key doesn't have permission

**Solution:** Use service role key for admin tests, or test with actual user auth

## Best Practices

✅ **DO:**
- Test against real database
- Clean up test data
- Use unique identifiers
- Test RLS policies with real auth
- Assert on database state changes

❌ **DON'T:**
- Mock database responses
- Leave test data in database
- Use hard-coded IDs
- Skip cleanup in afterEach
- Test without error handling

## CI/CD Integration

For CI/CD pipelines, set environment variables:
```bash
export VITE_SUPABASE_URL=https://bxaiabnqalurloblfwua.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
npm test
```

## Performance

Tests run against real database, so:
- Expect network latency
- Use `.limit()` in queries
- Run expensive tests separately
- Consider database connection pooling

## Security

⚠️ **Never commit:**
- Service role keys to git
- Production database credentials
- User passwords or tokens

✅ **Always:**
- Use anon key for read tests
- Use service role only when needed
- Sanitize test data
- Follow RLS policies

## Support

- **Database Dashboard:** https://supabase.com/dashboard/project/bxaiabnqalurloblfwua
- **Migration Guide:** `supabase/migrations/ROLLBACK_GUIDE.md`
- **Database Setup:** `DATABASE_SETUP.md`
- **December Fixes:** `test/DECEMBER_1_FIXES_TESTS.md`
