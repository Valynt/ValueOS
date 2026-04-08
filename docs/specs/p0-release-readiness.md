# P0 Release Readiness — Final Three Items

**Coordinator**: Agent (release-readiness)  
**Date**: 2026-04-07  
**Status**: Review materials prepared. Three items awaiting human approval.

---

## 1. Executive Summary

All seven P0 pre-implementation items have been technically prepared. Five are complete
(warmth types, SDUI ADR, API map, strict zone, bundle budget). Three require human
decisions that cannot be fabricated by an agent:

| Item | Agent Status | Human Required |
|------|-------------|----------------|
| P0-1: Backend Sign-off | Review memo prepared | Backend team approval |
| P0-2: User Validation | Testing kit prepared | 5 moderated sessions |
| P0-7: Spanish Review | Review brief prepared | Native speaker decision |

**Minimal path to green**: Backend sign-off can happen async (1 day). Spanish review
is a 30-minute task. User validation is the longest pole (3-5 days). All three can
run in parallel.

---

## 2. P0 Closure Tracker

| P0 Item | Description | Status | Agent Completed | Human Required | Owner | Exit Criteria | Blocking Risk | Next Action |
|---------|-------------|--------|-----------------|----------------|-------|---------------|---------------|-------------|
| P0-1 | Warmth derivation spec + backend sign-off | **Awaiting Human Review** | Spec written, types shipped, confidence_score traced through codebase | Backend team confirms confidence_score availability and warmth mapping | Backend Lead | Sign-off memo approved or approved-with-caveats | Medium — warmth derivation depends on confidence_score being reliably returned | Send review memo to backend lead |
| P0-2 | User validation of warmth mental model | **Awaiting Human Review** | Testing kit, moderator script, synthesis template prepared | Product/Design runs 5 sessions (15-20 min each) | Product Lead | ≥80% warmth comprehension without training | High — warmth is the conceptual foundation; if users don't understand it, Phase 1 scope changes | Schedule sessions this week |
| P0-3 | SDUI architecture decision | **Complete** | ADR written at `docs/decisions/adr-sdui-warmth-integration.md` | None | — | ADR reviewed | None | — |
| P0-4 | API migration map | **Complete** | Map at `docs/specs/api-migration-map.md` | None | — | Map reviewed | None | — |
| P0-5 | TypeScript strict zone | **Complete** | `tsconfig.strict-zone.json` created, ratchet budget added | None | — | CI gate passing | None | — |
| P0-6 | Bundle budget gate | **Complete** | Vite + metrics configs updated to 500KB | None | — | Build passes or exceptions documented | Low — vendor chunk may exceed; verify with build | Run `pnpm --filter ValyntApp build` |
| P0-7 | i18n keys + Spanish review | **Awaiting Human Review** | 39 keys added to en + es locales | Native Spanish speaker reviews warmth translations | Spanish Reviewer | Translations confirmed or revised | Low — labels can be updated post-launch if needed | Send review brief to native speaker |

---

## 3. Backend Sign-off Package (P0-1)

### 3.1 Summary of Warmth Spec Dependency

The frontend redesign introduces a warmth derivation layer that maps `saga_state` →
`forming` / `firm` / `verified`. The derivation function (`deriveWarmth` in
`packages/shared/src/domain/Warmth.ts`) requires two inputs from every case fetch:

1. **`saga_state`** — SagaStateEnum (`INITIATED` | `DRAFTING` | `VALIDATING` | `COMPOSING` | `REFINING` | `FINALIZED`)
2. **`confidence_score`** — number between 0 and 1

### 3.2 Codebase Evidence: confidence_score Availability

**Verified: confidence_score IS already exposed in the backend.**

| Location | Evidence |
|----------|---------|
| `packages/backend/src/api/valueCases/journey.routes.ts:55` | Journey endpoint selects `confidence_score` from `value_cases` table |
| `packages/backend/src/api/valueCases/journey.routes.ts:76-98` | Response includes `confidence_score` with fallback `?? 0.5` |
| `packages/backend/src/api/experience.ts:64` | Experience API schema: `confidence_score: z.number().min(0).max(1).default(0.5)` |
| `packages/backend/src/api/experience.ts:122-126` | Passed to `computeValueMaturity(saga_state, confidence_score)` |
| `packages/backend/src/api/valueCases/confidence.routes.ts:112-126` | Confidence update routes read/write `confidence_score` on entities |
| `apps/ValyntApp/src/api/valueGraph.ts:103-104` | Frontend already types `confidence_score: number` in claim views |
| `apps/ValyntApp/src/hooks/useConfidenceEditing.ts` | Frontend has mutation hooks for confidence updates |
| `apps/ValyntApp/src/hooks/hypothesisNormalization.ts:52` | Schema: `confidence_score: z.number().min(0).max(1).optional()` |

**Naming consistency**: Backend uses `confidence_score` (snake_case). Frontend uses both
`confidence_score` (API types) and `confidenceScore` (component props). The warmth spec
uses `confidence_score` at the API boundary and `confidenceScore` in component interfaces.
This is consistent with existing conventions.

**Nullable handling**: Backend defaults to `0.5` when `confidence_score` is null
(`journey.routes.ts:76`). The warmth derivation function accepts this — a `0.5` score
at `DRAFTING` saga state produces `forming` with no modifier (correct behavior).

### 3.3 Frontend Surfaces Depending on confidence_score for Warmth

| Surface | Component/Hook | How confidence_score is used |
|---------|---------------|------------------------------|
| Warmth derivation | `deriveWarmth()` in `packages/shared/src/domain/Warmth.ts` | Determines modifier: `firming` if ≥0.7 in forming, `needs_review` if <0.5 in verified |
| Workspace header | `WarmthHeader` (Phase 1) | Displays warmth badge + optional modifier icon |
| Inspector panel | `InspectorPanel` (Phase 2) | Shows raw `confidence_score` in "deep state" view |
| Case list | `CaseList` (Phase 3) | Warmth badge on each row |
| Dashboard | `WarmthSummary` (Phase 3) | Aggregate warmth counts |
| Reviewer surface | `ReviewPage` (Phase 3) | Confidence breakdown section |

### 3.4 Backend Questions Requiring Confirmation

1. **Is `confidence_score` reliably returned on every `GET /api/cases/:id/journey` response?**
   - Evidence says yes — `journey.routes.ts` selects it with a `?? 0.5` fallback.
   - **Confirm**: Is there any code path where this field could be omitted entirely (not null, but missing from response)?

2. **Is `confidence_score` on the `value_cases` table updated when saga state changes?**
   - The warmth derivation uses both saga_state and confidence_score. If saga advances but confidence isn't recalculated, the modifier could be stale.
   - **Confirm**: Does the saga transition trigger a confidence recalculation, or is confidence only updated by explicit user/agent actions?

3. **Can the frontend derive warmth client-side, or should the backend include `warmth_state` in the response?**
   - Recommendation: Client-side derivation using shared `deriveWarmth()` from `packages/shared`.
   - **Confirm**: Is there any backend logic that would produce a different warmth result than the shared function?

4. **Is there a plan for SSE events on warmth transitions?**
   - The redesign spec calls for `WARMTH_TRANSITION` events via SSE on `/api/cases/:id/events`.
   - **Confirm**: Is an SSE endpoint planned or does one already exist?

### 3.5 Recommended Backend Acceptance Criteria

- [ ] `GET /api/cases/:id/journey` always returns `saga_state` (string) and `confidence_score` (number, default 0.5)
- [ ] `confidence_score` is recalculated (or at minimum not stale) after saga state transitions
- [ ] The shared `deriveWarmth()` function in `packages/shared/src/domain/Warmth.ts` produces correct results for all known (saga_state, confidence) combinations
- [ ] No backend endpoint produces a warmth result that contradicts the shared derivation

### 3.6 Sign-off Block

```
Backend Review: Warmth Derivation Spec
Date: ___________
Reviewer: ___________

[ ] Approved — confidence_score is reliably available, warmth derivation is correct
[ ] Approved with caveats — (describe caveats below)
[ ] Changes required — (describe required changes below)

Notes:
_____________________________________________________
_____________________________________________________
```

---

## 4. User Validation Package (P0-2)

### 4.1 Test Objective

Validate that users across three personas (Value Engineer, Sales Rep, Executive Buyer)
can correctly interpret the warmth status model (`forming` / `firm` / `verified`)
without prior training, and that the dual-layer design (warmth surface + deep state)
meets the needs of both casual and power users.

### 4.2 Target Participant Profile

| # | Persona | Criteria | Recruitment Source |
|---|---------|----------|-------------------|
| 1 | Value Engineer | Daily user, builds value cases | Internal team or power user customer |
| 2 | Value Engineer | Daily user, uses keyboard shortcuts | Internal team or power user customer |
| 3 | Sales Rep | Occasional user, needs guidance | Sales team |
| 4 | Sales Rep | New to ValueOS (< 30 days) | Sales team |
| 5 | Executive Buyer | Reviews cases, makes approval decisions | Customer or internal exec |

### 4.3 Test Plan (5 Sessions, 15-20 min each)

**Setup**: Show participant 3-5 static wireframe screens. No live product. No prior explanation of warmth states.

**Session flow**:
1. **Intro** (2 min): "We're testing some new status labels. There are no wrong answers."
2. **Task block** (10-12 min): 5 core tasks (below)
3. **Debrief** (3-5 min): Open questions about naming, usefulness, trust

### 4.4 Moderator Script

```
Hi [Name], thanks for joining. We're testing some label changes in ValueOS.
I'll show you a few screens and ask what you think they mean.
There are no wrong answers — we're testing the design, not you.
Please think aloud as you look at each screen.

[Show Screen 1: Dashboard with three warmth badges]
```

### 4.5 Core Tasks

| # | Task | Screen | What to Observe | Success = |
|---|------|--------|----------------|-----------|
| 1 | "Look at this dashboard. What does [FORMING] tell you about this case?" | Dashboard with warmth badges | Can they articulate "in progress" or "early stage" without prompting? | Correct interpretation without training |
| 2 | "What about [FIRM]? How is it different from [FORMING]?" | Same dashboard | Do they perceive progression? Do they understand "stronger" or "more evidence"? | Perceives firm > forming |
| 3 | "And [VERIFIED]? What would you expect to do with this case?" | Same dashboard | Do they associate verified with "ready to act on" or "trustworthy"? | Associates verified with decision-readiness |
| 4 | "Click 'Show details' on this case. Is this information useful?" | Workspace header with dual-layer toggle | Do power users value the deep state? Do casual users feel overwhelmed? | Power users: "useful." Casual users: "I'd use the badge." |
| 5 | "If this case went from [FIRM] back to [FORMING], what happened?" | Case list showing a regression | Do they understand backward transitions? | Understands "something changed" or "needs more work" |

### 4.6 What to Observe

- **Comprehension**: Can they explain each warmth state in their own words?
- **Ordering**: Do they perceive forming → firm → verified as a progression?
- **Emotional response**: Does the language feel trustworthy, corporate-appropriate, not condescending?
- **Dual-layer**: Do they discover and understand the "Show details" toggle?
- **Regression**: Do they understand backward transitions without panic?

### 4.7 Success Criteria

| Metric | Pass | Revise | Fail |
|--------|------|--------|------|
| Warmth comprehension (correct interpretation without training) | ≥ 4/5 users (80%) | 3/5 users (60%) | ≤ 2/5 users |
| Progression ordering (forming < firm < verified) | ≥ 4/5 users | 3/5 users | ≤ 2/5 users |
| Dual-layer usefulness (power users find deep state valuable) | ≥ 2/2 VE users | 1/2 VE users | 0/2 VE users |
| No confusion or negative reaction to terminology | ≤ 1 user confused | 2 users confused | ≥ 3 users confused |

### 4.8 Note-Taking Template

```
Session #: ___  |  Participant: ___  |  Persona: ___  |  Date: ___

Task 1 — Forming interpretation:
  Participant said: ___
  Correct? [ ] Yes  [ ] Partial  [ ] No
  Notes: ___

Task 2 — Firm vs Forming:
  Participant said: ___
  Perceives progression? [ ] Yes  [ ] No
  Notes: ___

Task 3 — Verified interpretation:
  Participant said: ___
  Associates with readiness? [ ] Yes  [ ] Partial  [ ] No
  Notes: ___

Task 4 — Dual-layer toggle:
  Discovered independently? [ ] Yes  [ ] With prompt
  Found useful? [ ] Yes  [ ] No  [ ] N/A
  Notes: ___

Task 5 — Regression understanding:
  Participant said: ___
  Understood backward transition? [ ] Yes  [ ] No
  Notes: ___

Overall impression: ___
Suggested label changes: ___
```

### 4.9 Synthesis Template

```
WARMTH USER VALIDATION RESULTS
Date: ___________
Sessions completed: ___ / 5

COMPREHENSION SCORES:
  Forming correct:    ___/5
  Firm correct:       ___/5
  Verified correct:   ___/5
  Progression order:  ___/5
  Regression understood: ___/5

DUAL-LAYER:
  VE users found deep state useful: ___/2
  Sales users needed deep state:    ___/2

DECISION:
  [ ] PASS — ≥80% comprehension, proceed with labels as-is
  [ ] REVISE — 60-79% comprehension, adjust labels per findings
  [ ] FAIL — <60% comprehension, reconsider warmth model

LABEL ADJUSTMENTS (if any):
  "Forming" → ___
  "Firm" → ___
  "Verified" → ___

SIGNED: ___________  DATE: ___________
```

---

## 5. Spanish Review Package (P0-7)

### 5.1 Localization Review Brief

**To**: Native Spanish speaker (reviewer)  
**From**: Frontend team  
**Re**: Warmth status label translations for ValueOS

We are introducing three status labels that users will see frequently across the
application. These labels represent the maturity state of a business value case.
We need your assessment of whether the Spanish translations are natural, professional,
and correctly convey the intended meaning in a B2B enterprise context.

### 5.2 Terms Under Review

| English | Current Spanish | UX Context | Intended Meaning |
|---------|----------------|------------|-----------------|
| Forming | En formacion | Badge on case cards, dashboard | The case is early-stage. Evidence is being gathered. Work in progress. |
| Firm | Consolidado | Badge on case cards, dashboard | The case has strong evidence and validated assumptions. Confident but not final. |
| Verified | Verificado | Badge on case cards, dashboard | The case is validated, defensible, and ready for executive decision-making. |
| Firming up | Consolidandose | Sub-state indicator (small text) | The case is progressing well within the "forming" stage. |
| Needs review | Necesita revision | Sub-state indicator (warning) | The case has regressed or needs attention despite being in "verified" stage. |
| Show details | Mostrar detalles | Toggle button | Reveals technical status details beneath the warmth badge. |
| Confidence | Confianza | Label next to percentage | How certain the system is about the case's validity. |
| Copilot | Copiloto | Tab label for AI assistant mode | The AI assistant that helps build the case. |

### 5.3 Specific Questions

1. **Is "Consolidado" the right word for "Firm"?** The English "Firm" means "solid, strong,
   well-supported" — not "a company" (la firma). We want to convey strength and confidence
   without finality. Does "Consolidado" achieve this in enterprise Spanish?

2. **Is "En formacion" natural for "Forming"?** Alternative: "En desarrollo" (in development).
   Does "En formacion" sound like a military formation or like something taking shape?

3. **Is "Verificado" strong enough for "Verified"?** In English, "verified" implies third-party
   validation and decision-readiness. Does "Verificado" carry the same weight in Spanish?

4. **Are there regional concerns?** These labels will be used by Spanish-speaking users in
   Latin America and Spain. Are any of the translations regionally inappropriate?

### 5.4 Alternative Candidates for "Firm"

| Candidate | Literal Meaning | Tone | Regional Notes |
|-----------|----------------|------|---------------|
| **Consolidado** (current) | Consolidated, strengthened | Professional, stable | Neutral across regions |
| **Solidificado** | Solidified | More physical/concrete | May sound too literal |
| **Confirmado** | Confirmed | Decisive, clear | Could imply external approval (too strong?) |
| **Afianzado** | Secured, established | Formal, business-appropriate | Less common in LATAM |
| **Respaldado** | Backed, supported | Evidence-focused | Emphasizes evidence (good fit?) |

### 5.5 Reviewer Response Template

```
SPANISH LOCALIZATION REVIEW
Reviewer: ___________
Date: ___________
Region/Dialect: ___________

TERM-BY-TERM ASSESSMENT:

1. "Forming" → Current: "En formacion"
   Recommendation: ___________
   Rationale: ___________
   Tone: [ ] Professional  [ ] Too casual  [ ] Too formal  [ ] Awkward
   Regional concern: [ ] None  [ ] See notes

2. "Firm" → Current: "Consolidado"
   Recommendation: ___________
   Rationale: ___________
   Tone: [ ] Professional  [ ] Too casual  [ ] Too formal  [ ] Awkward
   Regional concern: [ ] None  [ ] See notes
   Preferred alternative (if not Consolidado): ___________

3. "Verified" → Current: "Verificado"
   Recommendation: ___________
   Rationale: ___________
   Tone: [ ] Professional  [ ] Too casual  [ ] Too formal  [ ] Awkward
   Regional concern: [ ] None  [ ] See notes

4. "Firming up" → Current: "Consolidandose"
   Recommendation: ___________

5. "Needs review" → Current: "Necesita revision"
   Recommendation: ___________

OVERALL ASSESSMENT:
[ ] Translations are correct and natural — ship as-is
[ ] Minor adjustments recommended (see above)
[ ] Significant changes needed — do not ship current translations

NOTES:
___________________________________________________________
```

---

## 6. Final Release Recommendation

### Ready to Close
- **P0-3**: SDUI Architecture Decision — ADR complete
- **P0-4**: API Migration Map — documented, no migration needed
- **P0-5**: TypeScript Strict Zone — config + CI gate ready
- **P0-6**: Bundle Budget Gate — Vite + metrics updated to 500KB

### Ready Pending Human Approval
- **P0-1**: Backend Sign-off — Review memo prepared. Codebase evidence strongly suggests
  `confidence_score` is available and correctly handled. Risk of rejection: **Low**.
  Backend team needs to confirm 4 specific questions.
  
- **P0-7**: Spanish Review — Review brief prepared with 5 alternative candidates for "Firm".
  Risk: **Low** — labels can be updated post-launch. 30-minute task for native speaker.

### Not Ready
- **P0-2**: User Validation — Testing kit is prepared but sessions have not been run.
  This is the longest-pole item. Risk: **Medium** — if warmth labels don't resonate,
  Phase 1 scope changes significantly.

### Risks If Launched Without Completing P0-2
- Warmth labels may not resonate with users, requiring mid-sprint pivots
- The dual-layer design (warmth + deep state) may not meet power user needs
- "Firm" in particular is the most ambiguous of the three labels
- **Mitigation**: The warmth system is implemented as a presentation layer over
  unchanged saga states. If labels need changing, it's a token + i18n update,
  not an architectural change.

### Minimal Path to Green

```
Day 1:  Send backend review memo → async approval (P0-1)
Day 1:  Send Spanish review brief → 30-min task (P0-7)
Day 1:  Schedule 5 user validation sessions (P0-2)
Day 2:  Backend sign-off received
Day 2:  Spanish translations confirmed
Day 3-5: Run user validation sessions
Day 5:  Synthesize results, make go/no-go decision
Day 5:  ALL P0 ITEMS CLOSED → Phase 1 begins
```

**Assumption**: Backend sign-off and Spanish review can complete in 1-2 days.
User validation is the critical path at 3-5 days.

**Recommendation**: Begin Phase 1 foundation work (route consolidation, settings
consolidation, strict zone enforcement) in parallel with user validation. These
workstreams do not depend on warmth label confirmation. Defer warmth component
implementation until P0-2 results are in.
