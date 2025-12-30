# P0 Implementation Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Read the implementation guide
cat docs/P0_IMPLEMENTATION_GUIDE.md

# 2. Install dependencies (if needed)
npm install redis @sentry/react

# 3. Update environment variables
cp .env.example .env.local
# Edit .env.local with actual values

# 4. Apply database migration
# Create: supabase/migrations/YYYYMMDD_health_check_table.sql
# Run: supabase db push

# 5. Implement changes (follow guide)
# 6. Test
npm run typecheck && npm run test

# 7. Deploy
npm run build && npm run deploy
```

---

## 📋 Implementation Checklist

### P0 Items (CRITICAL - 7.5 hours)
- [ ] **P0-1**: Sentry Init (`src/bootstrap.ts:243`) - 30 min
- [ ] **P0-2**: DB Connection (`src/bootstrap.ts:355`) - 2 hours
- [ ] **P0-3**: Tenant Verify (`src/config/secretsManager.v2.ts:165`) - 2 hours 🔴
- [ ] **P0-4**: RBAC (`src/config/secretsManager.v2.ts:149`) - 1.5 hours
- [ ] **P0-5**: Plan Tier (`src/middleware/planEnforcementMiddleware.ts:55`) - 1.5 hours

### P1 Items (HIGH - 3.5 hours)
- [ ] **P1-6**: Audit Log (`src/config/secretsManager.v2.ts:197`) - 1.5 hours
- [ ] **P1-7**: Redis Cache (`src/bootstrap.ts:375`) - 2 hours

---

## 🔥 Critical Security Item

### P0-3: Tenant Verification (MUST FIX)

**Current Code** (Line 165):
```typescript
// TODO: Verify user belongs to tenant
return { allowed: true };
```

**Replace With**:
```typescript
// Verify user belongs to tenant - SECURITY CRITICAL
try {
  const belongsToTenant = await verifyTenantMembership(userId, tenantId);
  if (!belongsToTenant) {
    return { allowed: false, reason: `User does not belong to tenant` };
  }
  return { allowed: true };
} catch (error) {
  return { allowed: false, reason: 'Tenant verification failed' };
}
```

**Add Function**:
```typescript
async function verifyTenantMembership(userId: string, tenantId: string): Promise<boolean> {
  const { getSupabaseClient } = await import('../lib/supabase');
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.organization_id === tenantId;
}
```

---

## 📁 New Files to Create

1. **src/lib/database.ts** - Database health check
2. **src/lib/redis.ts** - Redis cache client
3. **supabase/migrations/YYYYMMDD_health_check_table.sql** - Health check table

---

## 🔧 Environment Variables

```bash
# Sentry
VITE_SENTRY_ENABLED=true
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=production

# Redis
REDIS_ENABLED=true
REDIS_URL=redis://user:pass@host:port

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
```

---

## ✅ Testing Commands

```bash
# Type check
npm run typecheck

# Run tests
npm run test

# Security scan
npm run security:scan

# Lint
npm run lint

# Build
npm run build
```

---

## 🚨 Deployment Steps

1. **Pre-Deploy**
   ```bash
   npm run deploy:pre-check
   npm run db:backup
   ```

2. **Deploy**
   ```bash
   supabase db push
   npm run build
   npm run deploy
   ```

3. **Post-Deploy**
   ```bash
   npm run deploy:validate
   # Monitor Sentry for errors
   # Check audit logs
   ```

---

## 📊 Success Metrics

- ✅ Error rate < 0.1%
- ✅ DB latency < 100ms
- ✅ Cache hit rate > 80%
- ✅ Zero cross-tenant access
- ✅ All tests passing

---

## 🆘 Rollback

```bash
# Immediate rollback
git revert HEAD
npm run build
npm run deploy

# Database rollback
npm run db:restore
```

---

## 📞 Support

- **Security**: security@company.com
- **On-Call**: oncall@company.com
- **DevOps**: devops@company.com

---

## 📚 Full Documentation

- **Implementation Guide**: `docs/P0_IMPLEMENTATION_GUIDE.md`
- **Complete Summary**: `P0_IMPLEMENTATION_COMPLETE.md`
- **Test Suite**: `src/__tests__/p0-implementations.test.ts`

---

**Time Estimate**: 11 hours total
**Critical Path**: DB → Tenant → RBAC → Others
**Target Date**: 2025-01-02

---

**Status**: ✅ READY TO IMPLEMENT
