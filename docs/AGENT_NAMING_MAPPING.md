# Agent Naming Mapping

**Created:** December 5, 2025  
**Status:** 🟡 Approved - Implementation Pending  
**Sprint Task:** #004

---

## Purpose

This document defines the official mapping between current agent names (in code) and new standardized names (for documentation and future refactoring). This resolves the critical naming inconsistency identified in the Strategic Validation Report.

---

## Official Agent Mapping

### Current State (Codebase)
```
src/agents/
├── CoordinatorAgent.ts      # 22KB - Master orchestrator
├── CommunicatorAgent.ts      # 9KB  - User interaction
├── OutcomeEngineerAgent.ts   # 26KB - Business outcome engineering
├── InterventionDesignerAgent.ts # 20KB - Solution design
├── RealizationLoopAgent.ts   # 20KB - Value tracking
├── SystemMapperAgent.ts      # 18KB - System visualization
└── ValueEvalAgent.ts         # 14KB - Evaluation & scoring
```

### Proposed Mapping (Documentation Standard)

| Current Name (Code) | New Name (Docs) | Role | Status |
|---------------------|-----------------|------|--------|
| `CoordinatorAgent` | **Coordinator Agent** | Master task orchestrator | ✅ Keep as-is |
| `CommunicatorAgent` | **Communicator Agent** | User interaction & UI generation | ✅ Keep as-is |
| `OutcomeEngineerAgent` | **Opportunity Agent** | Discovers value opportunities | 🟡 Rename planned |
| `InterventionDesignerAgent` | **Target Agent** | Designs target interventions | 🟡 Rename planned |
| `RealizationLoopAgent` | **Realization Agent** | Tracks realized value | 🟡 Rename planned |
| `SystemMapperAgent` | **[Deprecated]** | Integrate into Coordinator | 🔴 Consolidate |
| `ValueEvalAgent` | **Integrity Agent** | Validates & scores integrity | 🟡 Rename planned |
| **[NEW]** | **Expansion Agent** | Identifies expansion opportunities | 🔵 Create new |

---

## Detailed Agent Specifications

### 1. Coordinator Agent ✅
**File:** `src/agents/CoordinatorAgent.ts`  
**Keep Name:** Yes  
**Reason:** Already aligned with documentation

**Responsibilities:**
- Break high-level intents into subgoals
- Route subgoals to appropriate agents
- Generate SDUI layouts
- Audit all decisions

**No changes required.**

---

### 2. Communicator Agent ✅
**File:** `src/agents/CommunicatorAgent.ts`  
**Keep Name:** Yes  
**Reason:** Already aligned with documentation

**Responsibilities:**
- Handle user conversational input
- Generate natural language responses
- Coordinate with Coordinator for SDUI generation
- Manage chat history

**No changes required.**

---

### 3. Opportunity Agent 🟡
**Current File:** `src/agents/OutcomeEngineerAgent.ts`  
**New File:** `src/agents/OpportunityAgent.ts`  
**Rename Required:** Yes

**Responsibilities:**
- Discover value opportunities from customer context
- Map pains to KPIs
- Generate discovery questions
- Score opportunity fit

**Rationale for Rename:**
- "Opportunity" is clearer for business users than "Outcome Engineer"
- Aligns with lifecycle: Opportunity → Target → Realization → Expansion
- Matches existing documentation references

**Implementation Plan:**
```bash
# Step 1: Rename file
mv src/agents/OutcomeEngineerAgent.ts src/agents/OpportunityAgent.ts

# Step 2: Rename class
sed -i 's/OutcomeEngineerAgent/OpportunityAgent/g' src/agents/OpportunityAgent.ts

# Step 3: Update imports
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/OutcomeEngineerAgent/OpportunityAgent/g'

# Step 4: Run tests
npm run typecheck
npm test
```

---

### 4. Target Agent 🟡
**Current File:** `src/agents/InterventionDesignerAgent.ts`  
**New File:** `src/agents/TargetAgent.ts`  
**Rename Required:** Yes

**Responsibilities:**
- Convert opportunities into quantifiable targets
- Design intervention strategies
- Generate ROI models
- Set baseline and target KPIs

**Rationale for Rename:**
- "Target" is business-friendly and lifecycle-consistent
- "Intervention Designer" is technical jargon
- Clear progression: Opportunity identifies → Target quantifies

**Implementation Plan:**
```bash
# Step 1: Rename file
mv src/agents/InterventionDesignerAgent.ts src/agents/TargetAgent.ts

# Step 2: Rename class
sed -i 's/InterventionDesignerAgent/TargetAgent/g' src/agents/TargetAgent.ts

# Step 3: Update imports
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/InterventionDesignerAgent/TargetAgent/g'

# Step 4: Run tests
npm run typecheck
npm test
```

---

### 5. Realization Agent 🟡
**Current File:** `src/agents/RealizationLoopAgent.ts`  
**New File:** `src/agents/RealizationAgent.ts`  
**Rename Required:** Yes (minor)

**Responsibilities:**
- Track progress towards targets
- Generate variance reports
- Explain deviations from plan
- Produce executive summaries

**Rationale for Rename:**
- Simplify "RealizationLoop" to "Realization"
- Maintains lifecycle consistency
- "Loop" is implementation detail, not user-facing

**Implementation Plan:**
```bash
# Step 1: Rename file
mv src/agents/RealizationLoopAgent.ts src/agents/RealizationAgent.ts

# Step 2: Rename class
sed -i 's/RealizationLoopAgent/RealizationAgent/g' src/agents/RealizationAgent.ts

# Step 3: Update imports
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/RealizationLoopAgent/RealizationAgent/g'

# Step 4: Run tests
npm run typecheck
npm test
```

---

### 6. System Mapper Agent 🔴
**Current File:** `src/agents/SystemMapperAgent.ts`  
**Action:** Deprecate & consolidate into Coordinator  
**Reason:** Overlapping responsibilities

**Responsibilities (to be absorbed):**
- System visualization → Move to Coordinator's SDUI generation
- Dependency mapping → Part of subgoal planning
- Architecture diagramming → SDUI component responsibility

**Implementation Plan:**
```bash
# Step 1: Extract reusable functions
# Move system mapping logic to src/lib/system-mapping.ts

# Step 2: Update Coordinator to use extracted functions
# Add system mapping capabilities to CoordinatorAgent.ts

# Step 3: Deprecate SystemMapperAgent
# Add deprecation notice, remove from routing

# Step 4: Update tests
# Move tests to CoordinatorAgent test suite

# Step 5: Delete file (after 1 sprint grace period)
```

**Timeline:** Complete by Week 2 (allow migration time)

---

### 7. Integrity Agent 🟡
**Current File:** `src/agents/ValueEvalAgent.ts`  
**New File:** `src/agents/IntegrityAgent.ts`  
**Rename Required:** Yes

**Responsibilities:**
- Validate manifesto compliance
- Score data provenance
- Ensure explainability
- Generate integrity reports

**Rationale for Rename:**
- "Integrity" is clearer than "ValueEval"
- Emphasizes trust and compliance focus
- Aligns with SOF governance principles

**Implementation Plan:**
```bash
# Step 1: Rename file
mv src/agents/ValueEvalAgent.ts src/agents/IntegrityAgent.ts

# Step 2: Rename class
sed -i 's/ValueEvalAgent/IntegrityAgent/g' src/agents/IntegrityAgent.ts

# Step 3: Update imports
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/ValueEvalAgent/IntegrityAgent/g'

# Step 4: Run tests
npm run typecheck
npm test
```

---

### 8. Expansion Agent 🔵
**New File:** `src/agents/ExpansionAgent.ts`  
**Status:** Does not exist - create new

**Responsibilities:**
- Identify upsell/cross-sell opportunities
- Score expansion potential
- Propose feature/service packages
- Estimate expansion ROI

**Template:** Based on RealizationAgent structure

**Implementation Plan:**
```bash
# Step 1: Create from template
cp src/agents/RealizationAgent.ts src/agents/ExpansionAgent.ts

# Step 2: Modify logic
# - Remove realization tracking
# - Add expansion opportunity detection
# - Add package recommendation logic

# Step 3: Register with Coordinator
# Add to CoordinatorAgent's routing table

# Step 4: Write tests
# Create src/agents/__tests__/ExpansionAgent.test.ts

# Step 5: Document
# Add to agent documentation
```

**Timeline:** Week 1, Task #007 (4 hours)

---

## Lifecycle Flow (With New Names)

```
User Request
    ↓
Communicator Agent (parses intent)
    ↓
Coordinator Agent (plans execution)
    ↓
┌─────────────────────────────────────┐
│                                     │
│  [Discovery Phase]                  │
│  Opportunity Agent                  │
│  - Discovers value opportunities    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [Planning Phase]                   │
│  Target Agent                       │
│  - Quantifies targets & ROI         │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [Execution Phase]                  │
│  Realization Agent                  │
│  - Tracks progress vs targets       │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [Growth Phase]                     │
│  Expansion Agent                    │
│  - Identifies next opportunities    │
│                                     │
└─────────────────────────────────────┘
            ↓
    Integrity Agent (validates all phases)
            ↓
    Communicator Agent (presents results)
```

---

## Migration Timeline

### Week 1 (Current)
- [x] **Day 1:** Create this mapping document
- [ ] **Day 2:** Rename OpportunityAgent, TargetAgent
- [ ] **Day 3:** Rename RealizationAgent, IntegrityAgent
- [ ] **Day 4:** Create ExpansionAgent
- [ ] **Day 5:** Update all tests, verify no breakage

### Week 2
- [ ] **Day 6-7:** Begin SystemMapper deprecation
- [ ] **Day 8-10:** Complete migration of SystemMapper logic

---

## Testing Checklist

After each rename, verify:
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all agent tests)
- [ ] `npm run build` succeeds
- [ ] Manual test: Agent responds to requests
- [ ] Check logs for errors
- [ ] Verify SDUI generation still works

---

## Documentation Updates Required

### High Priority
- [ ] Update `README.md` with new agent names
- [ ] Update `docs/guides/LIFECYCLE_USER_GUIDES.md`
- [ ] Update API documentation (`src/api/docs.ts`)
- [ ] Update architecture diagrams

### Medium Priority
- [ ] Update ADRs mentioning agents
- [ ] Update test documentation
- [ ] Update deployment guides

---

## Communication Plan

### Internal Team
- **Today:** Share this document in #engineering Slack
- **Tomorrow:** Standup update on progress
- **End of Week:** Demo working renamed agents

### External (If Applicable)
- **API Changes:** Version bump to 0.2.0 (breaking change)
- **User Docs:** Update guides after testing complete
- **Changelog:** Document renames in CHANGELOG.md

---

## Rollback Plan

If renaming causes critical issues:

1. **Revert Git Commits:**
   ```bash
   git revert HEAD~5  # Revert last 5 commits
   git push origin main --force-with-lease
   ```

2. **Hot Fix:**
   - Keep old names in code
   - Use aliases in documentation
   - Plan slower migration

3. **Notify Team:**
   - Post in #engineering
   - Update sprint tracker
   - Reschedule rename for Week 2

---

## Success Metrics

### Quantitative
- ✅ 0 references to old names in codebase
- ✅ 100% tests passing
- ✅ 0 TypeScript errors
- ✅ Build time unchanged (< 30 seconds)

### Qualitative
- ✅ New developers understand agent roles immediately
- ✅ Documentation matches code exactly
- ✅ Lifecycle flow is intuitive

---

## FAQ

**Q: Why not keep OutcomeEngineerAgent?**  
A: "Outcome Engineer" is technical jargon. "Opportunity" is clearer for business users and aligns with standard sales/CS terminology.

**Q: Do we need to version the API?**  
A: Yes, if external systems reference agent names. Bump to v0.2.0 and add deprecation notices.

**Q: What about existing data/logs?**  
A: Old agent names in logs are fine. Add migration script if querying by agent name.

**Q: Can we do this incrementally?**  
A: Yes, but complete within Week 1 to avoid confusion. Each rename is independent.

---

## Appendix: Import Update Script

```bash
#!/bin/bash
# update-agent-imports.sh

echo "Updating agent imports..."

# Update Opportunity Agent
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/import.*OutcomeEngineerAgent/import { OpportunityAgent }/g; s/OutcomeEngineerAgent/OpportunityAgent/g' {} +

# Update Target Agent
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/import.*InterventionDesignerAgent/import { TargetAgent }/g; s/InterventionDesignerAgent/TargetAgent/g' {} +

# Update Realization Agent
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/import.*RealizationLoopAgent/import { RealizationAgent }/g; s/RealizationLoopAgent/RealizationAgent/g' {} +

# Update Integrity Agent
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/import.*ValueEvalAgent/import { IntegrityAgent }/g; s/ValueEvalAgent/IntegrityAgent/g' {} +

echo "Running typecheck..."
npm run typecheck

echo "Running tests..."
npm test

echo "Done! Review changes with: git diff"
```

---

**Document Owner:** Engineering Team  
**Approved By:** [Pending Stakeholder Sign-off]  
**Implementation Start:** December 5, 2025  
**Completion Target:** December 12, 2025 (End of Week 1)
