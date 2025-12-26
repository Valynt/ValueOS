# Staging Deployment Checklist - Agent Security Fixes

**Date**: 2025-12-10  
**Target Environment**: Staging  
**Release**: Agent Security & Tenant Isolation v1.0

---

## ✅ Pre-Deployment Verification

### Code Changes
- [x] 8 production agents use secureInvoke() (no direct llmGateway.complete calls)
- [x] All agents have Zod schemas with hallucination_check
- [x] All memory operations include organizationId parameter
- [x] Confidence thresholds configured by risk profile
- [ ] Legacy src/agents/ directory deleted (PENDING - run cleanup script)
- [x] Zero TypeScript compile errors in production agents

### Test Coverage
- [ ] Unit tests pass for all 8 agents
- [ ] Integration tests pass (cross-tenant isolation)
- [ ] RLS tests pass (`npm run test:rls`)
- [ ] Memory system tenant isolation validated
- [ ] Circuit breaker activation tested
- [ ] Hallucination detection flags verified

### Documentation
- [x] AGENT_SECURITY_FIX_SUMMARY.md created
- [x] AGENT_FIX_VERIFICATION.md created
- [x] .github/instructions/todo.instructions.md updated
- [x] Test files created with security scenarios

---

## 🚀 Deployment Steps

### Step 1: Final Local Validation (15 minutes)

```bash
# 1. Run security test suite
bash scripts/test-agent-security.sh

# 2. Delete legacy agents
bash scripts/cleanup-legacy-agents.sh

# 3. Run full test suite
npm test

# 4. Run RLS tests
npm run test:rls

# 5. Type check entire codebase
npm run typecheck

# 6. Build production bundle
npm run build
```

**Exit Criteria**: All tests pass, zero errors, build succeeds

---

### Step 2: Staging Environment Preparation (10 minutes)

```bash
# 1. Ensure staging environment variables are set
cat > .env.staging << EOF
SUPABASE_URL=https://staging.supabase.co
SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=<staging-key>
NODE_ENV=staging
EOF

# 2. Verify database migrations are applied
npm run db:push -- --environment staging

# 3. Check Supabase connection
psql $STAGING_DATABASE_URL -c "SELECT version();"
```

**Exit Criteria**: Environment accessible, database up-to-date

---

### Step 3: Deploy to Staging (20 minutes)

```bash
# 1. Build with staging configuration
NODE_ENV=staging npm run build

# 2. Deploy to staging server
# (Adjust command based on your deployment method)
./deploy-staging.sh

# OR via Docker:
docker build -t valuecanvas:staging-agent-fix .
docker push valuecanvas:staging-agent-fix
kubectl set image deployment/valuecanvas-staging \
  valuecanvas=valuecanvas:staging-agent-fix -n staging

# 3. Verify deployment health
curl https://staging.valuecanvas.com/health

# 4. Check logs for errors
kubectl logs -f deployment/valuecanvas-staging -n staging | grep ERROR
```

**Exit Criteria**: Application responds, no startup errors

---

### Step 4: Smoke Tests (30 minutes)

#### Test 1: Opportunity Discovery (OpportunityAgent)
```bash
curl -X POST https://staging.valuecanvas.com/api/agents/opportunity \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "smoke-test-1",
    "input": {
      "valueCaseId": "test-case-001",
      "discoveryData": [
        "Customer struggles with manual data entry costing 20 hours/week"
      ]
    },
    "organizationId": "org-staging-test"
  }'
```

**Expected**: 
- Response includes opportunity_summary
- confidence_level present
- No hallucination_check: true flag
- Memory stored with correct organizationId

#### Test 2: Financial Modeling (FinancialModelingAgent)
```bash
curl -X POST https://staging.valuecanvas.com/api/agents/financial \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "smoke-test-2",
    "input": {
      "valueHypothesis": "Reduce costs by 30%",
      "businessObjectives": []
    },
    "organizationId": "org-staging-test"
  }'
```

**Expected**:
- ROI calculation present
- Confidence >= 0.7 (financial threshold)
- No unrealistic values (hallucination detection working)

#### Test 3: Cross-Tenant Isolation
```bash
# Create data for Org A
curl -X POST https://staging.valuecanvas.com/api/agents/opportunity \
  -H "Authorization: Bearer $ORG_A_TOKEN" \
  -d '{"organizationId": "org-a", ...}'

# Verify Org B cannot access Org A's data
curl -X GET https://staging.valuecanvas.com/api/memory?organizationId=org-a \
  -H "Authorization: Bearer $ORG_B_TOKEN"
```

**Expected**: 403 Forbidden or empty result set (RLS enforced)

---

### Step 5: Integration Test Suite (45 minutes)

```bash
# Run against staging environment
STAGING=true npm run test:integration

# Specific agent workflow tests
npm run test -- --run workflows/VOS-lifecycle.integration.test.ts

# Memory isolation tests
npm run test -- --run lib/agent-fabric/MemorySystem.tenant-isolation.test.ts
```

**Exit Criteria**: All integration tests pass

---

### Step 6: Monitoring Setup (15 minutes)

#### Grafana Dashboards
1. **Circuit Breaker Metrics**
   - Panel: `agent_circuit_breaker_state`
   - Alert: If open for > 5 minutes

2. **Hallucination Detection Rate**
   - Panel: `agent_hallucination_check_true_count`
   - Alert: If > 10% of responses

3. **Tenant Isolation Violations**
   - Panel: `memory_queries_without_organization_id`
   - Alert: If any violations detected

4. **Agent Confidence Scores**
   - Panel: `agent_confidence_distribution`
   - Alert: If avg < threshold by agent type

#### Log Monitoring
```bash
# Watch for security violations
kubectl logs -f deployment/valuecanvas-staging | grep "SECURITY:"

# Watch for hallucination detections
kubectl logs -f deployment/valuecanvas-staging | grep "hallucination_check: true"

# Watch for tenant isolation errors
kubectl logs -f deployment/valuecanvas-staging | grep "organizationId is required"
```

---

### Step 7: Performance Validation (30 minutes)

#### Latency Benchmarks
```bash
# Run performance tests
npm run test:perf

# Expected latency increases (baseline vs. after fix):
# - OpportunityAgent: +20-40ms (acceptable)
# - FinancialModelingAgent: +30-50ms (acceptable for security)
# - TargetAgent: +20-40ms (acceptable)
```

**Exit Criteria**: Latency increase < 10% of baseline

#### Memory Usage
```bash
# Monitor memory consumption
kubectl top pods -n staging | grep valuecanvas

# Expected: < 5% increase in memory usage
```

---

### Step 8: Security Audit (20 minutes)

```bash
# 1. Verify no cross-tenant data leaks
npm run test:rls

# 2. Check for direct LLM calls bypassing security
grep -r "llmGateway\.complete" src/lib/agent-fabric/agents/*.ts | \
  grep -v "BaseAgent.ts" | grep -v "//"

# Expected: 0 matches

# 3. Verify all memory operations include organizationId
grep -A 5 "memorySystem.store" src/lib/agent-fabric/agents/*.ts | \
  grep "organizationId" | wc -l

# Expected: >= 8 matches

# 4. Run security scan
npm run security:scan

# Expected: No new high/critical vulnerabilities
```

---

### Step 9: Rollback Plan (5 minutes)

**If Critical Issues Detected:**

```bash
# Option 1: Revert deployment
kubectl rollout undo deployment/valuecanvas-staging -n staging

# Option 2: Restore previous Docker image
kubectl set image deployment/valuecanvas-staging \
  valuecanvas=valuecanvas:previous-stable -n staging

# Option 3: Emergency disable (if needed)
kubectl scale deployment/valuecanvas-staging --replicas=0 -n staging
```

**Rollback Triggers**:
- > 5% error rate in agent executions
- Cross-tenant data leak detected
- Circuit breaker stuck in open state
- Hallucination rate > 20%
- Latency increase > 200ms

---

## 📊 Success Metrics (48-Hour Observation)

### Performance
- [ ] Agent execution latency: +20-50ms (< 10% increase)
- [ ] Memory usage: < +5% increase
- [ ] Error rate: < 1% of agent executions
- [ ] 99th percentile latency: < 2s

### Security
- [ ] Zero cross-tenant data leaks
- [ ] 100% of LLM calls use secureInvoke()
- [ ] 100% of memory operations include organizationId
- [ ] Hallucination detection rate: 1-5% (expected baseline)

### Reliability
- [ ] Circuit breaker activations: < 10 per day
- [ ] Agent execution success rate: > 98%
- [ ] Zero TypeScript runtime errors
- [ ] Zero RLS policy violations

---

## 🎯 Post-Deployment Actions

### Day 1 (Immediate)
- [ ] Monitor Grafana dashboards every 2 hours
- [ ] Review error logs for security violations
- [ ] Validate hallucination detection flags
- [ ] Check circuit breaker state

### Day 2-3 (Short-term)
- [ ] Analyze confidence score distributions
- [ ] Review tenant isolation audit logs
- [ ] Performance benchmarking report
- [ ] User acceptance testing (if applicable)

### Day 4-7 (Production Preparation)
- [ ] Document any edge cases discovered
- [ ] Update runbooks with operational insights
- [ ] Prepare production deployment plan
- [ ] Schedule production release window

---

## ✅ Staging Sign-Off

**Required Approvals**:
- [ ] Engineering Lead: All tests pass, zero security violations
- [ ] DevOps: Monitoring configured, rollback plan validated
- [ ] Security Team: Tenant isolation verified, no data leaks
- [ ] Product Owner: Smoke tests pass, ready for production

**Production Deployment Date**: December 13, 2025 (pending sign-off)

---

**Deployment Owner**: <Your Name>  
**Emergency Contact**: <On-call engineer>  
**Rollback Authority**: Engineering Lead or VP Engineering
