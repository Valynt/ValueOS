# Audit Hooks Usage Guide

## Overview

AUD-302 provides automatic audit logging for critical operations through Express middleware hooks.

## Installation

```typescript
import {
  auditDataExport,
  auditAPIKeyOperation,
  auditBulkDelete,
  auditPermissionChange,
  auditRoleAssignment,
  auditTenantProvisioning,
  auditSettingsChange,
  auditOperation,
} from '@/middleware/auditHooks';
```

## Usage Examples

### Data Export

```typescript
// routes/data.ts
import { auditDataExport } from '@/middleware/auditHooks';

router.get(
  '/api/data/export',
  authenticate,
  auditDataExport('business_case'), // Automatically logs export
  async (req, res) => {
    const data = await exportData();
    res.json(data);
  }
);
```

### API Key Operations

```typescript
// routes/api-keys.ts
import { auditAPIKeyOperation } from '@/middleware/auditHooks';

// View API key (CRITICAL - always logged)
router.get(
  '/api/keys/:keyId',
  authenticate,
  auditAPIKeyOperation('view'),
  async (req, res) => {
    const key = await getAPIKey(req.params.keyId);
    res.json(key);
  }
);

// Create API key
router.post(
  '/api/keys',
  authenticate,
  auditAPIKeyOperation('create'),
  async (req, res) => {
    const key = await createAPIKey(req.body);
    res.json(key);
  }
);

// Rotate API key
router.post(
  '/api/keys/:keyId/rotate',
  authenticate,
  auditAPIKeyOperation('rotate'),
  async (req, res) => {
    const key = await rotateAPIKey(req.params.keyId);
    res.json(key);
  }
);

// Revoke API key
router.delete(
  '/api/keys/:keyId',
  authenticate,
  auditAPIKeyOperation('revoke'),
  async (req, res) => {
    await revokeAPIKey(req.params.keyId);
    res.json({ success: true });
  }
);
```

### Bulk Deletions

```typescript
// routes/business-cases.ts
import { auditBulkDelete } from '@/middleware/auditHooks';

router.post(
  '/api/business-cases/bulk-delete',
  authenticate,
  auditBulkDelete('business_case'),
  async (req, res) => {
    const { ids } = req.body;
    const result = await bulkDeleteBusinessCases(ids);
    res.json(result);
  }
);
```

### Permission Changes

```typescript
// routes/permissions.ts
import { auditPermissionChange } from '@/middleware/auditHooks';

// Grant permission
router.post(
  '/api/users/:userId/permissions',
  authenticate,
  requirePermission('manage_permissions'),
  auditPermissionChange(),
  async (req, res) => {
    const { permission } = req.body;
    await grantPermission(req.params.userId, permission);
    res.json({ success: true });
  }
);

// Revoke permission
router.delete(
  '/api/users/:userId/permissions/:permission',
  authenticate,
  requirePermission('manage_permissions'),
  auditPermissionChange(),
  async (req, res) => {
    await revokePermission(req.params.userId, req.params.permission);
    res.json({ success: true });
  }
);
```

### Role Assignments

```typescript
// routes/roles.ts
import { auditRoleAssignment } from '@/middleware/auditHooks';

// Assign role
router.post(
  '/api/users/:userId/roles',
  authenticate,
  requirePermission('manage_roles'),
  auditRoleAssignment(),
  async (req, res) => {
    const { role } = req.body;
    await assignRole(req.params.userId, role);
    res.json({ success: true });
  }
);

// Remove role
router.delete(
  '/api/users/:userId/roles/:role',
  authenticate,
  requirePermission('manage_roles'),
  auditRoleAssignment(),
  async (req, res) => {
    await removeRole(req.params.userId, req.params.role);
    res.json({ success: true });
  }
);
```

### Tenant Provisioning

```typescript
// routes/tenants.ts
import { auditTenantProvisioning } from '@/middleware/auditHooks';

// Provision tenant
router.post(
  '/api/tenants',
  authenticate,
  requirePermission('manage_tenants'),
  auditTenantProvisioning('provision'),
  async (req, res) => {
    const tenant = await provisionTenant(req.body);
    res.json(tenant);
  }
);

// Deprovision tenant
router.delete(
  '/api/tenants/:tenantId',
  authenticate,
  requirePermission('manage_tenants'),
  auditTenantProvisioning('deprovision'),
  async (req, res) => {
    await deprovisionTenant(req.params.tenantId);
    res.json({ success: true });
  }
);

// Suspend tenant
router.post(
  '/api/tenants/:tenantId/suspend',
  authenticate,
  requirePermission('manage_tenants'),
  auditTenantProvisioning('suspend'),
  async (req, res) => {
    await suspendTenant(req.params.tenantId);
    res.json({ success: true });
  }
);
```

### Settings Changes

```typescript
// routes/settings.ts
import { auditSettingsChange } from '@/middleware/auditHooks';

router.put(
  '/api/settings/security',
  authenticate,
  requirePermission('manage_settings'),
  auditSettingsChange('security_settings'),
  async (req, res) => {
    const settings = await updateSecuritySettings(req.body);
    res.json(settings);
  }
);
```

### Generic Audit

```typescript
// routes/custom.ts
import { auditOperation } from '@/middleware/auditHooks';

router.post(
  '/api/custom-operation',
  authenticate,
  auditOperation(
    'custom_operation',
    'custom_resource',
    (req) => req.body.resourceId // Custom resource ID extractor
  ),
  async (req, res) => {
    const result = await performCustomOperation(req.body);
    res.json(result);
  }
);
```

## What Gets Logged

Each audit hook automatically logs:

- **User Information**: ID, name, email
- **Request Metadata**: IP address, user agent
- **Operation Details**: Action, resource type, resource ID
- **Status**: Success or failure (based on HTTP status code)
- **Additional Details**: Operation-specific metadata

## Audit Log Structure

```typescript
{
  id: "uuid",
  userId: "user-123",
  userName: "John Doe",
  userEmail: "john@example.com",
  action: "data_export",
  resourceType: "business_case",
  resourceId: "bulk",
  status: "success",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  timestamp: "2024-01-01T00:00:00Z",
  details: {
    recordCount: 100,
    duration: 1234,
    format: "csv"
  },
  integrity_hash: "sha256...",
  previous_hash: "sha256..."
}
```

## Compliance Features

### Immutability

Audit logs are INSERT-only. They cannot be updated or deleted (only archived).

### Cryptographic Integrity

Each log entry includes:
- `integrity_hash`: SHA-256 hash of the log entry
- `previous_hash`: Hash of the previous log entry (chain)

This creates a tamper-evident audit trail.

### PII Sanitization

All log details are automatically sanitized to remove PII before storage.

### Verification

```typescript
import { auditLogService } from '@/services/AuditLogService';

// Verify integrity of last 1000 logs
const result = await auditLogService.verifyIntegrity(1000);

if (!result.valid) {
  console.error('Audit log integrity compromised!');
  console.error('Errors:', result.errors);
}
```

## Querying Audit Logs

```typescript
import { auditLogService } from '@/services/AuditLogService';

// Query by user
const userLogs = await auditLogService.query({
  userId: 'user-123',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});

// Query by action
const exports = await auditLogService.query({
  action: 'data_export',
  status: 'success',
});

// Get statistics
const stats = await auditLogService.getStatistics(
  '2024-01-01',
  '2024-01-31'
);
```

## Export for Compliance

```typescript
// Export as JSON
const json = await auditLogService.export({
  format: 'json',
  query: {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  },
});

// Export as CSV
const csv = await auditLogService.export({
  format: 'csv',
  query: {
    action: 'data_export',
  },
});
```

## Best Practices

1. **Always audit critical operations**
   - Data exports
   - API key views
   - Bulk deletions
   - Permission changes
   - Role assignments

2. **Use specific audit hooks**
   - More semantic than generic `auditOperation`
   - Provides better context

3. **Place audit hooks after authentication**
   - Ensures user information is available
   - Prevents logging anonymous operations

4. **Place audit hooks before authorization**
   - Logs both successful and failed attempts
   - Important for security monitoring

5. **Verify integrity regularly**
   - Run integrity checks daily
   - Alert on any failures

6. **Archive old logs**
   - Implement retention policies
   - Archive instead of delete

## Monitoring

Set up alerts for:

- Failed audit logging (CRITICAL)
- Integrity verification failures
- Unusual patterns (e.g., bulk deletions)
- API key views
- Permission changes

## Testing

```typescript
import { auditLogService } from '@/services/AuditLogService';

// In tests, verify audit logs are created
it('should audit data export', async () => {
  await request(app)
    .get('/api/data/export')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const logs = await auditLogService.query({
    action: 'data_export',
  });

  expect(logs).toHaveLength(1);
  expect(logs[0].status).toBe('success');
});
```
