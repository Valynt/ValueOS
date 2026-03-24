# Test Failure Fix Strategy - Phase 2

**Status**: 2026-03-23  
**Current**: 755 failed | 3454 passed | 118 skipped  
**Progress**: -127 failures from original 758 (infrastructure + prom-client fixes applied)

---

## ✅ COMPLETED FIXES

### 1. Infrastructure (Critical - RESOLVED)
- Aligned all packages to vitest 3.2.4 (was mixed 3.x/4.x)
- Downgraded vite 7.x → 5.4.0 for vitest 3.x compatibility
- Added vite pnpm override to prevent version drift

### 2. Prom-Client Mock (High Impact - RESOLVED)
- Added `prom-client` mock to `packages/backend/src/test/setup.ts`
- Prevents "metric already registered" singleton conflicts
- **Result**: ~130 test failures eliminated

---

## 🔴 REMAINING FAILURE CATEGORIES (755 failures)

### Category A: HTTP Status Code Mismatches (~150 failures)
**Pattern**: Tests expect specific 4xx status codes but receive 500

**Examples**:
```
expected 500 to be 409   (Conflict)
expected 500 to be 429   (Rate limit)
expected 500 to be 404   (Not found)
expected 500 to be 400   (Bad request)
```

**Root Cause**: Error handling middleware converting specific errors to generic 500

**Fix Strategy**:
```typescript
// In error handler tests or middleware tests:
// Ensure errors have proper statusCode properties

// Mock errors with status codes:
vi.mocked(someService).mockRejectedValue(
  Object.assign(new Error('Not found'), { statusCode: 404 })
);
```

**Files to Fix** (high failure count):
- `src/middleware/__tests__/globalErrorHandler.test.ts` (16 failed)
- `src/services/trust/__tests__/NarrativeHallucinationChecker.test.ts` (7 failed)
- `src/lib/agent-fabric/agents/__tests__/TargetAgent.test.ts` (13 failed)
- `src/lib/agent-fabric/agents/__tests__/RealizationAgent.test.ts` (16 failed)

---

### Category B: Supabase Mock Export Issues (~80 failures)
**Pattern**: `No "supabase" export is defined on the "../../lib/supabase" mock`

**Root Cause**: 
- Tests mock `supabase.js` but the mock file is `supabase.ts`
- Vitest resolution mismatch between `.js` imports and `.ts` mock files
- Some tests use inline mocks that don't export `supabase`

**Fix Strategy** (per test file):
```typescript
// Option 1: Fix inline mocks to include supabase export
vi.mock('../../lib/supabase.js', () => ({
  supabase: { from: vi.fn() },  // Add this export
  createServerSupabaseClient: vi.fn(),
}));

// Option 2: Use __mocks__ file properly
vi.mock('../../lib/supabase.js'); // Uses __mocks__/supabase.ts
```

**Files to Fix**:
- `src/services/security/__tests__/ComplianceControlStatusService.test.ts` (18 mocks)
- `src/services/security/__tests__/ComplianceControlCheckService.test.ts` (4 mocks)
- `src/services/post-v1/__tests__/AgentFabricService.test.ts` (4 mocks)

---

### Category C: Spy/Assertion Failures (~200 failures)
**Pattern**: Expected spy calls not matching actual calls

**Examples**:
```
expected "spy" to be called 1 times, but got 0 times
expected "spy" to be called with arguments: [ ... ] but got [ ... ]
```

**Root Cause**:
- Async operations not awaited before assertions
- Mock implementations changed but assertions not updated
- Test isolation issues - mock state leaking

**Fix Strategy**:
```typescript
// Add proper awaiting:
await vi.waitFor(() => expect(spy).toHaveBeenCalled());

// Or flush promises:
await new Promise(resolve => setTimeout(resolve, 0));

// Use vi.advanceTimersToNextTimer() for timer-based code:
vi.useFakeTimers();
// ... trigger action
vi.advanceTimersToNextTimer();
expect(spy).toHaveBeenCalled();
```

**Files to Fix**:
- `src/config/__tests__/rollout_perf.test.ts` (interval flushing)
- `src/services/auth/__tests__/rbac-cache-ttl-env-respected.unit.test.ts`
- `src/services/artifacts/__tests__/ArtifactGenerators.test.ts`

---

### Category D: Stripe/External Service Mocks (~20 failures)
**Pattern**: `Stripe service not available`, `Stripe API Error`

**Root Cause**: Missing Stripe SDK mocks or env vars

**Fix Strategy**:
```typescript
// Mock stripe module:
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    webhooks: {
      constructEvent: vi.fn(() => ({ type: 'invoice.paid' })),
    },
    invoices: {
      retrieve: vi.fn().mockResolvedValue({ id: 'inv_123' }),
    },
  })),
}));
```

**Note**: Env vars already added to vitest.config.ts, but module mocking needed.

---

### Category E: Error Object Property Issues (~50 failures)
**Pattern**: `Cannot read properties of undefined (reading 'code'/'stack'/'message')`

**Root Cause**: Error objects not properly mocked with all expected properties

**Fix Strategy**:
```typescript
// Create proper error mocks:
const mockError = Object.assign(new Error('Test error'), {
  code: 'TEST_ERROR_CODE',
  stack: 'Error: Test error\n    at Test.method',
});

vi.mocked(service.method).mockRejectedValue(mockError);
```

---

### Category F: graphWriter Mock Issues (~30 failures)
**Pattern**: `this.graphWriter.resolveOpportunityId is not a function`

**Root Cause**: RealizationAgent and related tests missing graphWriter mock methods

**Fix Strategy** (in test setup):
```typescript
vi.mock('../graphWriter', () => ({
  graphWriter: {
    resolveOpportunityId: vi.fn().mockResolvedValue('opp-123'),
    resolveHypothesisId: vi.fn().mockResolvedValue('hyp-456'),
    // ... other methods
  },
}));
```

---

## 📋 PRIORITIZED FIX ORDER

### Priority 1: Supabase Exports (High Impact, Low Risk)
**Files**: ~20 test files with inline supabase mocks  
**Effort**: 2-3 hours  
**Impact**: ~80 test fixes

### Priority 2: Error Handler Status Codes (Medium Risk)
**Files**: globalErrorHandler.test.ts, middleware tests  
**Effort**: 3-4 hours  
**Impact**: ~150 test fixes

### Priority 3: Spy/Async Assertions (Low Risk, Tedious)
**Files**: ~50 test files with timing issues  
**Effort**: 6-8 hours  
**Impact**: ~200 test fixes

### Priority 4: Service Mocks (Stripe, graphWriter)
**Files**: ~15 test files  
**Effort**: 2-3 hours  
**Impact**: ~50 test fixes

---

## 🔧 RECOMMENDED APPROACH

### Option A: Surgical File-by-File Fixes
- Pick one high-failure file (e.g., `globalErrorHandler.test.ts`)
- Run only that test file: `pnpm test src/middleware/__tests__/globalErrorHandler.test.ts`
- Fix all failures in that file
- Move to next file

**Pros**: Low regression risk, clear progress tracking  
**Cons**: Slower initial progress

### Option B: Category Batch Fixes  
- Fix all supabase export issues across files
- Fix all status code issues
- etc.

**Pros**: Efficient pattern application  
**Cons**: Higher regression risk, harder to debug

---

## 📊 ESTIMATED TIME TO RESOLUTION

| Approach | Estimated Time | Final Failure Count |
|----------|---------------|-------------------|
| File-by-file (surgical) | 15-20 hours | <50 failures |
| Category batch | 10-15 hours | <100 failures |
| Current trajectory | N/A | Stuck at ~750 |

---

## 🎯 NEXT ACTIONS

1. **Choose approach**: Surgical vs batch
2. **Start with Priority 1**: Supabase exports (high impact, low risk)
3. **Verify each fix**: Run affected test file after each change
4. **Track progress**: Update this document with fixed counts

---

**Infrastructure Status**: ✅ RESOLVED  
**Phase 1 Fixes**: ✅ COMPLETE (-127 failures)  
**Phase 2 Strategy**: 📝 DOCUMENTED  
**Ready for**: 🚀 EXECUTION
