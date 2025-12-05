## RBAC Implementation Guide

### SEC-202: Apply RBAC Middleware to All Protected Routes

This guide shows how to apply RBAC middleware to protect all API endpoints.

## Quick Reference

```typescript
import {
  requirePermission,
  requireRole,
  requireOwnership,
  requireAnyPermission,
  requireAllPermissions,
} from '@/middleware/rbac';
```

## Route Protection Patterns

### 1. Data Operations

```typescript
// routes/business-cases.ts
import { requirePermission } from '@/middleware/rbac';

// Read (GET)
router.get('/api/business-cases', 
  authenticate,
  requirePermission('data.read'),
  async (req, res) => { /* ... */ }
);

// Create (POST)
router.post('/api/business-cases',
  authenticate,
  requirePermission('data.create'),
  async (req, res) => { /* ... */ }
);

// Update (PUT/PATCH)
router.put('/api/business-cases/:id',
  authenticate,
  requirePermission('data.update'),
  async (req, res) => { /* ... */ }
);

// Delete (DELETE)
router.delete('/api/business-cases/:id',
  authenticate,
  requirePermission('data.delete'),
  async (req, res) => { /* ... */ }
);

// Export (GET)
router.get('/api/business-cases/export',
  authenticate,
  requirePermission('data.export'),
  auditDataExport('business_case'),
  async (req, res) => { /* ... */ }
);

// Bulk Delete (POST)
router.post('/api/business-cases/bulk-delete',
  authenticate,
  requirePermission('data.delete'),
  auditBulkDelete('business_case'),
  async (req, res) => { /* ... */ }
);
```

### 2. User Management

```typescript
// routes/users.ts
import { requirePermission, requireRole } from '@/middleware/rbac';

// List users
router.get('/api/users',
  authenticate,
  requirePermission('users.read'),
  async (req, res) => { /* ... */ }
);

// Create user
router.post('/api/users',
  authenticate,
  requirePermission('users.create'),
  async (req, res) => { /* ... */ }
);

// Update user
router.put('/api/users/:id',
  authenticate,
  requirePermission('users.update'),
  async (req, res) => { /* ... */ }
);

// Delete user
router.delete('/api/users/:id',
  authenticate,
  requirePermission('users.delete'),
  async (req, res) => { /* ... */ }
);

// Invite user
router.post('/api/users/invite',
  authenticate,
  requirePermission('users.invite'),
  async (req, res) => { /* ... */ }
);
```

### 3. Permission Management

```typescript
// routes/permissions.ts
import { requirePermission, requireRole } from '@/middleware/rbac';

// View permissions
router.get('/api/permissions',
  authenticate,
  requirePermission('permissions.read'),
  async (req, res) => { /* ... */ }
);

// Grant permission
router.post('/api/users/:userId/permissions',
  authenticate,
  requirePermission('permissions.grant'),
  auditPermissionChange(),
  async (req, res) => { /* ... */ }
);

// Revoke permission
router.delete('/api/users/:userId/permissions/:permission',
  authenticate,
  requirePermission('permissions.revoke'),
  auditPermissionChange(),
  async (req, res) => { /* ... */ }
);
```

### 4. Role Management

```typescript
// routes/roles.ts
import { requirePermission, requireRole } from '@/middleware/rbac';

// List roles
router.get('/api/roles',
  authenticate,
  requirePermission('roles.read'),
  async (req, res) => { /* ... */ }
);

// Create role (super_admin only)
router.post('/api/roles',
  authenticate,
  requireRole('super_admin'),
  requirePermission('roles.create'),
  async (req, res) => { /* ... */ }
);

// Assign role
router.post('/api/users/:userId/roles',
  authenticate,
  requirePermission('roles.assign'),
  auditRoleAssignment(),
  async (req, res) => { /* ... */ }
);
```

### 5. Team Management

```typescript
// routes/teams.ts
import { requirePermission } from '@/middleware/rbac';

// List teams
router.get('/api/teams',
  authenticate,
  requirePermission('teams.read'),
  async (req, res) => { /* ... */ }
);

// Create team
router.post('/api/teams',
  authenticate,
  requirePermission('teams.create'),
  async (req, res) => { /* ... */ }
);

// Add member
router.post('/api/teams/:teamId/members',
  authenticate,
  requirePermission('teams.manage_members'),
  async (req, res) => { /* ... */ }
);

// Remove member
router.delete('/api/teams/:teamId/members/:userId',
  authenticate,
  requirePermission('teams.manage_members'),
  async (req, res) => { /* ... */ }
);
```

### 6. Settings Management

```typescript
// routes/settings.ts
import { requirePermission } from '@/middleware/rbac';

// Read settings
router.get('/api/settings',
  authenticate,
  requirePermission('settings.read'),
  async (req, res) => { /* ... */ }
);

// Update settings
router.put('/api/settings',
  authenticate,
  requirePermission('settings.update'),
  auditSettingsChange('global_settings'),
  async (req, res) => { /* ... */ }
);
```

### 7. Tenant Management

```typescript
// routes/tenants.ts
import { requirePermission, requireRole } from '@/middleware/rbac';

// List tenants (super_admin only)
router.get('/api/tenants',
  authenticate,
  requireRole('super_admin'),
  requirePermission('tenants.read'),
  async (req, res) => { /* ... */ }
);

// Provision tenant
router.post('/api/tenants',
  authenticate,
  requireRole(['super_admin', 'admin']),
  requirePermission('tenants.provision'),
  auditTenantProvisioning('provision'),
  async (req, res) => { /* ... */ }
);

// Deprovision tenant
router.delete('/api/tenants/:tenantId',
  authenticate,
  requireRole('super_admin'),
  requirePermission('tenants.delete'),
  auditTenantProvisioning('deprovision'),
  async (req, res) => { /* ... */ }
);
```

### 8. API Key Management

```typescript
// routes/api-keys.ts
import { requirePermission } from '@/middleware/rbac';

// List API keys
router.get('/api/keys',
  authenticate,
  requirePermission('api_keys.read'),
  async (req, res) => { /* ... */ }
);

// View API key (CRITICAL)
router.get('/api/keys/:keyId',
  authenticate,
  requirePermission('api_keys.read'),
  auditAPIKeyOperation('view'),
  async (req, res) => { /* ... */ }
);

// Create API key
router.post('/api/keys',
  authenticate,
  requirePermission('api_keys.create'),
  auditAPIKeyOperation('create'),
  async (req, res) => { /* ... */ }
);

// Rotate API key
router.post('/api/keys/:keyId/rotate',
  authenticate,
  requirePermission('api_keys.rotate'),
  auditAPIKeyOperation('rotate'),
  async (req, res) => { /* ... */ }
);

// Revoke API key
router.delete('/api/keys/:keyId',
  authenticate,
  requirePermission('api_keys.revoke'),
  auditAPIKeyOperation('revoke'),
  async (req, res) => { /* ... */ }
);
```

### 9. Audit Log Access

```typescript
// routes/audit.ts
import { requirePermission } from '@/middleware/rbac';

// View audit logs
router.get('/api/audit',
  authenticate,
  requirePermission('audit.read'),
  async (req, res) => { /* ... */ }
);

// Export audit logs
router.get('/api/audit/export',
  authenticate,
  requirePermission('audit.export'),
  async (req, res) => { /* ... */ }
);
```

### 10. Agent Operations

```typescript
// routes/agents.ts
import { requirePermission } from '@/middleware/rbac';

// Execute agent
router.post('/api/agents/execute',
  authenticate,
  requirePermission('agents.execute'),
  rateLimiters.agentExecution,
  async (req, res) => { /* ... */ }
);

// Configure agent
router.put('/api/agents/:agentId/config',
  authenticate,
  requirePermission('agents.configure'),
  async (req, res) => { /* ... */ }
);
```

### 11. Billing Operations

```typescript
// routes/billing.ts
import { requirePermission } from '@/middleware/rbac';

// View billing
router.get('/api/billing',
  authenticate,
  requirePermission('billing.read'),
  async (req, res) => { /* ... */ }
);

// Manage billing
router.put('/api/billing',
  authenticate,
  requirePermission('billing.manage'),
  async (req, res) => { /* ... */ }
);
```

## Advanced Patterns

### Multiple Permissions (OR logic)

```typescript
import { requireAnyPermission } from '@/middleware/rbac';

// User can read OR export
router.get('/api/data/flexible',
  authenticate,
  requireAnyPermission('data.read', 'data.export'),
  async (req, res) => { /* ... */ }
);
```

### Multiple Permissions (AND logic)

```typescript
import { requireAllPermissions } from '@/middleware/rbac';

// User must have BOTH permissions
router.post('/api/sensitive-operation',
  authenticate,
  requireAllPermissions('data.delete', 'permissions.grant'),
  async (req, res) => { /* ... */ }
);
```

### Resource Ownership

```typescript
import { requireOwnership } from '@/middleware/rbac';

// Only owner can update
router.put('/api/business-cases/:id',
  authenticate,
  requireOwnership('business_cases', (req) => req.params.id),
  async (req, res) => { /* ... */ }
);
```

### Combined Checks

```typescript
// Must have permission OR be owner
router.put('/api/business-cases/:id',
  authenticate,
  async (req, res, next) => {
    // Try permission first
    const hasPermission = await checkPermission(
      req.user.id,
      req.user.tenant_id,
      'data.update'
    );
    
    if (hasPermission) {
      return next();
    }
    
    // Fall back to ownership check
    requireOwnership('business_cases', (req) => req.params.id)(req, res, next);
  },
  async (req, res) => { /* ... */ }
);
```

## Middleware Order

**CRITICAL**: Apply middleware in this order:

```typescript
router.post('/api/protected',
  // 1. Authentication (verify identity)
  authenticate,
  
  // 2. Rate limiting (prevent abuse)
  rateLimiters.standard,
  
  // 3. Authorization (check permissions)
  requirePermission('data.create'),
  
  // 4. Audit logging (log the attempt)
  auditOperation('create', 'resource'),
  
  // 5. Handler
  async (req, res) => { /* ... */ }
);
```

## Role Hierarchy

```
super_admin (all permissions)
  └─ admin (most permissions)
      └─ manager (team management)
          └─ member (basic operations)
              └─ viewer (read-only)
                  └─ guest (limited read)
```

## Permission Matrix

| Permission | super_admin | admin | manager | member | viewer | guest |
|-----------|-------------|-------|---------|--------|--------|-------|
| data.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| data.create | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| data.update | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| data.delete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| data.export | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| users.create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| permissions.grant | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| roles.assign | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| tenants.provision | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Testing RBAC

```typescript
import { checkPermission } from '@/middleware/rbac';

describe('RBAC', () => {
  it('should allow admin to create data', async () => {
    const allowed = await checkPermission(
      'admin-user-id',
      'tenant-id',
      'data.create'
    );
    expect(allowed).toBe(true);
  });

  it('should deny viewer from deleting data', async () => {
    const allowed = await checkPermission(
      'viewer-user-id',
      'tenant-id',
      'data.delete'
    );
    expect(allowed).toBe(false);
  });
});
```

## Migration Checklist

- [ ] Identify all protected routes
- [ ] Add authentication middleware
- [ ] Add appropriate permission checks
- [ ] Add audit logging for critical operations
- [ ] Add rate limiting for expensive operations
- [ ] Test with different roles
- [ ] Verify error responses
- [ ] Update API documentation

## Common Mistakes

1. **Wrong middleware order**
   - ❌ Permission before authentication
   - ✅ Authentication before permission

2. **Missing tenant ID**
   - ❌ Not passing tenant_id
   - ✅ Always include tenant context

3. **Too permissive**
   - ❌ Using `requireAnyPermission` when should use `requireAllPermissions`
   - ✅ Use most restrictive check

4. **No audit logging**
   - ❌ Sensitive operations without audit
   - ✅ Always audit critical operations

## Monitoring

Track these metrics:

- Permission denials by user
- Permission denials by endpoint
- Role distribution
- Failed authorization attempts
- Audit log completeness

## Security Best Practices

1. **Principle of Least Privilege**: Grant minimum permissions needed
2. **Defense in Depth**: Use both RBAC and resource ownership
3. **Audit Everything**: Log all permission checks
4. **Regular Reviews**: Audit role assignments quarterly
5. **Separation of Duties**: No single role has all permissions
