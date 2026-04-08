# ADR: SDUI Warmth Integration Architecture

**Status**: Accepted  
**Date**: 2026-04-07  
**Decision**: Extend existing SDUI system with warmth-aware components

---

## Context

The ValueOS frontend has an established Server-Driven UI (SDUI) system:

| Location | Purpose |
|----------|---------|
| `packages/sdui/src/registry.tsx` | Component registry |
| `packages/sdui/src/StateUIMap.ts` | State-to-UI configuration (30 mappings) |
| `apps/ValyntApp/src/features/sdui/` | Renderer, types |
| `apps/ValyntApp/src/components/SDUI/` | DiscoveryCard, NarrativeBlock, KPIForm, etc. |
| `apps/ValyntApp/src/components/sdui/` | ValueGraphVisualization |
| `apps/ValyntApp/src/lib/state/SDUIStateProvider.tsx` | State management |
| `config/ui-registry.json` | Dual registration (per AGENTS.md) |

The frontend redesign introduces a warmth system (`forming` / `firm` / `verified`)
and three workspace modes (Canvas / Narrative / Copilot). These need UI components
that can be driven by the backend JourneyOrchestrator.

## Decision

**Extend the existing SDUI system. Do not create a parallel component architecture.**

### Rationale

1. The SDUI system already maps `(saga_state, workflow_status)` → UI components
2. `JourneyOrchestrator` already produces `SDUIPageDefinitions`
3. Adding warmth metadata to the existing schema is additive, not breaking
4. A parallel system would create competing rendering paths and confuse developers

## Changes Required

### 1. Schema Extension (`packages/shared/src/domain/ExperienceModel.ts`)

Add to `UIStateMappingSchema`:
- `warmth_state: WarmthStateSchema` — derived warmth
- `warmth_modifier: WarmthModifierSchema` — confidence sub-state
- `default_mode: WorkspaceModeSchema` — suggested workspace mode
- `operational_state` — deep state for inspector panel

### 2. New SDUI Components (register in both registry.tsx AND ui-registry.json)

**Phase 1-2**:
- `WarmthCard` — Container with warmth-appropriate styling
- `WarmthBadge` — Status indicator with modifier icon
- `WarmthHeader` — Page header with dual-layer toggle

**Phase 2**:
- `CopilotPanel` — Contextual chat (SDUI-renderable)
- `NarrativeStream` — Living document timeline
- `EvidencePanel` — Confidence + sources
- `InspectorPanel` — Dual-layer status

**Phase 3**:
- `ReviewSummary` — Executive summary with trust signals
- `ReviewAssumptions` — Assumptions at risk
- `ReviewApproval` — Approval workflow

### 3. Case Inconsistency Resolution

**Problem**: `src/components/SDUI/` (uppercase) and `src/components/sdui/` (lowercase) coexist.

**Resolution** (Phase 1):
1. Move `ValueGraphVisualization` from `sdui/` into `SDUI/`
2. Delete empty `sdui/` directory
3. Rename `SDUI/` to `sdui/` (lowercase, matching convention)
4. Update all import paths

## Consequences

### Positive
- Single rendering path for agent-driven UI
- Warmth components automatically benefit from SDUI state management
- JourneyOrchestrator can emit warmth-aware page definitions

### Negative
- Existing SDUI tests may need updates for new schema fields
- Component registry grows larger (mitigated by lazy loading)

### Neutral
- Existing SDUI components continue working unchanged
- New components are additive
