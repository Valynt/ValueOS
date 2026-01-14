# VROS Frontend Roadmap Implementation Plan

Implementation plan for the VROS Frontend Roadmap, mapping 55 tickets across 17 epics to the existing ValueOS codebase with gap analysis and prioritized execution order.

---

## Executive Summary

The ValueOS codebase is **more mature than the roadmap assumes**. Many Sprint 0 foundation items already exist. The primary gaps are in:

1. **Tenant Context UI** - Backend exists, frontend provider/switcher missing
2. **Agent Workspace 7-State Model** - Partial implementation, needs state machine formalization
3. **Home Hub / Mission Control** - Basic view exists, needs persona CTAs and ticker
4. **Billing UI** - Components exist but dashboard incomplete

**Recommended approach**: Skip redundant Sprint 0 items, focus on Sprint 1 Agent Workspace and Sprint 2 Home Hub.

---

## Gap Analysis: Existing vs Required

### ✅ Already Implemented (Skip or Enhance)

| Ticket | Requirement            | Existing Implementation                                         | Action                                 |
| ------ | ---------------------- | --------------------------------------------------------------- | -------------------------------------- |
| FE-001 | Centralized Env Config | `src/config/environment.ts` - Full typed config with validation | **SKIP**                               |
| FE-003 | Global Error Boundary  | `src/components/ErrorBoundary.tsx` - Root + template boundaries | **SKIP**                               |
| FE-004 | Route Code Splitting   | `src/AppRoutes.tsx` - All routes use `React.lazy`               | **SKIP**                               |
| FE-005 | Auth Flow              | `src/contexts/AuthContext.tsx` + `SecureTokenManager`           | **ENHANCE** - Add session expiry modal |
| FE-006 | Protected Route        | `src/components/Auth/ProtectedRoute.tsx`                        | **ENHANCE** - Add role-based access    |
| FE-009 | Design Tokens          | `src/index.css` - VALYNT tokens, 8px grid, CSS vars             | **SKIP**                               |
| FE-010 | UI Primitives          | `src/components/ui/*` - Button, Card, Dialog, Input, etc.       | **ENHANCE** - Add Skeleton, EmptyState |
| FE-012 | Event Tracking         | `src/lib/analyticsClient.ts` - Segment + Intercom               | **ENHANCE** - Add tenant context       |
| FE-014 | Split-Pane Layout      | `src/components/ChatCanvas/ChatCanvasLayout.tsx` - 2100+ lines  | **ENHANCE** - Add resize persistence   |
| FE-016 | Conversation Thread    | Exists in ChatCanvasLayout                                      | **ENHANCE** - Add reasoning links      |
| FE-017 | Prompt Bar             | `src/components/Agent/CommandBar.tsx`                           | **ENHANCE** - Add mention support      |

### 🔶 Partial Implementation (Needs Work)

| Ticket | Requirement                 | Current State                               | Gap                             |
| ------ | --------------------------- | ------------------------------------------- | ------------------------------- |
| FE-002 | AppShell with Tenant Header | `MainLayout.tsx` exists, no tenant badge    | Add tenant badge, color coding  |
| FE-007 | TenantProvider              | `src/sdui/TenantContext.ts` (types only)    | Need React context provider     |
| FE-008 | Tenant Switcher             | None                                        | Full implementation needed      |
| FE-011 | Loading/Empty States        | `EmptyState.tsx` exists, no skeletons       | Add skeleton components         |
| FE-015 | OmniInput                   | CommandBar exists                           | Add URL detection, autocomplete |
| FE-018 | Agent State Machine         | Implicit in ChatCanvasLayout                | Formalize 7-state model         |
| FE-021 | Agent WebSocket             | `useRealtimeUpdates.tsx` exists             | Adapt for agent streaming       |
| FE-023 | ROI Canvas                  | `src/views/ROICalculator.tsx` exists        | Add confidence highlighting     |
| FE-030 | Home Hub                    | `src/views/Home.tsx` + `MissionControl.tsx` | Add persona CTAs, ticker        |
| FE-036 | Billing Dashboard           | `src/views/Settings/BillingDashboard.tsx`   | Add cost vs value metrics       |

### ❌ Missing (Full Implementation Needed)

| Ticket | Requirement                   | Priority |
| ------ | ----------------------------- | -------- |
| FE-019 | Plan State UI (Approval Gate) | P0       |
| FE-020 | Execute State UI (Streaming)  | P0       |
| FE-022 | Clarify State UI              | P0       |
| FE-024 | Value Driver Cards            | P0       |
| FE-025 | Source Attribution Drawer     | P1       |
| FE-026 | Review State UI (Diff)        | P0       |
| FE-027 | Finalize State UI             | P0       |
| FE-028 | Error Recovery Modal          | P0       |
| FE-029 | Resume State UI               | P0       |
| FE-031 | Flight Control Ticker         | P1       |
| FE-032 | Persona CTA Cards             | P1       |
| FE-034 | Mode Selector                 | P1       |
| FE-037 | Cost Estimator Modal          | P1       |
| FE-043 | Keyboard Navigation Audit     | P0       |
| FE-047 | Global Command Palette        | P2       |
| FE-048 | Engine Room (Logs Drawer)     | P2       |

---

## Revised Sprint Plan

### Sprint 0.5: Foundation Gaps (3 days)

Focus only on missing foundation pieces.

#### Priority Tasks

1. **FE-007: TenantProvider with API Sync** [P0, M]
   - Create `src/contexts/TenantContext.tsx`
   - Wrap `AuthProvider` children
   - Validate tenant from URL against user's allowed tenants
   - Files to create:
     - `src/contexts/TenantContext.tsx`
     - `src/hooks/useTenant.ts`

2. **FE-008: Tenant Switcher with Confirmation** [P0, S]
   - Add to AppShell header
   - Use `useDirtyState` hook (already exists)
   - Files to create:
     - `src/components/Layout/TenantSwitcher.tsx`
     - `src/components/Layout/TenantBadge.tsx`

3. **FE-002: AppShell Enhancement** [P0, M]
   - Modify `src/components/Layout/MainLayout.tsx`
   - Add tenant badge to header
   - Add tenant color theming

4. **FE-011: Skeleton Components** [P0, S]
   - Create content-aware skeletons
   - Files to create:
     - `src/components/ui/skeleton.tsx`
     - `src/components/Common/ContentSkeleton.tsx`

5. **FE-005 Enhancement: Session Expiry Modal** [P0, S]
   - Add modal on 401 response
   - Files to create:
     - `src/components/Auth/SessionExpiredModal.tsx`

---

### Sprint 1: Agent Workspace Core (2 weeks)

#### Week 1: State Machine & Streaming

1. **FE-018: Agent State Machine** [P0, M]
   - Create formal state machine with XState or Zustand
   - States: Idle, Clarify, Plan, Execute, Review, Finalize, Resume
   - Files to create:
     - `src/lib/agent/AgentStateMachine.ts`
     - `src/hooks/useAgentState.ts`

2. **FE-021: Agent WebSocket Hook Enhancement** [P0, M]
   - Extend `useRealtimeUpdates` for agent-specific events
   - Add message type handling
   - Files to modify:
     - `src/hooks/useRealtimeUpdates.tsx`
   - Files to create:
     - `src/hooks/useAgentStream.ts`

3. **FE-019: Plan State UI** [P0, M]
   - Approval gate with task cards
   - Staggered animation
   - Files to create:
     - `src/components/Agent/PlanApprovalPanel.tsx`
     - `src/components/Agent/TaskCard.tsx`

4. **FE-022: Clarify State UI** [P0, S]
   - Question card with smart defaults
   - Files to create:
     - `src/components/Agent/ClarifyCard.tsx`

#### Week 2: Execute & Canvas

5. **FE-020: Execute State UI** [P0, L]
   - Real-time streaming feedback
   - Shimmer animations on active cells
   - Pause functionality
   - Files to create:
     - `src/components/Agent/ExecutionProgress.tsx`
     - `src/components/Agent/StreamingReasoning.tsx`

6. **FE-015: OmniInput Enhancement** [P0, M]
   - URL detection regex
   - Company autocomplete
   - Files to modify:
     - `src/components/Agent/CommandBar.tsx`

7. **FE-023: ROI Canvas Enhancement** [P0, L]
   - Add confidence highlighting
   - Source attribution badges
   - Files to modify:
     - `src/views/ROICalculator.tsx`
   - Files to create:
     - `src/components/Canvas/ConfidenceBadge.tsx`

8. **FE-024: Value Driver Cards** [P0, M]
   - Drag-and-drop reordering
   - Reasoning links
   - Files to create:
     - `src/components/Canvas/ValueDriverCard.tsx`

---

### Sprint 2: Review, Finalize & Home Hub (2 weeks)

#### Week 1: Completion Flow

1. **FE-026: Review State UI** [P0, M]
   - Side-by-side diff comparison
   - Files to create:
     - `src/components/Agent/ReviewDiffPanel.tsx`

2. **FE-027: Finalize State UI** [P0, M]
   - Success animation
   - CRM sync progress
   - Files to create:
     - `src/components/Agent/FinalizePanel.tsx`

3. **FE-028: Error Recovery Modal** [P0, M]
   - Actionable alternatives
   - Files to create:
     - `src/components/Modals/AgentErrorRecoveryModal.tsx`

4. **FE-029: Resume State UI** [P0, M]
   - Session restoration banner
   - Files to modify:
     - `src/components/ChatCanvas/SessionResumeBanner.tsx` (exists)

5. **FE-025: Source Attribution Drawer** [P1, M]
   - PDF viewer integration
   - Files to create:
     - `src/components/Canvas/SourceDrawer.tsx`

#### Week 2: Home Hub

6. **FE-030: Home Hub Enhancement** [P0, M]
   - Persona-specific layout
   - Files to modify:
     - `src/views/Home.tsx`
     - `src/views/MissionControl.tsx`

7. **FE-031: Flight Control Ticker** [P1, S]
   - Real-time agent activity
   - Files to create:
     - `src/components/Layout/FlightControlTicker.tsx`

8. **FE-032: Persona CTA Cards** [P1, M]
   - Dynamic based on user workload
   - Files to create:
     - `src/components/Home/PersonaCTACard.tsx`

9. **FE-034: Mode Selector** [P1, M]
   - Builder/Presenter/Tracker toggle
   - Files to create:
     - `src/components/Layout/ModeSelector.tsx`

---

### Sprint 3: Billing, Settings & Polish (2 weeks)

#### Week 1: Billing & Settings

1. **FE-036: Billing Dashboard Enhancement** [P0, M]
   - Cost vs value metrics
   - Files to modify:
     - `src/views/Settings/BillingDashboard.tsx`

2. **FE-037: Cost Estimator Modal** [P1, M]
   - Pre-execution cost estimate
   - Files to create:
     - `src/components/Modals/CostEstimatorModal.tsx`

3. **FE-040: Team Members Enhancement** [P0, M]
   - Files to modify:
     - `src/views/Settings/OrganizationUsers.tsx`

4. **FE-042: Access Denied Pattern** [P0, S]
   - Files to create:
     - `src/components/Auth/AccessDenied.tsx`

#### Week 2: Accessibility & Polish

5. **FE-043: Keyboard Navigation Audit** [P0, M]
   - Implement shortcuts: `Cmd+K`, `Cmd+J`, `Space`, `Shift+Enter`
   - Files to modify:
     - `src/hooks/useKeyboardShortcuts.ts`

6. **FE-044: Screen Reader Optimization** [P0, M]
   - Add aria-live regions
   - Audit all components

7. **FE-045: Motion & Animation Polish** [P1, M]
   - Implement spec animations
   - Files to create:
     - `src/styles/animations.css`

8. **FE-047: Global Command Palette** [P2, M]
   - Enhance existing CommandBar
   - Files to modify:
     - `src/components/Agent/CommandBar.tsx`

9. **FE-048: Engine Room (Logs Drawer)** [P2, M]
   - Files to create:
     - `src/components/Layout/EngineRoomDrawer.tsx`

---

### Sprint 4: Testing & Hardening (1 week)

1. **FE-049: Unit Test Coverage** [P0, L]
   - Target 70% on business logic
   - Focus: state machines, tenant validation, API client

2. **FE-050: Component Test Suite** [P0, M]
   - Test all new components

3. **FE-051: E2E Smoke Tests** [P0, M]
   - Critical journeys in Playwright
   - Files to create:
     - `test/playwright/agent-workflow.spec.ts`
     - `test/playwright/tenant-isolation.spec.ts`

4. **FE-053: CI Pipeline Enhancement** [P0, M]
   - Add bundle size check
   - Add secret leak detection

---

## File Structure Changes

```
src/
├── contexts/
│   └── TenantContext.tsx          # NEW
├── hooks/
│   ├── useTenant.ts               # NEW
│   ├── useAgentState.ts           # NEW
│   └── useAgentStream.ts          # NEW
├── lib/
│   └── agent/
│       └── AgentStateMachine.ts   # NEW
├── components/
│   ├── Agent/
│   │   ├── PlanApprovalPanel.tsx  # NEW
│   │   ├── TaskCard.tsx           # NEW
│   │   ├── ClarifyCard.tsx        # NEW
│   │   ├── ExecutionProgress.tsx  # NEW
│   │   ├── StreamingReasoning.tsx # NEW
│   │   ├── ReviewDiffPanel.tsx    # NEW
│   │   └── FinalizePanel.tsx      # NEW
│   ├── Auth/
│   │   ├── SessionExpiredModal.tsx # NEW
│   │   └── AccessDenied.tsx       # NEW
│   ├── Canvas/
│   │   ├── ValueDriverCard.tsx    # NEW
│   │   ├── ConfidenceBadge.tsx    # NEW
│   │   └── SourceDrawer.tsx       # NEW
│   ├── Home/
│   │   └── PersonaCTACard.tsx     # NEW
│   ├── Layout/
│   │   ├── TenantSwitcher.tsx     # NEW
│   │   ├── TenantBadge.tsx        # NEW
│   │   ├── FlightControlTicker.tsx # NEW
│   │   ├── ModeSelector.tsx       # NEW
│   │   └── EngineRoomDrawer.tsx   # NEW
│   ├── Modals/
│   │   ├── AgentErrorRecoveryModal.tsx # NEW
│   │   └── CostEstimatorModal.tsx # NEW
│   └── ui/
│       └── skeleton.tsx           # NEW
├── styles/
│   └── animations.css             # NEW
└── test/
    └── playwright/
        ├── agent-workflow.spec.ts # NEW
        └── tenant-isolation.spec.ts # NEW
```

---

## Effort Estimate (Revised)

| Sprint | Duration | New Files | Modified Files | Effort |
| ------ | -------- | --------- | -------------- | ------ |
| 0.5    | 3 days   | 6         | 3              | S      |
| 1      | 2 weeks  | 10        | 4              | L      |
| 2      | 2 weeks  | 8         | 4              | L      |
| 3      | 2 weeks  | 5         | 5              | M      |
| 4      | 1 week   | 2         | 2              | M      |

**Total**: ~7 weeks with 2-3 frontend engineers

---

## Critical Path

```
TenantContext (FE-007)
    ↓
TenantSwitcher (FE-008) + AppShell (FE-002)
    ↓
AgentStateMachine (FE-018)
    ↓
Plan/Execute/Clarify States (FE-019, FE-020, FE-022)
    ↓
Review/Finalize (FE-026, FE-027)
    ↓
Home Hub (FE-030, FE-031, FE-032)
    ↓
Testing (FE-049, FE-051)
```

---

## Questions for Clarification

1. **Tenant API**: Is there an existing API endpoint for fetching user's allowed tenants?
2. **Agent WebSocket Protocol**: What is the exact message format for agent state changes?
3. **CRM Integration**: Which CRM systems need sync support in FE-027?
4. **Persona Detection**: How is user persona (Strategist/Closer/Grower) determined?

---

## Next Steps

1. Confirm this plan aligns with priorities
2. Start Sprint 0.5 with TenantContext implementation
3. Set up feature branch: `feature/vros-frontend-roadmap`
