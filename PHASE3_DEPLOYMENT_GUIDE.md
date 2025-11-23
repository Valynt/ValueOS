# Phase 3 Deployment Guide

## Quick Start

```bash
# 1. Verify integration
./scripts/verify-phase3-integration.sh

# 2. Apply database migration
supabase db push

# 3. Deploy to staging (flags OFF)
docker-compose -f docker-compose.prod.yml up -d

# 4. Monitor
docker-compose logs -f app
```

## Pre-Deployment Checklist

- [ ] All Phase 3 integration complete
- [ ] Verification script passes
- [ ] Database migration tested locally
- [ ] Staging environment configured
- [ ] Monitoring queries ready
- [ ] Rollback plan documented

## Deployment Steps

### Week 1: Staging Deployment (Flags OFF)

**Goal**: Verify no regressions with new code deployed but disabled

```bash
# Set environment variables
export ENABLE_STATELESS_ORCHESTRATION=false
export ENABLE_SAFE_JSON_PARSER=false

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Monitor for 48 hours
# - Check error rates
# - Verify latency unchanged
# - Confirm no regressions
```

**Success Criteria**:
- Error rate unchanged from baseline
- Latency within 10% of baseline
- No new bugs reported

### Week 2: Canary Deployment (10% Traffic)

**Goal**: Test new architecture with small percentage of users

```bash
# Enable feature flags for 10% of users
export ENABLE_STATELESS_ORCHESTRATION=true
export ENABLE_SAFE_JSON_PARSER=true
export CANARY_PERCENTAGE=10

# Restart application
docker-compose restart app

# Monitor for 48 hours
```

**Monitoring Queries**:

```sql
-- Error rate comparison
SELECT 
  CASE 
    WHEN metadata->>'useStateless' = 'true' THEN 'New'
    ELSE 'Legacy'
  END as version,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
  ROUND(100.0 * SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY version;

-- Latency comparison
SELECT 
  CASE 
    WHEN metadata->>'useStateless' = 'true' THEN 'New'
    ELSE 'Legacy'
  END as version,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 2) as avg_duration_seconds,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))), 2) as p95_duration_seconds
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY version;

-- Session isolation check (MUST be 0)
SELECT COUNT(*) as cross_contamination_count
FROM (
  SELECT session_id, COUNT(DISTINCT user_id) as user_count
  FROM agent_sessions
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY session_id
  HAVING COUNT(DISTINCT user_id) > 1
) subquery;
```

**Success Criteria**:
- Error rate ≤ legacy error rate
- P95 latency < 3 seconds
- Zero cross-contamination
- No critical bugs

### Week 3: Gradual Rollout (25% → 50% → 75%)

**Day 1-2: 25% Traffic**

```bash
export CANARY_PERCENTAGE=25
docker-compose restart app
```

**Day 3-4: 50% Traffic**

```bash
export CANARY_PERCENTAGE=50
docker-compose restart app
```

**Day 5-6: 75% Traffic**

```bash
export CANARY_PERCENTAGE=75
docker-compose restart app
```

**Monitor at each step**:
- Run monitoring queries
- Check error rates
- Verify latency
- Review user feedback

**Pause criteria**:
- Error rate > 2%
- P95 latency > 5 seconds
- Any cross-contamination detected
- Critical bugs reported

### Week 4: Full Production (100%)

**Goal**: Complete migration to new architecture

```bash
# Enable for all users
export CANARY_PERCENTAGE=100
docker-compose restart app

# Monitor for 48 hours
```

**Post-Deployment**:
1. Monitor for 48 hours
2. Verify all metrics stable
3. Document lessons learned
4. Plan legacy code removal

## Rollback Procedures

### Immediate Rollback (Critical Issues)

```bash
# Disable feature flags
export ENABLE_STATELESS_ORCHESTRATION=false
export ENABLE_SAFE_JSON_PARSER=false

# Restart application
docker-compose restart app

# Verify legacy path working
curl -X POST http://staging.valuecanvas.com/api/agent/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "test query"}'
```

### Gradual Rollback (Non-Critical Issues)

```bash
# Reduce canary percentage
export CANARY_PERCENTAGE=50  # From 75%
docker-compose restart app

# Monitor for improvement
# If issues persist, reduce further
export CANARY_PERCENTAGE=25  # From 50%
docker-compose restart app

# If still issues, full rollback
export CANARY_PERCENTAGE=0
docker-compose restart app
```

## Monitoring Dashboard

### Key Metrics

1. **Error Rate**
   - Target: < 1%
   - Warning: > 2%
   - Critical: > 5%

2. **Latency (P95)**
   - Target: < 2s
   - Warning: > 3s
   - Critical: > 5s

3. **Session Isolation**
   - Target: 0 cross-contamination
   - Warning: N/A
   - Critical: > 0

4. **Concurrent Sessions**
   - Target: 100+
   - Warning: N/A
   - Critical: N/A

### Alert Configuration

```yaml
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    severity: critical
    notification: pagerduty
    
  - name: High Latency
    condition: p95_latency > 5s
    severity: critical
    notification: pagerduty
    
  - name: Session Isolation Failure
    condition: cross_contamination_count > 0
    severity: critical
    notification: pagerduty
    
  - name: Moderate Error Rate
    condition: error_rate > 2%
    severity: warning
    notification: slack
```

## Troubleshooting

### Issue: High Error Rate

**Symptoms**: Error rate > 2%

**Investigation**:
```sql
-- Find error patterns
SELECT 
  error_message,
  COUNT(*) as occurrence_count
FROM agent_sessions
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_message
ORDER BY occurrence_count DESC
LIMIT 10;
```

**Actions**:
1. Check if errors are new or existing
2. Review error logs for stack traces
3. If new errors, consider rollback
4. If existing errors, continue monitoring

### Issue: High Latency

**Symptoms**: P95 latency > 3s

**Investigation**:
```sql
-- Find slow sessions
SELECT 
  session_id,
  user_id,
  workflow_state->>'currentStage' as stage,
  EXTRACT(EPOCH FROM (updated_at - created_at)) as duration_seconds
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY duration_seconds DESC
LIMIT 10;
```

**Actions**:
1. Check database query performance
2. Review agent processing time
3. Check for external API delays
4. Consider caching improvements

### Issue: Session Isolation Failure

**Symptoms**: cross_contamination_count > 0

**Investigation**:
```sql
-- Find contaminated sessions
SELECT 
  session_id,
  ARRAY_AGG(DISTINCT user_id) as user_ids,
  COUNT(*) as request_count
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY session_id
HAVING COUNT(DISTINCT user_id) > 1;
```

**Actions**:
1. **IMMEDIATE ROLLBACK** - This is critical
2. Review session creation logic
3. Check for race conditions
4. Verify database constraints
5. Fix and re-test before re-deployment

## Success Metrics

### Phase 3 Complete When:

- ✅ Verification script passes
- ✅ Database migration applied
- ✅ Staging deployment successful
- ✅ Canary deployment successful (10%)
- ✅ Gradual rollout successful (25% → 50% → 75%)
- ✅ Full production successful (100%)
- ✅ 48 hours stable operation
- ✅ Error rate < 1%
- ✅ P95 latency < 2s
- ✅ Zero cross-contamination

### Production Ready When:

- ✅ All success metrics met
- ✅ No critical bugs
- ✅ Monitoring and alerting active
- ✅ Team trained on new architecture
- ✅ Documentation complete
- ✅ Runbook updated

## Post-Deployment

### Week 1 After Full Rollout

- [ ] Monitor all metrics daily
- [ ] Review error logs
- [ ] Collect user feedback
- [ ] Document any issues

### Week 2-4 After Full Rollout

- [ ] Continue monitoring
- [ ] Optimize performance
- [ ] Plan legacy code removal
- [ ] Update documentation

### Month 2

- [ ] Remove legacy code path
- [ ] Remove feature flags
- [ ] Optimize database queries
- [ ] Plan next enhancements

## Resources

- **Verification Script**: `./scripts/verify-phase3-integration.sh`
- **Monitoring Queries**: `docs/MONITORING_QUERIES.md`
- **Implementation Details**: `REMEDIATION_IMPLEMENTATION_COMPLETE.md`
- **Architecture Guide**: `CRITICAL_REMEDIATION_PLAN.md`

## Support

For issues during deployment:

1. Check this guide first
2. Review monitoring queries
3. Check error logs: `docker-compose logs -f app`
4. Run verification script
5. Consult team lead if issues persist

---

**Last Updated**: November 23, 2024  
**Version**: 1.0  
**Next Review**: After staging deployment
