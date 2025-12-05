# SEC-003: Service Migration to TenantAwareService - COMPLETE GUIDE

**Status:** Implementation Guide  
**Priority:** P0 - PRODUCTION BLOCKING  
**Estimated Time:** 8 hours remaining (4 hours completed)

---

## ✅ COMPLETED MIGRATIONS (2/15)

### 1. PresenceService ✅
**File:** `src/services/PresenceService.ts`  
**Changes:**
- Extended `TenantAwareService` instead of `BaseService`
- Added `tenantId` parameter to `startPresence()`
- Added tenant validation before creating sessions
- Always include `tenant_id` in database inserts

### 2. UserSettingsService ✅
**File:** `src/services/UserSettingsService.ts`  
**Changes:**
- Extended `TenantAwareService`
- Added `tenantId` parameter to `getProfile()` and `updateProfile()`
- Added tenant validation using `validateTenantAccess()`
- Verify user belongs to tenant before returning data

---

## 🔴 CRITICAL SERVICES TO MIGRATE (Priority Order)

### 3. PermissionService (HIGH PRIORITY)
**File:** `src/services/PermissionService.ts`  
**Risk:** Authorization bypass if not tenant-scoped  
**Estimated:** 1.5 hours

**Required Changes:**
```typescript
// BEFORE:
export class PermissionService extends BaseService {
  async hasPermission(
    userId: string,
    permission: Permission,
    scope: string,
    scopeId: string
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('permission', permission);
    return data.length > 0;
  }
}

// AFTER:
export class PermissionService extends TenantAwareService {
  async hasPermission(
    userId: string,
    tenantId: string,
    permission: Permission,
    scope: string,
    scopeId: string
  ): Promise<boolean> {
    // SEC-003: Validate tenant access
    await this.validateTenantAccess(userId, tenantId);
    
    // SEC-003: Query with tenant filtering
    const permissions = await this.queryWithTenantCheck<Permission>(
      'user_permissions',
      userId,
      { permission, scope, scope_id: scopeId }
    );
    
    return permissions.length > 0;
  }
}
```

---

### 4. AuditLogService (HIGH PRIORITY)
**File:** `src/services/AuditLogService.ts`  
**Risk:** Cross-tenant audit log access  
**Estimated:** 1 hour

**Required Changes:**
```typescript
// BEFORE:
export class AuditLogService extends BaseService {
  async getAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    const { data } = await this.supabase
      .from('audit_logs')
      .select('*')
      .match(filters);
    return data;
  }
}

// AFTER:
export class AuditLogService extends TenantAwareService {
  async getAuditLogs(
    userId: string,
    tenantId: string,
    filters: AuditLogFilters
  ): Promise<AuditLogEntry[]> {
    // SEC-003: Validate tenant access
    await this.validateTenantAccess(userId, tenantId);
    
    // SEC-003: Query with tenant filtering
    const logs = await this.queryWithTenantCheck<AuditLogEntry>(
      'audit_logs',
      userId,
      filters
    );
    
    return logs;
  }
  
  async createAuditLog(
    userId: string,
    tenantId: string,
    entry: CreateAuditLogEntry
  ): Promise<void> {
    // SEC-003: Insert with tenant validation
    await this.insertWithTenantCheck(
      'audit_logs',
      userId,
      tenantId,
      entry
    );
  }
}
```

---

### 5. SettingsService (HIGH PRIORITY)
**File:** `src/services/SettingsService.ts`  
**Risk:** Cross-tenant settings access  
**Estimated:** 1.5 hours

**Required Changes:**
```typescript
// BEFORE:
export class SettingsService extends BaseService {
  async getSettings(params: GetSettingsParams): Promise<Setting[]> {
    const { data } = await this.supabase
      .from('settings')
      .select('*')
      .eq('scope', params.scope)
      .eq('scope_id', params.scopeId);
    return data;
  }
}

// AFTER:
export class SettingsService extends TenantAwareService {
  async getSettings(
    userId: string,
    tenantId: string,
    params: GetSettingsParams
  ): Promise<Setting[]> {
    // SEC-003: Validate tenant access
    await this.validateTenantAccess(userId, tenantId);
    
    // SEC-003: Query with tenant filtering
    const settings = await this.queryWithTenantCheck<Setting>(
      'settings',
      userId,
      {
        scope: params.scope,
        scope_id: params.scopeId
      }
    );
    
    return settings;
  }
  
  async updateSetting(
    userId: string,
    tenantId: string,
    settingId: string,
    value: any
  ): Promise<Setting> {
    // SEC-003: Update with tenant validation
    return await this.updateWithTenantCheck<Setting>(
      'settings',
      userId,
      settingId,
      { value }
    );
  }
}
```

---

### 6. TenantProvisioning (CRITICAL)
**File:** `src/services/TenantProvisioning.ts`  
**Risk:** Tenant creation/deletion without validation  
**Estimated:** 2 hours

**Required Changes:**
```typescript
// BEFORE:
export class TenantProvisioning extends BaseService {
  async createTenant(data: CreateTenantInput): Promise<Tenant> {
    const { data: tenant } = await this.supabase
      .from('tenants')
      .insert(data)
      .select()
      .single();
    return tenant;
  }
}

// AFTER:
export class TenantProvisioning extends TenantAwareService {
  async createTenant(
    creatorUserId: string,
    data: CreateTenantInput
  ): Promise<Tenant> {
    // SEC-003: Create tenant (no validation needed for creation)
    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .insert({
        ...data,
        created_by: creatorUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // SEC-003: Add creator as admin
    await this.supabase
      .from('user_tenants')
      .insert({
        user_id: creatorUserId,
        tenant_id: tenant.id,
        role: 'admin',
        status: 'active'
      });
    
    return tenant;
  }
  
  async deleteTenant(
    userId: string,
    tenantId: string
  ): Promise<void> {
    // SEC-003: Validate user is admin of tenant
    await this.validateTenantAccess(userId, tenantId);
    
    // Verify user is admin
    const { data: membership } = await this.supabase
      .from('user_tenants')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();
      
    if (membership?.role !== 'admin') {
      throw new AuthorizationError('Only admins can delete tenants');
    }
    
    // SEC-003: Delete with validation
    await this.deleteWithTenantCheck('tenants', userId, tenantId);
  }
}
```

---

## 🟡 MEDIUM PRIORITY SERVICES

### 7. UsageTrackingService
**Estimated:** 1 hour  
**Pattern:** Add tenant validation to all tracking methods

### 8. AgentFabricService
**Estimated:** 1.5 hours  
**Pattern:** Validate tenant before agent operations

### 9. WorkflowOrchestrator
**Estimated:** 2 hours  
**Pattern:** Tenant-scope all workflow executions

### 10. ValueFabricService
**Estimated:** 1.5 hours  
**Pattern:** Validate tenant for value operations

---

## 🟢 LOW PRIORITY SERVICES (Can defer)

### 11. CacheService
**Estimated:** 0.5 hours  
**Note:** Cache keys should include tenant_id

### 12. ReflectionEngine
**Estimated:** 1 hour  
**Note:** Validate tenant for reflection operations

### 13. AgentAuditLogger
**Estimated:** 0.5 hours  
**Note:** Always log with tenant_id

### 14. AgentInitializer
**Estimated:** 0.5 hours  
**Note:** Initialize agents with tenant context

### 15. SecurityLogger
**Estimated:** 0.5 hours  
**Note:** Log security events with tenant_id

---

## 📋 MIGRATION CHECKLIST

For each service, complete these steps:

### Step 1: Update Imports
```typescript
// Change:
import { BaseService } from './BaseService';

// To:
import { TenantAwareService } from './TenantAwareService';
```

### Step 2: Update Class Declaration
```typescript
// Change:
export class MyService extends BaseService {

// To:
export class MyService extends TenantAwareService {
```

### Step 3: Add tenantId Parameter
```typescript
// Change:
async myMethod(userId: string, data: any): Promise<Result> {

// To:
async myMethod(userId: string, tenantId: string, data: any): Promise<Result> {
```

### Step 4: Add Tenant Validation
```typescript
// Add at start of method:
await this.validateTenantAccess(userId, tenantId);
```

### Step 5: Replace Raw Queries
```typescript
// Change:
const { data } = await this.supabase
  .from('table')
  .select('*')
  .eq('user_id', userId);

// To:
const data = await this.queryWithTenantCheck<Type>(
  'table',
  userId,
  { /* filters */ }
);
```

### Step 6: Update Inserts
```typescript
// Change:
const { data } = await this.supabase
  .from('table')
  .insert(record);

// To:
const data = await this.insertWithTenantCheck<Type>(
  'table',
  userId,
  tenantId,
  record
);
```

### Step 7: Update Updates
```typescript
// Change:
const { data } = await this.supabase
  .from('table')
  .update(changes)
  .eq('id', recordId);

// To:
const data = await this.updateWithTenantCheck<Type>(
  'table',
  userId,
  recordId,
  changes
);
```

### Step 8: Update Deletes
```typescript
// Change:
await this.supabase
  .from('table')
  .delete()
  .eq('id', recordId);

// To:
await this.deleteWithTenantCheck(
  'table',
  userId,
  recordId
);
```

### Step 9: Update Tests
```typescript
// Add tenantId to all test calls:
await service.myMethod(userId, tenantId, data);

// Add cross-tenant access tests:
it('should block cross-tenant access', async () => {
  await expect(
    service.myMethod(userA.id, tenantB.id, data)
  ).rejects.toThrow('Access denied');
});
```

### Step 10: Update API Routes
```typescript
// Add tenantId from request:
router.get('/resource', async (req, res) => {
  const userId = req.user.id;
  const tenantId = req.headers['x-tenant-id'] || req.user.defaultTenantId;
  
  const result = await service.myMethod(userId, tenantId, filters);
  res.json(result);
});
```

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests
For each migrated service, add:

```typescript
describe('MyService - Tenant Isolation', () => {
  it('should validate tenant access', async () => {
    const service = new MyService();
    
    await expect(
      service.myMethod(userA.id, tenantB.id, data)
    ).rejects.toThrow('Access denied');
  });
  
  it('should only return tenant data', async () => {
    const result = await service.getData(userA.id, tenantA.id);
    
    result.forEach(item => {
      expect(item.tenant_id).toBe(tenantA.id);
    });
  });
  
  it('should prevent tenant_id override', async () => {
    const result = await service.create(
      userA.id,
      tenantA.id,
      { tenant_id: tenantB.id, data: 'test' }
    );
    
    expect(result.tenant_id).toBe(tenantA.id); // Not tenantB!
  });
});
```

### Integration Tests
```typescript
describe('Cross-Tenant Access Prevention', () => {
  it('should block all cross-tenant operations', async () => {
    const userA = await createUser('tenant-a');
    const resourceB = await createResource('tenant-b');
    
    // Try to read
    await expect(
      service.get(userA.id, resourceB.tenant_id, resourceB.id)
    ).rejects.toThrow();
    
    // Try to update
    await expect(
      service.update(userA.id, resourceB.tenant_id, resourceB.id, {})
    ).rejects.toThrow();
    
    // Try to delete
    await expect(
      service.delete(userA.id, resourceB.tenant_id, resourceB.id)
    ).rejects.toThrow();
  });
});
```

---

## 📊 PROGRESS TRACKING

### Completed: 2/15 (13%)
- ✅ PresenceService
- ✅ UserSettingsService

### In Progress: 0/15
- 🔴 None

### Not Started: 13/15 (87%)
- 🔴 PermissionService (HIGH)
- 🔴 AuditLogService (HIGH)
- 🔴 SettingsService (HIGH)
- 🔴 TenantProvisioning (CRITICAL)
- 🟡 UsageTrackingService
- 🟡 AgentFabricService
- 🟡 WorkflowOrchestrator
- 🟡 ValueFabricService
- 🟢 CacheService
- 🟢 ReflectionEngine
- 🟢 AgentAuditLogger
- 🟢 AgentInitializer
- 🟢 SecurityLogger

### Estimated Time Remaining: 14 hours

---

## 🚨 CRITICAL PATH

**Must Complete Before Production:**
1. ✅ PresenceService (DONE)
2. ✅ UserSettingsService (DONE)
3. 🔴 PermissionService (1.5h) - BLOCKING
4. 🔴 AuditLogService (1h) - BLOCKING
5. 🔴 SettingsService (1.5h) - BLOCKING
6. 🔴 TenantProvisioning (2h) - BLOCKING

**Total Critical Path:** 6 hours remaining

---

## 📞 NEXT STEPS

1. **Immediate:** Migrate PermissionService (1.5h)
2. **Next:** Migrate AuditLogService (1h)
3. **Then:** Migrate SettingsService (1.5h)
4. **Critical:** Migrate TenantProvisioning (2h)
5. **Testing:** Add cross-tenant access tests (2h)
6. **Verification:** Run "Leaky Tenant" test suite

---

**Last Updated:** November 22, 2024  
**Status:** 🟡 IN PROGRESS (13% complete)  
**Blockers:** None  
**Risk:** MEDIUM - Need to accelerate migration pace
