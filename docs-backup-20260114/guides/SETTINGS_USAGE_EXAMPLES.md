# Settings Architecture - Usage Examples

## Quick Start

### Accessing Settings

From the main application sidebar, click the "Settings" button to open the settings panel.

### Keyboard Shortcuts

- **⌘K (Mac) / Ctrl+K (Windows)**: Open settings search
- **↑↓ Arrow Keys**: Navigate search results
- **Enter**: Select search result
- **ESC**: Close search modal

## Common Use Cases

### Example 1: Creating a New Settings Page

```tsx
// 1. Create the component file
// src/views/Settings/TeamBillingSettings.tsx

import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { CreditCard } from 'lucide-react';

export const TeamBillingSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Payment Method"
        description="Manage your team's payment information"
      >
        <div className="flex items-center space-x-4">
          <CreditCard className="h-8 w-8 text-gray-400" />
          <div>
            <p className="font-medium">Visa ending in 4242</p>
            <p className="text-sm text-gray-600">Expires 12/2025</p>
          </div>
          <button className="ml-auto px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Update
          </button>
        </div>
      </SettingsSection>
    </div>
  );
};
```

```typescript
// 2. Register the route
// src/lib/settingsRegistry.ts (add to teams children array)

{
  id: 'team-billing',
  path: '/billing',
  label: 'Billing',
  description: 'Manage payment methods and invoices',
  tier: 'team',
  permission: 'billing.manage',
  keywords: ['payment', 'credit card', 'invoice', 'subscription'],
  component: 'TeamBillingSettings',
}
```

```typescript
// 3. Add to SettingsView router
// src/views/Settings/SettingsView.tsx

import { TeamBillingSettings } from './TeamBillingSettings';

// In renderContent():
case '/team/billing':
  return <TeamBillingSettings />;
```

### Example 2: Using the Danger Zone Component

```tsx
import React from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { SettingsDangerZone } from '../../components/Settings/SettingsDangerZone';

export const AccountSettings: React.FC = () => {
  const handleDeleteAccount = async () => {
    try {
      await fetch('/api/account/delete', { method: 'DELETE' });
      // Redirect to goodbye page
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleResetData = async () => {
    await fetch('/api/account/reset', { method: 'POST' });
    // Show success message
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Account Settings"
        description="Manage your account preferences"
      >
        {/* Regular settings */}
      </SettingsSection>

      <SettingsDangerZone
        actions={[
          {
            label: 'Reset All Data',
            description: 'Clear all your cases, templates, and settings. This cannot be undone.',
            buttonText: 'Reset Data',
            confirmText: 'RESET',
            onConfirm: handleResetData,
          },
          {
            label: 'Delete Account',
            description: 'Permanently delete your account and all associated data. This action is irreversible.',
            buttonText: 'Delete Account',
            confirmText: 'DELETE',
            onConfirm: handleDeleteAccount,
          },
        ]}
      />
    </div>
  );
};
```

### Example 3: Form with Validation and Auto-Save

```tsx
import React, { useState, useEffect } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { Save, Check } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: 'John Doe',
    jobTitle: 'Product Manager',
    bio: '',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isDirty) {
        handleAutoSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, isDirty]);

  const handleAutoSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      setSaved(true);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaved(false);
  };

  return (
    <SettingsSection
      title="Profile Information"
      actions={
        <div className="flex items-center space-x-2 text-sm">
          {saving && (
            <>
              <Save className="h-4 w-4 text-gray-500 animate-pulse" />
              <span className="text-gray-600">Saving...</span>
            </>
          )}
          {saved && (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Title
          </label>
          <input
            type="text"
            value={formData.jobTitle}
            onChange={(e) => handleChange('jobTitle', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </SettingsSection>
  );
};
```

### Example 4: Permission-Based Content

```tsx
import React from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { useSettings } from '../../contexts/SettingsContext';
import { Shield, Lock } from 'lucide-react';

export const OrganizationSecurity: React.FC = () => {
  const { hasPermission } = useSettings();

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Single Sign-On (SSO)"
        description="Configure SAML or OIDC authentication for your organization"
      >
        {hasPermission('security.manage') ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">SSO is enabled</p>
                  <p className="text-sm text-gray-600">Using Okta SAML 2.0</p>
                </div>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Configure
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <Lock className="h-5 w-5 text-gray-400" />
            <p className="text-sm text-gray-600">
              You don't have permission to manage SSO settings. Contact your organization admin.
            </p>
          </div>
        )}
      </SettingsSection>

      {hasPermission('security.manage') && (
        <SettingsSection
          title="Password Policy"
          description="Set organization-wide password requirements"
        >
          {/* Password policy settings */}
        </SettingsSection>
      )}
    </div>
  );
};
```

### Example 5: Programmatic Navigation

```tsx
import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { ArrowRight } from 'lucide-react';

export const QuickLinks: React.FC = () => {
  const { navigateTo } = useSettings();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button
        onClick={() => navigateTo('/user/security')}
        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <p className="font-medium text-gray-900">Account Security</p>
          <p className="text-sm text-gray-600">Update password and 2FA</p>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400" />
      </button>

      <button
        onClick={() => navigateTo('/organization/billing')}
        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <p className="font-medium text-gray-900">Billing</p>
          <p className="text-sm text-gray-600">Manage subscription</p>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400" />
      </button>
    </div>
  );
};
```

### Example 6: Loading States

```tsx
import React, { useState, useEffect } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';

export const DataSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsSection
      title="Data Settings"
      description="Configure data retention and export options"
      loading={loading}
    >
      {data && (
        <div className="space-y-4">
          {/* Your settings content */}
        </div>
      )}
    </SettingsSection>
  );
};
```

### Example 7: Custom Permission Check

```tsx
import { useSettings } from '../../contexts/SettingsContext';

export const useCanManageTeam = (): boolean => {
  const { hasPermission } = useSettings();
  return hasPermission('team.manage');
};

// Usage in component
export const TeamSettings: React.FC = () => {
  const canManage = useCanManageTeam();

  return (
    <div>
      {canManage ? (
        <button>Add Member</button>
      ) : (
        <p>View only mode</p>
      )}
    </div>
  );
};
```

### Example 8: Custom Search Keywords

When registering a route, use comprehensive keywords to improve searchability:

```typescript
{
  id: 'user-notifications',
  path: '/notifications',
  label: 'Notifications',
  description: 'Control your notification preferences',
  tier: 'user',
  keywords: [
    // Core terms
    'notifications',
    'alerts',
    'preferences',

    // Channel types
    'email',
    'push',
    'slack',
    'in-app',

    // Actions
    'mute',
    'unmute',
    'enable',
    'disable',

    // Use cases
    'spam',
    'digest',
    'summary',
    'mentions',
    'comments',
  ],
  component: 'UserNotifications',
}
```

## Testing Examples

### Unit Test Example

```typescript
import { settingsRegistry } from '../lib/settingsRegistry';

describe('SettingsRegistry', () => {
  it('should find routes by search query', () => {
    const results = settingsRegistry.search('password', ['team.view']);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].route.path).toContain('security');
  });

  it('should filter by permissions', () => {
    const routes = settingsRegistry.filterByPermission(
      settingsRegistry.getAllRoutes(),
      ['team.view']
    );
    const hasOrgSettings = routes.some(r => r.id === 'organization');
    expect(hasOrgSettings).toBe(false);
  });
});
```

### Integration Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsView } from '../views/Settings/SettingsView';

describe('Settings Navigation', () => {
  it('should navigate to user profile', () => {
    render(<SettingsView />);

    const profileLink = screen.getByText('Profile');
    fireEvent.click(profileLink);

    expect(screen.getByText('Profile Information')).toBeInTheDocument();
  });

  it('should open search with Command+K', () => {
    render(<SettingsView />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByPlaceholderText('Search settings...')).toBeInTheDocument();
  });
});
```

## Best Practices

### 1. Always Use SettingsSection

✅ **Good:**
```tsx
<SettingsSection title="API Keys">
  {/* content */}
</SettingsSection>
```

❌ **Bad:**
```tsx
<div className="bg-white rounded-lg p-6">
  <h3>API Keys</h3>
  {/* content */}
</div>
```

### 2. Include Helpful Descriptions

✅ **Good:**
```tsx
<SettingsSection
  title="Session Timeout"
  description="Set how long users can remain idle before being logged out"
>
```

❌ **Bad:**
```tsx
<SettingsSection title="Session Timeout">
```

### 3. Use Appropriate Permission Levels

✅ **Good:** Only require specific permission needed
```typescript
permission: 'billing.view'
```

❌ **Bad:** Over-permission
```typescript
permission: 'organization.manage'
```

### 4. Provide Comprehensive Keywords

✅ **Good:**
```typescript
keywords: ['password', 'login', 'security', 'authentication', '2fa', 'mfa']
```

❌ **Bad:**
```typescript
keywords: ['password']
```

## Troubleshooting Common Issues

### Issue: Route not appearing in sidebar
**Solution:** Check that user has required permission and route is registered in settingsRegistry.

### Issue: Search not finding setting
**Solution:** Add more keywords to route registration, including synonyms and common misspellings.

### Issue: Navigation not updating URL
**Solution:** Use `navigateTo()` from context instead of manual hash manipulation.

### Issue: Permission check always fails
**Solution:** Ensure permission string exactly matches the SettingsPermission type definition.

---

For more information, see [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)
