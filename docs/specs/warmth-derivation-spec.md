# Warmth Derivation Specification

**Status**: Draft — requires backend team sign-off  
**Owner**: Frontend + Backend co-authored  
**Canonical types**: `packages/shared/src/domain/Warmth.ts`

---

## 1. Overview

The warmth system translates the technical saga lifecycle into a three-state
perceptual model that non-technical users can understand at a glance:

| Warmth State | Saga States | User Perception |
|-------------|-------------|-----------------|
| **forming** | `INITIATED`, `DRAFTING` | "This case is taking shape" |
| **firm** | `VALIDATING`, `COMPOSING` | "This case has strong evidence" |
| **verified** | `REFINING`, `FINALIZED` | "This case is ready for decisions" |

## 2. Derivation Rules

### Rule 1: saga_state is ALWAYS authoritative

The `SagaState` from `ValueCaseSaga.ts` determines the base warmth state.
No other signal can override this mapping.

```
INITIATED  → forming
DRAFTING   → forming
VALIDATING → firm
COMPOSING  → firm
REFINING   → verified
FINALIZED  → verified
```

### Rule 2: confidence_score adds visual modifiers only

Confidence modifiers provide sub-state indicators but never change the base
warmth state. They are visual hints, not state changes.

| Condition | Modifier | Visual Effect |
|-----------|----------|---------------|
| `forming` + confidence ≥ 0.7 | `firming` | Trending-up icon, progress hint |
| `verified` + confidence < 0.5 | `needs_review` | Warning icon, review prompt |

### Rule 3: Backward transitions immediately change warmth

The saga machine supports backward transitions via vetoes and objections:

| Trigger | Transition | Warmth Change |
|---------|-----------|---------------|
| `INTEGRITY_VETOED` | VALIDATING → DRAFTING | firm → forming |
| `REDTEAM_OBJECTION` | COMPOSING → DRAFTING | firm → forming |
| `USER_FEEDBACK` | REFINING → DRAFTING | verified → forming |

These are **immediate** — the UI must reflect the regression without delay.

## 3. Conflict Resolution

**Scenario**: saga_state = `DRAFTING` (forming) but confidence = 0.85

**Resolution**: Warmth = `forming` with `firming` modifier.
The high confidence suggests the case is progressing well, but the saga machine
has not yet advanced to `VALIDATING`. The user sees "Forming" with a subtle
"firming up" indicator.

**Scenario**: saga_state = `REFINING` (verified) but confidence = 0.3

**Resolution**: Warmth = `verified` with `needs_review` modifier.
The saga machine considers this case verified, but confidence has dropped.
The user sees "Verified" with a "needs review" warning.

## 4. Existing Mapping Functions

The following backend functions currently translate saga state. They remain
operational and are not replaced by warmth — warmth is an additional layer.

| Function | Location | Purpose | Warmth Relationship |
|----------|----------|---------|-------------------|
| `mapSagaStateToLifecycleStage` | `packages/backend/src/api/experience.ts` | Saga → lifecycle label | Parallel, not replaced |
| `mapSagaStateToBusinessCaseStatus` | `packages/backend/src/api/experience.ts` | Saga → business status | Parallel, not replaced |
| `mapStageToSagaState` | `packages/backend/src/services/post-v1/ValueLifecycleOrchestrator.ts` | Legacy stage → saga | Upstream input |
| `UI_STATE_MAPPINGS` | `packages/sdui/src/StateUIMap.ts` | (saga, workflow) → UI | Extended with warmth field |

## 5. Edge Cases

### Workflow failure during a saga state

When `workflow_status = "failed"` but `saga_state` hasn't changed:
- Warmth state stays the same (saga-authoritative)
- UI indicator (from existing `UIStateMapping`) shows error
- Copilot surfaces the failure for user action

### Missing confidence score

If `confidence_score` is `null` or `undefined`:
- No modifier applied
- Base warmth from saga_state only

### New saga states in future

If a saga state is added that isn't in the mapping:
- `deriveWarmth` should default to `"forming"` with a logged warning
- This prevents UI crashes while signaling a contract mismatch

## 6. Backend Requirements

For warmth to work, the backend must ensure:

- [ ] Every case fetch response includes `saga_state` (already present)
- [ ] Every case fetch response includes `confidence_score` (verify availability)
- [ ] SSE events include `WARMTH_TRANSITION` when saga state changes
- [ ] The `JourneyOrchestrator` output includes a `warmth_state` field

## 7. Frontend Contract

The frontend consumes warmth via:

```typescript
import { deriveWarmth } from "@valueos/shared/domain/Warmth";

const result = deriveWarmth(case.saga_state, case.confidence_score);
// result.state: "forming" | "firm" | "verified"
// result.modifier: "firming" | "needs_review" | null
```

The `WarmthResult` is then used to:
1. Select visual tokens (border style, color, animation)
2. Choose default workspace mode
3. Drive SDUI component variants
4. Filter and sort case lists
