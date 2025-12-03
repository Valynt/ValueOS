# Test Bug Analysis - December 1, 2025

## Executive Summary

**Total Test Failures Identified**: ~50+ failures across 8 categories  
**Severity Breakdown**:
- 🔴 **Critical** (Production Blockers): 3 categories
- 🟡 **High** (Feature Breaking): 3 categories  
- 🟢 **Medium** (Test Infrastructure): 2 categories

---

## Category 1: Action Router Integration 🔴 **CRITICAL**

### Failures (4 tests)
```
× should validate actions before routing
× should enforce Manifesto rules
× should log all actions to audit trail
```

### Root Cause Analysis

**Likely Issue**: `ActionRouter` service not properly initialized or mocked in tests.

**Files to Investigate**:
- `src/services/ActionRouter.ts` or `src/sdui/ActionRouter.ts`
- `test/sdui/__tests__/ActionRouter.test.ts`

**Hypothesis**:
1. Manifesto validation logic may be undefined
2. Audit logger mock incomplete
3. Action schema validation missing

### Investigation Commands
```bash
# Find ActionRouter implementation
find src -name "*ActionRouter*" -type f

# Check test file
cat src/sdui/__tests__/*ActionRouter*.test.ts* | head -100
```

---

## Category 2: Canvas Schema Service - Cache 🟡 **HIGH**

### Failures (3 tests)
```
× should return cached schema if valid
× should return null if cache expired
× should invalidate cache when schema is updated
```

### Root Cause Analysis

**Likely Issue**: Cache timing/TTL logic not working in test environment.

**Files to Investigate**:
- `src/services/CanvasSchemaService.ts`
- Cache implementation (Redis mock or in-memory)

**Hypothesis**:
1. `Date.now()` or timing mocks not set up
2. TTL expiration logic using real timers instead of fake timers
3. Cache invalidation not triggering properly

### Code Pattern to Look For
```typescript
// Problem: Real timers in tests
const isExpired = Date.now() > cache.expiresAt;

// Solution needed: Use vi.useFakeTimers()
vi.useFakeTimers();
vi.setSystemTime(new Date('2025-12-02'));
```

---

## Category 3: Business Days Utility 🟡 **HIGH**

### Failures (4 tests)
```
× should check if date is weekend (multiple failures)
× should check if date is weekday (multiple failures)
```

### Root Cause Analysis

**Likely Issue**: Date comparison logic or timezone issues.

**Files to Investigate**:
- `src/utils/dateUtils.ts` or similar
- `src/services/workflows/__tests__/SagaExecution.test.ts`

**Hypothesis**:
1. `.getDay()` returning unexpected values due to timezone
2. Weekend definition inconsistency (0=Sunday vs 1=Monday)
3. Date parsing creating wrong day

### Typical Bug Pattern
```typescript
// WRONG: Timezone-sensitive
const isWeekend = (date: Date) => {
  const day = date.getDay(); // Changes based on timezone!
  return day === 0 || day === 6;
};

// CORRECT: Timezone-aware
const isWeekend = (date: Date) => {
  const day = new Date(date.toISOString().split('T')[0]).getUTCDay();
  return day === 0 || day === 6;
};
```

---

## Category 4: CoordinatorAgent Logging 🟢 **MEDIUM**

### Failures (8 errors - non-blocking)
```
[ERROR] Failed to log coordinator decision {"decisionType":"task_initiated"} undefined
[ERROR] Failed to log coordinator decision {"decisionType":"subgoal_routed"} undefined
[ERROR] Failed to log coordinator decision {"decisionType":"static_ui_generated"} undefined
```

### Root Cause Analysis

**Likely Issue**: Logger mock not configured correctly.

**Files to Investigate**:
- `test/llm-marl/coordinator-agent.test.ts`
- CoordinatorAgent implementation

**Hypothesis**:
1. `auditLogger.log()` mock missing
2. Logger expects specific format not provided in mock
3. Async logging not awaited

**Impact**: Tests pass but log errors (non-blocking).

### Fix Pattern
```typescript
// In test setup
mockAuditLogger = {
  log: vi.fn().mockResolvedValue(undefined),
  logDecision: vi.fn().mockResolvedValue(undefined)
};
```

---

## Category 5: State Persistence 🔴 **CRITICAL**

### Failures (1 test)
```
× should persist state to database
```

### Root Cause Analysis

**Likely Issue**: Supabase mock not returning expected structure.

**Files to Investigate**:
- State management service with `persistState` method
- Database interaction layer

**Hypothesis**:
1. Mock returns `{ data: null, error: null }` instead of success
2. Assertion expects specific database response format
3. Transaction/commit not mocked

---

## Category 6: Session Manager Actions 🟡 **HIGH**

### Failures (2 tests)
```
× should route invokeAgent action successfully
× should route navigateToStage action successfully
```

### Root Cause Analysis

**Likely Issue**: Action routing logic expects dependencies not mocked.

**Files to Investigate**:
- `src/services/SessionManager.ts`
- Action handler implementations

**Hypothesis**:
1. Agent registry not mocked
2. Navigation router undefined
3. Action payload schema validation failing

---

## Category 7: Schema Caching 🟢 **MEDIUM**

### Failures (3 tests)
```
× should return cached schema if valid
× should return null if cache expired
× should return null if no cache exists
```

### Root Cause Analysis

**Same as Category 2** - likely shared cache implementation.

**Additional Check**: May be different service using same cache layer.

---

## Category 8: File Upload Validation 🟢 **LOW**

### Note
Tests are passing but taking 3+ seconds each:
```
validateFileUpload (4) 3037ms
```

**Optimization Needed**: File upload mocks should be instant.

**Issue**: Likely doing real file system operations or using setTimeout.

---

## Priority Fixes

### 🔴 **P0 - Fix Immediately** (Production Blockers)

1. **Action Router Integration**
   - File: `src/sdui/__tests__/*ActionRouter*`
   - Fix: Properly mock Manifesto validator and audit logger
   - ETA: 30 minutes

2. **State Persistence**
   - File: State management tests
   - Fix: Complete Supabase mock setup
   - ETA: 15 minutes

### 🟡 **P1 - Fix This Week** (Feature Breaking)

3. **Business Days Logic**
   - File: Date utility tests
   - Fix: Add timezone handling or use UTC
   - ETA: 20 minutes

4. **Canvas Schema Cache**
   - File: `src/services/CanvasSchemaService.ts`
   - Fix: Use `vi.useFakeTimers()` for TTL tests
   - ETA: 25 minutes

5. **Session Manager Routing**
   - File: SessionManager tests
   - Fix: Mock agent registry and navigation
   - ETA: 30 minutes

### 🟢 **P2 - Nice to Have** (Non-blocking)

6. **CoordinatorAgent Logging**
   - Fix: Update logger mocks
   - ETA: 10 minutes

7. **File Upload Performance**
   - Fix: Remove real I/O operations
   - ETA: 15 minutes

---

## Investigation Strategy

### Step 1: Identify Exact Failures
```bash
# Get detailed error messages
npm test -- --run --reporter=verbose 2>&1 | grep -A10 "×" > /tmp/failures.txt

# Focus on one category at a time
npm test -- --run src/sdui/__tests__/ActionRouter.test.ts
```

### Step 2: Check Mock Setup
```bash
# Look for mock patterns
grep -r "mockAuditLogger\|mockSupabase\|mockRouter" src/**/__tests__/
```

### Step 3: Review Implementation
```bash
# Find the actual implementation files
find src -name "ActionRouter.ts" -o -name "CanvasSchemaService.ts"
```

---

## Common Test Anti-Patterns Found

### 1. **Incomplete Mocks**
```typescript
// ❌ BAD
mockService = {
  doSomething: vi.fn()
  // Missing other methods the code calls!
};

// ✅ GOOD
mockService = {
  doSomething: vi.fn().mockResolvedValue(result),
  logError: vi.fn(),
  cleanup: vi.fn()
};
```

### 2. **Real Timers in Cache Tests**
```typescript
// ❌ BAD
it('should expire cache', async () => {
  cache.set('key', 'value', 100); // 100ms TTL
  await new Promise(resolve => setTimeout(resolve, 150)); // Real wait!
  expect(cache.get('key')).toBeNull();
});

// ✅ GOOD
it('should expire cache', async () => {
  vi.useFakeTimers();
  cache.set('key', 'value', 100);
  vi.advanceTimersByTime(150);
  expect(cache.get('key')).toBeNull();
  vi.useRealTimers();
});
```

### 3. **Timezone-Dependent Date Logic**
```typescript
// ❌ BAD
const isWeekend = (date: Date) => [0, 6].includes(date.getDay());

// ✅ GOOD
const isWeekend = (date: Date) => [0, 6].includes(date.getUTCDay());
```

---

## Recommended Next Actions

1. **Create individual bug tickets** for each category
2. **Focus on P0 items** (ActionRouter, StatePersistence) first
3. **Add regression tests** after fixes
4. **Document mock patterns** in test README

---

## Metrics

**Current State**:
- Total Tests: ~800
- Passing: ~750
- Failing: ~50
- **Pass Rate: 93.75%**

**Target State**:
- **Pass Rate: 100%**
- **Avg Test Time: < 100ms per test**
- **No console errors**

---

## Files Requiring Investigation

Priority order:

1. `src/sdui/__tests__/ActionRouter.test.ts` (or similar)
2. `src/services/__tests__/CanvasSchemaService.test.ts`
3. `src/services/workflows/__tests__/SagaExecution.test.ts`
4. `test/llm-marl/coordinator-agent.test.ts`
5. State management test files (location TBD)
6. `src/services/__tests__/SessionManager.test.ts`
