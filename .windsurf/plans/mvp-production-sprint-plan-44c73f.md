# Sprint Plan — Model Creation MVP → Production

A focused 4-sprint sequence to complete the Model Creation MVP and package for production release, starting from post-sprint-54 baseline.

---

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Data Model Validation (Task 0) | ✅ Complete | All schemas validated per 2026-03-23 report |
| Value Graph (Sprints 47-50) | ✅ Complete | All 8 agents integrated, API live, SDUI rendering |
| Reasoning Trace (Sprints 51-52) | ✅ Complete | BaseAgent integration, API, UI surface |
| Value Integrity (Sprints 53-54) | ✅ Complete | Contradiction detection, scoring, gating |
| Economic Kernel (Task 1) | ⬜ Not Started | Foundation for all downstream tasks |
| Dashboard "Go" (Task 2) | ⬜ Not Started | Quick win, blocked by nothing |
| Discovery Agent (Task 3) | ⬜ Not Started | Needs Economic Kernel for validation |
| NarrativeAgent (Task 4) | ⬜ Not Started | Needs Economic Kernel |
| ModelStage API (Task 5) | ⬜ Not Started | Needs Economic Kernel + Data Model |
| Integrity Wiring (Task 6) | ⬜ Not Started | Needs ModelStage API |
| Export UI (Task 7) | ⬜ Not Started | Needs NarrativeAgent |

**Test Status**: 755 failing | 3454 passed | 118 skipped (separate swarm handling)

---

## Sprint Structure

### Sprint A — Foundation (Week 1)
**Goal**: Economic Kernel + Dashboard "Go" + scaffolding

| Task | Hours | Owner | Deliverable |
|------|-------|-------|-------------|
| Economic Kernel service | 8 | Backend | `packages/backend/src/lib/economic-kernel/` with NPV/IRR/ROI/Decimal precision |
| Economic Kernel unit tests | 4 | Backend | `__tests__/kernel.test.ts` — all green, matches Excel ±0.01% |
| Dashboard "Go" button | 2 | Frontend | `apps/ValyntApp/src/components/dashboard/CreateCaseButton.tsx` |
| Dashboard navigation | 2 | Frontend | Navigate to `/discover/:id` on create |
| ModelStage API scaffolding | 4 | Backend | Routes, handlers, basic CRUD (no calculations yet) |
| **Test Gate** | — | — | `pnpm test` green for new code |

**Success**: E2E harness passes step 1 (Dashboard → opportunity created in <2s)

---

### Sprint B — Discovery + ModelStage (Week 2)
**Goal**: Working discovery flow with real financial calculations

| Task | Hours | Owner | Deliverable |
|------|-------|-------|-------------|
| Discovery Agent integration | 12 | Backend | Read/write Value Graph, generate 3-5 hypotheses |
| Discovery streaming updates | 4 | Backend | Real-time UI updates via existing MessageBus |
| ModelStage API — calculations | 8 | Backend | Wire Economic Kernel to API responses |
| ModelStage API — assumptions | 4 | Backend | Edit assumptions, trigger recalculation |
| Scenarios (conservative/base/upside) | 4 | Backend | Use sensitivity ranges from assumptions |
| **Integration Test** | — | — | Discovery → ModelStage → financials in <30s |

**Success**: E2E harness passes steps 2-3 (Discovery → Modeling with real numbers)

---

### Sprint C — Narrative + Integrity (Week 3)
**Goal**: Business case generation with integrity gating

| Task | Hours | Owner | Deliverable |
|------|-------|-------|-------------|
| NarrativeAgent — PDF generation | 8 | Backend | `generateExecutiveSummary()` using existing trace infrastructure |
| NarrativeAgent — financial injection | 4 | Backend | Inject Economic Kernel outputs into PDF |
| Integrity Wiring — gate enforcement | 4 | Backend | `integrity_score >= 0.6` blocks stage advance |
| Integrity Wiring — remediation | 4 | Backend | Return remediation instructions on failure |
| Value Graph narrative traversal | 4 | Backend | Structured narrative from graph paths (not free-form) |
| **E2E Test** | — | — | Full flow to PDF in <5 minutes |

**Success**: E2E harness passes all steps 1-5

---

### Sprint D — Export UI + Production Packaging (Week 4)
**Goal**: Polished UI + production readiness

| Task | Hours | Owner | Deliverable |
|------|-------|-------|-------------|
| Export UI — PDF download | 2 | Frontend | Button triggers download, loading state |
| Export UI — integrity check gate | 2 | Frontend | Button disabled if integrity check not passed |
| Test harness finalization | 4 | QA | `test/harness/model-creation.e2e.test.ts` green |
| Performance validation | 4 | QA | <5 min E2E, <100ms kernel calc, <5s PDF generation |
| Production packaging | 4 | DevOps | Docker images, migration scripts, env var docs |
| Security audit | 4 | Security | `scripts/test-agent-security.sh` green, no new `any` |
| **Final Gate** | — | — | All acceptance criteria from `valynt_mvp_execution_plan.md` |

**Success**: MVP ready for production deployment

---

## Cross-Sprint Invariants

Every PR must satisfy:

| Rule | Enforcement |
|------|-------------|
| Tenant isolation (`organization_id`) | `pnpm run test:rls` |
| LLM calls via `secureInvoke()` | Code review |
| No new `any` types | `pnpm run check` + ESLint |
| SDUI components registered | Both `ui-registry.json` and `registry.tsx` |
| RLS on new tables | Migration + test file |
| Agent security suite | `scripts/test-agent-security.sh` |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Economic Kernel precision bugs | Excel parity tests, Decimal.js strict mode |
| Discovery streaming delays | Use existing MessageBus, no new infrastructure |
| PDF generation performance | Puppeteer/Playwright with caching, <5s target |
| Integration complexity | Daily standups, shared task board, pair on interfaces |
| Test failures blocking merge | Separate swarm handling 755 failures in parallel |

---

## Definition of Done (MVP)

- [ ] Full E2E harness passes: Dashboard → Discovery → Modeling → Integrity → PDF
- [ ] Total pipeline time < 5 minutes
- [ ] Economic Kernel matches Excel ±0.01%
- [ ] Integrity score gates stage advancement (0.6 threshold)
- [ ] PDF contains correct financial numbers
- [ ] `pnpm test` green for all new code
- [ ] `pnpm run test:rls` green
- [ ] `pnpm run check` green (no new `any`)
- [ ] `scripts/test-agent-security.sh` green
- [ ] Production deployment artifacts ready

---

## Post-MVP (Deferred)

| Item | Reason |
|------|--------|
| `any` count → 0 in `apps/ValyntApp` | Separate tech debt sprint |
| `any` count → 0 in `packages/backend` | Separate tech debt sprint |
| WCAG + i18n completeness | Accessibility sprint post-MVP |
| Feature flag transition beta → ga | Product sign-off required |
| Value Narrative Engine v2 | Depends on MVP stability |

---

**Total Estimated Effort**: 70 hours across 4 weeks
**Parallel Tracks**: Backend (Kernel/Agents/API) + Frontend (Dashboard/Export)
**Coordination**: Daily standups, shared board, code review gates
