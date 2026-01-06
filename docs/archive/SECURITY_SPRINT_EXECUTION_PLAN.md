# Security Sprint Execution Plan

## Investigation Summary (Phase 1 Complete)

### CRITICAL FINDINGS

#### ✅ Task 1: Missing tenant scoping in DB queries
**Status**: MOSTLY SECURE
- LLM gating tables (llm_usage, llm_gating_policies) have proper tenant_id filtering
- BudgetTracker correctly filters by tenant_id
- GatingPolicy correctly filters by tenant_id
- **Action Required**: Audit settingsRegistry.ts and other database access patterns

#### ❌ Task 3: Direct LLM gateway calls bypassing secureInvoke
**Status**: VULNERABILITIES FOUND
**Files with direct llmGateway.complete() calls**:
1. `src/lib/agent-fabric/ReflectionEngine.ts` (2 calls)
2. `src/lib/agent-fabric/AgentFabric.ts` (2 calls)
3. `src/services/IntegrityAgentService.ts` (3 calls)
4. `src/services/UIRefinementLoop.ts` (4 calls)

**Total**: 11 direct calls bypassing security wrapper

#### ⚠️ Task 7: Agents performing external side-effects
**Status**: NEEDS REVIEW
- Database inserts found in OpportunityAgent, ExpansionAgent, RealizationAgent
- External API calls in various services (fetch, Stripe, etc.)
- **Action Required**: Verify all DB operations include organization_id filtering

#### 🔴 Task 8: Secrets present in repository
**Status**: CRITICAL SECURITY BREACH
- `.env.production` contains production Supabase credentials
- File committed to git history (commit 32c3b75f)
- **IMMEDIATE ACTION REQUIRED**: Rotate all credentials

#### ✅ Task 9: Incomplete RLS policies
**Status**: WELL IMPLEMENTED
- Recent migration (20251230012600) implements comprehensive RLS
- Tenant isolation policies in place
- Service role bypass properly configured
- **Action Required**: Run test suite to verify

#### ⚠️ Task 16: Overly permissive service_role usage
**Status**: WIDESPREAD USAGE
- 30+ files use service_role key
- Used in: approvals API, health checks, metering, billing, session management
- **Action Required**: Audit each usage, restrict to admin operations only

---

## Execution Plan

### PHASE 2A: IMMEDIATE CRITICAL FIXES (2 hours)

#### Priority 1: Credential Rotation (Task 8)
**Time**: 30 minutes
**Actions**:
1. Generate new Supabase service_role key
2. Generate new Supabase anon key
3. Update production environment variables
4. Remove .env.production from git history
5. Add to .gitignore if not present
6. Update secrets manager configuration

**Acceptance Criteria**:
- [ ] Old credentials revoked
- [ ] New credentials deployed
- [ ] .env.production removed from git history
- [ ] No secrets in repository

#### Priority 2: Wrap Direct LLM Calls (Task 3)
**Time**: 90 minutes
**Files to fix**:
1. ReflectionEngine.ts - wrap 2 calls
2. AgentFabric.ts - wrap 2 calls
3. IntegrityAgentService.ts - wrap 3 calls
4. UIRefinementLoop.ts - wrap 4 calls

**Implementation**:
```typescript
// BEFORE
const response = await this.llmGateway.complete(messages, options);

// AFTER
const response = await secureLLMInvoke(
  this.llmGateway,
  messages,
  {
    ...options,
    organizationId: this.organizationId,
    userId: this.userId,
    agentId: this.agentId,
  }
);
```

**Acceptance Criteria**:
- [ ] All 11 direct calls wrapped with secureLLMInvoke
- [ ] Tests pass
- [ ] Security tests added for each file

---

### PHASE 2B: HIGH PRIORITY FIXES (4 hours)

#### Task 16: Audit service_role Usage
**Time**: 2 hours
**Actions**:
1. Create service_role usage inventory
2. Categorize: REQUIRED vs UNNECESSARY
3. Replace unnecessary usage with anon key + RLS
4. Document legitimate service_role usage

**Files to audit** (30+ files):
- API endpoints (approvals, health)
- Metering services
- Billing services
- Session management
- SDUI data binding

**Acceptance Criteria**:
- [ ] Service_role usage reduced by 50%+
- [ ] All remaining usage documented and justified
- [ ] RLS policies handle user-level operations

#### Task 1: Complete Tenant Scoping Audit
**Time**: 2 hours
**Actions**:
1. Audit settingsRegistry.ts database queries
2. Audit sof-governance.ts queries
3. Audit hitl/HITLStorage.ts queries
4. Add organization_id filters where missing
5. Add tests for tenant isolation

**Acceptance Criteria**:
- [ ] All .from() calls include tenant filtering
- [ ] Tests verify cross-tenant access blocked
- [ ] No queries bypass RLS

---

### PHASE 2C: MEDIUM PRIORITY (3 hours)

#### Task 7: External Side-Effects Safeguards
**Time**: 3 hours
**Actions**:
1. Audit agent database operations
2. Add organization_id to all inserts/updates
3. Wrap external API calls with circuit breakers
4. Add HITL approval for destructive operations
5. Implement dry-run mode for testing

**Files to fix**:
- OpportunityAgent.ts
- ExpansionAgent.ts
- RealizationAgent.ts
- IntegrityAgent.ts

**Acceptance Criteria**:
- [ ] All DB operations include organization_id
- [ ] External calls have circuit breakers
- [ ] Destructive operations require approval
- [ ] Audit trail for all side-effects

---

### PHASE 3: VALIDATION (2 hours)

#### Security Test Suite
**Time**: 1 hour
**Actions**:
1. Run existing security tests
2. Add new tests for fixed vulnerabilities
3. Run RLS test suite
4. Manual penetration testing

**Test Coverage**:
- [ ] Tenant isolation tests
- [ ] Service_role bypass tests
- [ ] LLM security wrapper tests
- [ ] Credential rotation verification

#### Performance Impact Assessment
**Time**: 30 minutes
**Actions**:
1. Benchmark query performance with RLS
2. Measure secureLLMInvoke overhead
3. Profile service_role vs anon key performance

#### Documentation Update
**Time**: 30 minutes
**Actions**:
1. Update security documentation
2. Document service_role usage policy
3. Update deployment procedures
4. Create runbook for credential rotation

---

### PHASE 4: COMPLETION AUDIT (30 minutes)

#### Self-Audit Checklist
- [ ] All critical vulnerabilities patched
- [ ] No secrets in repository
- [ ] All LLM calls use security wrapper
- [ ] Service_role usage minimized and documented
- [ ] Tenant isolation verified
- [ ] Tests prevent regression
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] No technical debt introduced

---

## Time Estimates

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Investigation | ✅ Complete | All critical tasks analyzed |
| Phase 2A: Critical Fixes | 2 hours | Task 8, Task 3 |
| Phase 2B: High Priority | 4 hours | Task 16, Task 1 |
| Phase 2C: Medium Priority | 3 hours | Task 7 |
| Phase 3: Validation | 2 hours | Testing, docs |
| Phase 4: Audit | 0.5 hours | Final check |
| **TOTAL** | **11.5 hours** | **6 critical tasks** |

---

## Risk Assessment

### HIGH RISK
- ❌ Production credentials in git (Task 8) - **IMMEDIATE**
- ❌ Direct LLM calls bypass security (Task 3) - **CRITICAL**

### MEDIUM RISK
- ⚠️ Service_role overuse (Task 16) - **HIGH**
- ⚠️ Missing tenant filters (Task 1) - **HIGH**

### LOW RISK
- ✅ RLS policies (Task 9) - **WELL IMPLEMENTED**
- ⚠️ Agent side-effects (Task 7) - **NEEDS REVIEW**

---

## Success Criteria

### Security
- ✅ No secrets in repository
- ✅ All LLM calls secured
- ✅ Tenant isolation verified
- ✅ Service_role usage minimized

### Quality
- ✅ 100% test coverage for fixes
- ✅ No performance degradation
- ✅ Backward compatibility maintained
- ✅ Documentation complete

### Production Readiness
- ✅ Credentials rotated
- ✅ Rollback plan documented
- ✅ Monitoring in place
- ✅ Incident response ready

---

## Next Steps

1. **IMMEDIATE**: Begin Phase 2A (credential rotation)
2. Execute fixes in priority order
3. Continuous validation during implementation
4. Final audit before marking complete

