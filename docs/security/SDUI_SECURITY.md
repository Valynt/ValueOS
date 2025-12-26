# SDUI Security Documentation

## Overview

The Server-Driven UI (SDUI) system implements comprehensive security hardening to protect against XSS attacks, DoS attacks, stack overflow, and tenant isolation violations.

## Security Layers

### 1. XSS Protection

**Implementation**: `src/sdui/security/sanitization.ts`

All user-provided content is sanitized using DOMPurify before rendering:

```typescript
import { sanitizeProps } from './security/sanitization';

const sanitizedProps = sanitizeProps(resolvedProps, section.component);
```

**Features**:

- **Component-Specific Policies**: Different sanitization levels based on component type
  - `strict`: Strips ALL HTML (MetricBadge, StatCard)
  - `standard`: Allows safe HTML (most components)
  - `rich`: Allows rich formatting (NarrativeBlock, IntegrityReviewPanel)
- **Recursive Sanitization**: Handles nested objects and arrays
- **javascript: URL Blocking**: Explicitly blocks `javascript:` URLs in all string values
- **Recursion Loop Detection**: Prevents infinite loops with max depth = 10
- **Date Object Preservation**: Maintains Date instances without conversion

**XSS Test Vectors Blocked**:

```typescript
'<script>alert(1)</script>'
'<img src=x onerror=alert(1)>'
'<svg onload=alert(1)>'
'javascript:alert(1)'
'<iframe src="javascript:alert(1)"></iframe>'
'<a href="javascript:void(0)">Link</a>'
'<div onerror="alert(1)">Content</div>'
```

**Configuration**:

```typescript
// Component policy mapping in sanitization.ts
const COMPONENT_POLICIES: Record<string, keyof typeof SANITIZATION_CONFIGS> = {
  'MetricBadge': 'strict',      // No HTML allowed
  'StatCard': 'strict',
  'NarrativeBlock': 'rich',     // Rich formatting allowed
  'InfoBanner': 'standard',     // Safe HTML only
  // ... see sanitization.ts for full list
};
```

### 2. Rate Limiting

**Implementation**: `src/sdui/DataBindingResolver.ts`

Prevents DoS attacks on data binding resolution:

```typescript
import PQueue from 'p-queue';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Queue: max 10 concurrent requests
const queue = new PQueue({ concurrency: 10, timeout: 30000 });

// Rate limit: 10 requests per minute per organization
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60
});
```

**Configuration**:

- **Concurrency Limit**: 10 simultaneous data binding resolutions
- **Time-Window Limit**: 10 requests per 60 seconds per organizationId
- **Timeout**: 30 seconds per request
- **Scope**: Per-tenant rate limiting (organizationId key)

**Exceeded Limit Behavior**:

- Requests queued when concurrency limit reached
- `RateLimiterException` thrown when time-window limit exceeded
- Security metric `rate_limit_hit` incremented
- Error logged with organizationId context

### 3. Recursion Guards

**Implementation**: `src/sdui/renderer.tsx`

Prevents stack overflow from deeply nested layouts:

```typescript
const MAX_RENDER_DEPTH = 10;

function renderSection(section: any, context: any, depth: number = 0) {
  if (depth > MAX_RENDER_DEPTH) {
    incrementSecurityMetric('recursion_limit', { depth, section: section?.component });
    throw new Error(`Maximum render depth exceeded (${MAX_RENDER_DEPTH})`);
  }
  // ... render logic with depth+1 for nested sections
}
```

**Features**:

- Maximum depth: 10 levels
- Depth tracking through all layout components (VerticalSplit, HorizontalSplit, Grid, DashboardPanel)
- Prevents malicious deeply-nested payloads
- Security metric `recursion_limit` tracked

**Example Protected Scenario**:

```typescript
// This would be blocked at depth 11:
{
  type: 'VerticalSplit',
  sections: [{
    type: 'HorizontalSplit',
    sections: [{
      type: 'Grid',
      sections: [
        // ... 8 more levels of nesting ...
        { type: 'MetricBadge' } // BLOCKED - depth = 11
      ]
    }]
  }]
}
```

### 4. Security Metrics

**Implementation**: `src/sdui/security/metrics.ts`

Tracks all security events for monitoring and alerting:

```typescript
import { incrementSecurityMetric, getSecurityMetrics } from './security/metrics';

// Track events
incrementSecurityMetric('xss_blocked', { component: 'InfoBanner' });
incrementSecurityMetric('rate_limit_hit', { organizationId: 'org-123' });

// Read metrics
const metrics = getSecurityMetrics();
console.log(metrics.xssBlocked); // Count of XSS attempts blocked
```

**Event Types**:

- `xss_blocked`: XSS content sanitized
- `rate_limit_hit`: Rate limit exceeded
- `tenant_violation`: Cross-tenant access attempt
- `recursion_limit`: Render depth exceeded
- `invalid_schema`: Schema validation failed
- `component_not_found`: Unknown component type
- `binding_error`: Data binding resolution error
- `session_invalid`: Invalid session context

**Metrics Structure**:

```typescript
interface SecurityMetrics {
  xssBlocked: number;
  rateLimitHits: number;
  tenantViolations: number;
  recursionLimits: number;
  invalidSchemas: number;
  componentNotFound: number;
  bindingErrors: number;
  sessionInvalid: number;
  sinceTimestamp: number; // Last reset time
}
```

**Critical Event Logging**:

- `tenant_violation`: ERROR level with stack trace
- `xss_blocked`: WARN level with sanitized content sample
- `rate_limit_hit`: WARN level with organizationId
- All others: INFO level

## Testing

**Test Suite**: `src/sdui/__tests__/security.unit.test.tsx`  
**Configuration**: `vitest.config.unit.ts` (database-free unit tests)

**Test Coverage** (44/44 passing):

**Week 1 - Security Hardening** (21 tests):

- **XSS Sanitization** (11 tests):
  - Script tag sanitization
  - Event handler removal
  - javascript: URL blocking
  - Nested object/array sanitization
  - Component-specific policies
  - Recursion loop detection
  - XSS test vector blocking
  - HTML entity preservation
  - Null/undefined handling
  - Non-string primitive handling

- **Security Metrics** (6 tests):
  - XSS block tracking
  - Rate limit tracking
  - Tenant violation tracking
  - Recursion limit tracking
  - Metric reset functionality
  - Multiple event type independence

- **Recursion Guards** (2 tests):
  - Depth limit detection
  - Nested render depth tracking

- **Integration** (2 tests):
  - Combined attack vector handling
  - Valid data preservation with sanitization

**Week 2 - Stability & Monitoring** (23 tests):

- **Session Validation** (10 tests):
  - Valid session acceptance
  - Expiry detection
  - Idle timeout detection
  - Refresh threshold detection
  - Structure validation (missing fields, wrong types)
  - Activity timestamp updates
  - Session creation
  - Time remaining calculations
  - Edge cases (null, undefined, empty, extra fields, negative timestamps)

- **LRU Cache** (2 tests):
  - Eviction when cache full
  - Access order updates on cache hit

- **Performance Metrics** (3 tests):
  - Hit rate calculation
  - Average resolve time
  - Eviction count tracking

- **Memory Leak Prevention** (2 tests):
  - Maximum cache size enforcement
  - Periodic cleanup of expired entries

- **Security Edge Cases** (6 tests):
  - Null/undefined session handling
  - Invalid session structures
  - Extra fields tolerance
  - Timestamp edge cases

**Running Tests**:

```bash
# Run security unit tests (no database required)
npx vitest run --config vitest.config.unit.ts

# Run with coverage
npx vitest run --config vitest.config.unit.ts --coverage

# Watch mode
npx vitest --config vitest.config.unit.ts
```

## Performance Targets

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| XSS Sanitization Overhead | <5ms per component | TBD | Pending benchmark |
| Rate Limit Queue Latency | <100ms (uncongested) | TBD | Pending benchmark |
| Recursion Guard Check | <1ms | TBD | Pending benchmark |
| Memory Overhead | <10MB for 1000 components | TBD | Pending benchmark |
| Cache Hit Rate | >80% | Tracked | ✅ Metrics available |
| Average Resolve Time | <100ms | Tracked | ✅ Metrics available |
| LRU Eviction Rate | <10/min | Tracked | ✅ Metrics available |
| Session Validation | <1ms | TBD | Pending benchmark |

## Deployment Checklist

Before deploying to production:

1. ✅ Security test suite passing (44/44 tests - Week 1 + Week 2)
2. ✅ Memory leak prevention implemented (LRU cache with max 1000 entries)
3. ✅ Performance metrics instrumentation complete
4. ✅ Session validation implemented
5. ⏳ Performance benchmarks within targets
6. ⏳ Staging deployment with 48-hour observation
7. ⏳ Security audit of tenant isolation
8. ⏳ Load testing of rate limiting and cache eviction
9. ⏳ Monitoring alerts configured for:
   - `tenantViolations > 0` (CRITICAL)
   - `xssBlocked > 100/hr` (WARNING)
   - `rateLimitHits > 1000/hr` (WARNING)
   - `recursionLimits > 10/hr` (WARNING)
   - `cacheHitRate < 70%` (WARNING)
   - `evictionCount > 100/hr` (WARNING)
   - `sessionInvalid > 50/hr` (WARNING)

### 5. Memory Management (Week 2)

**Implementation**: `src/sdui/DataBindingResolver.ts`

LRU cache eviction prevents unbounded memory growth:

```typescript
// Configuration
private readonly MAX_CACHE_SIZE = 1000;
private cacheAccessOrder: string[] = []; // Track LRU order

// Automatic eviction when cache full
if (this.cache.size >= this.MAX_CACHE_SIZE && !this.cache.has(key)) {
  this.evictLRU(); // Remove least recently used
}
```

**Features**:

- **Maximum Size**: 1000 cache entries (prevents memory leaks)
- **LRU Algorithm**: Tracks access order, evicts oldest first
- **Access Tracking**: Cache hits move entries to "most recently used"
- **Eviction Metrics**: `performanceMetrics.evictionCount` tracked

**Performance Monitoring**:

```typescript
const metrics = resolver.getPerformanceMetrics();
// Returns:
// {
//   cacheHits: 850,
//   cacheMisses: 150,
//   hitRate: '85.00%',
//   avgResolveTime: '45.23ms',
//   evictionCount: 12,
//   cacheSize: 1000,
//   maxCacheSize: 1000
// }
```

### 6. Session Validation (Week 2)

**Implementation**: `src/sdui/security/sessionValidation.ts`

Validates session state before rendering:

```typescript
import { validateSession } from './security/sessionValidation';

const validation = validateSession(sessionContext);
if (!validation.valid) {
  // Show login prompt
  return <LoginRequired reason={validation.reason} />;
}

if (validation.shouldRefresh) {
  // Refresh session in background
  refreshSessionToken();
}
```

**Validation Rules**:

- **Max Age**: 24 hours absolute expiration
- **Idle Timeout**: 2 hours of inactivity
- **Refresh Threshold**: Warn at 15 minutes before expiry
- **Structure Validation**: Required fields (sessionId, userId, organizationId, timestamps)
- **Type Checking**: All fields must have correct types

**Session Context**:

```typescript
interface SessionContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}
```

## Known Limitations

1. ✅ ~~**Cache Unbounded Growth**~~: **FIXED** - LRU cache with 1000 entry max implemented (Week 2)
2. **CSP Headers**: May need refinement for specific SDUI components (test thoroughly in staging)
3. **Rate Limit Persistence**: In-memory rate limiting resets on service restart (consider Redis for distributed systems)
4. **Session Storage**: Sessions validated client-side; consider server-side session store for enhanced security

## Rollback Plan

If security issues discovered in production:

1. Immediate: Disable SDUI rendering via feature flag `SDUI_ENABLED=false`
2. Short-term: Revert to previous commit (before `fca7e64`)
3. Long-term: Fix issue, add regression test, redeploy

## Security Contacts

- **Security Issues**: Report to security team immediately
- **Performance Issues**: Contact DevOps for monitoring dashboard access
- **Implementation Questions**: See `src/sdui/security/` source code comments

---

**Last Updated**: 2025-12-11  
**Implementation Status**: Week 1 ✅ | Week 2 ✅  
**Completed**: XSS protection, rate limiting, recursion guards, LRU cache, performance metrics, session validation  
**Next**: Performance benchmarking, load testing, staging deployment
