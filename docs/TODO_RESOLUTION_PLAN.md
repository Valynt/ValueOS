# Critical TODO Resolution Plan

**Generated**: 2025-12-30  
**Status**: Action Required  
**Target**: Week 1 (P0 Items)

---

## P0 - BLOCKERS (Must Fix Before Production)

### 1. Bootstrap Initialization (src/bootstrap.ts)

#### TODO #1: Initialize Sentry (Line 243)
**Status**: ⚠️ INCOMPLETE  
**Impact**: Error tracking disabled in production  
**Priority**: P0

**Current Code**:
```typescript
// TODO: Initialize Sentry
```

**Resolution**:
```typescript
// Initialize Sentry error tracking
if (config.sentry.enabled && config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.environment,
    tracesSampleRate: config.sentry.tracesSampleRate,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay()
    ],
    beforeSend(event) {
      // Redact sensitive data
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }
      return event;
    }
  });
  logger.info('Sentry initialized', { environment: config.environment });
}
```

**Action Items**:
- [ ] Add Sentry initialization code
- [ ] Configure DSN in environment variables
- [ ] Test error reporting
- [ ] Verify PII redaction

---

#### TODO #2: Check Database Connection (Line 355)
**Status**: ⚠️ INCOMPLETE  
**Impact**: App may start without database connectivity  
**Priority**: P0

**Current Code**:
```typescript
// TODO: Check database connection
```

**Resolution**:
```typescript
// Verify database connectivity
try {
  const { data, error } = await supabase
    .from('_health_check')
    .select('count')
    .limit(1);
  
  if (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
  
  logger.info('Database connection verified');
  return { status: 'healthy', database: 'connected' };
} catch (error) {
  logger.error('Database connection check failed', error);
  throw new BootstrapError(
    'DATABASE_CONNECTION_FAILED',
    'Cannot connect to database',
    { error }
  );
}
```

**Action Items**:
- [ ] Add database health check
- [ ] Create `_health_check` table or use existing table
- [ ] Handle connection failures gracefully
- [ ] Add retry logic with exponential backoff

---

#### TODO #3: Initialize Redis Cache (Line 375)
**Status**: ⚠️ INCOMPLETE  
**Impact**: Caching disabled, performance degradation  
**Priority**: P1 (can launch without, but needed for scale)

**Current Code**:
```typescript
// TODO: Initialize Redis cache
```

**Resolution**:
```typescript
// Initialize Redis cache (optional)
if (config.redis.enabled && config.redis.url) {
  try {
    const redis = createClient({ url: config.redis.url });
    
    redis.on('error', (err) => {
      logger.error('Redis connection error', err);
    });
    
    await redis.connect();
    
    // Test connection
    await redis.ping();
    
    logger.info('Redis cache initialized', { url: config.redis.url });
    return { status: 'healthy', cache: 'connected' };
  } catch (error) {
    logger.warn('Redis initialization failed, continuing without cache', error);
    // Non-blocking - app can run without Redis
    return { status: 'degraded', cache: 'disabled' };
  }
} else {
  logger.info('Redis cache disabled');
  return { status: 'healthy', cache: 'disabled' };
}
```

**Action Items**:
- [ ] Add Redis initialization code
- [ ] Make Redis optional (non-blocking)
- [ ] Add connection pooling
- [ ] Implement graceful degradation

---

### 2. Secrets Management (src/config/secretsManager.v2.ts)

#### TODO #4: Integrate with RBAC System (Line 149)
**Status**: ⚠️ INCOMPLETE  
**Impact**: Authorization checks not enforced  
**Priority**: P0

**Current Code**:
```typescript
// TODO: Integrate with actual RBAC system
```

**Resolution**:
```typescript
// Check RBAC permissions
import { checkPermission } from '@/security/rbac';

async checkAccess(userId: string, secretPath: string, operation: 'read' | 'write' | 'delete'): Promise<boolean> {
  try {
    // Map secret operations to RBAC permissions
    const permissionMap = {
      read: 'secrets:read',
      write: 'secrets:rotate',
      delete: 'secrets:delete'
    };
    
    const hasPermission = await checkPermission(
      userId,
      permissionMap[operation]
    );
    
    if (!hasPermission) {
      logger.warn('Access denied to secret', {
        userId,
        secretPath,
        operation
      });
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('RBAC check failed', error);
    return false; // Fail closed
  }
}
```

**Action Items**:
- [ ] Import RBAC permission checker
- [ ] Map secret operations to permissions
- [ ] Add audit logging for access attempts
- [ ] Test permission enforcement

---

#### TODO #5: Verify Tenant Membership (Line 165)
**Status**: ⚠️ INCOMPLETE  
**Impact**: Cross-tenant data access possible  
**Priority**: P0 - SECURITY CRITICAL

**Current Code**:
```typescript
// TODO: Verify user belongs to tenant
```

**Resolution**:
```typescript
// Verify tenant membership
async verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      logger.error('Failed to verify tenant membership', { userId, error });
      return false;
    }
    
    if (data.organization_id !== tenantId) {
      logger.warn('Cross-tenant access attempt blocked', {
        userId,
        requestedTenant: tenantId,
        userTenant: data.organization_id
      });
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Tenant verification failed', error);
    return false; // Fail closed
  }
}
```

**Action Items**:
- [ ] Add tenant membership verification
- [ ] Query user's organization_id
- [ ] Block cross-tenant access attempts
- [ ] Add security audit logging

---

#### TODO #6: Database Audit Logging (Line 197)
**Status**: ⚠️ INCOMPLETE  
**Impact**: Compliance audit trail incomplete  
**Priority**: P1 (needed for SOC2)

**Current Code**:
```typescript
// TODO: Also write to database for long-term compliance
```

**Resolution**:
```typescript
// Write audit log to database for compliance
async logToDatabase(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        organization_id: entry.tenantId,
        user_id: entry.userId,
        action: entry.operation,
        resource_type: 'secret',
        resource_id: entry.secretPath,
        changes: {
          operation: entry.operation,
          timestamp: entry.timestamp,
          success: entry.success
        },
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      logger.error('Failed to write audit log to database', error);
      // Don't throw - audit logging should not block operations
    }
  } catch (error) {
    logger.error('Database audit logging failed', error);
  }
}
```

**Action Items**:
- [ ] Add database audit logging
- [ ] Ensure non-blocking (don't fail operations)
- [ ] Add retry logic for transient failures
- [ ] Verify audit_logs table schema

---

### 3. Plan Enforcement (src/middleware/planEnforcementMiddleware.ts)

#### TODO #7: Get Actual Plan Tier (Line 55)
**Status**: ⚠️ INCOMPLETE  
**Impact**: All users treated as 'free' tier  
**Priority**: P0 (if billing enabled)

**Current Code**:
```typescript
const isHard = isHardCap('free', metric); // TODO: Get actual plan tier
```

**Resolution**:
```typescript
// Get user's actual plan tier
async function getUserPlanTier(userId: string): Promise<'free' | 'pro' | 'enterprise'> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      logger.warn('Failed to get user plan, defaulting to free', { userId, error });
      return 'free'; // Fail safe
    }
    
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', data.organization_id)
      .single();
    
    if (orgError || !org) {
      logger.warn('Failed to get org plan, defaulting to free', { orgId: data.organization_id, orgError });
      return 'free'; // Fail safe
    }
    
    return org.tier as 'free' | 'pro' | 'enterprise';
  } catch (error) {
    logger.error('Plan tier lookup failed', error);
    return 'free'; // Fail safe
  }
}

// Usage in middleware
const planTier = await getUserPlanTier(req.user.id);
const isHard = isHardCap(planTier, metric);
```

**Action Items**:
- [ ] Implement plan tier lookup
- [ ] Cache plan tier in session/JWT
- [ ] Add fallback to 'free' tier
- [ ] Test plan enforcement logic

---

## P1 - HIGH PRIORITY (Should Fix Before Production)

### 4. Component Error Boundaries

#### TODO #8-10: Integrate Error Tracking Service
**Files**: 
- `src/components/Agent/AgentErrorBoundary.tsx`
- `src/components/SDUIApp.tsx`
- `src/sdui/components/ComponentErrorBoundary.tsx`

**Status**: ⚠️ INCOMPLETE  
**Impact**: Errors not reported to monitoring  
**Priority**: P1

**Resolution**: Integrate with Sentry (after TODO #1 is complete)

---

### 5. Agent Fabric Integrations

#### TODO #11-13: External Service Integrations
**File**: `src/lib/agent-fabric/RetrievalEngine.ts`

**TODOs**:
- Integrate with Supabase storage metadata query
- Integrate with web scraper service
- Integrate with MCP Ground Truth API

**Status**: ⚠️ INCOMPLETE  
**Impact**: Limited agent capabilities  
**Priority**: P2 (post-launch enhancement)

---

## P2 - MEDIUM PRIORITY (Post-Launch)

### 6. Feature Implementations

- Canvas resize functionality
- Risk reduction calculations
- Value tree updates
- Assumption updates
- Conflict resolution in realtime updates

**Priority**: P2 (feature enhancements)

---

## Resolution Timeline

### Week 1 (Days 1-3)
- [x] Audit all TODOs
- [ ] Fix P0 items #1-7
- [ ] Test all fixes
- [ ] Update documentation

### Week 2 (Days 4-7)
- [ ] Fix P1 items #8-13
- [ ] Integration testing
- [ ] Security review
- [ ] Performance testing

### Week 3 (Post-Launch)
- [ ] Address P2 items
- [ ] Technical debt cleanup
- [ ] Feature enhancements

---

## Testing Checklist

After resolving each TODO:

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Security implications reviewed
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] Code review completed

---

## Sign-off

| Item | Developer | Reviewer | Date |
|------|-----------|----------|------|
| TODO #1 (Sentry) | | | |
| TODO #2 (DB Check) | | | |
| TODO #3 (Redis) | | | |
| TODO #4 (RBAC) | | | |
| TODO #5 (Tenant) | | | |
| TODO #6 (Audit) | | | |
| TODO #7 (Plan Tier) | | | |

---

**Last Updated**: 2025-12-30  
**Next Review**: 2025-12-31
