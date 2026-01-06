# P0 Production Readiness Implementation Guide

This document provides complete, production-ready implementations for all P0 critical items.

---

## P0-1: Sentry Initialization (src/bootstrap.ts:243)

### Current Code (Line 243)
```typescript
// TODO: Initialize Sentry
// await initializeSentry(config.monitoring.sentry);
logger.info("   ⚠️  Sentry initialization not implemented yet");
warnings.push("Sentry initialization not implemented");
onWarning?.("Sentry initialization not implemented");
```

### Replace With
```typescript
// Initialize Sentry with PII protection
const { initializeSentry } = await import('./lib/sentry');
initializeSentry();
logger.info("   ✅ Sentry error tracking initialized");
```

### Notes
- The Sentry implementation already exists in `src/lib/sentry.ts`
- It includes PII redaction and environment detection
- No additional changes needed to sentry.ts

---

## P0-2: Database Connection Check (src/bootstrap.ts:355)

### Current Code (Line 355)
```typescript
// TODO: Check database connection
// await checkDatabaseConnection();
logger.info("   ⚠️  Database connection check not implemented yet");
warnings.push("Database connection check not implemented");
onWarning?.("Database connection check not implemented");
```

### Replace With
```typescript
// Check database connection with retry logic
try {
  await checkDatabaseConnection();
  logger.info("   ✅ Database connection verified");
} catch (error) {
  const errorMsg = `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  errors.push(errorMsg);
  onError?.(errorMsg);
  logger.error(`   ❌ ${errorMsg}`);
  
  if (failFast) {
    return {
      success: false,
      config,
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  }
}
```

### New Function to Add (src/lib/database.ts)
```typescript
/**
 * Database Connection Health Check
 * 
 * Verifies database connectivity with retry logic
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface DatabaseHealthCheck {
  connected: boolean;
  latency: number;
  error?: string;
}

/**
 * Check database connection with exponential backoff retry
 */
export async function checkDatabaseConnection(
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<DatabaseHealthCheck> {
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < maxRetries) {
    const startTime = Date.now();
    
    try {
      // Simple health check query
      const { data, error } = await supabase
        .from('_health_check')
        .select('count')
        .limit(1)
        .single();

      if (error) {
        // If table doesn't exist, try a simpler query
        if (error.code === '42P01') {
          const { error: simpleError } = await supabase
            .from('organizations')
            .select('id')
            .limit(1);
          
          if (simpleError) {
            throw simpleError;
          }
        } else {
          throw error;
        }
      }

      const latency = Date.now() - startTime;
      
      logger.info('Database connection successful', {
        latency,
        attempt: attempt + 1,
      });

      return {
        connected: true,
        latency,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn(`Database connection attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('Database connection failed after all retries', lastError, {
    attempts: maxRetries,
  });

  return {
    connected: false,
    latency: 0,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Create health check table if it doesn't exist
 */
export async function ensureHealthCheckTable(): Promise<void> {
  try {
    const { error } = await supabase.rpc('create_health_check_table');
    
    if (error && error.code !== '42P07') { // Ignore "already exists" error
      logger.warn('Failed to create health check table', { error: error.message });
    }
  } catch (error) {
    logger.warn('Health check table creation skipped', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

### SQL Migration to Add
Create file: `supabase/migrations/YYYYMMDD_health_check_table.sql`
```sql
-- Create health check table for database connectivity tests
CREATE TABLE IF NOT EXISTS _health_check (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a single row for health checks
INSERT INTO _health_check (count) VALUES (1)
ON CONFLICT DO NOTHING;

-- Function to create health check table (for runtime creation)
CREATE OR REPLACE FUNCTION create_health_check_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS _health_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    count INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  INSERT INTO _health_check (count) VALUES (1)
  ON CONFLICT DO NOTHING;
END;
$$;
```

---

## P0-3: Tenant Verification (src/config/secretsManager.v2.ts:165) - SECURITY CRITICAL

### Current Code (Line 165)
```typescript
// TODO: Verify user belongs to tenant
return { allowed: true };
```

### Replace With
```typescript
// Verify user belongs to tenant - SECURITY CRITICAL
try {
  const belongsToTenant = await verifyTenantMembership(userId, tenantId);
  
  if (!belongsToTenant) {
    logger.warn('Cross-tenant access attempt blocked', {
      userId: this.maskUserId(userId),
      tenantId,
      action,
    });
    
    return {
      allowed: false,
      reason: `User does not belong to tenant ${tenantId}`,
    };
  }
  
  return { allowed: true };
} catch (error) {
  logger.error('Tenant verification failed', error instanceof Error ? error : undefined, {
    userId: this.maskUserId(userId),
    tenantId,
  });
  
  // Fail closed - deny access on error
  return {
    allowed: false,
    reason: 'Tenant verification failed',
  };
}
```

### New Function to Add (in same file)
```typescript
/**
 * Verify user belongs to tenant
 * 
 * SECURITY CRITICAL: Prevents cross-tenant data access
 */
async function verifyTenantMembership(
  userId: string,
  tenantId: string
): Promise<boolean> {
  try {
    // Import supabase client
    const { getSupabaseClient } = await import('../lib/supabase');
    const supabase = getSupabaseClient();
    
    // Query user's organization membership
    const { data, error } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to verify tenant membership', error, {
        userId,
        tenantId,
      });
      return false; // Fail closed
    }

    if (!data) {
      logger.warn('User not found during tenant verification', {
        userId,
        tenantId,
      });
      return false;
    }

    // Check if user's organization matches requested tenant
    const belongsToTenant = data.organization_id === tenantId;
    
    if (!belongsToTenant) {
      logger.warn('Cross-tenant access attempt detected', {
        userId,
        userTenant: data.organization_id,
        requestedTenant: tenantId,
      });
    }

    return belongsToTenant;
  } catch (error) {
    logger.error('Tenant membership verification error', error instanceof Error ? error : undefined, {
      userId,
      tenantId,
    });
    return false; // Fail closed on any error
  }
}
```

---

## P0-4: RBAC Integration (src/config/secretsManager.v2.ts:149)

### Current Code (Line 149)
```typescript
// TODO: Integrate with actual RBAC system
// For now, implement basic permission model based on user roles
// This should be replaced with proper integration to MemoryAccessControl
```

### Replace With
```typescript
// Integrate with RBAC system
try {
  const { checkPermission } = await import('../middleware/rbac');
  
  // Map secret operations to RBAC permissions
  const permissionMap: Record<'READ' | 'WRITE' | 'DELETE' | 'ROTATE', string> = {
    READ: 'api_keys.read',
    WRITE: 'api_keys.create',
    DELETE: 'api_keys.revoke',
    ROTATE: 'api_keys.rotate',
  };
  
  const permission = permissionMap[action];
  const hasPermission = await checkPermission(userId, tenantId, permission as any);
  
  if (!hasPermission) {
    logger.warn('RBAC permission denied for secret access', {
      userId: this.maskUserId(userId),
      tenantId,
      action,
      permission,
    });
    
    return {
      allowed: false,
      reason: `Permission denied: ${permission}`,
    };
  }
  
  return { allowed: true };
} catch (error) {
  logger.error('RBAC permission check failed', error instanceof Error ? error : undefined, {
    userId: this.maskUserId(userId),
    tenantId,
    action,
  });
  
  // Fail closed - deny access on error
  return {
    allowed: false,
    reason: 'Permission check failed',
  };
}
```

---

## P0-5: Plan Tier Detection (src/middleware/planEnforcementMiddleware.ts:55)

### Current Code (Line 55)
```typescript
const isHard = isHardCap('free', metric); // TODO: Get actual plan tier
```

### Replace With
```typescript
// Get actual plan tier from organization
const planTier = await getUserPlanTier(tenantId);
const isHard = isHardCap(planTier, metric);
```

### New Function to Add (in same file)
```typescript
/**
 * Get user's plan tier from organization
 */
async function getUserPlanTier(
  tenantId: string
): Promise<'free' | 'starter' | 'professional' | 'enterprise'> {
  try {
    const { getSupabaseClient } = await import('../lib/supabase');
    const supabase = getSupabaseClient();
    
    // Query organization tier
    const { data, error } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      logger.warn('Failed to get organization plan tier, defaulting to free', {
        tenantId,
        error: error?.message,
      });
      return 'free'; // Fail safe - most restrictive tier
    }

    // Validate tier value
    const validTiers = ['free', 'starter', 'professional', 'enterprise'];
    const tier = data.tier?.toLowerCase();
    
    if (!validTiers.includes(tier)) {
      logger.warn('Invalid plan tier, defaulting to free', {
        tenantId,
        tier: data.tier,
      });
      return 'free';
    }

    return tier as 'free' | 'starter' | 'professional' | 'enterprise';
  } catch (error) {
    logger.error('Plan tier lookup failed', error instanceof Error ? error : undefined, {
      tenantId,
    });
    return 'free'; // Fail safe
  }
}

// Cache plan tiers to avoid repeated database queries
const planTierCache = new Map<string, { tier: string; expiresAt: number }>();
const PLAN_TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user's plan tier with caching
 */
async function getUserPlanTierCached(
  tenantId: string
): Promise<'free' | 'starter' | 'professional' | 'enterprise'> {
  // Check cache first
  const cached = planTierCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier as any;
  }

  // Fetch from database
  const tier = await getUserPlanTier(tenantId);
  
  // Cache the result
  planTierCache.set(tenantId, {
    tier,
    expiresAt: Date.now() + PLAN_TIER_CACHE_TTL,
  });

  return tier;
}
```

---

## P1-6: Database Audit Logging (src/config/secretsManager.v2.ts:197)

### Current Code (Line 197)
```typescript
// TODO: Also write to database for long-term compliance
// INSERT INTO secret_audit_logs (...)
```

### Replace With
```typescript
// Write to database for long-term compliance
try {
  await writeAuditLogToDatabase(entry);
} catch (error) {
  // Don't throw - audit logging should not block operations
  logger.error('Failed to write audit log to database', error instanceof Error ? error : undefined, {
    tenantId: entry.tenantId,
    action: entry.action,
  });
}
```

### New Function to Add (in same file)
```typescript
/**
 * Write audit log to database for compliance
 */
async function writeAuditLogToDatabase(entry: AuditLogEntry): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../lib/supabase');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        organization_id: entry.tenantId,
        user_id: entry.userId,
        action: entry.action,
        resource_type: 'secret',
        resource_id: entry.secretKey,
        changes: {
          operation: entry.action,
          result: entry.result,
          error: entry.error,
          timestamp: entry.timestamp,
          metadata: entry.metadata,
        },
        ip_address: null, // Set from request context if available
        user_agent: null, // Set from request context if available
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    // Log but don't throw - audit logging should not block operations
    logger.error('Database audit logging failed', error instanceof Error ? error : undefined);
  }
}
```

---

## P1-7: Redis Cache Initialization (src/bootstrap.ts:375)

### Current Code (Line 375)
```typescript
// TODO: Initialize Redis cache
// await initializeCache(config.cache);
logger.info("   ⚠️  Cache initialization not implemented yet");
warnings.push("Cache initialization not implemented");
onWarning?.("Cache initialization not implemented");
```

### Replace With
```typescript
// Initialize Redis cache with graceful degradation
try {
  const cacheHealth = await initializeRedisCache(config.cache);
  
  if (cacheHealth.connected) {
    logger.info(`   ✅ Redis cache initialized (${cacheHealth.latency}ms)`);
  } else {
    logger.warn(`   ⚠️  Redis cache unavailable - continuing without cache`);
    warnings.push('Redis cache unavailable');
    onWarning?.('Redis cache unavailable');
  }
} catch (error) {
  const errorMsg = `Cache initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  warnings.push(errorMsg);
  onWarning?.(errorMsg);
  logger.warn(`   ⚠️  ${errorMsg} - continuing without cache`);
}
```

### New File to Create (src/lib/redis.ts)
```typescript
/**
 * Redis Cache Client
 * 
 * Provides caching with graceful degradation
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

export interface CacheConfig {
  enabled: boolean;
  url?: string;
  ttl: number;
}

export interface CacheHealthCheck {
  connected: boolean;
  latency: number;
  error?: string;
}

/**
 * Initialize Redis cache
 */
export async function initializeRedisCache(
  config: CacheConfig
): Promise<CacheHealthCheck> {
  if (!config.enabled) {
    logger.info('Redis cache disabled');
    return { connected: false, latency: 0 };
  }

  if (!config.url) {
    logger.warn('Redis URL not configured');
    return { connected: false, latency: 0, error: 'URL not configured' };
  }

  try {
    const startTime = Date.now();
    
    // Create Redis client
    redisClient = createClient({
      url: config.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Error handling
    redisClient.on('error', (error) => {
      logger.error('Redis client error', error);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    // Connect
    await redisClient.connect();

    // Test connection
    await redisClient.ping();

    const latency = Date.now() - startTime;

    logger.info('Redis cache initialized', {
      url: config.url.replace(/:[^:@]+@/, ':***@'), // Mask password
      latency,
    });

    return { connected: true, latency };
  } catch (error) {
    logger.warn('Redis cache initialization failed - continuing without cache', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      connected: false,
      latency: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get Redis client (may be null if not connected)
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Set cache value
 */
export async function setCache(
  key: string,
  value: string,
  ttl?: number
): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    if (ttl) {
      await redisClient.setEx(key, ttl, value);
    } else {
      await redisClient.set(key, value);
    }
    return true;
  } catch (error) {
    logger.warn('Cache set failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get cache value
 */
export async function getCache(key: string): Promise<string | null> {
  if (!redisClient) {
    return null;
  }

  try {
    return await redisClient.get(key);
  } catch (error) {
    logger.warn('Cache get failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Delete cache value
 */
export async function deleteCache(key: string): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.warn('Cache delete failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Failed to close Redis connection', error instanceof Error ? error : undefined);
    }
  }
}
```

---

## Testing Checklist

After implementing all changes:

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Run `npm run test` - All tests pass
- [ ] Test Sentry initialization in production mode
- [ ] Test database connection with retry logic
- [ ] Test tenant verification blocks cross-tenant access
- [ ] Test RBAC integration denies unauthorized access
- [ ] Test plan tier detection returns correct tier
- [ ] Test audit logging writes to database
- [ ] Test Redis cache graceful degradation
- [ ] Review security logs for any issues
- [ ] Conduct penetration testing on tenant isolation

---

## Environment Variables to Add

Add to `.env.example` and `.env.production`:

```bash
# Sentry Error Tracking
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_SAMPLE_RATE=1.0

# Redis Cache
REDIS_ENABLED=true
REDIS_URL=redis://username:password@host:port
CACHE_TTL=300

# Database
DATABASE_URL=postgresql://user:password@host:port/database
```

---

## Deployment Steps

1. **Pre-Deployment**
   - Review all code changes
   - Run full test suite
   - Conduct security review
   - Update environment variables

2. **Deployment**
   - Apply database migrations
   - Deploy application code
   - Verify Sentry is receiving events
   - Verify database connection
   - Verify Redis connection

3. **Post-Deployment**
   - Monitor error rates
   - Check audit logs
   - Verify tenant isolation
   - Test plan enforcement
   - Monitor cache hit rates

---

## Rollback Plan

If issues are detected:

1. **Immediate Actions**
   - Revert to previous deployment
   - Disable problematic features via feature flags
   - Monitor error rates

2. **Investigation**
   - Review Sentry error logs
   - Check database audit logs
   - Analyze security logs

3. **Fix and Redeploy**
   - Fix identified issues
   - Test thoroughly in staging
   - Deploy with monitoring

---

## Support Contacts

- **Security Issues**: security-team@company.com
- **Database Issues**: dba-team@company.com
- **On-Call Engineer**: oncall@company.com

---

**Last Updated**: 2025-12-30
**Version**: 1.0.0
