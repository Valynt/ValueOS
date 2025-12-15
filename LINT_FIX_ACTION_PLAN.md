# Lint Fix Action Plan - Comprehensive Remediation

**Date**: 2025-12-13  
**Status**: 🔴 IN PROGRESS

## Current State

**Total Problems**: 3,356

- **Errors**: 609 (MUST FIX)
- **Warnings**: 2,747 (SHOULD FIX)

### Breakdown by Rule

| Rule                                    | Count | Type    | Priority |
| --------------------------------------- | ----- | ------- | -------- |
| `@typescript-eslint/no-explicit-any`    | 2,164 | Warning | 🔴 P0    |
| `@typescript-eslint/no-unused-vars`     | 466   | Warning | 🔴 P0    |
| `jsx-a11y/*` (accessibility)            | ~300  | Error   | 🟡 P1    |
| `@typescript-eslint/no-require-imports` | 16    | Warning | 🟢 P2    |
| `@typescript-eslint/ban-ts-comment`     | 10    | Warning | 🟢 P2    |
| Other                                   | ~400  | Mixed   | 🟡 P1    |

## Execution Strategy

### Phase 1: Fix Blocking Errors (609 errors) - Priority P0

**Timeline**: 1-2 days  
**Goal**: Zero errors, build passes with strict rules

#### 1.1 Accessibility Errors (~300 errors)

**Files**: Components with form controls, interactive elements

**Common Issues**:

```tsx
// ❌ Error: control-has-associated-label
<input type="text" />

// ✅ Fix: Add aria-label or associated label
<input type="text" aria-label="Search" />
// OR
<label htmlFor="search">Search</label>
<input type="text" id="search" />
```

**Action**: Systematic fix with proper labels

#### 1.2 Static Element Interactions (~100 errors)

```tsx
// ❌ Error: no-static-element-interactions
<div onClick={handleClick}>Click me</div>

// ✅ Fix: Use button or add keyboard handler
<button onClick={handleClick}>Click me</button>
// OR
<div
  onClick={handleClick}
  onKeyPress={handleKeyPress}
  role="button"
  tabIndex={0}
>
  Click me
</div>
```

#### 1.3 Case Declarations (~50 errors)

```typescript
// ❌ Error: no-case-declarations
switch (type) {
  case "A":
    const value = getValue();
    break;
}

// ✅ Fix: Wrap in block
switch (type) {
  case "A": {
    const value = getValue();
    break;
  }
}
```

#### 1.4 React Hooks Dependencies (~50 errors)

```tsx
// ❌ Error: exhaustive-deps
useEffect(() => {
  fetchData();
}, []); // Missing fetchData dependency

// ✅ Fix: Add dependency or use useCallback
const fetchData = useCallback(() => {
  // ...
}, []);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

### Phase 2: Fix `any` Types (2,164 warnings) - Priority P0

**Timeline**: 2-3 days  
**Goal**: Type-safe codebase

#### 2.1 API Layer (Day 1)

**Files**: `src/api/**/*.ts`  
**Count**: ~300 instances

**Pattern**:

```typescript
// ❌ Before
export async function handleRequest(req: any, res: any) {
  const data = req.body;
  return res.json(data);
}

// ✅ After
import { Request, Response } from "express";

export async function handleRequest(
  req: Request,
  res: Response,
): Promise<void> {
  const data = req.body;
  res.json(data);
}
```

#### 2.2 Services Layer (Day 2)

**Files**: `src/services/**/*.ts`  
**Count**: ~400 instances

**Pattern**:

```typescript
// ❌ Before
async function processWorkflow(context: any) {
  return context.data;
}

// ✅ After
interface WorkflowContext {
  workflowId: string;
  userId: string;
  data: Record<string, unknown>;
}

async function processWorkflow(context: WorkflowContext) {
  return context.data;
}
```

#### 2.3 Components Layer (Day 3)

**Files**: `src/components/**/*.tsx`  
**Count**: ~500 instances

**Pattern**:

```tsx
// ❌ Before
interface Props {
  data: any;
  onUpdate: (value: any) => void;
}

// ✅ After
interface WorkflowData {
  id: string;
  name: string;
  status: "pending" | "running" | "complete";
}

interface Props {
  data: WorkflowData;
  onUpdate: (value: WorkflowData) => void;
}
```

#### 2.4 Test Files (Day 4)

**Files**: `src/**/*.test.ts`, `src/**/*.test.tsx`  
**Count**: ~500 instances

**Pattern**:

```typescript
// ❌ Before
const mockData: any = { id: "123" };

// ✅ After
const mockData: Partial<WorkflowData> = { id: "123" };
// OR
const mockData = { id: "123" } as const;
```

#### 2.5 Utilities & Lib (Day 5)

**Files**: `src/lib/**/*.ts`, `src/utils/**/*.ts`  
**Count**: ~400 instances

### Phase 3: Fix Unused Variables (466 warnings) - Priority P0

**Timeline**: 1 day  
**Goal**: Clean, intentional code

#### 3.1 Remove Truly Unused Variables

```typescript
// ❌ Before
const userId = await getUserId(); // Never used
const result = await query(); // Never used

// ✅ After
// Remove if truly unused
// OR prefix with _ if intentionally unused
const _userId = await getUserId(); // Kept for side effects
```

#### 3.2 Fix Unused Function Parameters

```typescript
// ❌ Before
function handler(req: Request, res: Response, next: NextFunction) {
  // next is never used
}

// ✅ After
function handler(req: Request, res: Response, _next: NextFunction) {
  // Prefix with _ to indicate intentionally unused
}
```

#### 3.3 Remove Unused Imports

```typescript
// ❌ Before
import { useState, useEffect, useMemo } from "react";
// Only useState is used

// ✅ After
import { useState } from "react";
```

### Phase 4: Fix Remaining Issues - Priority P1-P2

**Timeline**: 1 day

#### 4.1 require() Imports (16 instances)

```typescript
// ❌ Before
const module = require("./module");

// ✅ After
import module from "./module";
```

#### 4.2 @ts-comment Suppressions (10 instances)

```typescript
// ❌ Before
// @ts-ignore
const value = dangerousOperation();

// ✅ After
// Fix the actual type issue
const value = dangerousOperation() as ExpectedType;
// OR add proper type assertion with explanation
const value = dangerousOperation() as unknown as ExpectedType; // Explanation why
```

## Implementation Plan

### Day 1: Accessibility Errors + API Layer `any`

**Morning** (4 hours):

- Fix all `control-has-associated-label` errors
- Fix all `label-has-associated-control` errors
- Fix all `click-events-have-key-events` errors

**Afternoon** (4 hours):

- Replace `any` in `src/api/**/*.ts`
- Create proper type definitions
- Test API endpoints

**Target**: 300 errors → 100 errors

### Day 2: Services Layer `any` + React Hooks

**Morning** (4 hours):

- Replace `any` in `src/services/**/*.ts`
- Create interface definitions
- Fix orchestrator types

**Afternoon** (4 hours):

- Fix React hooks dependency warnings
- Fix case declaration errors
- Fix static element interaction errors

**Target**: 100 errors → 0 errors ✅

### Day 3: Components Layer `any`

**All Day** (8 hours):

- Replace `any` in `src/components/**/*.tsx`
- Create proper prop interfaces
- Fix component type safety

**Target**: 2,164 `any` → 1,200 `any`

### Day 4: Test Files `any`

**All Day** (8 hours):

- Replace `any` in test files
- Use proper mock types
- Create test fixtures with types

**Target**: 1,200 `any` → 500 `any`

### Day 5: Utilities + Unused Variables

**Morning** (4 hours):

- Replace `any` in `src/lib/**/*.ts`
- Replace `any` in `src/utils/**/*.ts`

**Afternoon** (4 hours):

- Remove unused variables
- Prefix intentionally unused with `_`
- Remove unused imports

**Target**: 500 `any` → 0 `any` ✅, 466 unused → 0 unused ✅

### Day 6: Remaining Issues + CI Setup

**Morning** (4 hours):

- Fix require() imports
- Fix @ts-comment suppressions
- Fix any remaining issues

**Afternoon** (4 hours):

- Restore ESLint rules to 'error'
- Set up CI lint gates
- Enable stricter TypeScript rules
- Verify build passes

**Target**: 0 errors, 0 warnings ✅

## CI/CD Integration

### ESLint CI Gate

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run lint
        # This will fail if ANY errors exist
```

### Stricter TypeScript Rules

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Restored ESLint Rules

```javascript
// eslint.config.js
export default [
  {
    rules: {
      // Restore to errors
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
];
```

## Progress Tracking

### Daily Checklist

**Day 1**:

- [ ] Fix accessibility errors (300 → 0)
- [ ] Fix API layer `any` types (~300)
- [ ] Commit: "fix: resolve accessibility errors and API type safety"

**Day 2**:

- [ ] Fix Services layer `any` types (~400)
- [ ] Fix React hooks dependencies
- [ ] Fix remaining errors (100 → 0)
- [ ] Commit: "fix: resolve services type safety and remaining errors"

**Day 3**:

- [ ] Fix Components layer `any` types (~500)
- [ ] Commit: "fix: improve component type safety"

**Day 4**:

- [ ] Fix Test files `any` types (~500)
- [ ] Commit: "fix: improve test type safety"

**Day 5**:

- [ ] Fix Utilities/Lib `any` types (~400)
- [ ] Fix unused variables (466 → 0)
- [ ] Commit: "fix: complete type safety and remove unused code"

**Day 6**:

- [ ] Fix remaining issues
- [ ] Restore ESLint rules to 'error'
- [ ] Set up CI lint gates
- [ ] Enable stricter TypeScript
- [ ] Commit: "chore: restore strict linting and enable CI gates"

## Success Criteria

**Phase 1 Complete**:

- [ ] Zero ESLint errors
- [ ] Build passes
- [ ] Tests pass

**Phase 2 Complete**:

- [ ] Zero `any` types in production code
- [ ] All types properly defined
- [ ] IDE autocomplete works everywhere

**Phase 3 Complete**:

- [ ] Zero unused variables
- [ ] All imports necessary
- [ ] Code intent clear

**Phase 4 Complete**:

- [ ] Zero warnings
- [ ] ESLint rules restored to 'error'
- [ ] CI gates active
- [ ] TypeScript strict mode enabled

## Estimated Timeline

**Option 2 (Recommended)**: 2-3 days

- Day 1: Errors + Critical `any` types
- Day 2: Services + Remaining errors
- Day 3: Unused variables + CI setup
- **Result**: 609 errors → 0, ~1,000 `any` → ~500

**Option 3 (Comprehensive)**: 5-6 days

- Days 1-2: All errors
- Days 3-5: All `any` types
- Day 6: Unused variables + CI setup
- **Result**: 3,356 problems → 0

## Next Steps

1. **Immediate**: Start Day 1 execution
2. **Daily**: Commit progress, run tests
3. **End of Day 2**: Decision point - continue or ship
4. **End of Day 6**: Production-grade codebase

## Accountability

**Owner**: Engineering team  
**Reviewer**: Tech lead  
**Timeline**: 6 days maximum  
**No exceptions**: Quality is non-negotiable
