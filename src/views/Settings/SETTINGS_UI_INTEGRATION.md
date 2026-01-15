# Settings UI Integration Guide

## Overview

This guide explains how to integrate Settings UI components with the new Supabase schema and settingsRegistry system.

## Architecture

### Data Flow

```
User Interaction
    ↓
Settings Component
    ↓
useSettings() / useSettingsGroup() Hook
    ↓
SettingsRegistry
    ↓
Supabase (users/teams/organizations tables)
    ↓
JSONB Columns (user_preferences/team_settings/organization_settings)
```

### Tenant Override Cascade

Settings are loaded with the following priority:

1. **User-level** override (highest priority)
2. **Team-level** override
3. **Organization-level** override
4. **System default** (lowest priority)

## Using the useSettings Hook

### Single Setting

```typescript
import { useSettings } from '../../lib/settingsRegistry';

function MyComponent({ userId }: { userId: string }) {
  const { value, loading, error, update, reset } = useSettings(
    'user.theme',
    { userId },
    { scope: 'user', defaultValue: 'system' }
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Current theme: {value}</p>
      <button onClick={() => update('dark')}>Set Dark Theme</button>
      <button onClick={reset}>Reset to Default</button>
    </div>
  );
}
```

### Multiple Settings

```typescript
import { useSettingsGroup } from '../../lib/settingsRegistry';

function MyComponent({ userId }: { userId: string }) {
  const { values, loading, error, updateSetting, resetSetting } = useSettingsGroup(
    ['user.theme', 'user.language', 'user.timezone'],
    { userId },
    { scope: 'user' }
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Theme: {values['user.theme']}</p>
      <p>Language: {values['user.language']}</p>
      <p>Timezone: {values['user.timezone']}</p>
      
      <button onClick={() => updateSetting('user.theme', 'dark')}>
        Set Dark Theme
      </button>
    </div>
  );
}
```

## Component Examples

### User Settings Component

```typescript
import React from 'react';
import { useSettingsGroup } from '../../lib/settingsRegistry';
import { SettingsSection } from '../../components/Settings/SettingsSection';

interface UserSettingsProps {
  userId: string;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ userId }) => {
  const { values, loading, updateSetting } = useSettingsGroup(
    [
      'user.theme',
      'user.language',
      'user.timezone',
      'user.notifications.email',
      'user.notifications.push',
    ],
    { userId },
    { scope: 'user' }
  );

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Appearance">
        <select
          value={values['user.theme'] || 'system'}
          onChange={(e) => updateSetting('user.theme', e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <label>
          <input
            type="checkbox"
            checked={values['user.notifications.email'] ?? true}
            onChange={(e) =>
              updateSetting('user.notifications.email', e.target.checked)
            }
          />
          Email Notifications
        </label>
      </SettingsSection>
    </div>
  );
};
```

### Team Settings Component

```typescript
import React from 'react';
import { useSettingsGroup } from '../../lib/settingsRegistry';

interface TeamSettingsProps {
  teamId: string;
}

export const TeamSettings: React.FC<TeamSettingsProps> = ({ teamId }) => {
  const { values, loading, updateSetting } = useSettingsGroup(
    [
      'team.defaultRole',
      'team.allowGuestAccess',
      'team.requireApproval',
      'team.notifications.mentions',
    ],
    { teamId },
    { scope: 'team' }
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div>
        <label>Default Role for New Members</label>
        <select
          value={values['team.defaultRole'] || 'member'}
          onChange={(e) => updateSetting('team.defaultRole', e.target.value)}
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={values['team.allowGuestAccess'] ?? false}
            onChange={(e) =>
              updateSetting('team.allowGuestAccess', e.target.checked)
            }
          />
          Allow Guest Access
        </label>
      </div>
    </div>
  );
};
```

### Organization Settings Component

```typescript
import React from 'react';
import { useSettingsGroup } from '../../lib/settingsRegistry';

interface OrganizationSettingsProps {
  organizationId: string;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  organizationId,
}) => {
  const { values, loading, updateSetting } = useSettingsGroup(
    [
      'organization.currency',
      'organization.fiscalYearStart',
      'organization.security.mfaRequired',
      'organization.security.ssoRequired',
      'organization.security.sessionTimeout',
    ],
    { organizationId },
    { scope: 'organization' }
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <label>Currency</label>
        <select
          value={values['organization.currency'] || 'USD'}
          onChange={(e) => updateSetting('organization.currency', e.target.value)}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={values['organization.security.mfaRequired'] ?? false}
            onChange={(e) =>
              updateSetting('organization.security.mfaRequired', e.target.checked)
            }
          />
          Require MFA for all users
        </label>
      </div>

      <div>
        <label>Session Timeout (minutes)</label>
        <input
          type="number"
          value={values['organization.security.sessionTimeout'] || 480}
          onChange={(e) =>
            updateSetting(
              'organization.security.sessionTimeout',
              parseInt(e.target.value)
            )
          }
        />
      </div>
    </div>
  );
};
```

## Available Settings

### User-Level Settings

```typescript
// Appearance
'user.theme' // 'light' | 'dark' | 'system'
'user.language' // 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh'
'user.timezone' // IANA timezone string
'user.dateFormat' // 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MMM DD, YYYY'
'user.timeFormat' // '12h' | '24h'

// Notifications
'user.notifications.email' // boolean
'user.notifications.push' // boolean
'user.notifications.slack' // boolean
'user.notifications.inApp' // boolean

// Accessibility
'user.accessibility.highContrast' // boolean
'user.accessibility.fontSize' // 'small' | 'medium' | 'large' | 'extra-large'
'user.accessibility.reducedMotion' // boolean
```

### Team-Level Settings

```typescript
// Access Control
'team.defaultRole' // 'admin' | 'member' | 'guest'
'team.allowGuestAccess' // boolean
'team.requireApproval' // boolean

// Notifications
'team.notifications.mentions' // boolean
'team.notifications.updates' // boolean

// Workflow
'team.workflow.autoAssign' // boolean
'team.workflow.defaultPriority' // 'low' | 'medium' | 'high'
```

### Organization-Level Settings

```typescript
// General
'organization.currency' // 'USD' | 'EUR' | 'GBP' | etc.
'organization.fiscalYearStart' // 'MM-DD' format
'organization.workingDays' // ['mon', 'tue', 'wed', 'thu', 'fri']
'organization.workingHours.start' // 'HH:MM' format
'organization.workingHours.end' // 'HH:MM' format

// Security
'organization.security.mfaRequired' // boolean
'organization.security.ssoRequired' // boolean
'organization.security.sessionTimeout' // number (minutes)
'organization.security.passwordPolicy.minLength' // number
'organization.security.passwordPolicy.requireUppercase' // boolean
'organization.security.passwordPolicy.requireLowercase' // boolean
'organization.security.passwordPolicy.requireNumbers' // boolean
'organization.security.passwordPolicy.requireSymbols' // boolean

// Billing
'organization.billing.autoRenew' // boolean
'organization.billing.invoiceEmail' // string
```

## Database Schema Integration

### User Preferences

Stored in `users.user_preferences` JSONB column:

```sql
SELECT user_preferences FROM users WHERE id = 'user-id';

-- Example result:
{
  "theme": "dark",
  "language": "en",
  "timezone": "America/New_York",
  "notifications": {
    "email": true,
    "push": false
  }
}
```

### Team Settings

Stored in `teams.team_settings` JSONB column:

```sql
SELECT team_settings FROM teams WHERE id = 'team-id';

-- Example result:
{
  "defaultRole": "member",
  "allowGuestAccess": false,
  "notifications": {
    "mentions": true
  }
}
```

### Organization Settings

Stored in `organizations.organization_settings` JSONB column:

```sql
SELECT organization_settings FROM organizations WHERE id = 'org-id';

-- Example result:
{
  "currency": "USD",
  "security": {
    "mfaRequired": true,
    "sessionTimeout": 480
  }
}
```

## Validation and RLS

### Row Level Security

All settings tables have RLS enabled:

```sql
-- Users can only update their own preferences
CREATE POLICY "Users can update own preferences"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Team admins can update team settings
CREATE POLICY "Team admins can update team settings"
  ON teams FOR UPDATE
  TO authenticated
  USING (user_has_team_permission(auth.uid(), id, 'team.manage'))
  WITH CHECK (user_has_team_permission(auth.uid(), id, 'team.manage'));

-- Org admins can update org settings
CREATE POLICY "Org admins can update org settings"
  ON organizations FOR UPDATE
  TO authenticated
  USING (user_has_org_permission(auth.uid(), id, 'organization.manage'))
  WITH CHECK (user_has_org_permission(auth.uid(), id, 'organization.manage'));
```

### Validation

Implement validation in your components:

```typescript
function validateSetting(key: string, value: any): string | null {
  switch (key) {
    case 'user.theme':
      if (!['light', 'dark', 'system'].includes(value)) {
        return 'Invalid theme value';
      }
      break;

    case 'organization.security.sessionTimeout':
      if (typeof value !== 'number' || value < 5 || value > 1440) {
        return 'Session timeout must be between 5 and 1440 minutes';
      }
      break;

    case 'user.language':
      if (!['en', 'es', 'fr', 'de', 'ja', 'zh'].includes(value)) {
        return 'Invalid language code';
      }
      break;
  }

  return null;
}
```

## Caching

The SettingsRegistry includes built-in caching:

- **Cache TTL**: 5 minutes
- **Cache Key**: `${key}|user:${userId}|team:${teamId}|org:${orgId}`
- **Automatic Invalidation**: On update/delete

### Manual Cache Control

```typescript
import { settingsRegistry } from '../../lib/settingsRegistry';

// Clear all cache
settingsRegistry.clearCache();

// Cache is automatically invalidated on updates
await settingsRegistry.saveSetting('user.theme', 'dark', 'user', userId);
// Cache for this setting is now cleared
```

## Error Handling

```typescript
const { value, loading, error, update } = useSettings('user.theme', { userId });

if (error) {
  return (
    <div className="text-red-600">
      <p>Failed to load settings: {error.message}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}

// Handle update errors
async function handleUpdate(newValue: string) {
  try {
    await update(newValue);
    toast.success('Settings updated');
  } catch (err) {
    toast.error(`Failed to update: ${err.message}`);
  }
}
```

## Testing

### Unit Tests

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSettings } from './UserSettings';

test('loads and displays user settings', async () => {
  render(<UserSettings userId="user-123" />);

  await waitFor(() => {
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });
});

test('updates theme setting', async () => {
  const user = userEvent.setup();
  render(<UserSettings userId="user-123" />);

  const themeSelect = await screen.findByLabelText('Theme');
  await user.selectOptions(themeSelect, 'dark');

  await waitFor(() => {
    expect(themeSelect).toHaveValue('dark');
  });
});
```

### Integration Tests

```typescript
import { supabase } from '../../lib/supabase';
import { settingsRegistry } from '../../lib/settingsRegistry';

test('settings cascade works correctly', async () => {
  const userId = 'user-123';
  const teamId = 'team-456';
  const orgId = 'org-789';

  // Set org-level default
  await settingsRegistry.saveSetting(
    'user.theme',
    'light',
    'organization',
    orgId
  );

  // Set team-level override
  await settingsRegistry.saveSetting('user.theme', 'dark', 'team', teamId);

  // Load with cascade
  const value = await settingsRegistry.loadSetting('user.theme', {
    userId,
    teamId,
    organizationId: orgId,
  });

  // Should use team override
  expect(value).toBe('dark');
});
```

## Best Practices

1. **Always provide userId/teamId/organizationId** in context
2. **Use useSettingsGroup** for multiple related settings
3. **Implement loading states** for better UX
4. **Handle errors gracefully** with user-friendly messages
5. **Validate input** before calling update()
6. **Use appropriate scope** (user/team/organization)
7. **Provide default values** for optional settings
8. **Clear cache** when needed (rare)
9. **Test cascade behavior** thoroughly
10. **Document custom settings** in this file

## Migration from Old System

If migrating from an old settings system:

```typescript
// Old system
const theme = localStorage.getItem('theme');

// New system
const { value: theme } = useSettings('user.theme', { userId });

// Migration script
async function migrateSettings(userId: string) {
  const oldTheme = localStorage.getItem('theme');
  if (oldTheme) {
    await settingsRegistry.saveSetting('user.theme', oldTheme, 'user', userId);
    localStorage.removeItem('theme');
  }
}
```

## Troubleshooting

### Settings not loading

1. Check userId/teamId/organizationId is provided
2. Verify RLS policies allow access
3. Check database connection
4. Clear cache: `settingsRegistry.clearCache()`

### Settings not saving

1. Verify user has permission (RLS)
2. Check validation errors
3. Verify scope and scopeId are correct
4. Check database constraints

### Cache issues

1. Clear cache manually
2. Check cache TTL (5 minutes default)
3. Verify cache key generation

## References

- [Settings Registry](../../lib/settingsRegistry.ts)
- [Settings Service](../../services/SettingsService.ts)
- [Supabase Migration](../../../supabase/migrations/20251117151356_create_enterprise_saas_settings_schema.sql)
- [Settings Types](../../types/index.ts)
