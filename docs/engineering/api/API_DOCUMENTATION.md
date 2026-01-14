# ValueOS API Documentation

## Overview

This guide provides comprehensive documentation for ValueOS APIs, including both external integrations and internal service APIs.

---

## External API Documentation

### Authentication

- **Method**: Bearer tokens generated per workspace
- **Header**: `Authorization: Bearer <token>`
- **Token source**: Use the `access_token` returned by `POST /auth/login` or the Supabase session `access_token` issued to your workspace users
- **Scopes**:
  - `lifecycle:trigger` — run agents and orchestrations
  - `docs:read` — fetch documentation pages and metadata
  - `telemetry:write` — push realization/telemetry events

### Base URLs

- **Production**: `https://api.valuecanvas.com/v1`
- **Sandbox**: `https://sandbox-api.valuecanvas.com/v1`

### Endpoints

#### Trigger Lifecycle Workflow

`POST /lifecycle/runs`

- **Payload**:

```json
{
  "stage": "opportunity|target|realization|expansion",
  "accountId": "uuid",
  "inputs": { "discoveryNotes": "...", "persona": "CFO", "benchmarks": [...] }
}
```

- **Behavior**: Enqueues a workflow in the orchestrator and returns `runId` plus status URL
- **Idempotency**: Provide `Idempotency-Key` header to avoid duplicate runs

#### Fetch Documentation Page

`GET /docs/pages/{slug}`

- **Query params**: `version` (optional, defaults to latest)
- **Response**: Page metadata, HTML/MD content, and related links

#### Submit Telemetry Event

`POST /telemetry/events`

- **Payload**:

```json
{
  "accountId": "uuid",
  "kpi": "response_time_ms",
  "value": 123,
  "timestamp": "2025-11-17T12:00:00Z",
  "metadata": { "source": "app" }
}
```

- **Behavior**: Writes to `telemetry_events` and triggers Realization Agent refresh

### Error Handling

- Standardized error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR|AUTHENTICATION_ERROR|RATE_LIMIT_EXCEEDED|SERVER_ERROR",
    "message": "human-readable detail",
    "traceId": "..."
  }
}
```

- Rate limits return `429` with `Retry-After`

### Webhooks

- **Run status updates**: Configure a webhook endpoint to receive `run.started`, `run.completed`, and `run.failed` events
- **Security**: HMAC signatures via `X-VC-Signature`; rotate secrets quarterly

### Versioning & Stability

- All endpoints are versioned under `/v1`; breaking changes will be introduced via `/v2` with at least 90 days' notice
- Schema changes include `deprecationNotice` fields in responses for forward planning

---

## Internal Services API

### Architecture

#### Base Infrastructure

**BaseService** (`/src/services/BaseService.ts`)

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
  maxRetries: number; // Default: 3
  initialDelay: number; // Default: 1000ms
  maxDelay: number; // Default: 10000ms
  backoffMultiplier: number; // Default: 2
}

interface RequestConfig {
  timeout?: number;
  retries?: Partial<RetryConfig>;
  deduplicationKey?: string;
  skipCache?: boolean;
}
```

#### Error Types

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

### Core Services

#### 1. SettingsService

**Location**: `/src/services/SettingsService.ts`

Centralized settings management with strong typing and validation.

**Features**:

- Type-safe setting storage (string, number, boolean, object, array)
- Scope-based isolation (user, team, organization)
- Automatic serialization/deserialization
- Bulk operations
- Upsert functionality
- Validation on type mismatch

**Usage**:

```typescript
import { settingsService } from "./services";

// Get a single setting
const theme = await settingsService.getSetting("theme", "user", userId);

// Get multiple settings
const settings = await settingsService.getSettings({
  scope: "user",
  scopeId: userId,
  keys: ["theme", "language"],
});

// Create setting
await settingsService.createSetting({
  key: "notifications.email",
  value: true,
  type: "boolean",
  scope: "user",
  scopeId: userId,
});

// Update setting
await settingsService.updateSetting("theme", "user", userId, { value: "dark" });

// Upsert (create or update)
await settingsService.upsertSetting({
  key: "language",
  value: "en",
  type: "string",
  scope: "user",
  scopeId: userId,
});

// Bulk update
await settingsService.bulkUpdateSettings("user", userId, {
  theme: "dark",
  language: "en",
  compactMode: true,
});

// Delete setting
await settingsService.deleteSetting("theme", "user", userId);
```

#### 2. UserSettingsService

**Location**: `/src/services/UserSettingsService.ts`

User profile and preference management.

**Features**:

- Profile CRUD operations
- Preference management with defaults
- Account deletion

**Usage**:

```typescript
import { userSettingsService } from "./services";

// Get profile
const profile = await userSettingsService.getProfile(userId);

// Update profile
await userSettingsService.updateProfile(userId, {
  fullName: "John Doe",
  timezone: "America/New_York",
  language: "en",
});

// Get preferences (with defaults)
const preferences = await userSettingsService.getPreferences(userId);
// Returns: { theme, emailNotifications, desktopNotifications, ... }

// Update preferences
await userSettingsService.updatePreferences(userId, {
  theme: "dark",
  emailNotifications: false,
});

// Delete account
await userSettingsService.deleteAccount(userId);
```

#### 3. AuthService

**Location**: `/src/services/AuthService.ts`

Session management and authentication operations using Supabase Auth.

**Features**:

- Email/password authentication
- Session management
- Password reset
- Token refresh

**Usage**:

```typescript
import { authService } from "./services";

// Sign up
const { user, session } = await authService.signup({
  email: "user@example.com",
  password: "securepassword",
  fullName: "John Doe",
});

// Login
const { user, session } = await authService.login({
  email: "user@example.com",
  password: "password",
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
await authService.requestPasswordReset("user@example.com");

// Update password
await authService.updatePassword("newpassword");

// Check authentication
const isAuth = await authService.isAuthenticated();
```

#### 4. PermissionService

**Location**: `/src/services/PermissionService.ts`

Role-based access control (RBAC) implementation.

**Features**:

- Fine-grained permissions
- Role-based authorization
- Scope-based access (user/team/organization)
- Permission caching
- Bulk permission checks

**Usage**:

```typescript
import { permissionService } from "./services";

// Check single permission
const canManage = await permissionService.hasPermission(
  userId,
  "team.manage",
  "team",
  teamId
);

// Check multiple permissions (ALL required)
const hasAll = await permissionService.hasAllPermissions(
  userId,
  ["team.manage", "members.manage"],
  "team",
  teamId
);

// Check any permission (ONE required)
const hasAny = await permissionService.hasAnyPermission(
  userId,
  ["team.view", "team.manage"],
  "team",
  teamId
);

// Require permission (throws if unauthorized)
await permissionService.requirePermission(
  userId,
  "billing.manage",
  "organization",
  orgId
);

// Get user roles
const roles = await permissionService.getUserRoles(userId, "team", teamId);

// Assign role
await permissionService.assignRole(userId, roleId, "team", teamId);

// Remove role
await permissionService.removeRole(userId, roleId, "team", teamId);
```

**Available Permissions**:

```typescript
type Permission =
  | "user.view"
  | "user.edit"
  | "team.view"
  | "team.manage"
  | "organization.manage"
  | "members.manage"
  | "billing.view"
  | "billing.manage"
  | "security.manage"
  | "audit.view";
```

#### 5. AuditLogService

**Location**: `/src/services/AuditLogService.ts`

Comprehensive audit logging with advanced querying and export capabilities.

**Features**:

- Automatic event logging
- Advanced filtering
- Export to CSV/JSON
- Statistics and analytics
- Data retention management

**Usage**:

```typescript
import { auditLogService } from "./services";

// Log an event
await auditLogService.log({
  userId: user.id,
  userName: user.name,
  userEmail: user.email,
  action: "user.updated",
  resourceType: "user",
  resourceId: user.id,
  details: { fields: ["name", "email"] },
  ipAddress: request.ip,
  userAgent: request.headers["user-agent"],
  status: "success",
});

// Query logs
const logs = await auditLogService.query({
  userId: userId,
  action: "user.updated",
  resourceType: "user",
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-12-31T23:59:59Z",
  status: "success",
  limit: 100,
  offset: 0,
});

// Get by ID
const log = await auditLogService.getById(logId);

// Export logs
const csv = await auditLogService.export({
  format: "csv",
  query: {
    startDate: "2024-01-01T00:00:00Z",
    endDate: "2024-12-31T23:59:59Z",
  },
});

// Get statistics
const stats = await auditLogService.getStatistics(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z"
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
  "2023-01-01T00:00:00Z" // Older than this date
);
```

---

## Best Practices

### Error Handling

```typescript
import { ServiceError, ValidationError } from "./services";

try {
  await settingsService.updateSetting(key, scope, scopeId, { value });
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    console.error("Validation failed:", error.message);
  } else if (error instanceof ServiceError) {
    // Handle other service errors
    console.error("Service error:", error.code, error.message);
  } else {
    // Handle unexpected errors
    console.error("Unexpected error:", error);
  }
}
```

### Caching

```typescript
// Automatic caching with deduplication
const settings = await settingsService.getSettings({
  scope: "user",
  scopeId: userId,
});
// Cached for 5 minutes

// Skip cache for fresh data
const settings = await service.executeRequest(
  async () => {
    /* ... */
  },
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
  settingsService.getSetting("theme", "user", userId),
  settingsService.getSetting("theme", "user", userId),
  settingsService.getSetting("theme", "user", userId),
]);
// Only 1 actual database call is made
```

### Retry Logic

```typescript
// Automatic retry with exponential backoff
await service.executeRequest(
  async () => {
    /* operation */
  },
  {
    retries: {
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    },
  }
);
```

---

## API Versioning Policy

### Versioning Strategy

- **Semantic versioning** for API endpoints
- **Backward compatibility** maintained within major versions
- **Deprecation notices** provided for breaking changes
- **Migration guides** provided for version upgrades

### Version Lifecycle

1. **Development**: New features in development version
2. **Stable**: Production-ready version with SLA
3. **Deprecated**: Version scheduled for removal
4. **Retired**: Version no longer supported

### Breaking Changes

Breaking changes include:

- Removing or renaming endpoints
- Changing request/response formats
- Modifying authentication requirements
- Changing behavior of existing endpoints

Non-breaking changes include:

- Adding new endpoints
- Adding optional fields to responses
- Adding new query parameters
- Improving error messages

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
import { settingsService } from "./services";

describe("SettingsService", () => {
  it("should create and retrieve setting", async () => {
    const setting = await settingsService.createSetting({
      key: "test",
      value: "value",
      type: "string",
      scope: "user",
      scopeId: "test-user",
    });

    const retrieved = await settingsService.getSetting(
      "test",
      "user",
      "test-user"
    );

    expect(retrieved).toBe("value");
  });

  it("should handle validation errors", async () => {
    await expect(
      settingsService.createSetting({
        key: "test",
        value: 123,
        type: "string", // Type mismatch
        scope: "user",
        scopeId: "test-user",
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

**Last Updated**: 2026-01-14
**Maintained By**: API Team
**Review Frequency**: Monthly
