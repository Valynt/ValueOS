# Batch 3 Execution Checklist: Components Wiring

**Predecessor:** merge/services-batch-2 (f16d1c37)  
**Target Branch:** merge/components-batch-3  
**Scope:** Components layer only (shallow provider wiring for smoke test)  
**Estimated Duration:** 15-20 minutes execution + 10-15 minutes validation  

---

## Pre-Execution Checklist

- [ ] Batch 2 (`merge/services-batch-2`) stable in `origin/main` or staging branch
- [ ] `npm run typecheck` passes on `merge/services-batch-2`
- [ ] tsconfig.json excludes legacy-restored/ and legacy-merge/
- [ ] Team briefed on scope (components only, not full feature parity)

---

## Phase 1: Setup (2 min)

```bash
# Create new branch from Batch 2
git checkout merge/services-batch-2
git pull origin merge/services-batch-2  # Ensure latest

git checkout -b merge/components-batch-3

# Verify you're on the right branch
git branch -vv | grep components-batch-3
# Expected: * merge/components-batch-3 ... f16d1c37
```

- [ ] Branch created: `merge/components-batch-3`
- [ ] Pointing to f16d1c37 (Batch 2 head)

---

## Phase 2: Discovery (3 min)

**Goal:** Know what you're about to copy

```bash
# Count component files
find apps/ValyntApp/src/legacy-restored/components \
  \( -name "*.tsx" -o -name "*.ts" \) \
  ! -path "*/__tests__/*" | wc -l

# Expected: ~35-45 files (excluding tests)

# List top-level components
ls -1 apps/ValyntApp/src/legacy-restored/components/ | head -20

# Identify local dependencies (icons, styles, ui primitives)
grep -r "from '\." apps/ValyntApp/src/legacy-restored/components/ \
  | grep -v node_modules | cut -d: -f2 | sort -u | head -10
```

**Checklist:**
- [ ] Component count noted (expected: 35-45)
- [ ] Top-level structure understood
- [ ] Local dependency imports identified

---

## Phase 3: Staging (3 min)

**Goal:** Copy components to isolation area for safe validation

```bash
# Create staging directory
mkdir -p apps/ValyntApp/src/legacy-merge/components

# Copy all component files (preserve directory structure)
cp -r apps/ValyntApp/src/legacy-restored/components/* \
  apps/ValyntApp/src/legacy-merge/components/

# Verify copy
find apps/ValyntApp/src/legacy-merge/components \
  -name "*.tsx" -o -name "*.ts" | wc -l

# Expected: Same count as legacy-restored (+ any local deps)
```

**Checklist:**
- [ ] Staging directory created
- [ ] All components copied to legacy-merge/components/
- [ ] File count matches source

---

## Phase 4: Import Path Rewriting (4 min)

**CRITICAL:** Update all imports to production paths. This is the main diff work.

### Pattern 1: Service Imports (Most Common)

```bash
# Find examples first
grep -r "from '\.\./\.\./\.\./services/" \
  apps/ValyntApp/src/legacy-merge/components/ | head -5
# Expected: import { AgentRegistry } from '../../../services/AgentRegistry'

# Rewrite service imports
find apps/ValyntApp/src/legacy-merge/components \
  -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./\.\./services/|from '@services/|g" {} \;

# Verify rewrite
grep -r "from '@services/" \
  apps/ValyntApp/src/legacy-merge/components/ | head -3
```

### Pattern 2: Type Imports

```bash
# Find examples
grep -r "from '\.\./\.\./types/" \
  apps/ValyntApp/src/legacy-merge/components/ | head -5
# Expected: import { VOS } from '../../types/vos'

# Rewrite type imports (one level up: ../../types/ → @types/)
find apps/ValyntApp/src/legacy-merge/components \
  -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./types/|from '@types/|g" {} \;

# Verify
grep -r "from '@types/" \
  apps/ValyntApp/src/legacy-merge/components/ | head -3
```

### Pattern 3: Lib Imports

```bash
# Find examples
grep -r "from '\.\./\.\./lib/" \
  apps/ValyntApp/src/legacy-merge/components/ | head -3

# Rewrite lib imports
find apps/ValyntApp/src/legacy-merge/components \
  -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./lib/|from '@lib/|g" {} \;

# Verify
grep -r "from '@lib/" \
  apps/ValyntApp/src/legacy-merge/components/ | head -3
```

### Pattern 4: Relative Sibling Imports (Tricky)

```bash
# Some imports may be: import X from '../OtherComponent'
# These should stay relative (within components/)
# Only rewrite if they reference services/types/lib

# Check for remaining external relative imports
grep -r "from '\.\./\.\./\.\./\.\." \
  apps/ValyntApp/src/legacy-merge/components/ | head -5

# If found, decide: keep relative OR convert to barrel import
# Example: import { helper } from '../../../../utils/helpers'
# → import { helper } from '@lib/helpers' (if in lib now)
```

**Checklist:**
- [ ] Service imports rewritten (`@services/*`)
- [ ] Type imports rewritten (`@types/*`)
- [ ] Lib imports rewritten (`@lib/*`)
- [ ] No ../../../../../ imports remain (check with grep above)

---

## Phase 5: Isolated TypeScript Validation (4 min)

**Goal:** Ensure components compile in isolation before production copy

```bash
# Run tsc on staged components ONLY
npx tsc --noEmit \
  --skipLibCheck \
  --lib es2020,dom \
  --jsx react-jsx \
  --esModuleInterop \
  --resolveJsonModule \
  --moduleResolution node \
  --baseUrl apps/ValyntApp \
  --paths "$(cat apps/ValyntApp/tsconfig.json | jq -r '.compilerOptions.paths | keys[] | @json' | tr -d '"' | paste -sd ',' -)" \
  'apps/ValyntApp/src/legacy-merge/components/**/*.tsx' 2>&1

# Simpler: Just use existing tsconfig
cd apps/ValyntApp
npx tsc --noEmit \
  --skipLibCheck \
  src/legacy-merge/components 2>&1 | head -50

# Expected output: Either "0 errors" OR list of fixable errors
# Common fixable issues:
# - "Cannot find module '@services/XService'" → Service not exported in index.ts
# - "Property 'X' does not exist on type 'Props'" → Type mismatch (fix in Batch 4)
# - "React is not defined" → Missing import (if not using jsx: react-jsx)

# If you see > 5 errors: Stop here and debug in legacy-merge/
# Do NOT copy to production until staging compiles
```

**If Validation Fails:**
```bash
# Example: Missing service export
grep -r "export.*AgentRegistry" apps/ValyntApp/src/services/

# If not found: Add to src/services/index.ts
echo "export * from './AgentRegistry';" >> apps/ValyntApp/src/services/index.ts

# Re-run validation
```

**Checklist:**
- [ ] Staged components validate with `npx tsc --noEmit`
- [ ] Error count ≤ 3 (acceptable: missing hooks, untyped contexts)
- [ ] All import paths resolve (no "Cannot find module")

---

## Phase 6: Move to Production (2 min)

**ONLY if Phase 5 passes**

```bash
# Copy validated components to production
cp -r apps/ValyntApp/src/legacy-merge/components/* \
  apps/ValyntApp/src/components/

# Verify production copy
find apps/ValyntApp/src/components -name "*.tsx" | wc -l

# Expected: Same count as staging
```

**Checklist:**
- [ ] Components copied to src/components/
- [ ] File count matches staging

---

## Phase 7: Full App Validation (3 min)

**Goal:** Ensure entire app still compiles

```bash
# Full typecheck with legacy dirs excluded
pnpm --filter valynt-app run typecheck 2>&1 | tail -20

# Expected: Either "0 errors" OR same errors as before Batch 3
# New errors = import path issues OR breaking service changes

# If new errors appear: Identify which component(s) cause them
# Suggested fix: Revert to staging and debug specific file
```

**Checklist:**
- [ ] `pnpm --filter valynt-app run typecheck` passes (or has same errors as Batch 2)
- [ ] No import path errors (`Cannot find module @services/...`)

---

## Phase 8: Component-Level Smoke Test (5 min)

**Goal:** Verify components can at least load and render a shell

```bash
# Start dev server (backend optional for this phase)
pnpm --filter valynt-app dev &
DEV_PID=$!

# Wait for startup
sleep 5

# Quick smoke test: Check if app serves without crashes
curl -s http://localhost:5173/ | grep -q "<!DOCTYPE\|<html" && echo "✅ App served"

# OR: Open browser and visually check
# - App shell loads (not 500 error)
# - No JavaScript console errors (F12)
# - At least one component renders (doesn't matter if broken state)

# Kill dev server
kill $DEV_PID 2>/dev/null || true
```

**Checklist:**
- [ ] Dev server started without errors
- [ ] App served HTML (curl test or browser)
- [ ] No immediate JS errors in console

---

## Phase 9: Diff Discipline Review (5 min)

**BEFORE COMMITTING:** Verify diffs only contain allowed changes

```bash
# See all changes in staged components
git diff --cached apps/ValyntApp/src/components/ | head -100

# Allowed changes:
# ✅ Import path rewrites (../../../services/ → @services/)
# ✅ New barrel exports (export * from './Component')
# ✅ Small type annotations for strict mode
# ✅ Missing @types references

# NOT allowed (abort if found):
# ❌ Component logic changes
# ❌ CSS/style modifications
# ❌ Service method signature changes
# ❌ New dependencies (package.json changes)

# If you accidentally modified component behavior:
git reset HEAD apps/ValyntApp/src/components/
git restore apps/ValyntApp/src/components/
cp -r apps/ValyntApp/src/legacy-merge/components/* apps/ValyntApp/src/components/
# Re-apply only import changes via sed
```

**Checklist:**
- [ ] All diffs reviewed: only import paths and barrel exports
- [ ] Zero functional changes to components
- [ ] No new npm dependencies added

---

## Phase 10: Commit to Git (2 min)

```bash
# Stage all changes
git add \
  apps/ValyntApp/src/components/ \
  apps/ValyntApp/src/legacy-merge/components/

# Commit with detailed message
git commit -m "Merge batch 3: components (service integration)

- Copied all components from legacy-restored to production
- Updated imports: services (@services), types (@types), lib (@lib)
- Full import path validation in staging before production copy
- Components ready for runtime wiring with orchestration services
- All changes strictly: import paths + barrel exports (no logic refactors)

Verified:
- ✅ Staged typecheck passes
- ✅ Full app typecheck passes
- ✅ Dev server starts without immediate errors
- ✅ Diff contains only import rewrites (no functional changes)

Pre-existing issues from Batch 2 remain excluded (legacy-restored/)
Hook wiring deferred to Batch 4 (requires context provider setup)"

# Verify commit
git log --oneline -3
```

**Checklist:**
- [ ] Changes staged and committed
- [ ] Commit message clear and detailed
- [ ] `git log --oneline` shows batch 3 commit

---

## Phase 11: Push & Open PR (Optional but Recommended)

```bash
# Push to remote (if using shared repo)
git push origin merge/components-batch-3

# Or keep local for further testing
git log --oneline merge/components-batch-3 | head -5
```

**Checklist:**
- [ ] Branch pushed (if applicable)
- [ ] Ready for PR review

---

## Diff Discipline Rules (Golden)

These rules prevent Batch 3 from becoming a feature branch:

| Change Type | Allowed? | Example |
|------------|----------|---------|
| Import path rewrite | ✅ YES | `../../../services/` → `@services/` |
| Barrel export add | ✅ YES | `export * from './NewComponent'` |
| Type annotation | ✅ YES | `: React.FC<Props>` |
| Missing @types fix | ✅ YES | Add `import { VOSType } from '@types'` |
| Component logic change | ❌ NO | Add new state hook, change render logic |
| CSS/style change | ❌ NO | Modify classNames, update layout |
| Service API call | ❌ NO | Call new service method in component |
| New npm dependency | ❌ NO | Add react-router, axios, etc. |

---

## Troubleshooting Guide

### Problem: "Cannot find module @services/XService"
**Diagnosis:**
```bash
grep -r "export.*XService" apps/ValyntApp/src/services/
# If empty: Service not exported from index.ts
```
**Fix:**
```bash
# Add to src/services/index.ts
echo "export * from './XService';" >> apps/ValyntApp/src/services/index.ts

# Retry validation
```

### Problem: "Property X does not exist on type Props"
**Diagnosis:** Component prop types don't match service return types  
**Fix (defer to Batch 4):** Document and skip component for now  
**Temporary:** Remove component from staging if blocking full app validation

### Problem: React Hook errors ("Hook called outside component")
**Diagnosis:** Component uses hooks but provider not initialized  
**Fix:** This is expected! Batch 4 will add context providers  
**For now:** Document which hooks need providers

### Problem: CSS not loading (blank component)
**Diagnosis:** Style imports use relative paths  
**Fix:** Inspect component, check if style import is correct  
**Example:** `import './Component.module.css'` should work as-is

---

## Success Criteria

✅ **Passed:**
- Staging components compile without import errors
- Full app typecheck passes (same error count as Batch 2)
- Dev server starts and serves HTML
- All diffs contain only import path changes
- No component logic was modified
- Commit message is clear and detailed

✅ **Not Required Yet (Batch 4):**
- Components actually render correctly (hooks not initialized)
- Services callable from components (context providers not set up)
- Features work end-to-end
- All tests pass

---

## Cleanup (After Batch 3 Stable in Production)

Once this branch is merged and verified in staging:

```bash
# Remove staging area (components already in production)
rm -rf apps/ValyntApp/src/legacy-merge/components/

# Keep legacy-restored/ for reference (may delete in future batch)

# Commit cleanup
git add apps/ValyntApp/src/legacy-merge/
git commit -m "cleanup: remove batch 3 staging area after merge"
```

---

**Status:** Ready for execution  
**Estimated Total Time:** 35-40 minutes  
**Risk Level:** Low (import-only changes, isolated validation)  
**Next Phase:** Batch 4 (Hooks & Context Providers)
