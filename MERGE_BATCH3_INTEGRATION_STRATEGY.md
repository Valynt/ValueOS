# Batch 3 Integration Strategy: Components Only vs. Minimal Providers

**Decision Point:** Before starting Phase 1 of Batch 3
**Impact:** Affects scope, timeline, and validation approach
**Default Recommendation:** **Option B** (Components + Minimal Providers)

---

## Overview

Batch 3 must integrate React components from legacy-restored into production. However, components typically depend on:

1. **Hook imports** (`useAgentRegistry`, `useWorkflowState`, etc.)
2. **Context providers** (`AgentProvider`, `WorkflowProvider`)
3. **Service initialization** (service instances in context)

This creates a choice: Do we wire these dependencies, or leave them stubbed?

---

## Option A: Components Only (Import Paths Only)

**Scope:** Copy components + update `@services`, `@types`, `@lib` imports only. Leave hooks and providers stubbed.

### Approach

```typescript
// Component file (src/components/Dashboard.tsx)
import { AgentRegistry } from '@services/AgentRegistry';
import { useAgentRegistry } from '@hooks/useAgentRegistry';  // ← Stub for now

export function Dashboard() {
  // Hook will error at runtime if not wrapped in provider
  // But TypeScript will compile
  const registry = useAgentRegistry();
  return <div>...</div>;
}
```

### Pros

✅ **Minimal scope:** Batch 3 stays narrow (import paths only)
✅ **Fast execution:** 20 minutes total
✅ **Clear separation:** Hooks/providers = Batch 4 (separate work)
✅ **Less risk:** No context tree changes (can't break providers)
✅ **Easier rollback:** Revert is just removing component files

### Cons

❌ **Can't smoke test:** Components don't render (hooks break at runtime)
❌ **Deferred validation:** May find wiring issues too late (in Batch 4)
❌ **Incomplete picture:** Can't verify service→component flow works
❌ **Requires mocks:** Must mock hooks to do meaningful tests
❌ **False confidence:** "Compiles" but "doesn't work"

### When to Use

- You're confident in component logic (already tested in legacy)
- You want to minimize Batch 3 scope
- You have a well-defined provider structure (will implement in Batch 4)
- Time pressure: Need Batch 3 done in < 25 minutes

### Execution Summary

```bash
# Phase 1-7: Standard (import paths only)
# Phase 8 (smoke test): SKIP — components won't render

# Minimal validation:
✅ TypeScript compiles
✅ No import errors
⏩ Component rendering deferred to Batch 4
```

---

## Option B: Components + Minimal Providers (RECOMMENDED)

**Scope:** Copy components + import paths + wire minimal context providers to enable shell route rendering.

### Approach

```typescript
// Create minimal provider (src/providers/BatchThreeShell.tsx)
// Only includes: AgentRegistryProvider, WorkflowStateProvider

// src/App.tsx
export function App() {
  return (
    <BatchThreeShell>
      <AppShell>
        <Route path="/dashboard" component={Dashboard} />
      </AppShell>
    </BatchThreeShell>
  );
}

// Dashboard now works (provider initialized)
export function Dashboard() {
  const registry = useAgentRegistry(); // ← Now works!
  return <div>Registry: {registry.list().length} agents</div>;
}
```

### Pros

✅ **Real smoke test:** Components actually render
✅ **Early validation:** Catch wiring issues immediately (not in Batch 4)
✅ **Service integration proof:** Verify services are callable from components
✅ **Risk reduction:** Fix provider issues now vs. later
✅ **Team confidence:** Reviewers see working shell, not just imports
✅ **Easier Batch 4:** Context layer already in place

### Cons

❌ **Slightly larger scope:** Batch 3 = 35-40 minutes (not 20)
❌ **More files:** Providers + shell route added
❌ **Higher risk:** Provider implementation could have bugs
❌ **Rollback complexity:** If provider is wrong, affects more code
⚠️ **Scope creep potential:** Easy to slip into "feature work"

### When to Use

- You want proof that services and components work together
- Time permits 35-40 minute execution
- You have a clear list of which providers are "minimal" (3-5 max)
- You want to validate the entire service→component→UI flow

### Execution Summary

```bash
# Phase 1-7: Standard (import paths + component copy)

# Phase 8 (new): Create minimal provider
# - AgentRegistryProvider (wraps AgentRegistry service)
# - WorkflowStateProvider (wraps WorkflowStateService)
# - Pass these into <AppShell> or <CaseWorkspace> route

# Phase 9 (enhanced): Smoke test components with providers
✅ TypeScript compiles
✅ No import errors
✅ Dev server starts
✅ Route loads and renders (components visible)
✅ Services callable from component hooks

# Phase 10: Commit (standard)
```

---

## Decision Matrix

| Factor                    | Option A (Imports Only)  | Option B (Minimal Providers)  |
| ------------------------- | ------------------------ | ----------------------------- |
| **Execution Time**        | 20 min                   | 35-40 min                     |
| **TypeScript Validation** | ✅ Yes                   | ✅ Yes                        |
| **Runtime Smoke Test**    | ❌ No                    | ✅ Yes                        |
| **Service Verification**  | ❌ Components can't call | ✅ Services callable          |
| **Provider Wiring**       | Deferred (Batch 4)       | Partially done                |
| **Rollback Complexity**   | Simple                   | Moderate                      |
| **Risk Level**            | Low                      | Low-Moderate                  |
| **Scope Creep Risk**      | Low                      | Moderate (if not disciplined) |
| **Team Confidence**       | Medium                   | High                          |
| **Batch 4 Effort**        | Higher (more work left)  | Lower (foundation set)        |

---

## Default Recommendation: **Option B**

**Why?**

1. **Early validation:** Catch service→component wiring issues now, not in Batch 4
2. **Team confidence:** Show reviewers a working shell, not just imports
3. **Risk reduction:** Fix provider bugs in controlled Batch 3 scope
4. **Effort balance:** Option B saves time in Batch 4 (vs. Option A)
5. **Only 15 extra minutes:** 20 vs 35-40 is not a huge difference

**But with guardrails:**

```
Strict diff discipline:
✅ Create src/providers/ directory for minimal providers
✅ Add AppShell route wrapper that uses providers
✅ Update App.tsx or main shell route to wrap <BatchThreeProviders>
❌ Do NOT add new features or business logic
❌ Do NOT call service methods (keep providers basic)
❌ Do NOT update service implementations
❌ Do NOT change any component render logic
```

---

## How to Execute Option B

### Step 1: Identify Minimal Providers (5 min)

```bash
# Find which hooks are most commonly used in components
grep -r "use" apps/ValyntApp/src/legacy-restored/components/ \
  | grep "from '@hooks" | cut -d: -f2 | sort | uniq -c | sort -rn | head -10

# Expected top 3-5:
# - useAgentRegistry
# - useWorkflowState
# - useSessionManager
# - useUserContext
```

### Step 2: Create Minimal Providers (10 min)

```typescript
// src/providers/BatchThreeProviders.tsx
import { createContext, useContext, ReactNode } from 'react';
import { AgentRegistry } from '@services/AgentRegistry';
import { SessionManager } from '@services/SessionManager';
import { WorkflowStateService } from '@services/WorkflowStateService';

// Create contexts (simple, no logic)
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

### Step 3: Wire into AppShell (5 min)

```typescript
// src/App.tsx or main shell route
import { BatchThreeProviders } from '@providers/BatchThreeProviders';

export function App() {
  return (
    <BatchThreeProviders>
      <AppShell>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* other routes */}
        </Routes>
      </AppShell>
    </BatchThreeProviders>
  );
}
```

### Step 4: Run Smoke Test (5 min)

```bash
pnpm --filter valynt-app dev

# Open http://localhost:5173/dashboard
# Verify:
# ✅ Page loads (no 500 error)
# ✅ Dashboard component renders
# ✅ useAgentRegistry() hook works (not "context not found" error)
```

---

## If Choosing Option A: What to Do in Batch 4

If you choose Option A (import-only), Batch 4 must:

1. Create all providers (AgentRegistry, Workflow, Session, etc.)
2. Wrap AppShell with providers
3. Test that each component's hooks now work
4. Fix any type mismatches between component props and service returns

This is ~50% more work than Option B's provider setup.

---

## Diff Discipline for Option B

If choosing Option B, these are the **only allowed changes**:

```diff
✅ Create src/providers/BatchThreeProviders.tsx
✅ Update src/App.tsx to wrap with <BatchThreeProviders>
✅ Update src/hooks/index.ts to export context hooks
✅ Update component imports to use @services, @types, @lib

❌ Change service method signatures
❌ Add new business logic to providers
❌ Call service methods (providers should only instantiate)
❌ Modify component render logic
❌ Add new npm dependencies
```

---

## Recommendation Form (Complete Before Starting)

```markdown
## Batch 3 Integration Choice

**Chosen Strategy:** [ ] Option A (Components Only) / [X] Option B (Minimal Providers)

**Rationale:** (Fill in)

- Team wants early validation: YES/NO
- Time available: 20 min / 35-40 min / Don't care
- Risk tolerance: Low / Medium / High
- Previous provider architecture: Clear and documented / Messy / Unknown

**Constraints:**

- Must deploy by: [DATE]
- Other batches blocked on: [BATCH N]
- Team bandwidth: [# people available]

**Sign-Off:**

- Tech Lead: ******\_\_\_\_******
- PM: ******\_\_\_\_******
```

---

## Bottom Line

| Choose Option A If                        | Choose Option B If                |
| ----------------------------------------- | --------------------------------- |
| Time is critical (need Batch 3 in 20 min) | Want early validation             |
| Confident in Batch 4 to finish providers  | Want working shell sooner         |
| Risk-averse (minimal changes)             | Want team confidence / smoke test |
| Provider structure unknown                | Know which 3-5 providers needed   |
|                                           | Time permits 35-40 min            |

**Default (unless constrained otherwise):** **Option B**

---

**Next Step:** Fill out the Decision Form above, then proceed to MERGE_BATCH3_EXECUTION_CHECKLIST.md with your chosen option.
