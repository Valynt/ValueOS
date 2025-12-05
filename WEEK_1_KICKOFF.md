# Week 1 Kickoff - 30-Day Sprint

**Date:** December 5, 2025  
**Sprint Week:** 1 of 4  
**Goal:** Fix identity crisis + complete core integration  
**Status:** 🟢 STARTED

---

## Quick Win! Tasks Already Complete ✅

### Task #001: Brand Consolidation ✅
**Status:** COMPLETE  
**Finding:** ValueCanvas branding verified consistent across codebase!  
**Impact:** Code is already clean - only documentation needed updates  
**Time Saved:** 2 hours

### Task #002: Update package.json ✅
**Status:** COMPLETE  
**Changes:**
```diff
- "name": "vite-react-typescript-starter"
+ "name": "valuecanvas"
- "version": "0.0.0"
+ "version": "0.1.0"
```
**Time:** 5 minutes  
**Committed:** Yes

### Task #004: Agent Mapping Document ✅
**Status:** COMPLETE  
**File:** `docs/AGENT_NAMING_MAPPING.md`  
**Content:** Complete mapping of all 7 agents + implementation plan  
**Time:** 30 minutes

---

## Today's Remaining Tasks (Dec 5)

### Task #003: Update Documentation References
**Owner:** @tech-writer  
**Effort:** 3 hours  
**Priority:** P0

**Files to Update:**
```
docs/README.md
docs/guides/LIFECYCLE_USER_GUIDES.md
docs/api/README.md
docs/architecture/*.md
docs/adr/README.md
```

**Find & Replace:**
- ValueCanvas branding consistency verified
- Remove confusing framework references (BTS, SOF, VOS)
- Update agent names to match mapping

**Acceptance:** All docs use consistent terminology

---

### Task #005: Rename Agent Files (Part 1)
**Owner:** @engineering  
**Effort:** 2 hours  
**Priority:** P0  
**Dependencies:** Task #004 complete ✅

**Actions:**
```bash
# Opportunity Agent
git mv src/agents/OutcomeEngineerAgent.ts src/agents/OpportunityAgent.ts

# Target Agent
git mv src/agents/InterventionDesignerAgent.ts src/agents/TargetAgent.ts
```

**Post-Rename:**
1. Update class names inside files
2. Run `npm run typecheck`
3. Fix any import errors
4. Commit with message: "Rename OutcomeEngineer → Opportunity, InterventionDesigner → Target"

---

## Tomorrow's Tasks (Dec 6)

### Task #006: Rename Agent Files (Part 2)
**Owner:** @engineering  
**Effort:** 2 hours  
**Priority:** P0

**Actions:**
```bash
# Realization Agent
git mv src/agents/RealizationLoopAgent.ts src/agents/RealizationAgent.ts

# Integrity Agent
git mv src/agents/ValueEvalAgent.ts src/agents/IntegrityAgent.ts
```

**Post-Rename:**
1. Update class names
2. Update all imports across codebase
3. Run full test suite
4. Commit

---

### Task #007: Create Expansion Agent
**Owner:** @engineering  
**Effort:** 4 hours  
**Priority:** P1

**Template:**
```bash
cp src/agents/RealizationAgent.ts src/agents/ExpansionAgent.ts
```

**Modifications:**
1. Remove realization tracking logic
2. Add expansion opportunity detection
3. Add package recommendation system
4. Register with CoordinatorAgent
5. Write tests

**Acceptance:** ExpansionAgent responds to "identify expansion opportunities"

---

## Weekend Tasks (Dec 7-8) - If Team Available

### Task #008: Renderer Integration (Sprint 5)
**Owner:** @frontend-eng  
**Effort:** 4 hours  
**Priority:** P0

**File:** `src/sdui/engine/renderPage.ts`

**Changes:**
1. Add layout type handler for nested layouts
2. Implement recursive rendering
3. Add error boundaries
4. Test with complex layouts

**Acceptance:** Nested layouts render correctly

---

### Task #009: Canvas Store Integration (Sprint 5)
**Owner:** @frontend-eng  
**Effort:** 3 hours  
**Priority:** P0

**File:** `src/components/ChatCanvas/ChatCanvasLayout.tsx`

**Changes:**
1. Import `useCanvasStore`
2. Connect canvas state
3. Add Undo button (`Cmd+Z`)
4. Add Redo button (`Cmd+Shift+Z`)
5. Test history persistence

**Acceptance:** User can undo/redo canvas changes

---

## Next Week Preview (Dec 9-12)

### Task #010: Agent Service Integration (Sprint 5)
**Effort:** 4 hours  
**File:** `src/agents/CoordinatorAgent.ts`

### Task #011: Integration Testing (Sprint 5)
**Effort:** 7 hours  
**File:** `src/sdui/__tests__/integration/agent-to-render.test.ts`

---

## Communication

### Daily Standup (9:00 AM)
**Format:** 15 minutes in #engineering

```
Team Member: [Your Name]
Yesterday: [Task IDs completed]
Today: [Task IDs planned]
Blockers: [Any issues]
```

### Today's Standup Example:
```
Team Member: Platform Team
Yesterday: ✅ #001 (already clean), ✅ #002 (package.json), ✅ #004 (agent mapping)
Today: 🟡 #003 (doc updates), 🟡 #005 (rename agents part 1)
Blockers: None - ahead of schedule!
```

---

## Progress Dashboard

### Week 1 Progress: 27% Complete (3/11 tasks)
```
✅ #001 Brand consolidation
✅ #002 Package.json update
🟡 #003 Documentation updates       [IN PROGRESS]
✅ #004 Agent mapping doc
⏳ #005 Agent rename (part 1)      [TODAY]
⏳ #006 Agent rename (part 2)      [TOMORROW]
⏳ #007 Create ExpansionAgent      [TOMORROW]
⏳ #008 Renderer integration       [WEEKEND]
⏳ #009 Canvas store integration   [WEEKEND]
⏳ #010 Agent service integration  [NEXT WEEK]
⏳ #011 Integration testing        [NEXT WEEK]
```

---

## Risk Assessment

### 🟢 Low Risk Items
- ✅ Brand consolidation (already done!)
- ✅ Package.json (completed)
- ✅ Agent mapping (documented)

### 🟡 Medium Risk Items
- Agent renaming (many files, could miss imports)
  - **Mitigation:** Created update script in agent mapping doc
  - **Testing:** Run typecheck + full test suite after each rename

- Sprint 5 integration (18 hours - largest task)
  - **Mitigation:** Break into 4 subtasks
  - **Buffer:** Weekend available if needed

### 🔴 High Risk Items
- None identified for Week 1

---

## Tools & Scripts

### Check TypeScript Errors
```bash
npm run typecheck
```

### Run Tests
```bash
npm test                    # All tests
npm test OpportunityAgent  # Specific agent
```

### Find Agent References
```bash
# Before renaming
grep -r "OutcomeEngineerAgent" src/

# After renaming
grep -r "OutcomeEngineerAgent" src/  # Should be empty
grep -r "OpportunityAgent" src/       # Should show all usages
```

### Automated Import Update
```bash
# Use script from docs/AGENT_NAMING_MAPPING.md
bash scripts/update-agent-imports.sh
```

---

## Definition of Done - Week 1

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] Test coverage > 90% for changed files
- [ ] No console errors in dev mode
- [ ] Linter passes (`npm run lint`)

### Functionality
- [ ] Agents respond with correct new names
- [ ] SDUI canvas renders agent layouts
- [ ] Undo/Redo works in canvas
- [ ] No broken imports

### Documentation
- [ ] All docs use "ValueCanvas" consistently
- [ ] Agent names match code
- [ ] README.md updated
- [ ] Changelog updated

### Demo Ready
- [ ] Can demonstrate agent workflow end-to-end
- [ ] Can show canvas rendering
- [ ] Can show undo/redo functionality

---

## Team Assignments

### @engineering (Backend)
- Task #005: Agent rename (part 1) - TODAY
- Task #006: Agent rename (part 2) - TOMORROW
- Task #007: Create ExpansionAgent - TOMORROW
- Task #010: Agent service integration - NEXT WEEK

### @frontend-eng
- Task #008: Renderer integration - WEEKEND/MONDAY
- Task #009: Canvas store integration - WEEKEND/MONDAY

### @qa-eng
- Task #011: Integration testing - TUESDAY-WEDNESDAY
- Continuous: Verify each rename doesn't break existing tests

### @tech-writer
- Task #003: Documentation updates - TODAY/TOMORROW
- Continuous: Update docs as agents are renamed

---

## Success Metrics (End of Week)

### Quantitative
- ✅ 0 "ValueVerse" references
- 🎯 0 old agent names in code
- 🎯 100% tests passing
- 🎯 < 5 TypeScript errors (none blocking)

### Qualitative
- ✅ Team confident in agent naming
- 🎯 Demo-able to stakeholders
- 🎯 Sprint 5 integration understood
- 🎯 No confusion about agent roles

---

## Celebration Plan 🎉

### Friday EOD (Dec 12)
- **Demo Session:** Show renamed agents in action
- **Metrics Review:** Confirm all Week 1 goals met
- **Retrospective:** What went well, what to improve
- **Happy Hour:** Virtual or in-person celebration

---

## Next Steps (Right Now)

### For Engineers:
1. Pull latest from main: `git pull origin main`
2. Read `docs/AGENT_NAMING_MAPPING.md`
3. Start Task #005 (rename agents part 1)
4. Post progress in #engineering

### For Tech Writers:
1. Read `docs/AGENT_NAMING_MAPPING.md`
2. Start Task #003 (update docs)
3. Use find & replace for efficiency
4. Commit as you go

### For QA:
1. Set up test monitoring
2. Watch for failures after renames
3. Prepare integration test plan (Task #011)

### For Everyone:
1. Review `30_DAY_SPRINT_TRACKER.md`
2. Bookmark sprint dashboard (when created)
3. Attend daily standups
4. Ask questions in #engineering

---

## Questions?

**Slack:** #engineering  
**Sprint Lead:** @pm  
**Technical Lead:** @engineering  
**Documentation:** @tech-writer

---

**Let's ship Week 1! 🚀**

---

**Document Status:** Active  
**Last Updated:** December 5, 2025, 3:59 AM UTC  
**Next Update:** EOD Dec 5 (post-standup)
