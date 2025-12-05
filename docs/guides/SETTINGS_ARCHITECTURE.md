# Settings Architecture Documentation

## Overview

This document describes the comprehensive settings architecture built for the application. The system provides a scalable, user-friendly interface with advanced navigation, search capabilities, and permission-based access control.

## Architecture Components

### 1. Core Components

#### SettingsView (`src/views/Settings/SettingsView.tsx`)
The main entry point for the settings application. Wraps all settings content with the `SettingsProvider` and handles routing logic.

**Features:**
- Centralized routing based on current path
- Component lazy loading support
- Fallback handling for unknown routes

#### SettingsLayout (`src/components/Settings/SettingsLayout.tsx`)
Provides consistent structure across all settings pages.

**Features:**
- Persistent sidebar navigation (desktop)
- Mobile-responsive drawer navigation
- Integrated search bar
- Breadcrumb navigation
- Responsive design that adapts to screen size

#### SettingsSidebar (`src/components/Settings/SettingsSidebar.tsx`)
Three-level hierarchical navigation system with collapsible sections.

**Features:**
- Three-tier organization: User → Team → Organization
- Expandable/collapsible sections
- Active route highlighting
- Permission-based visibility
- Mobile-friendly with close functionality
- Visual role indicator at bottom

### 2. Navigation & Routing

#### SettingsRegistry (`src/lib/settingsRegistry.ts`)
Central registry managing all settings routes with advanced capabilities.

**Features:**
- Route registration and lookup
- Hierarchical path management
- Breadcrumb generation
- Permission-based filtering
- Search functionality with scoring algorithm

**Route Structure:**
```typescript
{
  id: 'unique-id',
  path: '/section/subsection',
  label: 'Display Name',
  description: 'Helpful description',
  tier: 'user' | 'team' | 'organization',
  permission?: 'permission.name',
  keywords?: ['searchable', 'terms'],
  children?: SettingsRoute[]
}
```

#### SettingsContext (`src/contexts/SettingsContext.tsx`)
React Context providing global state management for settings.

**Provides:**
- Current route tracking
- Navigation function
- Search query state
- User permissions
- Permission checking utility
- Breadcrumb data

**Usage:**
```typescript
const { currentRoute, navigateTo, hasPermission } = useSettings();
```

### 3. Search System

#### SettingsSearchBar (`src/components/Settings/SettingsSearchBar.tsx`)
Global search with keyboard shortcuts and instant results.

**Features:**
- Command+K (Ctrl+K) keyboard shortcut
- Fuzzy search across routes
- Real-time result filtering
- Keyboard navigation (↑↓ arrows, Enter)
- Permission-aware results
- Visual result highlighting
- ESC to close

**Search Algorithm:**
- Exact match: 100 points
- Starts with query: 50 points
- Contains query: 25 points
- Description match: 10 points
- Keyword match: 15 points

### 4. Reusable Components

#### SettingsSection (`src/components/Settings/SettingsSection.tsx`)
Standardized container for settings content.

**Props:**
- `title`: Section heading
- `description`: Optional help text
- `loading`: Shows loading spinner
- `actions`: Optional action buttons
- `children`: Section content

**Usage:**
```tsx
<SettingsSection
  title="Profile Information"
  description="Update your personal details"
  actions={<button>Save</button>}
>
  {/* Your content */}
</SettingsSection>
```

#### SettingsDangerZone (`src/components/Settings/SettingsDangerZone.tsx`)
Specialized component for destructive actions.

**Features:**
- Visual warning styling (red borders)
- Type-to-confirm safety mechanism
- Loading states during execution
- Cancel functionality
- Multiple actions support

**Usage:**
```tsx
<SettingsDangerZone
  actions={[
    {
      label: 'Delete Account',
      description: 'Permanently delete your account and all data',
      buttonText: 'Delete Account',
      confirmText: 'DELETE',
      onConfirm: async () => { /* deletion logic */ }
    }
  ]}
/>
```

#### SettingsBreadcrumb (`src/components/Settings/SettingsBreadcrumb.tsx`)
Shows current location in settings hierarchy.

**Features:**
- Auto-generated from current route
- Clickable navigation to parent sections
- Home icon for quick return
- Active page highlighting

## Permission System

### Permission Types

Defined in `src/types/index.ts`:

```typescript
type SettingsPermission =
  | 'organization.manage'
  | 'members.manage'
  | 'team.manage'
  | 'billing.manage'
  | 'api_keys.manage'
  | 'webhooks.manage'
  | 'integrations.manage'
  | 'security.manage'
  | 'audit.view'
  | 'billing.view'
  | 'team.view';
```

### How Permissions Work

1. **Route-Level Protection**
   - Each route can specify a required permission
   - Routes without permission are visible to all users

2. **Dynamic Filtering**
   - Sidebar automatically hides routes user can't access
   - Search results filtered by permissions
   - Empty sections are hidden

3. **Permission Checking**
   ```typescript
   const { hasPermission } = useSettings();

   if (hasPermission('members.manage')) {
     // Show admin-only content
   }
   ```

## Settings Tiers

### Tier 1: User Settings
**Path:** `/user/*`

Personal settings affecting only the current user.

**Sections:**
- Profile: Name, email, avatar, job title
- Security: Password, 2FA, active sessions
- Notifications: Email, push, in-app, Slack preferences
- Appearance: Theme, language, accessibility
- Authorized Apps: OAuth connections

### Tier 2: Team/Workspace Settings
**Path:** `/team/*`

Settings for specific workspaces/teams.

**Sections:**
- General: Workspace name and icon
- Members: Invite and manage team members
- Integrations: Team-specific app connections

**Required Permission:** `team.view` or higher

### Tier 3: Organization Settings
**Path:** `/organization/*`

Company-wide settings accessible to org admins.

**Sections:**
- General: Organization name, logo, branding
- Members & Access: User directory, roles, permissions
- Security: SSO, MFA enforcement, policies
- Audit Logs: Compliance and activity tracking
- Billing: Plans, invoices, payment methods
- Integrations: API keys, webhooks, org apps

**Required Permission:** Various org-level permissions

## Responsive Design

### Desktop (≥1024px)
- Persistent sidebar on left (288px width)
- Full search bar in header
- Breadcrumb navigation below search
- Main content area with max-width constraint

### Tablet (768px - 1023px)
- Collapsible sidebar as drawer
- Hamburger menu button
- Full-width content

### Mobile (<768px)
- Full-screen drawer navigation
- Compact search bar
- Simplified breadcrumbs
- Touch-optimized interactions

## Accessibility Features

### WCAG 2.1 AA Compliance

1. **Keyboard Navigation**
   - All interactive elements keyboard accessible
   - Command+K search shortcut
   - Arrow key navigation in search results
   - Tab navigation through forms

2. **Screen Reader Support**
   - Semantic HTML structure
   - ARIA labels on interactive elements
   - Descriptive link text
   - Form labels and descriptions

3. **Visual Accessibility**
   - High contrast text colors
   - Focus indicators on all interactive elements
   - Proper heading hierarchy
   - Sufficient color contrast ratios

4. **Motion & Animation**
   - Smooth transitions (respects prefers-reduced-motion)
   - No auto-playing animations
   - Loading spinners for async operations

## Hash-Based Routing

The system uses hash-based routing for client-side navigation:

**Format:** `#/settings/section/subsection`

**Examples:**
- `#/settings/user/profile`
- `#/settings/team/members`
- `#/settings/organization/security`

**Benefits:**
- No server configuration required
- Works with static file hosting
- Browser back/forward support
- Shareable URLs

**Implementation:**
```typescript
// Navigate programmatically
navigateTo('/user/profile');

// Updates window.location.hash
// Dispatches custom 'settings-navigate' event
```

## Adding New Settings Pages

### Step 1: Create the Component

```tsx
// src/views/Settings/MyNewSetting.tsx
import React from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';

export const MyNewSetting: React.FC = () => {
  return (
    <SettingsSection
      title="My New Setting"
      description="Description of what this setting does"
    >
      {/* Your content */}
    </SettingsSection>
  );
};
```

### Step 2: Register the Route

```typescript
// src/lib/settingsRegistry.ts
{
  id: 'my-new-setting',
  path: '/organization/my-setting',
  label: 'My Setting',
  description: 'Helpful description for search',
  tier: 'organization',
  permission: 'organization.manage',
  keywords: ['searchable', 'terms'],
  component: 'MyNewSetting',
}
```

### Step 3: Add to SettingsView

```typescript
// src/views/Settings/SettingsView.tsx
import { MyNewSetting } from './MyNewSetting';

// In renderContent():
case '/organization/my-setting':
  return <MyNewSetting />;
```

### Step 4: Test

1. Navigate to Settings
2. Search for your new setting
3. Verify it appears in sidebar
4. Test navigation
5. Verify permissions work correctly

## State Management

### Local State
Each settings page manages its own local state for:
- Form inputs
- Loading states
- Error states
- Validation

### Global State (via Context)
- Current route
- User permissions
- Search query
- Breadcrumb trail

### Form State Best Practices

```tsx
const [formData, setFormData] = useState({
  name: '',
  email: '',
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    await saveSettings(formData);
    // Show success message
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

## Performance Optimizations

1. **Code Splitting**
   - Settings pages loaded on-demand
   - Separate chunks for large sections

2. **Memoization**
   - Route filtering memoized
   - Search results cached

3. **Debouncing**
   - Search input debounced (handled by React state)
   - Form auto-save debounced (if implemented)

4. **Virtual Scrolling**
   - Large lists (audit logs, member directory) should use virtual scrolling
   - Pagination for 50+ items

## Security Considerations

1. **Permission Validation**
   - Always validate on backend
   - Frontend permissions for UX only
   - Never trust client-side permission checks

2. **Sensitive Data**
   - API keys shown with prefix only
   - Passwords never displayed
   - PII redacted in audit logs

3. **CSRF Protection**
   - Include CSRF tokens in forms
   - Verify tokens on backend

4. **Rate Limiting**
   - Limit settings update frequency
   - Prevent brute force on confirmations

## Testing Strategy

### Unit Tests
- Test SettingsRegistry search algorithm
- Test permission filtering logic
- Test route matching

### Integration Tests
- Test navigation flow
- Test search functionality
- Test permission-based visibility

### E2E Tests
- Test complete settings workflows
- Test mobile navigation
- Test keyboard shortcuts

## Future Enhancements

1. **Settings History**
   - Track changes to settings
   - Rollback capability
   - Audit trail integration

2. **Real-time Collaboration**
   - Show who's viewing same settings
   - Conflict resolution
   - Live updates

3. **Settings Import/Export**
   - Backup settings
   - Clone organization settings
   - Migrate between environments

4. **Advanced Search**
   - Filter by tier
   - Filter by permission level
   - Recent searches

5. **Keyboard Shortcuts**
   - Quick navigation between sections
   - Shortcut reference panel
   - Customizable shortcuts

## Troubleshooting

### Navigation not working
- Check window.location.hash is updating
- Verify route exists in registry
- Check permissions are set correctly

### Search not showing results
- Verify user has required permissions
- Check route keywords include search terms
- Confirm route is registered

### Sidebar not collapsing
- Check expandedSections state
- Verify section IDs match
- Test on mobile viewport

### Permission errors
- Validate permission strings match exactly
- Check user permissions are loaded
- Verify permission is required for route

## Support

For questions or issues with the settings architecture:
1. Check this documentation
2. Review component source code
3. Check TypeScript types for interfaces
4. Contact the development team

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0
