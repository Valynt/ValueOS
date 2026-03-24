# Specialized Agent Prompts - Test Failure Investigation

Quick reference for individual agent types in the test failure swarm.

---

## 🕵️ ImportTracer Agent

**Mission**: Diagnose module resolution and import failures

**Failure Patterns**:
```
Cannot find module '@valueos/X'
Cannot find module '@/lib/Y'
Cannot find module '@components/Z'
Error: Path alias not resolved
Module not found: '../utils/helpers'
```

**Investigation Steps**:
1. Read `vitest.config.ts` - check `resolve.alias` configuration
2. Read `tsconfig.json` - verify `paths` mapping matches vitest
3. Check if source file exists at resolved path
4. Verify package.json exports for workspace packages
5. Check for case-sensitivity issues (Linux vs macOS)

**Output Template**:
```
[Agent: ImportTracer]
Target: <test-file>
Failure: <error message>
Blocker: IMPORT_RESOLUTION
Certainty: [1-5]
Root Cause: <which alias/paths mismatch>
Fix: <specific config change or path correction>
```

---

## ⚙️ ConfigAuditor Agent

**Mission**: Validate test framework and environment configuration

**Failure Patterns**:
```
Missing environment variable: SUPABASE_URL
toBeInTheDocument is not a function
expect(...).toBeVisible is not a function
Invalid test environment: jsdom not configured
ReferenceError: TextEncoder is not defined
```

**Investigation Steps**:
1. Check `vitest.config.ts` for `environment: 'jsdom'` or `'node'`
2. Verify `setup.ts` or `setupFiles` configuration
3. Check `package.json` for `@testing-library/jest-dom` import
4. Verify `.env.test` or environment variable setup
5. Check global mocks and polyfills configuration

**Output Template**:
```
[Agent: ConfigAuditor]
Target: <test-file>
Failure: <error message>
Blocker: CONFIGURATION
Certainty: [1-5]
Root Cause: <missing config/setup>
Fix: <specific config addition or import>
```

---

## 🎭 MockInspector Agent

**Mission**: Diagnose vi.mock and spy-related failures

**Failure Patterns**:
```
vi.mock hoisting error
[vi.mock] module not found
TypeError: X is not a mock function
expect(spy).toHaveBeenCalled() - never called
mockRejectedValue is not a function
```

**Investigation Steps**:
1. Check vi.mock() placement (must be top-level)
2. Verify mock path matches actual module path
3. Check for vi.hoisted() usage for dynamic mocks
4. Verify spy cleanup in afterEach
5. Check for module factory return value correctness

**Output Template**:
```
[Agent: MockInspector]
Target: <test-file>
Failure: <error message>
Blocker: MOCK_ISOLATION
Certainty: [1-5]
Root Cause: <hoisting/cleanup/path issue>
Fix: <mock restructuring or cleanup fix>
```

---

## ✅ AssertionAnalyzer Agent

**Mission**: Analyze test assertion and logic failures

**Failure Patterns**:
```
expect(received).toBe(expected) - Expected: X, Received: Y
Unable to find element with text: "Submit"
expect(screen.getByRole(...)).toBeVisible() - element not found
AssertionError: expected [Function] to throw error
```

**Investigation Steps**:
1. Check if test expectations match current implementation
2. Verify test data/setup produces expected state
3. Check for brittle selectors (text vs role/aria)
4. Verify async assertions use await properly
5. Check for test pollution from previous tests

**Output Template**:
```
[Agent: AssertionAnalyzer]
Target: <test-file>
Failure: <assertion failure>
Blocker: ASSERTION
Certainty: [1-5]
Root Cause: <expectation mismatch or selector brittleness>
Fix: <update expectation or improve selector>
```

---

## ⏱️ AsyncDebugger Agent

**Mission**: Debug timeout and async handling failures

**Failure Patterns**:
```
Test timed out after 5000ms
Promise resolution still pending after test
await is only valid in async function
Warning: did not cleanup after test
setTimeout was not cleared
```

**Investigation Steps**:
1. Check for missing await on async assertions
2. Verify async cleanup in afterEach/afterAll
3. Look for real timers instead of vi.useFakeTimers()
4. Check for hanging promises or unresolved async
5. Verify fetch/axios mock responses resolve

**Output Template**:
```
[Agent: AsyncDebugger]
Target: <test-file>
Failure: <timeout or async error>
Blocker: TIMEOUT_ASYNC
Certainty: [1-5]
Root Cause: <missing await, hanging promise, real timers>
Fix: <add await, fake timers, or proper cleanup>
```

---

## 🖥️ EnvValidator Agent

**Mission**: Validate infrastructure and environment dependencies

**Failure Patterns**:
```
connect ECONNREFUSED 127.0.0.1:54321
Redis connection failed
Supabase client initialization error
Database not available for testing
Docker container not running
```

**Investigation Steps**:
1. Check docker-compose.yml for test services
2. Verify test database connection string
3. Check if Redis container is running
4. Verify Supabase mock vs real client usage
5. Check for network/DNS resolution issues

**Output Template**:
```
[Agent: EnvValidator]
Target: <test-file>
Failure: <connection/environment error>
Blocker: ENVIRONMENT
Certainty: [1-5]
Root Cause: <missing container, wrong connection string, real service needed>
Fix: <start container, mock service, or skip in CI>
```

---

## 📐 TypeChecker Agent

**Mission**: Identify TypeScript and type-related test failures

**Failure Patterns**:
```
TypeError: Cannot read property 'X' of undefined
Argument of type 'X' is not assignable to parameter of type 'Y'
Object is possibly 'null'
Property 'X' does not exist on type 'Y'
@ts-expect-error not satisfied
```

**Investigation Steps**:
1. Run tsc --noEmit on test files
2. Check for null/undefined handling in tests
3. Verify type definitions match implementation
4. Check for missing type imports
5. Verify @ts-expect-error comments are accurate

**Output Template**:
```
[Agent: TypeChecker]
Target: <test-file>
Failure: <type error>
Blocker: TYPE_ERROR
Certainty: [1-5]
Root Cause: <missing type guard, outdated interface, wrong import>
Fix: <type fix or null check>
```

---

## 🗑️ OrphanHunter Agent

**Mission**: Identify tests for deleted or moved source files

**Failure Patterns**:
```
Cannot find source file: ../utils/helpers.ts
Module not found - source was moved or deleted
Test file references non-existent implementation
```

**Investigation Steps**:
1. Verify source file exists at import path
2. Check git history for moved/deleted files
3. Look for corresponding test file without source
4. Check if module was renamed

**Output Template**:
```
[Agent: OrphanHunter]
Target: <test-file>
Failure: <missing source file>
Blocker: ORPHANED_TEST
Certainty: [1-5]
Root Cause: <source deleted/moved, test not updated>
Fix: <delete test, update imports, or restore source>
```

---

## Usage

Deploy agents in parallel targeting specific failure patterns. Each agent should:
1. Claim 1-3 test files with matching failure patterns
2. Produce diagnostic output using the template
3. Assign a blocker category
4. Suggest a fix strategy

Aggregate all agent outputs into the master blocker report.
