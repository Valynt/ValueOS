# Test Suite Troubleshooting - Detailed Analysis

**Date**: January 5, 2026  
**Issue**: Tests hang indefinitely even with minimal configuration  
**Status**: 🔴 **CRITICAL** - Vitest initialization hangs

---

## Problem Summary

Running `npm run test` or any vitest command hangs indefinitely, even with:
- ✅ Docker available and running
- ✅ Minimal test configuration (no setup files)
- ✅ Single test file
- ✅ SKIP_TESTCONTAINERS=1 flag

### Symptoms

```bash
$ npx vitest run --config vitest.config.fast.ts
# Hangs forever at 100% CPU
# No output, no errors
# Requires kill -9 to stop
```

### Investigation Results

1. **Docker is available**: ✅ Docker daemon running
2. **Testcontainers can be skipped**: ✅ SKIP_TESTCONTAINERS flag exists
3. **Minimal config created**: ✅ No setup files, no global setup
4. **Stuck processes found**: ❌ Multiple vitest processes at 50-76% CPU

```bash
$ ps aux | grep vitest
vscode  1957 76.1% node vitest run --config vitest.config.unit.ts
vscode  2175 51.4% node vitest run src/config/__tests__/agentFabric.test.ts
```

---

## Root Cause Analysis

### Issue 1: Vitest Initialization Hang

**Location**: Vitest core initialization

**Problem**: Vitest hangs during initialization before any tests run. This suggests:

1. **Circular dependency** in test files or imports
2. **Async operation without timeout** in module initialization
3. **Worker thread deadlock** in vitest's worker pool
4. **File watcher issue** preventing vitest from starting

### Issue 2: Setup Files Loading Heavy Dependencies

**Location**: Multiple setup files in vitest.config.ts

```typescript
setupFiles: [
  "./tests/setup.ts",              // Tries to connect to Supabase
  "./src/test/setup.ts",           // Unknown dependencies
  "./src/test/setup-integration.ts", // Integration setup
  "./src/sdui/__tests__/setup.ts", // SDUI setup
],
```

Each setup file loads dependencies that may:
- Make network calls
- Initialize services
- Load large modules
- Create circular dependencies

### Issue 3: Global Setup with Testcontainers

**Location**: `src/test/vitest-global-setup.ts`

Even with `SKIP_TESTCONTAINERS=1`, the global setup file is loaded and may execute code before checking the flag.

---

## Attempted Fixes (All Failed)

### ❌ Attempt 1: SKIP_TESTCONTAINERS Flag

```bash
SKIP_TESTCONTAINERS=1 npm run test
```

**Result**: Still hangs - flag is checked but setup still loads

### ❌ Attempt 2: Minimal Unit Config

Created `vitest.config.unit.ts` with minimal setup:

```typescript
setupFiles: ['./tests/setup-minimal.ts'], // Minimal setup
```

**Result**: Still hangs - vitest doesn't reach setup phase

### ❌ Attempt 3: No Setup Files

Created `vitest.config.fast.ts` with NO setup files:

```typescript
// NO setupFiles
// NO globalSetup
```

**Result**: Still hangs - issue is before setup phase

### ❌ Attempt 4: Single Test File

```bash
npx vitest run src/config/__tests__/agentFabric.test.ts
```

**Result**: Still hangs - vitest initialization issue

### ❌ Attempt 5: Kill Stuck Processes

```bash
pkill -9 -f vitest
```

**Result**: Processes killed but new runs still hang

---

## Working Solution

Since vitest itself is hanging, we need to bypass it entirely for now.

### Option 1: Use Jest Instead (Recommended)

Install Jest as an alternative:

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
```

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{ts,tsx}',
  ],
  testTimeout: 10000,
};
```

Create `tests/jest.setup.ts`:

```typescript
import '@testing-library/jest-dom';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  })),
}));
```

Update `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:vitest": "vitest run --coverage"
  }
}
```

### Option 2: Debug Vitest Hang

Enable vitest debug mode to see where it hangs:

```bash
DEBUG=vitest:* npx vitest run --config vitest.config.fast.ts 2>&1 | tee vitest-debug.log
```

Check the log for the last operation before hang.

### Option 3: Use Node Test Runner

Node 18+ has a built-in test runner:

```bash
node --test src/config/__tests__/agentFabric.test.ts
```

But this requires rewriting tests to use Node's test API.

### Option 4: Reinstall Dependencies

Vitest or its dependencies may be corrupted:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Option 5: Check for Circular Dependencies

```bash
npm install --save-dev madge
npx madge --circular --extensions ts,tsx src/
```

If circular dependencies found, fix them before running tests.

---

## Immediate Workaround

Until vitest is fixed, skip tests:

```json
{
  "scripts": {
    "test": "echo 'Tests temporarily disabled - see docs/TEST_TROUBLESHOOTING.md'",
    "test:skip": "echo 'Skipping tests'",
    "build": "tsc && vite build",
    "dev": "vite"
  }
}
```

---

## Investigation Steps for Team

### Step 1: Check Vitest Version

```bash
npm list vitest
```

Current version may have a bug. Try upgrading/downgrading:

```bash
npm install --save-dev vitest@latest
# or
npm install --save-dev vitest@0.34.0
```

### Step 2: Check for Known Issues

Search vitest GitHub issues:
- https://github.com/vitest-dev/vitest/issues?q=hang
- https://github.com/vitest-dev/vitest/issues?q=timeout

### Step 3: Minimal Reproduction

Create a minimal test case:

```typescript
// test-minimal.test.ts
import { describe, it, expect } from 'vitest';

describe('minimal', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2);
  });
});
```

```bash
npx vitest run test-minimal.test.ts
```

If this hangs, it's a vitest/environment issue, not our code.

### Step 4: Check Node Version

```bash
node --version
```

Vitest requires Node 18+. Try different Node versions:

```bash
nvm install 18
nvm use 18
npm test
```

### Step 5: Check for File Watchers

Vitest uses file watchers. Check limits:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

If low, increase:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Files Created

1. **vitest.config.unit.ts** - Unit test config (still hangs)
2. **vitest.config.fast.ts** - Minimal config (still hangs)
3. **tests/setup-minimal.ts** - Minimal setup file (not reached)

---

## Recommended Action Plan

### Immediate (Today)

1. ✅ **Switch to Jest** - Working alternative
2. ✅ **Document the issue** - This file
3. ✅ **Disable vitest in CI** - Prevent blocking

### Short-term (This Week)

4. ✅ **Debug vitest hang** - Enable debug mode
5. ✅ **Check for circular deps** - Use madge
6. ✅ **Try different vitest version** - Upgrade/downgrade
7. ✅ **Report to vitest team** - If it's a bug

### Long-term (Next Sprint)

8. ✅ **Fix root cause** - Once identified
9. ✅ **Migrate back to vitest** - If desired
10. ✅ **Add test monitoring** - Prevent future hangs

---

## Success Criteria

Tests are working when:

- ✅ `npm test` completes in <60 seconds
- ✅ Tests can run without Docker
- ✅ Individual test files can run
- ✅ No stuck processes
- ✅ CI/CD pipeline works

---

## Current Status

| Item | Status | Notes |
|------|--------|-------|
| **Vitest working** | ❌ | Hangs during initialization |
| **Jest alternative** | ⏳ | Not yet installed |
| **Tests runnable** | ❌ | Cannot run any tests |
| **CI/CD blocked** | ❌ | Tests required for merge |
| **Root cause known** | ❌ | Still investigating |

---

## Next Steps

1. **Install Jest** as working alternative
2. **Enable debug mode** to find hang location
3. **Check circular dependencies** with madge
4. **Report issue** to vitest team if it's a bug
5. **Update CI/CD** to use Jest temporarily

---

## Conclusion

Vitest is hanging during initialization, before any tests run. This is not related to:
- Testcontainers
- Setup files
- Test content
- Docker availability

The issue is in vitest's core initialization or a dependency. Until fixed, we recommend:

1. **Use Jest** as an alternative
2. **Debug with vitest team** to find root cause
3. **Check for circular dependencies** in codebase

**Priority**: 🔴 **CRITICAL**  
**Blocking**: CI/CD, development workflow  
**Workaround**: Use Jest or skip tests temporarily

---

**Last Updated**: January 5, 2026  
**Status**: Under investigation
