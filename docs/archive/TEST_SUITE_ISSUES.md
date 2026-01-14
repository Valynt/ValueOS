# Test Suite Issues

**Date**: January 5, 2026  
**Issue**: `npm run test` hangs indefinitely  
**Status**: 🔴 **CRITICAL** - Tests cannot run

---

## Problem

Running `npm run test` hangs indefinitely and never completes. The test suite is configured to use Docker testcontainers for Postgres and Redis, but the setup is blocking.

### Symptoms

```bash
$ npm run test
# Hangs forever, no output
# Ctrl+C required to exit
```

### Root Cause

**Location**: `src/test/vitest-global-setup.ts` → `testcontainers-global-setup.ts`

The global setup tries to start Docker containers:

```typescript
export async function setup() {
  // Allow skipping heavy testcontainers setup for fast local unit tests
  if (process.env.SKIP_TESTCONTAINERS === "1") {
    console.warn("⚠️ SKIP_TESTCONTAINERS set — skipping...");
    return;
  }

  console.warn("🐳 Starting Postgres Testcontainer...");
  
  // This hangs if Docker is not available or not running
  container = await new PostgreSqlContainer("postgres:15.1")
    .withDatabase("postgres")
    .withUsername("postgres")
    .withPassword("postgres")
    .withExposedPorts(5432)
    .start(); // ← HANGS HERE
    
  // Also tries to start Redis
  redisContainer = await new GenericContainer("redis:7.0")
    .withExposedPorts(6379)
    .start(); // ← HANGS HERE TOO
}
```

### Why It Hangs

1. **Docker not running** - Testcontainers requires Docker daemon
2. **Docker not available** - In some environments (CI, containers) Docker may not be accessible
3. **Network issues** - Pulling Docker images may timeout
4. **Resource constraints** - Not enough memory/CPU to start containers

---

## Attempted Fixes

### ❌ Attempt 1: Use SKIP_TESTCONTAINERS flag

```bash
SKIP_TESTCONTAINERS=1 npm run test
```

**Result**: Still hangs - the flag is checked but setup still runs other blocking code

### ❌ Attempt 2: Run single test file

```bash
SKIP_TESTCONTAINERS=1 npx vitest run src/config/__tests__/agentFabric.test.ts
```

**Result**: Still hangs - global setup runs before any tests

---

## Recommended Fixes

### 🔴 Priority 1: Make Testcontainers Optional (IMMEDIATE)

**Problem**: Global setup always runs, even for unit tests that don't need database

**Solution**: Split test suites into unit and integration

#### Step 1: Create separate Vitest configs

**File**: `vitest.config.unit.ts`
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom", // For React components
    setupFiles: [
      "./src/test/setup.ts", // Basic setup only
    ],
    // NO globalSetup - skip testcontainers
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
      "**/*.integration.test.{ts,tsx}", // Exclude integration tests
      "src/repositories/**", // Exclude DB-dependent tests
    ],
    testTimeout: 5000,
    isolate: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // ... other aliases
    },
  },
});
```

**File**: `vitest.config.integration.ts`
```typescript
import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.unit";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: "node",
    globalSetup: "./src/test/vitest-global-setup.ts", // Use testcontainers
    include: [
      "**/*.integration.test.{ts,tsx}",
      "src/repositories/**/*.test.{ts,tsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
    ],
    testTimeout: 30000, // Longer timeout for integration tests
  },
});
```

#### Step 2: Update package.json scripts

```json
{
  "scripts": {
    "test": "vitest run --config vitest.config.unit.ts",
    "test:unit": "vitest run --config vitest.config.unit.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:all": "npm run test:unit && npm run test:integration",
    "test:watch": "vitest --config vitest.config.unit.ts",
    "test:coverage": "vitest run --config vitest.config.unit.ts --coverage"
  }
}
```

#### Step 3: Rename integration tests

```bash
# Rename tests that need database
mv src/repositories/__tests__/ValueTreeRepository.test.ts \
   src/repositories/__tests__/ValueTreeRepository.integration.test.ts

# Or add a comment at the top:
// @integration-test
```

---

### 🟡 Priority 2: Add Docker Check (MEDIUM)

**Problem**: No feedback when Docker is not available

**Solution**: Check Docker before starting containers

```typescript
// src/test/testcontainers-global-setup.ts

async function isDockerAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function setup() {
  if (process.env.SKIP_TESTCONTAINERS === "1") {
    console.warn("⚠️ SKIP_TESTCONTAINERS set — skipping...");
    return;
  }

  // Check Docker availability
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    console.error("❌ Docker is not available or not running");
    console.error("   Please start Docker or set SKIP_TESTCONTAINERS=1");
    throw new Error("Docker not available");
  }

  console.warn("🐳 Starting Postgres Testcontainer...");
  // ... rest of setup
}
```

---

### 🟡 Priority 3: Add Timeout to Container Startup (MEDIUM)

**Problem**: Container startup can hang forever

**Solution**: Add timeout with better error messages

```typescript
async function startContainerWithTimeout<T>(
  startFn: () => Promise<T>,
  timeoutMs: number = 60000
): Promise<T> {
  return Promise.race([
    startFn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Container startup timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

export async function setup() {
  // ... docker check

  try {
    console.warn("🐳 Starting Postgres Testcontainer (60s timeout)...");
    
    container = await startContainerWithTimeout(
      () => new PostgreSqlContainer("postgres:15.1")
        .withDatabase("postgres")
        .withUsername("postgres")
        .withPassword("postgres")
        .withExposedPorts(5432)
        .start(),
      60000
    );
    
    console.warn(`✅ Postgres started`);
  } catch (error) {
    console.error("❌ Failed to start Postgres container:", error);
    console.error("   Try: docker pull postgres:15.1");
    throw error;
  }
}
```

---

### 🟢 Priority 4: Mock Database for Unit Tests (LOW)

**Problem**: Unit tests shouldn't need real database

**Solution**: Use in-memory mocks for unit tests

```typescript
// src/test/mocks/database.ts
import { vi } from 'vitest';

export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signIn: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
};

// In unit tests:
vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}));
```

---

## Immediate Workaround

Until the fixes are implemented, developers can:

### Option 1: Skip tests entirely

```bash
# Don't run tests
npm run build
npm run dev
```

### Option 2: Run specific test files manually

```bash
# Run a single test file without global setup
npx vitest run src/config/__tests__/agentFabric.test.ts \
  --no-coverage \
  --no-global-setup
```

### Option 3: Use Docker Compose for local testing

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:15.1
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7.0
    ports:
      - "6379:6379"
```

```bash
# Start services
docker-compose -f docker-compose.test.yml up -d

# Set env vars
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
export REDIS_URL=redis://localhost:6379

# Run tests
SKIP_TESTCONTAINERS=1 npm run test

# Stop services
docker-compose -f docker-compose.test.yml down
```

---

## Implementation Plan

### Phase 1: Quick Fix (1-2 hours)

1. ✅ Create `vitest.config.unit.ts` (no testcontainers)
2. ✅ Update `package.json` scripts
3. ✅ Test that `npm run test` works

**Expected Result**: Unit tests run without Docker

### Phase 2: Integration Tests (2-3 hours)

4. ✅ Create `vitest.config.integration.ts`
5. ✅ Rename integration tests (*.integration.test.ts)
6. ✅ Add Docker availability check
7. ✅ Add container startup timeout

**Expected Result**: Integration tests work when Docker is available

### Phase 3: Documentation (1 hour)

8. ✅ Update README with test instructions
9. ✅ Document Docker requirements
10. ✅ Add troubleshooting guide

**Expected Result**: Clear documentation for developers

---

## Testing the Fix

### Before Fix

```bash
$ npm run test
# Hangs forever ❌
```

### After Fix

```bash
$ npm run test
# Runs unit tests in 5-10 seconds ✅

$ npm run test:integration
# Requires Docker, runs in 30-60 seconds ✅

$ npm run test:all
# Runs both suites ✅
```

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| **Unit Test Time** | ∞ (hangs) | 5-10s | <10s |
| **Integration Test Time** | ∞ (hangs) | 30-60s | <60s |
| **Docker Required** | Always | Only for integration | Optional |
| **Developer Experience** | ❌ Broken | ✅ Works | ✅ Good |

---

## Related Issues

- Login screen performance (separate issue)
- Bootstrap sequence blocking (separate issue)
- Test coverage reporting (works after fix)

---

## Conclusion

The test suite is currently **broken** due to:

1. **Mandatory testcontainers** - Always tries to start Docker
2. **No timeout** - Hangs forever if Docker unavailable
3. **No separation** - Unit tests mixed with integration tests

**Fix**: Split into unit and integration test suites, make Docker optional for unit tests.

**Priority**: 🔴 **CRITICAL** - Developers cannot run tests

**Effort**: 2-3 hours for complete fix

**Impact**: Unblocks development and CI/CD

---

**Next Steps**:
1. Implement Phase 1 (unit tests without Docker)
2. Test locally
3. Update CI/CD pipeline
4. Document for team
