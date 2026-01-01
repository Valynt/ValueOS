# Plan Tier Detection Updates

## Updates for src/middleware/planEnforcementMiddleware.ts

---

## Update 1: Add Imports (Top of file)

### Add these imports:
```typescript
import { logger } from '../lib/logger';
```

---

## Update 2: Plan Tier Detection (Line ~55)

### Find this code:
```typescript
const isHard = isHardCap('free', metric); // TODO: Get actual plan tier
```

### Replace with:
```typescript
// Get actual plan tier from organization
const planTier = await getUserPlanTierCached(tenantId);
const isHard = isHardCap(planTier, metric);
```

---

## Update 3: Add Helper Functions (Add to end of file)

### Add these functions:

```typescript
/**
 * Plan tier cache to avoid repeated database queries
 */
const planTierCache = new Map<string, { tier: string; expiresAt: number }>();
const PLAN_TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Valid plan tiers
 */
type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

/**
 * Get user's plan tier from organization
 * 
 * @param tenantId - Organization/tenant ID
 * @returns Plan tier (defaults to 'free' on error)
 */
async function getUserPlanTier(tenantId: string): Promise<PlanTier> {
  try {
    // Import supabase dynamically
    const { supabase } = await import('../lib/supabase');
    
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
    const validTiers: PlanTier[] = ['free', 'starter', 'professional', 'enterprise'];
    const tier = data.tier?.toLowerCase();
    
    if (!validTiers.includes(tier as PlanTier)) {
      logger.warn('Invalid plan tier, defaulting to free', {
        tenantId,
        tier: data.tier,
      });
      return 'free';
    }

    return tier as PlanTier;
  } catch (error) {
    logger.error('Plan tier lookup failed', error instanceof Error ? error : undefined, {
      tenantId,
    });
    return 'free'; // Fail safe
  }
}

/**
 * Get user's plan tier with caching
 * 
 * @param tenantId - Organization/tenant ID
 * @returns Plan tier (cached for 5 minutes)
 */
async function getUserPlanTierCached(tenantId: string): Promise<PlanTier> {
  // Check cache first
  const cached = planTierCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier as PlanTier;
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

/**
 * Invalidate plan tier cache for a tenant
 * 
 * Call this when a tenant's plan changes
 * 
 * @param tenantId - Organization/tenant ID
 */
export function invalidatePlanTierCache(tenantId: string): void {
  planTierCache.delete(tenantId);
  logger.info('Plan tier cache invalidated', { tenantId });
}

/**
 * Clear all plan tier cache
 * 
 * Useful for testing or after bulk plan updates
 */
export function clearPlanTierCache(): void {
  const size = planTierCache.size;
  planTierCache.clear();
  logger.info('Plan tier cache cleared', { entriesCleared: size });
}

/**
 * Get plan tier cache statistics
 */
export function getPlanTierCacheStats(): {
  size: number;
  entries: Array<{ tenantId: string; tier: string; expiresIn: number }>;
} {
  const now = Date.now();
  const entries = Array.from(planTierCache.entries()).map(([tenantId, data]) => ({
    tenantId,
    tier: data.tier,
    expiresIn: Math.max(0, data.expiresAt - now),
  }));

  return {
    size: planTierCache.size,
    entries,
  };
}
```

---

## Update 4: Export Helper Functions

### Add to exports at top of file:
```typescript
export {
  invalidatePlanTierCache,
  clearPlanTierCache,
  getPlanTierCacheStats,
};
```

---

## Complete Example Usage

Here's how the updated middleware should work:

```typescript
export async function planEnforcementMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.organization_id;
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get actual plan tier from organization (with caching)
    const planTier = await getUserPlanTierCached(tenantId);
    
    // Check usage against plan limits
    const metric = getMetricFromRequest(req);
    const currentUsage = await UsageCache.get(tenantId, metric);
    const limit = getPlanLimit(planTier, metric);
    const isHard = isHardCap(planTier, metric);

    if (currentUsage >= limit) {
      if (isHard) {
        // Hard cap - block request
        res.status(429).json({
          error: 'Plan limit exceeded',
          plan: planTier,
          metric,
          limit,
          current: currentUsage,
        });
        return;
      } else {
        // Soft cap - allow but warn
        logger.warn('Soft plan limit exceeded', {
          tenantId,
          plan: planTier,
          metric,
          limit,
          current: currentUsage,
        });
      }
    }

    // Attach plan info to request for downstream use
    req.planTier = planTier;
    req.planLimits = getPlanLimits(planTier);

    next();
  } catch (error) {
    logger.error('Plan enforcement middleware error', error instanceof Error ? error : undefined);
    // Fail open for non-critical errors to avoid blocking all requests
    next();
  }
}
```

---

## Plan Tier Configuration

### Ensure organizations table has tier column:

```sql
-- Migration: Add tier column if not exists
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'free';

-- Add check constraint
ALTER TABLE organizations
ADD CONSTRAINT organizations_tier_check 
CHECK (tier IN ('free', 'starter', 'professional', 'enterprise'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organizations_tier 
ON organizations(tier);
```

---

## Testing

### Test Plan Tier Detection:

```typescript
// Test file: src/__tests__/planTierDetection.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getUserPlanTierCached, 
  invalidatePlanTierCache,
  clearPlanTierCache,
  getPlanTierCacheStats 
} from '../middleware/planEnforcementMiddleware';

describe('Plan Tier Detection', () => {
  beforeEach(() => {
    clearPlanTierCache();
  });

  it('should return free tier for non-existent organization', async () => {
    const tier = await getUserPlanTierCached('non-existent-org');
    expect(tier).toBe('free');
  });

  it('should cache plan tier for 5 minutes', async () => {
    const tenantId = 'test-org-123';
    
    // First call - fetches from database
    const tier1 = await getUserPlanTierCached(tenantId);
    
    // Second call - should use cache
    const tier2 = await getUserPlanTierCached(tenantId);
    
    expect(tier1).toBe(tier2);
    
    const stats = getPlanTierCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.entries[0].tenantId).toBe(tenantId);
  });

  it('should invalidate cache when requested', async () => {
    const tenantId = 'test-org-123';
    
    await getUserPlanTierCached(tenantId);
    expect(getPlanTierCacheStats().size).toBe(1);
    
    invalidatePlanTierCache(tenantId);
    expect(getPlanTierCacheStats().size).toBe(0);
  });

  it('should handle invalid tier values', async () => {
    // Mock organization with invalid tier
    // Should default to 'free'
    const tier = await getUserPlanTierCached('org-with-invalid-tier');
    expect(tier).toBe('free');
  });
});
```

---

## API Endpoint for Plan Management

### Add endpoint to update plan tier:

```typescript
// POST /api/admin/organizations/:id/plan
export async function updateOrganizationPlan(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { tier } = req.body;

    // Validate tier
    const validTiers = ['free', 'starter', 'professional', 'enterprise'];
    if (!validTiers.includes(tier)) {
      res.status(400).json({ error: 'Invalid plan tier' });
      return;
    }

    // Update organization
    const { error } = await supabase
      .from('organizations')
      .update({ tier, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Invalidate cache
    invalidatePlanTierCache(id);

    res.json({ success: true, tier });
  } catch (error) {
    logger.error('Failed to update organization plan', error instanceof Error ? error : undefined);
    res.status(500).json({ error: 'Failed to update plan' });
  }
}
```

---

## Verification

After making these changes:

1. **Type Check**:
```bash
npm run typecheck
```

2. **Test Plan Enforcement**:
```bash
npm run test -- planTierDetection
```

3. **Manual Testing**:
- Create organizations with different tiers
- Verify correct limits are enforced
- Test cache behavior
- Test cache invalidation

---

## Next Steps

After implementing plan tier detection:
1. Test all implementations thoroughly
2. Run security tests
3. Deploy to staging
4. Monitor and verify

---

## Cache Management

### Clear cache on deployment:
```bash
# In deployment script
curl -X POST https://api.yourapp.com/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Monitor cache performance:
```bash
# Get cache statistics
curl https://api.yourapp.com/admin/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

**Status**: Ready for implementation
**Estimated Time**: 1.5 hours
**Priority**: P0 (if billing is enabled)
