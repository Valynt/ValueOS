# DX Import Strategy & Resolution

## Current State

The repository has **285+ unresolved relative imports** - files that are imported but don't exist in the filesystem.

This is NOT a build configuration issue. It's a **missing implementation problem**.

## Critical Rule: NO STUBS ALLOWED

Creating stub files (empty implementations) is **permanently forbidden**:
- ❌ Hides broken imports from detection  
- ❌ Creates false sense of progress
- ❌ Spreads problems across 200+ files
- ❌ Prevents proper refactoring
- ❌ Breaks CI validation

## The Three Proper Solutions

### 1. Implement Missing Files

If a module is imported but doesn't exist, **create the real implementation**:

```typescript
// packages/backend/src/repositories/WorkflowStateRepository.ts
export class WorkflowStateRepository {
  async getState(workflowId: string) {
    // Real implementation here
  }
}
```

### 2. Create Barrel Exports + Compat Re-exports

If the file exists but at the wrong path:

```typescript
// packages/backend/src/repositories/index.ts (barrel)
export { WorkflowStateRepository } from './WorkflowStateRepository';
```

Then re-export at the legacy path:

```typescript
// packages/backend/src/lib/repositories/WorkflowStateRepository.ts
export * from '../../repositories/WorkflowStateRepository';
```

### 3. Configure Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@repositories/*": ["packages/backend/src/repositories/*"],
      "@types/*": ["packages/backend/src/types/*"]
    }
  }
}
```

## Permanent Safeguards (In Place)

**ESLint Rules** (`eslint.config.js`)
- `import/no-unresolved`: Errors on missing imports
- Prevents broken code from being written

**Pre-commit Hook** (`.git/hooks/pre-commit`)
- Blocks commits with unresolved imports
- Prevents code from reaching repository

**CI Validation** (`.github/workflows/dx-e2e.yml`)  
- Strict import checking on every PR
- Fails loudly with guidance
- Zero tolerance for unresolved imports

**Stub Creator** (`scripts/dx/create-missing-stubs.ts`)
- Permanently disabled with exit code 1
- No environment override possible
- Clear error message on any attempt

## How to Fix a Specific Module

Example: Fix `packages/backend/src/types/workflow.ts` (unresolved)

```bash
# 1. Find all imports of this module
grep -r "from.*types/workflow" packages/backend/src

# 2. Decide: Does this functionality belong in the codebase?
#    YES → Implement it
#    NO / Moved → Create compat re-export

# 3a. Implement:
cat > packages/backend/src/types/workflow.ts << 'EOF'
export interface Workflow {
  id: string;
  name: string;
  state: WorkflowState;
}

export type WorkflowState = 'draft' | 'active' | 'archived';
EOF

# 3b. OR Alias (if moved elsewhere):
cat > packages/backend/src/types/workflow.ts << 'EOF'
export * from '../../models/Workflow';  // Real location
EOF

# 4. Verify:
pnpm run dx:validate-imports
```

## Timeline to Full Resolution

**Current**: 285+ unresolved imports  
**Goal**: 0 unresolved imports

**Effort estimate:**
- Top 10 (most critical): 2-3 hrs each = 30 hrs
- Next 30: 1 hr each = 30 hrs  
- Remaining 200+: 15 min each = 50 hrs
- **Total: ~110 hours**

**Recommended pace:**
- Fix 3-5 modules per day
- ~20 days to complete
- Verify with `pnpm run dx:validate-imports` after each fix

## Reference Commands

```bash
# Validate all imports (CI-strict)
pnpm run dx:validate-imports

# Find what imports a module
grep -r "from.*SemanticMemory" packages/backend/src

# Check if file exists
ls -la packages/backend/src/lib/agent-fabric/LLMGateway.ts

# TypeScript validation
pnpm typecheck

# Run regression tests
pnpm test packages/backend/src/__tests__/import-resolution.test.ts
```

## Why This Matters

Import resolution issues cascade:
- Broken imports → Type errors → Build failures → CI red
- But stubs mask these → Code breaks in production
- Pre-commit + CI + validation catch it early

**The safeguards ensure: What compiles locally = What passes CI = What ships to production**

