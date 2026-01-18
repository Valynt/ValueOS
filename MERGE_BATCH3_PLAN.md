# Batch 3 Plan: Components Merge Strategy

**Predecessor:** Batch 2 (f16d1c37 `merge/services-batch-2`)
**Target Branch:** `merge/components-batch-3`
**Estimated Files:** 40-50 component files + test suites
**Dependencies:** All services (Batch 2), all types (Batch 1)

---

## Overview

This batch moves all React component files from `legacy-restored/components/` to production (`apps/ValyntApp/src/components/`), ensuring:

1. **Service imports** point to production paths (`@services/**`)
2. **Type imports** reference production types (`@types/**`)
3. **Hook imports** resolve correctly (will improve in Batch 4)
4. **No breaking structural changes** (Strategy B: minimal refactoring)

---

## Execution Plan

### Phase 1: Discovery (5 minutes)

```bash
# List all component files to merge
find apps/ValyntApp/src/legacy-restored/components -name "*.tsx" -o -name "*.ts" | wc -l

# Check for broken imports (anticipate these for Phase 2)
grep -r "from '\.\./\.\./\.\./services" apps/ValyntApp/src/legacy-restored/components/ | head -20
grep -r "from '\.\./\.\./types" apps/ValyntApp/src/legacy-restored/components/ | head -20
```

### Phase 2: Staging

```bash
# Create staging directory
mkdir -p apps/ValyntApp/src/legacy-merge/components

# Copy all component files
cp -r apps/ValyntApp/src/legacy-restored/components/* \
  apps/ValyntApp/src/legacy-merge/components/

# Verify structure
ls -la apps/ValyntApp/src/legacy-merge/components/
```

### Phase 3: Import Rewriting (Critical)

**Pattern 1: Service imports**

```typescript
// Before
import { AgentRegistry } from "../../../services/AgentRegistry";

// After
import { AgentRegistry } from "@services/AgentRegistry";
```

**Pattern 2: Type imports**

```typescript
// Before
import { VOS } from "../../../types/vos";

// After
import { VOS } from "@types/vos";
```

**Pattern 3: Lib imports**

```typescript
// Before
import { BaseAgent } from "../../../lib/agent-fabric/agents/BaseAgent";

// After
import { BaseAgent } from "@lib/agent-fabric/agents/BaseAgent";
```

**Execution:**

```bash
# Rewrite service imports
sed -i "s|from '\.\./\.\./\.\./services/|from '@services/|g" \
  apps/ValyntApp/src/legacy-merge/components/**/*.tsx

# Rewrite type imports
sed -i "s|from '\.\./\.\./types/|from '@types/|g" \
  apps/ValyntApp/src/legacy-merge/components/**/*.tsx

# Rewrite lib imports
sed -i "s|from '\.\./\.\./lib/|from '@lib/|g" \
  apps/ValyntApp/src/legacy-merge/components/**/*.tsx

# Verify rewrite
grep -r "@services/" apps/ValyntApp/src/legacy-merge/components/ | head -5
```

### Phase 4: Validation in Isolation

```bash
# Run targeted typecheck on staging components
npx tsc --noEmit --skipLibCheck \
  --lib es2020,dom \
  --jsx react-jsx \
  apps/ValyntApp/src/legacy-merge/components/**/*.tsx 2>&1 | head -50

# Expected output: Should resolve all imports via tsconfig paths
# If errors: identify missing types/services and add stubs
```

### Phase 5: Move to Production

```bash
# Copy validated components to production
cp -r apps/ValyntApp/src/legacy-merge/components/* \
  apps/ValyntApp/src/components/

# Verify production structure
ls -la apps/ValyntApp/src/components/ | head -20
```

### Phase 6: Full App Validation

```bash
# Run full app typecheck
npm run typecheck

# Expected: Should pass (leveraging Batch 1+2 infrastructure)
# If failures: Identify and document for stabilization phase
```

### Phase 7: Commit to Git

```bash
git add \
  apps/ValyntApp/src/components \
  apps/ValyntApp/src/legacy-merge/components

git commit -m "Merge batch 3: components (service integration)

- Copied all components from legacy-restored to production
- Updated imports: services (@services), types (@types), lib (@lib)
- Full import path validation in staging before production copy
- Components ready for runtime wiring with orchestration services
- Tests will be addressed in stabilization phase"
```

---

## Troubleshooting

### Import Resolution Fails

**Issue:** Components can't find `@services/*` after sed rewrite
**Solution:** Verify tsconfig.json has proper path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@services/*": ["./apps/ValyntApp/src/services/*"],
      "@types/*": ["./apps/ValyntApp/src/types/*"],
      "@lib/*": ["./apps/ValyntApp/src/lib/*"]
    }
  }
}
```

### Missing Type Definitions

**Issue:** Component imports a type that doesn't exist in `@types/`
**Solution:**

1. Check if type is in `legacy-restored/types/` (copy to Batch 1 if missing)
2. Or add type stub in staging: `legacy-merge/types/missing-type.ts`

### React Hook Errors

**Issue:** Components use hooks that reference services before they're initialized
**Solution:** Document for Batch 4 (hooks) — defer fixes until provider refactoring

---

## File Structure After Batch 3

```
apps/ValyntApp/src/
├── components/              ← Batch 3 (NEW PRODUCTION)
│   ├── Dashboard.tsx
│   ├── WorkflowEditor.tsx
│   └── ... (40-50 files)
├── services/               ← Batch 2 (PRODUCTION)
├── lib/                    ← Batch 2 (PRODUCTION)
├── types/                  ← Batch 1 (PRODUCTION)
├── legacy-merge/           ← STAGING (will delete after Batch 3 stabilizes)
│   ├── components/
│   ├── services/
│   └── lib/
└── legacy-restored/        ← ARCHIVE (excluded from typecheck)
```

---

## Success Criteria

✅ All components copied to production
✅ All imports use `@services/*`, `@types/*`, `@lib/*` conventions
✅ `npm run typecheck` passes (excluding legacy-restored/legacy-merge)
✅ No new circular dependencies introduced
✅ Staging area ready for cleanup (Phase 1 of Batch 4)

---

## Next Batch (Batch 4): Hooks

After Batch 3 is stable:

- Copy hook files
- Update context providers to use new services
- Refactor service initialization (React Context API)
- Move from prop drilling to global context

---

## Command Summary (All in One)

```bash
# Full Batch 3 execution
set -e

# Phase 1+2: Stage components
mkdir -p apps/ValyntApp/src/legacy-merge/components
cp -r apps/ValyntApp/src/legacy-restored/components/* \
  apps/ValyntApp/src/legacy-merge/components/

# Phase 3: Rewrite imports
find apps/ValyntApp/src/legacy-merge/components -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i "s|from '\.\./\.\./\.\./services/|from '@services/|g"
find apps/ValyntApp/src/legacy-merge/components -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i "s|from '\.\./\.\./types/|from '@types/|g"
find apps/ValyntApp/src/legacy-merge/components -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i "s|from '\.\./\.\./lib/|from '@lib/|g"

# Phase 4: Validate
echo "✅ Validation checks (manual review recommended)"
grep -r "@services/" apps/ValyntApp/src/legacy-merge/components/ | wc -l
grep -r "@types/" apps/ValyntApp/src/legacy-merge/components/ | wc -l

# Phase 5: Move to production
cp -r apps/ValyntApp/src/legacy-merge/components/* apps/ValyntApp/src/components/

# Phase 6: Full app validation
npm run typecheck

# Phase 7: Commit
git add apps/ValyntApp/src/components apps/ValyntApp/src/legacy-merge/components
git commit -m "Merge batch 3: components (service integration)

- Copied all components from legacy-restored to production
- Updated imports: services (@services), types (@types), lib (@lib)
- Full import path validation in staging before production copy
- Components ready for runtime wiring with orchestration services"

echo "✅ Batch 3 Complete"
```

---

**Status:** Ready for manual execution
