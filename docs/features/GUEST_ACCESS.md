# Guest Access System

## Overview

The Guest Access System enables external stakeholders (prospects, partners, customers) to access specific business cases with limited permissions through secure magic links. This eliminates the need for full account creation while maintaining security and control.

## Features

### 1. Magic Link Authentication
- Secure token-based access (no password required)
- Configurable expiration (default: 30 days)
- One-time or reusable links
- Automatic token validation

### 2. Permission Levels
- **View-Only**: Can view all content, export reports
- **Comment**: Can view and add comments
- **Edit**: Can view, comment, and edit elements

### 3. Activity Tracking
- Comprehensive audit log
- Track all guest actions
- IP address and user agent logging
- Access count and timestamps

### 4. Session Management
- Automatic expiration handling
- Periodic token validation
- Expiration warnings
- Graceful session termination

## Architecture

### Database Schema

#### guest_users
Stores guest user information

```sql
CREATE TABLE guest_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(email, organization_id)
);
```

#### guest_access_tokens
Stores magic link tokens

```sql
CREATE TABLE guest_access_tokens (
  id UUID PRIMARY KEY,
  guest_user_id UUID REFERENCES guest_users(id),
  value_case_id UUID REFERENCES value_cases(id),
  token TEXT UNIQUE,
  permissions JSONB,
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER,
  revoked BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### guest_activity_log
Audit log of guest activities

```sql
CREATE TABLE guest_activity_log (
  id UUID PRIMARY KEY,
  guest_user_id UUID REFERENCES guest_users(id),
  guest_access_token_id UUID REFERENCES guest_access_tokens(id),
  value_case_id UUID REFERENCES value_cases(id),
  activity_type TEXT,
  activity_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ
);
```

### Security

#### Row-Level Security (RLS)
All tables have RLS policies ensuring:
- Users can only access guests in their organization
- Guests can only access their assigned value cases
- Activity logs are organization-scoped

#### Token Security
- 32-byte cryptographically secure random tokens
- Base64url encoding (URL-safe)
- Stored hashed in database (future enhancement)
- Automatic expiration
- Revocation support

## Usage

### Creating a Guest User

```typescript
import { getGuestAccessService } from './services/GuestAccessService';

const guestService = getGuestAccessService();

// Create guest user
const guestUser = await guestService.createGuestUser({
  email: 'prospect@example.com',
  name: 'John Prospect',
  company: 'Acme Corp',
  role: 'Decision Maker',
  organizationId: 'org-123',
});
```

### Generating a Magic Link

```typescript
// Create access token with permissions
const { token, magicLink } = await guestService.createGuestToken({
  guestUserId: guestUser.id,
  valueCaseId: 'vc-123',
  permissions: {
    can_view: true,
    can_comment: true,
    can_edit: false,
  },
  expiresInDays: 30,
});

// Send magic link via email
console.log('Magic Link:', magicLink);
// https://app.valueos.com/guest/access?token=abc123...
```

### Validating a Token

```typescript
// Validate token (called automatically by useGuestSession hook)
const result = await guestService.validateToken(
  token,
  ipAddress,
  userAgent
);

if (result.isValid) {
  console.log('Guest:', result.guestName);
  console.log('Permissions:', result.permissions);
} else {
  console.error('Invalid token:', result.errorMessage);
}
```

### Using Guest Session Hook

```typescript
import { useGuestSession } from './hooks/useGuestSession';

function GuestView() {
  const {
    isLoading,
    isValid,
    isExpired,
    guestName,
    permissions,
    expiresAt,
    errorMessage,
    refresh,
    logout,
    checkExpirationWarning,
  } = useGuestSession({
    onExpired: () => {
      alert('Your access has expired');
    },
    onInvalid: (error) => {
      alert(`Access denied: ${error}`);
    },
    checkInterval: 60000, // Check every minute
  });

  if (isLoading) return <div>Loading...</div>;
  if (!isValid) return <div>Access denied: {errorMessage}</div>;

  const { isExpiringSoon, daysRemaining } = checkExpirationWarning();

  return (
    <div>
      <h1>Welcome, {guestName}!</h1>
      {isExpiringSoon && (
        <div>Your access expires in {daysRemaining} days</div>
      )}
      {/* Your content */}
    </div>
  );
}
```

### Checking Permissions

```typescript
import { useGuestPermissions } from './hooks/useGuestSession';

function GuestCanvas({ permissions }) {
  const { canView, canComment, canEdit, hasPermission } = useGuestPermissions(permissions);

  return (
    <div>
      {canView && <ViewCanvas />}
      {canComment && <CommentButton />}
      {canEdit && <EditTools />}
      
      {hasPermission('edit') ? (
        <button>Edit Element</button>
      ) : (
        <div>You don't have edit permission</div>
      )}
    </div>
  );
}
```

### Logging Guest Activity

```typescript
import { useGuestActivity } from './hooks/useGuestSession';

function GuestCanvas({ guestUserId, tokenId, valueCaseId }) {
  const { logActivity } = useGuestActivity(guestUserId, tokenId, valueCaseId);

  const handleViewElement = (elementId: string) => {
    logActivity('view_element', { elementId });
  };

  const handleAddComment = (commentId: string) => {
    logActivity('add_comment', { commentId });
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    logActivity(format === 'pdf' ? 'export_pdf' : 'export_excel', { format });
  };

  return <div>{/* Your canvas */}</div>;
}
```

### Displaying Guest Badge

```typescript
import { GuestBadge, GuestBadgeCompact, GuestAccessBanner } from './components/Guest/GuestBadge';

// Full badge
<GuestBadge
  guestName="John Prospect"
  guestEmail="john@example.com"
  permissions={permissions}
  expiresAt="2026-02-05T00:00:00Z"
/>

// Compact badge (for headers)
<GuestBadgeCompact
  guestName="John Prospect"
  permissions={permissions}
/>

// Full-width banner
<GuestAccessBanner
  guestName="John Prospect"
  guestEmail="john@example.com"
  permissions={permissions}
  expiresAt="2026-02-05T00:00:00Z"
  onRequestAccess={() => {
    // Handle access request
  }}
/>
```

### Revoking Access

```typescript
// Revoke a specific token
await guestService.revokeToken(
  token,
  'Security concern - unauthorized sharing'
);

// Get all tokens for a value case
const tokens = await guestService.getTokensForValueCase('vc-123');

// Revoke all tokens for a guest
for (const token of tokens.filter(t => t.guestUserId === 'guest-123')) {
  await guestService.revokeToken(token.token, 'Guest access removed');
}
```

## Permission System

### Permission Presets

```typescript
import { createGuestPermissionPreset } from './lib/permissions/guestPermissions';

// View-only
const viewOnly = createGuestPermissionPreset('view-only');
// { can_view: true, can_comment: false, can_edit: false }

// Comment
const comment = createGuestPermissionPreset('comment');
// { can_view: true, can_comment: true, can_edit: false }

// Edit
const edit = createGuestPermissionPreset('edit');
// { can_view: true, can_comment: true, can_edit: true }
```

### Permission Checks

```typescript
import { checkGuestPermission, PermissionAction, ResourceType } from './lib/permissions/guestPermissions';

const result = checkGuestPermission(
  permissions,
  PermissionAction.EDIT,
  ResourceType.CANVAS_ELEMENT
);

if (result.allowed) {
  // Allow action
} else {
  console.error(result.reason);
}
```

### Permission Summary

```typescript
import { getGuestPermissionManager } from './lib/permissions/guestPermissions';

const manager = getGuestPermissionManager();
const summary = manager.getPermissionSummary(permissions);

console.log(summary.level); // 'view-only' | 'comment' | 'edit'
console.log(summary.description); // 'Can view and comment'
console.log(summary.actions); // ['View all content', 'Add comments', ...]
```

## Activity Tracking

### Activity Types

- `access`: Initial access to value case
- `view_element`: Viewed a canvas element
- `add_comment`: Added a comment
- `view_metric`: Viewed a metric
- `export_pdf`: Exported PDF report
- `export_excel`: Exported Excel report
- `share_email`: Shared via email

### Viewing Activity

```typescript
// Get activity for a value case
const activities = await guestService.getActivityForValueCase('vc-123', 100);

activities.forEach(activity => {
  console.log(`${activity.activityType} at ${activity.createdAt}`);
  console.log('Data:', activity.activityData);
});
```

## Maintenance

### Cleanup Expired Tokens

```typescript
// Manually cleanup expired tokens (older than 30 days)
const deletedCount = await guestService.cleanupExpiredTokens();
console.log(`Cleaned up ${deletedCount} expired tokens`);
```

### Scheduled Cleanup

Set up a cron job or scheduled task:

```typescript
// Run daily at 2 AM
import { getGuestAccessService } from './services/GuestAccessService';

async function cleanupJob() {
  const guestService = getGuestAccessService();
  const count = await guestService.cleanupExpiredTokens();
  console.log(`Cleaned up ${count} expired tokens`);
}

// Schedule with your task runner
```

## Best Practices

### 1. Token Expiration

- **Short-term access**: 7 days for quick reviews
- **Standard access**: 30 days for ongoing collaboration
- **Extended access**: 90 days for long-term projects
- **Never**: Use with caution, prefer renewable tokens

### 2. Permission Levels

- Start with **view-only** for initial sharing
- Upgrade to **comment** for feedback collection
- Grant **edit** only to trusted stakeholders
- Review permissions regularly

### 3. Security

- Always use HTTPS for magic links
- Don't share tokens in public channels
- Revoke tokens when no longer needed
- Monitor activity logs for suspicious behavior
- Set appropriate expiration times

### 4. User Experience

- Send personalized invitation emails
- Include clear instructions
- Show expiration warnings (3 days before)
- Provide easy access request flow
- Display permission level clearly

### 5. Monitoring

- Track token usage and access patterns
- Monitor for unusual activity
- Set up alerts for:
  - Multiple failed access attempts
  - Access from unusual locations
  - High-frequency activity
  - Token sharing (multiple IPs)

## Troubleshooting

### Token Not Working

1. Check if token has expired
2. Verify token hasn't been revoked
3. Check RLS policies
4. Verify value case still exists
5. Check browser console for errors

### Permission Denied

1. Verify guest has required permission
2. Check permission level (view/comment/edit)
3. Verify token is for correct value case
4. Check if token has been revoked

### Activity Not Logging

1. Verify guest user ID and token ID
2. Check RLS policies on activity log
3. Verify network connectivity
4. Check browser console for errors

## API Reference

### GuestAccessService

```typescript
class GuestAccessService {
  // Create guest user
  createGuestUser(options: CreateGuestUserOptions): Promise<GuestUser>
  
  // Create access token
  createGuestToken(options: CreateGuestTokenOptions): Promise<{
    token: GuestAccessToken;
    magicLink: string;
  }>
  
  // Validate token
  validateToken(token: string, ipAddress?: string, userAgent?: string): Promise<TokenValidationResult>
  
  // Revoke token
  revokeToken(token: string, reason?: string): Promise<boolean>
  
  // Get guest user
  getGuestUser(guestUserId: string): Promise<GuestUser | null>
  
  // Get tokens for value case
  getTokensForValueCase(valueCaseId: string): Promise<GuestAccessToken[]>
  
  // Log activity
  logActivity(
    guestUserId: string,
    tokenId: string,
    valueCaseId: string,
    activityType: GuestActivityType,
    activityData?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void>
  
  // Get activity
  getActivityForValueCase(valueCaseId: string, limit?: number): Promise<GuestActivity[]>
  
  // Cleanup expired tokens
  cleanupExpiredTokens(): Promise<number>
}
```

### Hooks

```typescript
// Guest session management
useGuestSession(options?: UseGuestSessionOptions): {
  isLoading: boolean;
  isValid: boolean;
  isExpired: boolean;
  guestUserId?: string;
  valueCaseId?: string;
  permissions?: GuestPermissions;
  guestName?: string;
  guestEmail?: string;
  expiresAt?: string;
  errorMessage?: string;
  refresh: () => Promise<void>;
  logout: () => void;
  checkExpirationWarning: () => { isExpiringSoon: boolean; daysRemaining: number };
}

// Permission checks
useGuestPermissions(permissions?: GuestPermissions): {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  hasPermission: (action: 'view' | 'comment' | 'edit') => boolean;
}

// Activity logging
useGuestActivity(guestUserId?: string, tokenId?: string, valueCaseId?: string): {
  logActivity: (activityType: GuestActivityType, activityData?: Record<string, any>) => Promise<void>;
}
```

## Future Enhancements

### 1. Token Renewal
- Allow guests to request token renewal
- Automatic renewal for active users
- Email notifications before expiration

### 2. Multi-Factor Authentication
- Optional MFA for sensitive value cases
- SMS or email verification codes
- Time-based one-time passwords (TOTP)

### 3. Advanced Permissions
- Granular permissions per element
- Time-based permissions
- IP-based restrictions
- Device-based restrictions

### 4. Collaboration Features
- Guest-to-guest messaging
- Shared annotations
- Collaborative editing sessions
- Real-time presence for guests

### 5. Analytics
- Guest engagement metrics
- Conversion tracking (guest → customer)
- Activity heatmaps
- Engagement scoring

## Support

For issues or questions:
- **Documentation**: `/docs/features/GUEST_ACCESS.md`
- **Slack**: `#guest-access-support`
- **Email**: `support@valueos.com`
