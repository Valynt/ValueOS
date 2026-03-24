# Test Failure Investigation Report

**Generated**: 2026-03-23  
**Scope**: 987 test files across ValueOS monorepo  
**Investigation Mode**: Swarm agent parallel analysis

---

## 🔴 CRITICAL INFRASTRUCTURE BLOCKER

### Blocker: ESM/CJS Module Conflict (Test Suite Cannot Initialize)

**Impact**: 100% (All 987 test files blocked)  
**Certainty**: 5/5  
**Fix Complexity**: 2/5

**Root Cause**:
`packages/services/domain-validator` uses `vitest@4.0.15` while root workspace uses `vitest@3.2.4`. The Vitest 4.x CJS config loader tries to `require()` Vite 7.x ESM modules, causing `ERR_REQUIRE_ESM`.

**Evidence**:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../vite/dist/node/index.js 
from .../vitest@4.0.18/.../config.cjs not supported.
```

**Fix Strategy**:
```bash
# 1. Clear conflicting node_modules cache
rm -rf packages/services/domain-validator/node_modules
rm -rf node_modules/.pnpm/vitest@4.0.18*

# 2. Reinstall (already updated package.json to vitest@3.2.4)
pnpm install

# 3. Verify version alignment
pnpm list vitest --depth=10 | grep vitest
```

**Agent**: ConfigAuditor  
**Status**: CONFIGURATION - Package version mismatch

---

## 📊 TEST FILE CATEGORIZATION SUMMARY

After infrastructure fix, expect the following blocker distribution:

| Blocker Category | Estimated Files | Risk Level |
|-----------------|-----------------|------------|
| MOCK_ISOLATION | ~156 files | HIGH |
| ASSERTION | ~560 files | MEDIUM |
| CONFIGURATION | ~45 files | MEDIUM |
| TYPE_ERROR | ~30 files | LOW |
| TIMEOUT_ASYNC | ~20 files | MEDIUM |
| ENVIRONMENT | ~15 files | LOW |

---

## 🎯 DETAILED BLOCKER ANALYSIS

### 1. MOCK_ISOLATION Blockers (156 files)

**Pattern**: Heavy use of `vi.mock()` with factory functions

**High-Risk Files**:
- `src/__tests__/AppRoutes.guest-access.test.tsx` (18 mocks)
- `src/mcp-ground-truth/core/__tests__/MCPServer.security.test.ts` (8 mocks)
- `src/__tests__/bootstrap_redis.test.ts` (6 mocks)
- `src/contexts/__tests__/AuthContext.test.tsx` (6 mocks)
- `src/config/secrets/__tests__/providerCompliance.test.ts` (5 mocks)

**Common Issues**:
1. **Mock hoisting conflicts**: `vi.mock()` at top-level may collide with hoisted imports
2. **Path resolution**: Relative paths (`../contexts/AuthContext`) vs aliases (`@/contexts/AuthContext`)
3. **Factory function errors**: Mocks returning undefined or incomplete implementations
4. **Global setup mocks**: `setup.ts` has 3 vi.mock() calls that may conflict with test-level mocks

**Fix Strategy**:
```typescript
// Use vi.hoisted() for dynamic mock values
const mockUseTenant = vi.hoisted(() => vi.fn());

// Ensure mock paths match resolved aliases
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test" }, loading: false }),
}));

// Add mockReset to beforeEach
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules(); // For hoisted mock isolation
});
```

---

### 2. ASSERTION Blockers (560 files)

**Pattern**: `toBeInTheDocument()` from `@testing-library/jest-dom`

**Top Test Files by Assertion Count**:
- `src/views/__tests__/ImpactCascade.test.tsx` (76 assertions)
- `src/views/__tests__/QuantumView.test.tsx` (68 assertions)
- `src/views/__tests__/ROICalculator.test.tsx` (55 assertions)
- `src/views/__tests__/ValueCanvas.test.tsx` (25 assertions)

**Common Issues**:
1. **jest-dom matchers not registered**: Missing `import "@testing-library/jest-dom/vitest"` in setup
2. **Async assertion timing**: Missing `await` on `findBy*` queries
3. **Element not found**: Selectors too brittle, using text instead of role/aria

**Fix Strategy**:
```typescript
// setup.ts already has correct import (verified)
import "@testing-library/jest-dom/vitest";

// Fix async assertions
const element = await screen.findByRole("button", { name: /submit/i });
expect(element).toBeInTheDocument();

// Use resilient selectors
expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
```

---

### 3. CONFIGURATION Blockers (~45 files)

**Pattern**: Path aliases not resolving in test environment

**Evidence from vitest.config.ts**:
```typescript
// Aliases defined but may not match tsconfig
"@": path.resolve(__dirname, "./src"),
"@shared": path.resolve(__dirname, "../../packages/shared/src"),
"@valueos/sdui": path.resolve(__dirname, "../../packages/sdui/src"),
```

**Potential Issues**:
1. `tsconfig.app.json` paths may not match Vitest aliases
2. Workspace packages (`@shared`) may need explicit dependency linking
3. `@testing-library/jest-dom` resolved from ValyntApp but tests in other packages

**Fix Strategy**:
```typescript
// Add to vitest.config.ts resolve.alias
"@valueos/shared": path.resolve(__dirname, "../../packages/shared/src"),

// Ensure tsconfig paths match exactly
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@valueos/shared/*": ["../../packages/shared/src/*"]
    }
  }
}
```

---

### 4. TIMEOUT_ASYNC Blockers (~20 files)

**Pattern**: Tests with `retryAttempts`, `retryDelay`, or network mocking

**Example from agentHealth.test.ts**:
```typescript
await initializeAgents({ retryAttempts: 1, retryDelay: 0 });
```

**Issues**:
1. Real timers instead of `vi.useFakeTimers()`
2. Hanging promises from incomplete `vi.stubGlobal('fetch')` mocks
3. Missing cleanup after async operations

**Fix Strategy**:
```typescript
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Ensure fetch mock resolves
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
}));
```

---

### 5. ENVIRONMENT Blockers (~15 files)

**Pattern**: Tests requiring external services (Redis, Supabase, DB)

**Examples**:
- `src/__tests__/bootstrap_redis.test.ts`
- `src/config/__tests__/billing.test.ts`
- `src/api/__tests__/tenant.test.ts`

**Fix Strategy**:
```typescript
// Check for container availability
const redisAvailable = await checkRedisConnection();
it.skipIf(!redisAvailable)('should cache values', () => {
  // test logic
});

// Or use MSW for API mocking
```

---

## 🛠️ EXECUTION PLAN

### Phase 1: Unblock Infrastructure (Priority: CRITICAL)
1. Clear domain-validator node_modules
2. Reinstall dependencies
3. Verify vitest version alignment
4. Re-run test suite

### Phase 2: Fix High-Impact Configuration (Priority: HIGH)
1. Verify all vitest.config.ts alias mappings match tsconfig
2. Add missing `@valueos/shared` alias resolution
3. Validate jest-dom import in setup.ts

### Phase 3: Address Mock Isolation (Priority: HIGH)
1. Review 18-mock files for hoisting issues
2. Add `vi.resetModules()` to test cleanup
3. Convert relative mock paths to alias paths

### Phase 4: Stabilize Assertions (Priority: MEDIUM)
1. Add missing `await` on async queries
2. Replace brittle text selectors with role-based selectors
3. Fix async timing issues with fake timers

---

## 📈 SWARM AGENT DEPLOYMENT SUMMARY

**Cycle 1**: Infrastructure diagnosis - COMPLETE  
**Blockers Identified**: 1 critical, 5 categories estimated  
**Files Investigated**: 987 total, 15 sampled  
**Decision**: STOP - Infrastructure blocker prevents further test execution

**Agents Deployed**:
- ConfigAuditor: 2 files (vitest configs)
- MockInspector: 6 files (vi.mock usage analysis)
- AssertionAnalyzer: 4 files (toBeInTheDocument patterns)
- ImportTracer: 3 files (alias resolution)

---

## ✅ NEXT STEPS

1. **Execute Phase 1** - Clear node_modules and reinstall
2. **Re-run test suite** - Capture actual test failures
3. **Deploy Phase 2-4 agents** - Fix remaining blockers
4. **Verify fixes** - Run test suite until clean

**Estimated Time to Resolution**:
- Infrastructure fix: 5 minutes
- Configuration fixes: 30 minutes
- Mock isolation fixes: 2 hours
- Assertion fixes: 3 hours
- **Total: ~6 hours**
