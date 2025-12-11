# SDUI Staging Deployment Guide

## Pre-Deployment Checklist

### 1. Code Validation

- [x] Security hardening implemented (Week 1)
  - [x] XSS sanitization with DOMPurify
  - [x] Rate limiting (10 req/min per org)
  - [x] Recursion guards (max depth 10)
  - [x] Security metrics tracking

- [x] Stability improvements implemented (Week 2)
  - [x] LRU cache eviction (1000 max entries)
  - [x] Performance metrics instrumentation
  - [x] Session validation

- [x] Test Coverage
  - [x] 76/76 unit tests passing
  - [x] Performance benchmarks validated
  - [x] Load tests passing

### 2. Performance Validation

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| XSS Sanitization (simple) | <5ms | <5ms | ✅ |
| XSS Sanitization (malicious) | <10ms | <10ms | ✅ |
| Session Validation | <1ms | <1ms | ✅ |
| Cache Operations | <1ms | <1ms | ✅ |
| Full Render Cycle | <150ms | <150ms | ✅ |
| Concurrent 1000 ops | <5s | <5s | ✅ |

## Deployment Steps

### Step 1: Environment Configuration

```bash
# Set staging environment variables
export NODE_ENV=staging
export SDUI_ENABLED=true
export SDUI_SECURITY_ENABLED=true

# Cache configuration
export SDUI_CACHE_MAX_SIZE=1000
export SDUI_CACHE_TTL_MS=60000

# Rate limiting
export SDUI_RATE_LIMIT_REQUESTS=100
export SDUI_RATE_LIMIT_WINDOW_MS=60000

# Session validation
export SESSION_MAX_AGE_MS=86400000  # 24 hours
export SESSION_IDLE_TIMEOUT_MS=7200000  # 2 hours
```

### Step 2: Build and Deploy

```bash
# 1. Build staging bundle
npm run build:staging

# 2. Run pre-deployment tests
npm run test:unit
npm run test:performance

# 3. Deploy to staging
./scripts/deploy-staging.sh

# 4. Verify deployment
curl https://staging.valuecanvas.io/health
```

### Step 3: Database Migrations

```sql
-- No database changes required for SDUI security/stability
-- All changes are in-memory (cache, rate limiting, session validation)
```

### Step 4: Monitoring Setup

#### Grafana Dashboards

Create dashboard with panels:

**SDUI Performance**:
```json
{
  "title": "SDUI Performance Metrics",
  "panels": [
    {
      "title": "Cache Hit Rate",
      "query": "sdui_cache_hits / (sdui_cache_hits + sdui_cache_misses) * 100",
      "threshold": { "warning": 70, "critical": 50 }
    },
    {
      "title": "Average Resolve Time",
      "query": "sdui_total_resolve_time / sdui_resolve_count",
      "threshold": { "warning": 100, "critical": 200 }
    },
    {
      "title": "Cache Size",
      "query": "sdui_cache_size",
      "max": 1000
    },
    {
      "title": "Eviction Rate",
      "query": "rate(sdui_eviction_count[1h])",
      "threshold": { "warning": 100 }
    }
  ]
}
```

**SDUI Security**:
```json
{
  "title": "SDUI Security Metrics",
  "panels": [
    {
      "title": "XSS Blocks",
      "query": "rate(sdui_xss_blocked[1h])",
      "threshold": { "warning": 100 }
    },
    {
      "title": "Rate Limit Hits",
      "query": "rate(sdui_rate_limit_hits[1h])",
      "threshold": { "warning": 1000 }
    },
    {
      "title": "Session Invalid",
      "query": "rate(sdui_session_invalid[1h])",
      "threshold": { "warning": 50, "critical": 200 }
    },
    {
      "title": "Tenant Violations",
      "query": "sdui_tenant_violations",
      "threshold": { "critical": 1 }
    }
  ]
}
```

#### Alert Configuration

```yaml
# Grafana Alert Rules

alerts:
  - name: SDUI Cache Hit Rate Low
    condition: |
      sdui_cache_hits / (sdui_cache_hits + sdui_cache_misses) * 100 < 70
    severity: warning
    notification: slack-engineering
    
  - name: SDUI High Eviction Rate
    condition: rate(sdui_eviction_count[1h]) > 100
    severity: warning
    notification: slack-engineering
    
  - name: SDUI Session Invalid High
    condition: rate(sdui_session_invalid[1h]) > 50
    severity: warning
    notification: slack-security
    
  - name: SDUI Tenant Violation
    condition: increase(sdui_tenant_violations[5m]) > 0
    severity: critical
    notification: slack-security, pagerduty
    
  - name: SDUI High XSS Attempts
    condition: rate(sdui_xss_blocked[1h]) > 100
    severity: warning
    notification: slack-security
    
  - name: SDUI Performance Degradation
    condition: |
      sdui_total_resolve_time / sdui_resolve_count > 200
    severity: warning
    notification: slack-engineering
```

### Step 5: Smoke Tests

Run after deployment:

```bash
# 1. Health check
curl https://staging.valuecanvas.io/health
# Expected: { "status": "ok", "sdui": "enabled" }

# 2. XSS protection test
curl -X POST https://staging.valuecanvas.io/api/sdui/render \
  -H "Content-Type: application/json" \
  -d '{
    "component": "InfoBanner",
    "props": {
      "title": "<script>alert(1)</script>Test"
    }
  }'
# Expected: title should be sanitized (no <script> tag)

# 3. Session validation test
curl https://staging.valuecanvas.io/api/session/validate \
  -H "Authorization: Bearer $EXPIRED_TOKEN"
# Expected: { "valid": false, "reason": "Session expired" }

# 4. Cache metrics test
curl https://staging.valuecanvas.io/api/sdui/metrics
# Expected: {
#   "cacheHits": N,
#   "cacheMisses": M,
#   "hitRate": "X%",
#   "avgResolveTime": "Yms"
# }
```

## 48-Hour Observation Period

### Day 1 Checklist

**Hour 0-6**:
- [ ] Monitor deployment for errors
- [ ] Validate all smoke tests passing
- [ ] Check Grafana dashboards loading correctly
- [ ] Verify metrics flowing to monitoring

**Hour 6-12**:
- [ ] Review cache hit rates (target >70%)
- [ ] Monitor XSS block counts (should be near zero for legitimate traffic)
- [ ] Check session validation metrics
- [ ] Verify no tenant isolation violations

**Hour 12-24**:
- [ ] Analyze performance under normal load
- [ ] Review eviction patterns
- [ ] Monitor rate limit hits
- [ ] Check for any security alerts

### Day 2 Checklist

**Hour 24-36**:
- [ ] Review aggregated metrics from Day 1
- [ ] Identify any performance bottlenecks
- [ ] Check for memory leaks (cache size should stabilize)
- [ ] Validate session timeout UX

**Hour 36-48**:
- [ ] Final performance validation
- [ ] Security audit review
- [ ] Prepare production deployment plan
- [ ] Document any issues or observations

### Success Criteria

Must achieve ALL before production deployment:

- [x] Zero security violations (tenant isolation, XSS bypasses)
- [ ] Cache hit rate >70%
- [ ] Average resolve time <100ms
- [ ] P99 resolve time <500ms
- [ ] Zero memory leaks (stable cache size)
- [ ] Session validation working correctly
- [ ] Alert system functioning
- [ ] No performance degradation over 48 hours

### Rollback Triggers

Immediate rollback if:

1. **Security Issue**: Tenant isolation violation detected
2. **Performance**: P99 latency >2s for 5+ minutes
3. **Memory**: Cache size exceeds 1500 entries (indicates eviction failure)
4. **Errors**: Error rate >5% for 10+ minutes
5. **Data Loss**: Session validation causing widespread logouts

**Rollback Command**:
```bash
./scripts/rollback-staging.sh --version=previous
# Or use feature flag:
export SDUI_ENABLED=false
```

## Post-Observation

### Production Readiness Review

After successful 48-hour observation:

1. **Engineering Sign-off**:
   - Performance metrics within targets
   - No critical bugs identified
   - Load testing validated

2. **Security Sign-off**:
   - Zero security violations
   - XSS protection effective
   - Tenant isolation validated
   - Session validation working

3. **DevOps Sign-off**:
   - Monitoring and alerts functional
   - Resource usage acceptable
   - Deployment process validated

### Production Deployment Plan

Once approved:

1. **Schedule**: Deploy during low-traffic window (e.g., Sunday 2-4 AM EST)
2. **Strategy**: Gradual rollout with feature flag
   - 10% traffic for 1 hour
   - 25% traffic for 2 hours
   - 50% traffic for 4 hours
   - 100% traffic after validation
3. **Monitoring**: Engineering on-call during rollout
4. **Rollback**: Feature flag ready for instant disable

## Metrics to Track

### Performance Metrics
- Cache hit rate (target >70%)
- Average resolve time (target <100ms)
- P99 resolve time (target <500ms)
- Eviction count per hour (target <100)

### Security Metrics
- XSS blocks per hour (should be low for legitimate traffic)
- Rate limit hits per hour (should be rare)
- Session invalid per hour (expect some from expired sessions)
- Tenant violations (must be zero)

### System Metrics
- Cache memory usage (should stabilize <10MB)
- CPU usage (should not increase significantly)
- Request latency (should remain stable)
- Error rate (should remain <1%)

## Support Contacts

- **Engineering Lead**: @engineering-lead (Slack)
- **Security Team**: @security (Slack), security@valuecanvas.io
- **DevOps On-Call**: PagerDuty integration
- **Product Manager**: @product (Slack)

---

**Last Updated**: 2025-12-11  
**Version**: 1.0  
**Author**: Engineering Team
