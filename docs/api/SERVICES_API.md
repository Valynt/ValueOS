# Services & API Integration Layer Documentation

## Overview

This document describes the comprehensive Services & API Integration Layer for the application. All services follow SOLID principles, implement proper error handling, caching, retry logic, and request deduplication.

---

## Architecture

### Base Infrastructure

#### **BaseService**
**Location**: `/src/services/BaseService.ts`

Abstract base class providing common functionality for all services:

**Features**:
- ✅ Exponential backoff retry logic
- ✅ Request deduplication (1-second window)
- ✅ Caching with TTL (5 minutes default)
- ✅ Timeout handling
- ✅ Comprehensive logging
- ✅ Error handling and transformation

**Configuration**:
```typescript
interface RetryConfig {
  maxRetries: number;        // Default: 3
  initialDelay: number;      // Default: 1000ms
  maxDelay: number;          // Default: 10000ms
  backoffMultiplier: number; // Default: 2
}

interface RequestConfig {
  timeout?: number;
  retries?: Partial<RetryConfig>;
  deduplicationKey?: string;
  skipCache?: boolean;
}
```

---

#### **Error Types**
**Location**: `/src/services/errors.ts`

Comprehensive error hierarchy:

```typescript
enum ErrorCode {
  NETWORK_ERROR
  VALIDATION_ERROR
  AUTHENTICATION_ERROR
  AUTHORIZATION_ERROR
  NOT_FOUND
  CONFLICT
  RATE_LIMIT_EXCEEDED
  SERVER_ERROR
  TIMEOUT
  UNKNOWN
}
```

**Custom Error Classes**:
- `ServiceError` - Base error class
- `NetworkError` - Network connectivity issues
- `ValidationError` - Input validation failures
- `AuthenticationError` - Auth failures (401)
- `AuthorizationError` - Permission denied (403)
- `NotFoundError` - Resource not found (404)
- `ConflictError` - Resource conflicts (409)
- `RateLimitError` - Rate limit exceeded (429)
- `TimeoutError` - Request timeout (408)

---

## Core Services

### 1. SettingsService

**Location**: `/src/services/SettingsService.ts`

Centralized settings management with strong typing and validation.

#### **Features**:
- Type-safe setting storage (string, number, boolean, object, array)
- Scope-based isolation (user, team, organization)
- Automatic serialization/deserialization
- Bulk operations
- Upsert functionality
- Validation on type mismatch

#### **Usage**:

```typescript
import { settingsService } from './services';

// Get a single setting
const theme = await settingsService.getSetting(
  'theme',
  'user',
  userId
);

// Get multiple settings
const settings = await settingsService.getSettings({
  scope: 'user',
  scopeId: userId,
  keys: ['theme', 'language'],
});

// Create setting
await settingsService.createSetting({
  key: 'notifications.email',
  value: true,
  type: 'boolean',
  scope: 'user',
  scopeId: userId,
});

// Update setting
await settingsService.updateSetting(
  'theme',
  'user',
  userId,
  { value: 'dark' }
);

// Upsert (create or update)
await settingsService.upsertSetting({
  key: 'language',
  value: 'en',
  type: 'string',
  scope: 'user',
  scopeId: userId,
});

// Bulk update
await settingsService.bulkUpdateSettings('user', userId, {
  theme: 'dark',
  language: 'en',
  compactMode: true,
});

// Delete setting
await settingsService.deleteSetting('theme', 'user', userId);
```

#### **Database Schema**:
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key, scope, scope_id)
);
```

---

### 2. UserSettingsService

**Location**: `/src/services/UserSettingsService.ts`

User profile and preference management.

#### **Features**:
- Profile CRUD operations
- Preference management with defaults
- Account deletion

#### **Usage**:

```typescript
import { userSettingsService } from './services';

// Get profile
const profile = await userSettingsService.getProfile(userId);

// Update profile
await userSettingsService.updateProfile(userId, {
  fullName: 'John Doe',
  timezone: 'America/New_York',
  language: 'en',
});

// Get preferences (with defaults)
const preferences = await userSettingsService.getPreferences(userId);
// Returns: { theme, emailNotifications, desktopNotifications, ... }

// Update preferences
await userSettingsService.updatePreferences(userId, {
  theme: 'dark',
  emailNotifications: false,
});

// Delete account
await userSettingsService.deleteAccount(userId);
```

#### **Interfaces**:
```typescript
interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatar?: string;
  bio?: string;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  emailNotifications: boolean;
  desktopNotifications: boolean;
  weeklyDigest: boolean;
  compactMode: boolean;
}
```

---

### 3. AuthService

**Location**: `/src/services/AuthService.ts`

Session management and authentication operations using Supabase Auth.

#### **Features**:
- Email/password authentication
- Session management
- Password reset
- Token refresh

#### **Usage**:

```typescript
import { authService } from './services';

// Sign up
const { user, session } = await authService.signup({
  email: 'user@example.com',
  password: 'securepassword',
  fullName: 'John Doe',
});

// Login
const { user, session } = await authService.login({
  email: 'user@example.com',
  password: 'password',
});

// Logout
await authService.logout();

// Get current session
const session = await authService.getSession();

// Get current user
const user = await authService.getCurrentUser();

// Refresh session
const { user, session } = await authService.refreshSession();

// Request password reset
await authService.requestPasswordReset('user@example.com');

// Update password
await authService.updatePassword('newpassword');

// Check authentication
const isAuth = await authService.isAuthenticated();
```

#### **Security**:
- Minimum 8-character passwords
- Secure session storage
- Automatic token refresh
- Email verification support

---

### 4. PermissionService

**Location**: `/src/services/PermissionService.ts`

Role-based access control (RBAC) implementation.

#### **Features**:
- Fine-grained permissions
- Role-based authorization
- Scope-based access (user/team/organization)
- Permission caching
- Bulk permission checks

#### **Usage**:

```typescript
import { permissionService } from './services';

// Check single permission
const canManage = await permissionService.hasPermission(
  userId,
  'team.manage',
  'team',
  teamId
);

// Check multiple permissions (ALL required)
const hasAll = await permissionService.hasAllPermissions(
  userId,
  ['team.manage', 'members.manage'],
  'team',
  teamId
);

// Check any permission (ONE required)
const hasAny = await permissionService.hasAnyPermission(
  userId,
  ['team.view', 'team.manage'],
  'team',
  teamId
);

// Require permission (throws if unauthorized)
await permissionService.requirePermission(
  userId,
  'billing.manage',
  'organization',
  orgId
);

// Get user roles
const roles = await permissionService.getUserRoles(userId, 'team', teamId);

// Assign role
await permissionService.assignRole(
  userId,
  roleId,
  'team',
  teamId
);

// Remove role
await permissionService.removeRole(
  userId,
  roleId,
  'team',
  teamId
);
```

#### **Available Permissions**:
```typescript
type Permission =
  | 'user.view'
  | 'user.edit'
  | 'team.view'
  | 'team.manage'
  | 'organization.manage'
  | 'members.manage'
  | 'billing.view'
  | 'billing.manage'
  | 'security.manage'
  | 'audit.view';
```

---

### 5. AuditLogService

**Location**: `/src/services/AuditLogService.ts`

Comprehensive audit logging with advanced querying and export capabilities.

#### **Features**:
- Automatic event logging
- Advanced filtering
- Export to CSV/JSON
- Statistics and analytics
- Data retention management

#### **Usage**:

```typescript
import { auditLogService } from './services';

// Log an event
await auditLogService.log({
  userId: user.id,
  userName: user.name,
  userEmail: user.email,
  action: 'user.updated',
  resourceType: 'user',
  resourceId: user.id,
  details: { fields: ['name', 'email'] },
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
  status: 'success',
});

// Query logs
const logs = await auditLogService.query({
  userId: userId,
  action: 'user.updated',
  resourceType: 'user',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-12-31T23:59:59Z',
  status: 'success',
  limit: 100,
  offset: 0,
});

// Get by ID
const log = await auditLogService.getById(logId);

// Export logs
const csv = await auditLogService.export({
  format: 'csv',
  query: {
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
  },
});

// Get statistics
const stats = await auditLogService.getStatistics(
  '2024-01-01T00:00:00Z',
  '2024-12-31T23:59:59Z'
);
// Returns: {
//   totalEvents,
//   successfulEvents,
//   failedEvents,
//   topActions: [{ action, count }],
//   topUsers: [{ userId, userName, count }]
// }

// Delete old logs (data retention)
const deletedCount = await auditLogService.deleteOldLogs(
  '2023-01-01T00:00:00Z' // Older than this date
);
```

#### **Query Interface**:
```typescript
interface AuditLogQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  status?: 'success' | 'failed';
  limit?: number;
  offset?: number;
}
```

---

## Best Practices

### Error Handling

```typescript
import { ServiceError, ValidationError } from './services';

try {
  await settingsService.updateSetting(key, scope, scopeId, { value });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    console.error('Validation failed:', error.message);
  } else if (error instanceof ServiceError) {
    // Handle other service errors
    console.error('Service error:', error.code, error.message);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

### Caching

```typescript
// Automatic caching with deduplication
const settings = await settingsService.getSettings({
  scope: 'user',
  scopeId: userId,
});
// Cached for 5 minutes

// Skip cache for fresh data
const settings = await service.executeRequest(
  async () => { /* ... */ },
  { skipCache: true }
);

// Manual cache clearing
settingsService.clearCache(); // Clear all
settingsService.clearCache(key); // Clear specific key
```

### Request Deduplication

```typescript
// Multiple rapid calls will deduplicate
Promise.all([
  settingsService.getSetting('theme', 'user', userId),
  settingsService.getSetting('theme', 'user', userId),
  settingsService.getSetting('theme', 'user', userId),
]);
// Only 1 actual database call is made
```

### Retry Logic

```typescript
// Automatic retry with exponential backoff
await service.executeRequest(
  async () => { /* operation */ },
  {
    retries: {
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    }
  }
);
```

---

## Database Requirements

### Required Tables

```sql
-- Settings
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'object', 'array')),
  scope TEXT NOT NULL CHECK (scope IN ('user', 'team', 'organization')),
  scope_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key, scope, scope_id)
);

CREATE INDEX idx_settings_scope ON settings(scope, scope_id);
CREATE INDEX idx_settings_key ON settings(key);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  permissions TEXT[] NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('user', 'team', 'organization')),
  scope_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id, scope, scope_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_scope ON user_roles(scope, scope_id);
```

---

## Environment Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: Logging
NODE_ENV=development|production
LOG_LEVEL=debug|info|warn|error
```

---

## Testing

```typescript
import { settingsService } from './services';

describe('SettingsService', () => {
  it('should create and retrieve setting', async () => {
    const setting = await settingsService.createSetting({
      key: 'test',
      value: 'value',
      type: 'string',
      scope: 'user',
      scopeId: 'test-user',
    });

    const retrieved = await settingsService.getSetting(
      'test',
      'user',
      'test-user'
    );

    expect(retrieved).toBe('value');
  });

  it('should handle validation errors', async () => {
    await expect(
      settingsService.createSetting({
        key: 'test',
        value: 123,
        type: 'string', // Type mismatch
        scope: 'user',
        scopeId: 'test-user',
      })
    ).rejects.toThrow(ValidationError);
  });
});
```

---

## Performance Optimizations

1. **Caching**: 5-minute TTL reduces database load
2. **Deduplication**: Prevents duplicate requests within 1 second
3. **Bulk Operations**: Minimizes round trips
4. **Indexed Queries**: All common queries use database indexes
5. **Connection Pooling**: Supabase handles connection management
6. **Lazy Loading**: Services loaded only when needed

---

## Build Status

✅ **Successfully compiled**
- All services type-safe
- Zero build errors
- Production-ready
- Comprehensive error handling
- Full TypeScript support

---

## Next Steps

Additional services can be implemented following the same patterns:
- `TeamSettingsService` - Team/workspace management
- `OrganizationSettingsService` - Organization operations
- `IntegrationService` - Third-party integrations
- `BillingService` - Subscription and billing
- `NotificationService` - Notification delivery
- `WebhookService` - Webhook management
- `APIKeyService` - API key management

All follow the established patterns in BaseService and can be added incrementally.
