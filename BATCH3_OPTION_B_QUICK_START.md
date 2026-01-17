# Batch 3 Quick Start: Option B Execution

**Decision:** ✅ Option B (Components + Minimal Providers)  
**Executor:** [Your Name]  
**Start Time:** 2026-01-17 [HH:MM]  
**Expected Duration:** 35-40 minutes  
**Branch:** merge/components-batch-3  

---

## What You're About to Do

Copy React components from legacy to production, update import paths to `@services`, `@types`, `@lib`, then create minimal context providers to enable a working shell route smoke test.

**Result:** Components render and can call services via hooks (proof of integration).

---

## Pre-Flight Checklist (5 min)

Before you start, verify these are true:

- [ ] You're on `merge/services-batch-2` branch (run `git branch -v`)
- [ ] `pnpm --filter valynt-app run typecheck` passes (0 errors)
- [ ] You have 40 minutes of uninterrupted time
- [ ] You have the 11-phase checklist open: [MERGE_BATCH3_EXECUTION_CHECKLIST.md](./MERGE_BATCH3_EXECUTION_CHECKLIST.md)
- [ ] You have the troubleshooting guide ready (end of checklist)

**Go/No-Go:** If all true, proceed. If any false, reschedule.

---

## Option B Specific: Provider Setup (10 min)

### Before You Execute Phases 1-7

Identify which 3-5 hooks are most used by components:

```bash
grep -r "use[A-Z]" apps/ValyntApp/src/legacy-restored/components/ \
  | grep "from '@hooks" | cut -d: -f2 | sort | uniq -c | sort -rn | head -5

# Expected output: useAgentRegistry, useWorkflowState, useSessionManager, etc.
```

**Note which 3-5 hooks you see** — you'll wire these into providers in Phase 8.

### After Phase 7 (Full App Validation)

You'll create a single provider file:

**File:** `apps/ValyntApp/src/providers/BatchThreeProviders.tsx`

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { AgentRegistry } from '@services/AgentRegistry';
import { SessionManager } from '@services/SessionManager';
import { WorkflowStateService } from '@services/WorkflowStateService';

// Create contexts
const AgentRegistryContext = createContext<AgentRegistry | null>(null);
const SessionContext = createContext<SessionManager | null>(null);
const WorkflowContext = createContext<WorkflowStateService | null>(null);

// Export hooks that components use
export function useAgentRegistry() {
  const context = useContext(AgentRegistryContext);
  if (!context) throw new Error('useAgentRegistry must be in AgentRegistryProvider');
  return context;
}

export function useSessionManager() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSessionManager must be in SessionProvider');
  return context;
}

export function useWorkflowState() {
  const context = useContext(WorkflowContext);
  if (!context) throw new Error('useWorkflowState must be in WorkflowProvider');
  return context;
}

// Provider component
export function BatchThreeProviders({ children }: { children: ReactNode }) {
  const agentRegistry = new AgentRegistry();
  const sessionManager = new SessionManager();
  const workflowService = new WorkflowStateService();

  return (
    <AgentRegistryContext.Provider value={agentRegistry}>
      <SessionContext.Provider value={sessionManager}>
        <WorkflowContext.Provider value={workflowService}>
          {children}
        </WorkflowContext.Provider>
      </SessionContext.Provider>
    </AgentRegistryContext.Provider>
  );
}
```

**Then update your App.tsx or shell route to wrap with providers:**

```typescript
import { BatchThreeProviders } from '@providers/BatchThreeProviders';

export function App() {
  return (
    <BatchThreeProviders>
      <AppShell>
        <Routes>
          {/* routes here */}
        </Routes>
      </AppShell>
    </BatchThreeProviders>
  );
}
```

---

## Execution Flow (Option B)

### Phase 1-7: Standard (40 min checklist)

Follow [MERGE_BATCH3_EXECUTION_CHECKLIST.md](./MERGE_BATCH3_EXECUTION_CHECKLIST.md) phases 1-7 exactly:

1. ✅ Setup (2 min)
2. ✅ Discovery (3 min)
3. ✅ Staging (3 min)
4. ✅ Import Path Rewriting (4 min)
5. ✅ Isolated TypeScript Validation (4 min)
6. ✅ Move to Production (2 min)
7. ✅ Full App Validation (3 min)

### Phase 8: Create Minimal Providers (Option B Only) (5 min)

**Do:**
- Create `apps/ValyntApp/src/providers/BatchThreeProviders.tsx` (copy template above)
- Add to `src/App.tsx` or main shell route wrapper
- Make sure imports use `@services` convention

**Don't:**
- Add business logic to providers (only instantiate services)
- Call service methods (just pass service objects to context)
- Create more than 5 providers (keep it minimal)

### Phase 9: Enhanced Smoke Test (Option B Only) (5 min)

```bash
# Start dev server
pnpm --filter valynt-app dev &
DEV_PID=$!

# Wait for startup
sleep 5

# Test 1: App served
curl -s http://localhost:5173/ | grep -q "<!DOCTYPE" && echo "✅ App served"

# Test 2: Shell route loads
curl -s http://localhost:5173/dashboard 2>&1 | grep -q "html" && echo "✅ Route responds"

# Test 3: Manual browser check (F12 console)
# - No immediate JavaScript errors
# - Components visible (not blank)
# - useAgentRegistry() hook works (not "context not found" error)

# Kill server
kill $DEV_PID 2>/dev/null || true
```

### Phase 10-11: Diff Review & Commit (Standard)

Follow [MERGE_BATCH3_EXECUTION_CHECKLIST.md](./MERGE_BATCH3_EXECUTION_CHECKLIST.md) phases 10-11:

10. ✅ Diff Discipline Review (5 min)
11. ✅ Commit to Git (2 min)

---

## Quick Command Reference

```bash
# Create branch
git checkout merge/services-batch-2
git checkout -b merge/components-batch-3

# Stage components (Phase 3)
mkdir -p apps/ValyntApp/src/legacy-merge/components
cp -r apps/ValyntApp/src/legacy-restored/components/* \
  apps/ValyntApp/src/legacy-merge/components/

# Rewrite imports (Phase 4)
find apps/ValyntApp/src/legacy-merge/components -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./\.\./services/|from '@services/|g" {} \;
find apps/ValyntApp/src/legacy-merge/components -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./types/|from '@types/|g" {} \;
find apps/ValyntApp/src/legacy-merge/components -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i "s|from '\.\./\.\./lib/|from '@lib/|g" {} \;

# Validate in staging (Phase 5)
cd apps/ValyntApp
npx tsc --noEmit src/legacy-merge/components 2>&1 | head -20

# Copy to production (Phase 6)
cp -r apps/ValyntApp/src/legacy-merge/components/* \
  apps/ValyntApp/src/components/

# Full app validation (Phase 7)
pnpm --filter valynt-app run typecheck

# Smoke test (Phase 9 - Option B)
pnpm --filter valynt-app dev &
sleep 5 && curl -s http://localhost:5173/ | grep -q "<!DOCTYPE" && echo "✅ Served"

# Commit (Phase 11)
git add apps/ValyntApp/src/components apps/ValyntApp/src/legacy-merge/components apps/ValyntApp/src/providers/
git commit -m "Merge batch 3: components + minimal providers (Option B)

- Copied all components from legacy-restored to production
- Updated imports: services (@services), types (@types), lib (@lib)
- Created minimal providers: AgentRegistry, SessionManager, WorkflowState
- Wired providers into shell route (AppShell wrapper)
- Full smoke test passed: components render, hooks callable
- All changes: import rewrites + provider setup (no logic changes)"
```

---

## Diff Discipline Reminders (Golden Rules)

**ALLOWED:**
- ✅ Import path rewrites (`../../../services/` → `@services/`)
- ✅ New barrel exports (`export * from './Component'`)
- ✅ New providers file (`src/providers/BatchThreeProviders.tsx`)
- ✅ App.tsx wrapper update

**PROHIBITED:**
- ❌ Component logic changes
- ❌ CSS modifications
- ❌ Service method calls in providers
- ❌ New npm dependencies

---

## If Something Goes Wrong

**Phase 5 validation fails (imports don't resolve)?**
→ Check [MERGE_BATCH3_EXECUTION_CHECKLIST.md → Troubleshooting](./MERGE_BATCH3_EXECUTION_CHECKLIST.md#troubleshooting-guide)

**Phase 9 smoke test fails (component doesn't render)?**
→ Check browser console (F12) for errors
→ Check provider is wrapping AppShell correctly
→ Verify services instantiate without errors

**Diff review shows logic changes?**
→ Revert staging and redo (don't copy to production)
→ Check sed commands ran correctly
→ Verify no manual edits were made

---

## Success Looks Like

✅ TypeScript: 0 errors (full app validation)  
✅ Dev server: Starts without crashes  
✅ Shell route: Loads and renders components  
✅ Hooks: useAgentRegistry() works (context initialized)  
✅ Diff: Only imports + providers (no logic changes)  
✅ Commit: Clear message + phase checklist followed  

---

## Post-Execution

### Immediate (After Commit)

1. Push branch: `git push origin merge/components-batch-3`
2. Create PR (use template from MERGE_BATCH2_COMPLETION_SUMMARY.md)
3. Ping reviewers on Slack

### Verification (Reviewer)

Reviewer should check:
- [ ] All diffs are import paths only + provider setup
- [ ] No component logic modified
- [ ] TypeScript passes (no new errors)
- [ ] PR template filled out

### Merge & Cleanup

1. After approval: Merge to staging/main
2. Remove staging area: `rm -rf apps/ValyntApp/src/legacy-merge/components/`
3. Move to Batch 4: Hooks & context providers (full setup)

---

## Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Setup branch | 2 min |
| 2 | Discovery | 3 min |
| 3 | Copy to staging | 3 min |
| 4 | Rewrite imports | 4 min |
| 5 | Validate isolated | 4 min |
| 6 | Copy to production | 2 min |
| 7 | Full app validation | 3 min |
| 8 | Create providers (Option B) | 5 min |
| 9 | Smoke test (Option B) | 5 min |
| 10 | Diff review | 5 min |
| 11 | Commit | 2 min |
| **Total** | | **39 min** |

---

## Document References

- **Execution checklist:** [MERGE_BATCH3_EXECUTION_CHECKLIST.md](./MERGE_BATCH3_EXECUTION_CHECKLIST.md) (detailed 11-phase guide)
- **Troubleshooting:** [MERGE_BATCH3_EXECUTION_CHECKLIST.md → Troubleshooting Guide](#troubleshooting-guide)
- **Batch 2 recap:** [MERGE_BATCH2_COMPLETION_SUMMARY.md](./MERGE_BATCH2_COMPLETION_SUMMARY.md)
- **Full roadmap:** [MERGE_STRATEGY_COMPLETE_ROADMAP.md](./MERGE_STRATEGY_COMPLETE_ROADMAP.md)
- **All docs index:** [MERGE_DOCUMENTATION_INDEX.md](./MERGE_DOCUMENTATION_INDEX.md)

---

**Ready to start? Follow MERGE_BATCH3_EXECUTION_CHECKLIST.md phases 1-11, with Option B provider setup at phase 8.**

**✅ Good luck! You've got this.** 🚀
