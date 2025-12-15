# Week 2, Day 1-2: Lint Error Fixes

**Date**: 2025-12-13  
**Status**: 🟡 In Progress

## Current State

**Total Problems**: 3,413
- **Errors**: 1,154
- **Warnings**: 2,259

## Problem Categories

### 1. TypeScript `any` Types (2,259 warnings)
**Impact**: Type safety compromised  
**Priority**: P1 (High)

**Common Patterns**:
```typescript
// Bad
function process(data: any) { }
const result: any = getValue();

// Good
function process(data: unknown) { }
const result: string | number = getValue();
```

**Strategy**:
- Replace `any` with `unknown` for truly dynamic types
- Use proper type definitions for known structures
- Add type guards where needed
- Use generics for reusable functions

### 2. Console Statements (10+ errors)
**Impact**: Production logging issues  
**Priority**: P0 (Critical)

**Files**:
- `tests/performance/performance-benchmarks.ts` (10 console.log statements)

**Strategy**:
- Replace `console.log` with `logger.info`
- Replace `console.debug` with `logger.debug`
- Keep `console.warn` and `console.error` (allowed by lint rules)

### 3. Unused Variables (Multiple errors)
**Impact**: Dead code  
**Priority**: P2 (Medium)

**Examples**:
- `agentMemory` in `tests/performance/performance-benchmarks.ts`

**Strategy**:
- Remove unused imports
- Remove unused variables
- Prefix intentionally unused variables with `_`

### 4. `Function` Type Usage (4+ errors)
**Impact**: Type safety compromised  
**Priority**: P1 (High)

**Pattern**:
```typescript
// Bad
const callback: Function = () => {};

// Good
const callback: () => void = () => {};
const callback: (arg: string) => number = (arg) => {};
```

## Systematic Fix Plan

### Phase 1: Critical Errors (Day 1 Morning)
**Target**: Fix all blocking errors (1,154 → 0)

1. **Console Statements** (10 errors)
   - File: `tests/performance/performance-benchmarks.ts`
   - Action: Replace with logger calls
   - Time: 15 minutes

2. **Unused Variables** (50+ errors)
   - Action: Remove or prefix with `_`
   - Time: 30 minutes

3. **Function Type** (4+ errors)
   - Action: Replace with proper function signatures
   - Time: 20 minutes

4. **Other Blocking Errors** (1,090 errors)
   - Review and categorize
   - Fix systematically by file
   - Time: 3-4 hours

### Phase 2: High-Priority Warnings (Day 1 Afternoon)
**Target**: Fix `any` types in critical paths (2,259 → 1,000)

1. **API Layer** (Priority 1)
   - Files: `src/api/**/*.ts`
   - Focus: Request/response types
   - Time: 2 hours

2. **Services Layer** (Priority 2)
   - Files: `src/services/**/*.ts`
   - Focus: Business logic types
   - Time: 2 hours

3. **Components** (Priority 3)
   - Files: `src/components/**/*.tsx`
   - Focus: Props and state types
   - Time: 2 hours

### Phase 3: Remaining Warnings (Day 2)
**Target**: Fix remaining `any` types (1,000 → 0)

1. **Test Files**
   - Files: `src/**/*.test.ts`, `tests/**/*.ts`
   - Strategy: Use proper mock types
   - Time: 3 hours

2. **Utilities**
   - Files: `src/utils/**/*.ts`, `src/lib/**/*.ts`
   - Strategy: Add proper type definitions
   - Time: 2 hours

3. **Configuration**
   - Files: `src/config/**/*.ts`
   - Strategy: Define config interfaces
   - Time: 1 hour

## Automated Fixes

### Script 1: Replace Console Statements
```bash
#!/bin/bash
# fix-console-logs.sh

find src tests -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i 's/console\.log(/logger.info(/g' "$file"
  sed -i 's/console\.debug(/logger.debug(/g' "$file"
done
```

### Script 2: Remove Unused Imports
```bash
#!/bin/bash
# remove-unused-imports.sh

npx ts-unused-exports tsconfig.json --excludePathsFromReport="test;spec"
```

### Script 3: Find and Fix `any` Types
```bash
#!/bin/bash
# find-any-types.sh

# Find all `any` usages
grep -r ": any" src/ --include="*.ts" --include="*.tsx" | wc -l

# Generate report
grep -r ": any" src/ --include="*.ts" --include="*.tsx" > any-types-report.txt
```

## Progress Tracking

### Day 1 Morning (4 hours)
- [ ] Fix console statements (10 errors)
- [ ] Fix unused variables (50+ errors)
- [ ] Fix Function types (4+ errors)
- [ ] Fix remaining blocking errors (1,090 errors)
- **Target**: 0 errors

### Day 1 Afternoon (6 hours)
- [ ] Fix API layer `any` types
- [ ] Fix Services layer `any` types
- [ ] Fix Components `any` types
- **Target**: <1,000 warnings

### Day 2 (6 hours)
- [ ] Fix test file `any` types
- [ ] Fix utility `any` types
- [ ] Fix configuration `any` types
- **Target**: 0 warnings

## Success Criteria

- [ ] Zero lint errors
- [ ] <100 lint warnings (stretch: 0)
- [ ] All console.log replaced with logger
- [ ] No `Function` types
- [ ] No unused variables
- [ ] Build succeeds
- [ ] Tests pass

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking changes from type fixes | Run tests after each batch of fixes |
| Time overrun | Prioritize errors over warnings |
| Regression | Commit frequently, test incrementally |

## Tools

- ESLint with TypeScript plugin
- `ts-unused-exports` for dead code
- `grep` for pattern finding
- Git for incremental commits

## Next Steps

1. Start with Phase 1 (critical errors)
2. Commit after each category of fixes
3. Run tests to verify no regressions
4. Move to Phase 2 (high-priority warnings)
5. Document any patterns that need architectural changes
