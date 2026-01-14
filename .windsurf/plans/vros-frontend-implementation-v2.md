# VROS Frontend Implementation Plan v2

Updated implementation plan incorporating tenant API, WebSocket protocol, and persona strategy details from user clarifications.

---

## Integration Details (Clarified)

### 1. Tenant Access API

**Existing Infrastructure:**

- `TenantAwareService.getUserTenants(userId)` - queries `user_tenants` table
- `TenantContextResolver.hasTenantAccess(userId, tenantId)` - validates access
- No dedicated REST endpoint; use service methods directly

**Frontend Implementation:**

```typescript
// src/contexts/TenantContext.tsx
// Call TenantAwareService.getTenantContext() via API wrapper
// Store: { userId, tenantId, tenantIds[] }
```

### 2. WebSocket Message Format

**Existing Protocol** (`WebSocketManager.ts`):

```typescript
interface WebSocketMessage {
  type: string; // 'authenticate' | 'subscribe' | 'ping' | 'pong' | custom
  channel?: string; // e.g., 'agent:session-123'
  data: any;
  timestamp: string;
  messageId?: string;
}
```

**Agent State Channel Pattern:**

```typescript
// Subscribe to agent session
wsManager.subscribe(`agent:${sessionId}`, (data) => {
  // data.state: 'idle' | 'clarify' | 'plan' | 'execute' | 'review' | 'finalize' | 'resume'
  // data.reasoning?: string (streaming)
  // data.progress?: { current: number, total: number }
});
```

### 3. Persona Strategy

**Recommended Approach: Explicit Selection + Behavioral Hints**

| Layer                  | Purpose                        | Storage                              |
| ---------------------- | ------------------------------ | ------------------------------------ |
| **Persona** (identity) | Stable preference, UI defaults | `user_preferences.persona`           |
| **Mode** (intent)      | Current workspace context      | `workspace.mode` or URL param        |
| **Behavioral Score**   | Assistive suggestions          | Computed client-side, 14-day rolling |

**Implementation:**

1. **Onboarding**: Ask "What best describes what you're trying to do?" with options: Strategist / Closer / Grower / Not sure
2. **RBAC Mapping** (optional): Map roles to suggested persona
3. **Mode Switching**: Per-workspace toggle (Builder/Presenter/Tracker maps to persona context)
4. **Behavioral Inference**: Track actions, suggest mode switches, never auto-change persona

---

## Revised Sprint 0.5: Foundation Gaps (3 days)

### FE-007: TenantProvider with API Sync [P0, M]

**Files to create:**

- `src/contexts/TenantContext.tsx`
- `src/hooks/useTenant.ts`
- `src/api/tenant.ts`

**Implementation:**

```typescript
// src/api/tenant.ts
export async function fetchUserTenants(userId: string): Promise<TenantInfo[]> {
  // Call backend service that wraps TenantAwareService.getUserTenants
  const response = await apiClient.get(`/api/users/${userId}/tenants`);
  return response.data;
}

// src/contexts/TenantContext.tsx
interface TenantContextValue {
  currentTenant: TenantInfo | null;
  tenants: TenantInfo[];
  switchTenant: (tenantId: string) => Promise<void>;
  isValidating: boolean;
}
```

**Validation Logic:**

- Extract `orgId` from URL (`/org/:orgId/...`)
- Validate against `tenants[]` from API
- Reject with redirect if invalid
- Store validated tenant in context

### FE-008: Tenant Switcher [P0, S]

**Files to create:**

- `src/components/Layout/TenantSwitcher.tsx`
- `src/components/Layout/TenantBadge.tsx`

**Features:**

- Dropdown with tenant list
- Confirmation modal using `useDirtyState` hook
- Color-coded badge per tenant
- "Triple-lock" visual: icon + name + color

### FE-002: AppShell Enhancement [P0, S]

**Files to modify:**

- `src/components/Layout/MainLayout.tsx`
- `src/components/Layout/Header.tsx`

**Changes:**

- Add `<TenantBadge>` to header
- Integrate `<TenantSwitcher>` dropdown
- Apply tenant color to accent elements

---

## Sprint 1: Agent Workspace (2 weeks)

### FE-018: Agent State Machine [P0, M]

**Files to create:**

- `src/lib/agent/AgentStateMachine.ts`
- `src/lib/agent/types.ts`
- `src/hooks/useAgentState.ts`

**State Definition:**

```typescript
type AgentState =
  | "idle" // Waiting for input
  | "clarify" // Asking clarifying question
  | "plan" // Showing proposed plan
  | "execute" // Running tasks
  | "review" // Showing diff for approval
  | "finalize" // Committing results
  | "resume"; // Restoring previous session

interface AgentStateContext {
  state: AgentState;
  sessionId: string;
  plan?: PlanStep[];
  clarifyQuestion?: ClarifyQuestion;
  progress?: ExecutionProgress;
  diff?: ReviewDiff;
  error?: AgentError;
}
```

**WebSocket Integration:**

```typescript
// src/hooks/useAgentState.ts
export function useAgentState(sessionId: string) {
  const [state, dispatch] = useReducer(agentReducer, initialState);

  useEffect(() => {
    const unsubscribe = wsManager.subscribe(`agent:${sessionId}`, (msg) => {
      dispatch({ type: msg.type, payload: msg.data });
    });
    return unsubscribe;
  }, [sessionId]);

  return state;
}
```

### FE-019: Plan State UI [P0, M]

**Files to create:**

- `src/components/Agent/PlanApprovalPanel.tsx`
- `src/components/Agent/TaskCard.tsx`

**Features:**

- Staggered card animation (100ms delay)
- Token cost estimate display
- Actions: Approve All, Approve Step, Modify, Cancel
- Keyboard: `Shift+Enter` to approve

### FE-020: Execute State UI [P0, L]

**Files to create:**

- `src/components/Agent/ExecutionProgress.tsx`
- `src/components/Agent/StreamingReasoning.tsx`
- `src/components/Agent/ValidationPulse.tsx`

**Features:**

- Real-time reasoning stream in Context Brain
- Shimmer animation on active canvas cells
- Progress: X of Y tasks, elapsed time
- Pause with `Space` key
- Validation pulse (emerald shimmer) on data reconciliation

### FE-022: Clarify State UI [P0, S]

**Files to create:**

- `src/components/Agent/ClarifyCard.tsx`

**Features:**

- Amber glow visual treatment
- Auto-focus input
- Suggested options as clickable chips
- 60s timeout with friendly message

---

## Sprint 2: Review, Finalize & Home Hub (2 weeks)

### FE-026: Review State UI [P0, M]

**Files to create:**

- `src/components/Agent/ReviewDiffPanel.tsx`

**Features:**

- Side-by-side comparison
- Color coding: green (agent), blue (human), red (removed)
- Actions: Accept All, Accept Selected, Reject, Request Revision

### FE-027: Finalize State UI [P0, M]

**Files to create:**

- `src/components/Agent/FinalizePanel.tsx`

**Features:**

- Success animation (particle burst)
- Summary: what was created, storage location, next steps
- CRM sync progress indicator
- Error recovery on sync failure

### FE-030: Home Hub with Persona CTAs [P0, M]

**Files to modify:**

- `src/views/Home.tsx`
- `src/views/MissionControl.tsx`

**Files to create:**

- `src/components/Home/PersonaCTACard.tsx`
- `src/components/Home/PersonaSelector.tsx`

**Persona CTA Examples:**

- **Strategist**: "Your hypothesis for 'Tesla' needs 2 more data points"
- **Closer**: "3 deals ready for Story Mode"
- **Grower**: "2 QBRs due this week"

**Mode Selector:**

- Workspace-level toggle: Strategize / Close / Grow
- Persisted per workspace
- Affects: navigation defaults, suggested workflows, CTA prioritization

---

## New Files Summary

```
src/
├── api/
│   └── tenant.ts                    # NEW - Tenant API wrapper
├── contexts/
│   └── TenantContext.tsx            # NEW - React context
├── hooks/
│   ├── useTenant.ts                 # NEW
│   └── useAgentState.ts             # NEW
├── lib/
│   └── agent/
│       ├── AgentStateMachine.ts     # NEW
│       └── types.ts                 # NEW
├── components/
│   ├── Agent/
│   │   ├── PlanApprovalPanel.tsx    # NEW
│   │   ├── TaskCard.tsx             # NEW
│   │   ├── ExecutionProgress.tsx    # NEW
│   │   ├── StreamingReasoning.tsx   # NEW
│   │   ├── ValidationPulse.tsx      # NEW
│   │   ├── ClarifyCard.tsx          # NEW
│   │   ├── ReviewDiffPanel.tsx      # NEW
│   │   └── FinalizePanel.tsx        # NEW
│   ├── Home/
│   │   ├── PersonaCTACard.tsx       # NEW
│   │   └── PersonaSelector.tsx      # NEW
│   └── Layout/
│       ├── TenantSwitcher.tsx       # NEW
│       └── TenantBadge.tsx          # NEW
```

---

## Backend API Needed

The frontend requires one new API endpoint:

```typescript
// GET /api/users/:userId/tenants
// Returns: TenantInfo[] with { id, name, color, role }
// Implementation: Wrap TenantAwareService.getUserTenants + tenant metadata
```

This can be added to `app/api/admin/` or a new `app/api/users/` route.

---

## Next Steps

1. **Confirm** this plan aligns with priorities
2. **Backend**: Add `/api/users/:userId/tenants` endpoint (or confirm existing route)
3. **Start Sprint 0.5**: TenantContext implementation
4. **Feature branch**: `feature/vros-frontend-roadmap`

Ready to proceed with implementation on confirmation.
