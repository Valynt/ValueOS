# ValueOS Merge Strategy: Complete Roadmap

**Status:** Batch 2 ✅ Complete | Batch 3 🚀 Ready to Execute
**Date:** 2026-01-17
**Lead:** ValueOS Merge Team

---

## Executive Summary

The ValueOS application is being migrated from legacy monolithic architecture to production via structured batches. Each batch is:

- **Isolated** — Works in staging area (`legacy-merge/`) before production
- **Validated** — TypeScript checks, smoke tests, cycle detection
- **Reversible** — Can roll back with `git revert` or `reset`
- **Documented** — Full execution checklists, verification commands

**Current Progress:**

- ✅ **Batch 1 (Types):** Complete (vos.ts, workflow.ts, agents.ts)
- ✅ **Batch 2 (Services & Lib):** Complete (143 services, 54 lib files, 706 commits)
- 🚀 **Batch 3 (Components):** Ready to execute (2 integration options)
- 📋 **Batch 4+ (Hooks, Routes, Data):** Planned

---

## Batch 2: Services & Lib (COMPLETE)

**Commit:** f16d1c37 | 2aaa38ac
**Files:** 706 committed
**Merge Date:** 2026-01-17

### What Was Delivered

1. **143 Service Files** → `apps/ValyntApp/src/services/`
   - Full orchestration layer (WorkflowOrchestrator, MessageBus, AgentRegistry, etc.)
   - All dependent services included (no missing imports)
   - Tests + test fixtures included

2. **Agent Fabric Library** → `apps/ValyntApp/src/lib/agent-fabric/`
   - 6 agent implementations (BaseAgent, OpportunityAgent, TargetAgent, etc.)
   - 5 core utilities (LLMGateway, MemorySystem, AuditLogger, etc.)
   - Performance optimization layer

3. **tsconfig Updates**
   - Path aliases working: `@services/*`, `@lib/*`, `@types/*`
   - Both tsconfig.json (TypeScript) and vite.config.ts (bundler)
   - Legacy directories excluded from compilation

### Verification

```bash
# TypeScript validation
pnpm --filter valynt-app run typecheck
# ✅ PASS: 0 errors in production code

# Import paths verified
grep -r "@services/" apps/ValyntApp/src/services/ | wc -l
# ✅ 47 services using new convention

# Staging area created for post-merge review
ls -la apps/ValyntApp/src/legacy-merge/
# ✅ All services staged before production copy
```

### Pre-Existing Issues (Correctly Excluded)

| File                     | Issue               | Status                      |
| ------------------------ | ------------------- | --------------------------- |
| WebScraperService.ts     | Missing async/await | ❌ Excluded (legacy-merge/) |
| AgentTelemetryService.ts | Missing type defs   | ❌ Excluded (legacy-merge/) |

**Note:** These issues existed **before** Batch 2. They do not block production and will be addressed in stabilization phase with tests.

### Risk Assessment: LOW

- Zero structural refactors (no method signature changes)
- No component or hook API changes
- Services are self-contained
- Rollback: `git revert f16d1c37 --no-edit` (clean, single-commit revert)

---

## Batch 3: Components (READY TO EXECUTE)

**Target Branch:** merge/components-batch-3
**Estimated Duration:** 20 min (Option A) OR 35-40 min (Option B)
**Pre-Requisite:** Batch 2 stable in main branch

### Decision Point: Integration Strategy

#### Option A: Components Only (Import Paths)

- Copy components + update `@services`, `@types`, `@lib` imports
- Leave hooks/providers for Batch 4
- ✅ Minimal scope (20 minutes)
- ❌ Can't smoke test components (hooks not initialized)

#### Option B: Components + Minimal Providers (RECOMMENDED)

- Copy components + import paths
- Create minimal context providers for shell route
- Enables real smoke test of service→component→UI flow
- ✅ Full validation (35-40 minutes)
- ✅ Early risk detection

**Default:** Option B (better validation, saves time in Batch 4)

### Execution Plan (All-in-One)

```bash
# 1. Create branch
git checkout merge/services-batch-2
git checkout -b merge/components-batch-3

# 2. Stage components
mkdir -p apps/ValyntApp/src/legacy-merge/components
cp -r apps/ValyntApp/src/legacy-restored/components/* \
  apps/ValyntApp/src/legacy-merge/components/

# 3. Rewrite imports
find apps/ValyntApp/src/legacy-merge/components \
  -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./\.\./services/|from '@services/|g" {} \;

find apps/ValyntApp/src/legacy-merge/components \
  -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./types/|from '@types/|g" {} \;

find apps/ValyntApp/src/legacy-merge/components \
  -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./lib/|from '@lib/|g" {} \;

# 4. Validate in staging
cd apps/ValyntApp
npx tsc --noEmit src/legacy-merge/components 2>&1 | head -20

# 5. If Option B: Create providers
# (See MERGE_BATCH3_INTEGRATION_STRATEGY.md for detailed provider code)

# 6. Copy to production
cp -r apps/ValyntApp/src/legacy-merge/components/* \
  apps/ValyntApp/src/components/

# 7. Full app validation
pnpm --filter valynt-app run typecheck

# 8. Smoke test
pnpm --filter valynt-app dev &
sleep 5
curl -s http://localhost:5173/ | grep -q "<!DOCTYPE" && echo "✅ Served"

# 9. Commit
git add apps/ValyntApp/src/components apps/ValyntApp/src/legacy-merge/components
git commit -m "Merge batch 3: components (service integration)

- Copied all components from legacy-restored to production
- Updated imports: services (@services), types (@types), lib (@lib)
- Full import path validation in staging before production copy
- [If Option B] Created minimal providers for shell route smoke test"
```

### Diff Discipline (Golden Rules)

```
ALLOWED CHANGES:
✅ Import path rewrites (../../../services/ → @services/)
✅ New barrel exports (export * from './Component')
✅ Small type annotations for strict mode
✅ Create src/providers/ for minimal context (Option B only)

PROHIBITED CHANGES:
❌ Component logic modifications
❌ CSS/style changes
❌ Service method calls (keep providers basic)
❌ New npm dependencies
❌ Refactor existing components
```

### Success Criteria

- [ ] Staged components compile (npx tsc --noEmit)
- [ ] Full app typecheck passes (same error count as Batch 2)
- [ ] Dev server starts without immediate errors
- [ ] All diffs contain only import path changes
- [ ] Commit message clear + detailed
- [ ] Staging area ready for cleanup after merge

---

## Documentation Reference

| Document                                                                       | Purpose                            | Audience                   |
| ------------------------------------------------------------------------------ | ---------------------------------- | -------------------------- |
| [MERGE_BATCH2_COMPLETION_SUMMARY.md](./MERGE_BATCH2_COMPLETION_SUMMARY.md)     | Batch 2 final report + PR template | Tech leads, code reviewers |
| [MERGE_BATCH3_INTEGRATION_STRATEGY.md](./MERGE_BATCH3_INTEGRATION_STRATEGY.md) | Option A vs B decision matrix      | PM, tech lead, team        |
| [MERGE_BATCH3_EXECUTION_CHECKLIST.md](./MERGE_BATCH3_EXECUTION_CHECKLIST.md)   | Step-by-step 11-phase execution    | Individual executor        |
| [MERGE_PLAN_STATUS.md](./MERGE_PLAN_STATUS.md)                                 | Master status document             | All stakeholders           |

---

## Full Merge Roadmap (Batches 1-6)

### ✅ Completed

**Batch 1: Core Types** (a5bbd1de)

- vos.ts (VOS lifecycle types)
- workflow.ts (DAG + execution)
- agents.ts (agent taxonomy)
- Status: Stable, ready for Batch 2+

**Batch 2: Core Services & Lib** (f16d1c37, 2aaa38ac)

- 143 services (full orchestration layer)
- 54 lib files (agent-fabric, utilities)
- Status: Stable, all imports resolve, ready for Batch 3

### 🚀 Ready Now

**Batch 3: Components** (merge/components-batch-3)

- ~40-50 component files
- Service/type import wiring
- Minimal provider setup (Option B)
- Timeline: 20-40 minutes
- Decision form: [See MERGE_BATCH3_INTEGRATION_STRATEGY.md]

### 📋 Upcoming

**Batch 4: Hooks & Context Providers**

- ~15-20 hook files
- Context provider tree (if not done in Batch 3)
- Service initialization logic
- Timeline: ~30-40 minutes

**Batch 5: Routes & Route Handlers**

- Page components
- Route definitions
- Navigation logic
- Timeline: ~30-40 minutes

**Batch 6: Data Layer & Utils**

- Data fetching hooks
- Utility functions
- Constants and config
- Timeline: ~20-30 minutes

---

## Team Responsibilities

### Pre-Execution

- **Tech Lead:** Review integration strategy, choose Option A or B
- **Executor:** Coordinate with team, reserve 20-40 min focused time
- **Reviewer:** Be available for 15-min post-commit review

### Execution

- **Executor:** Follow MERGE_BATCH3_EXECUTION_CHECKLIST.md exactly
- **Slack:** Quick sync after Phase 5 (validation) before Phase 6 (production copy)
- **No changes:** Diff discipline is strict (see golden rules)

### Post-Execution

- **Reviewer:** Check diff for import-only changes (5 min review)
- **QA:** Smoke test on staging env (if available)
- **DevOps:** Deploy to staging + verify shell route loads

---

## Commands Quick Reference

### Batch 2 Verification

```bash
pnpm --filter valynt-app run typecheck
git log --oneline merge/services-batch-2 | head -3
```

### Batch 3 Execution

```bash
git checkout -b merge/components-batch-3 merge/services-batch-2
# [Follow MERGE_BATCH3_EXECUTION_CHECKLIST.md phases 1-11]
git commit -m "Merge batch 3: components..."
```

### Batch 3 Validation

```bash
pnpm --filter valynt-app run typecheck
pnpm --filter valynt-app dev  # Start shell, verify routes load
```

### Rollback (If Needed)

```bash
# Clean revert (if no Batch 3+ changes to same files)
git revert f16d1c37 --no-edit

# OR hard reset (local development only)
git reset --hard merge/types-batch-1
```

---

## FAQ

**Q: What if I find an error during Batch 3 execution?**
A: Stop at the phase where you found it. Fix in `src/legacy-merge/components/` (staging), re-validate, then copy to production. Do not fix in production directly.

**Q: Can I skip the staging area?**
A: Not recommended. Staging allows you to validate imports in isolation before affecting production code. Keeps diffs clean and reversible.

**Q: What if the full app still has > 0 errors after Batch 3?**
A: Document new errors in a separate file (`BATCH3_KNOWN_ERRORS.md`). Only rollback if error count is higher than Batch 2. Small increases are expected (hook providers not initialized yet).

**Q: When do I wire hooks?**
A: Batch 4 (Hooks & Context Providers). Batch 3 focuses on import paths + optional minimal providers for smoke test.

**Q: Can I add features while moving code?**
A: No. Strict diff discipline. Features are for subsequent batches after merge is complete and stable.

---

## Success Metrics

After all batches complete:

- [ ] **TypeScript:** 0 errors in production code
- [ ] **Imports:** All use `@services`, `@types`, `@lib` conventions
- [ ] **Services:** Callable from components via hooks
- [ ] **Components:** Render without runtime errors
- [ ] **Routes:** Navigation works between pages
- [ ] **Tests:** Unit tests for at least core services
- [ ] **Multi-tenant:** RLS policies enforced at service layer
- [ ] **Performance:** App starts in < 5 seconds

---

## Contact & Escalation

- **Blocker during execution?** Ping tech-lead on Slack
- **Import path issues?** Check tsconfig.json + vite.config.ts (see Batch 2 docs)
- **Provider wiring (Option B)?** See MERGE_BATCH3_INTEGRATION_STRATEGY.md Step 2
- **Rollback needed?** See MERGE_BATCH2_COMPLETION_SUMMARY.md "Risk Mitigation" section

---

**Last Updated:** 2026-01-17
**Next Review:** After Batch 3 commit
**Approvers:** [Tech Lead], [PM], [Eng Manager]
