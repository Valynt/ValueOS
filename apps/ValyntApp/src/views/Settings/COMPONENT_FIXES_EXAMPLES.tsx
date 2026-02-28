/**
 * Sprint 1 Fix #4: Component Memoization Examples
 * 
 * This file shows how to properly memoize context objects
 * to prevent infinite re-renders in settings components.
 * 
 * Apply these patterns to ALL components using useSettings or useSettingsGroup
 */

import React, { useMemo } from 'react';

import { useSettings, useSettingsGroup } from '../../lib/settingsRegistry';

// ============================================================================
// Example 1: UserProfile Component
// ============================================================================

interface UserProfileProps {
  userId: string;
}

export const UserProfileFixed: React.FC<UserProfileProps> = ({ userId }) => {
  // ✅ FIX: Memoize context object
  const context = useMemo(() => ({ userId }), [userId]);
  
  const { value: theme, update: updateTheme } = useSettings(
    'user.theme',
    context,
    { scope: 'user', defaultValue: 'system' }
  );

  return (
    <div>
      <select value={theme || 'system'} onChange={(e) => updateTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
};

// ============================================================================
// Example 2: TeamSettings Component
// ============================================================================

interface TeamSettingsProps {
  teamId: string;
}

export const TeamSettingsFixed: React.FC<TeamSettingsProps> = ({ teamId }) => {
  // ✅ FIX: Memoize context object
  const context = useMemo(() => ({ teamId }), [teamId]);
  
  const { values, updateSetting } = useSettingsGroup(
    [
      'team.defaultRole',
      'team.allowGuestAccess',
      'team.requireApproval',
      'team.notifications.mentions',
    ],
    context,
    { scope: 'team' }
  );

  return (
    <div>
      <label>
        <input
          type="checkbox"
          // ✅ FIX: Use explicit false default instead of ?? false
          checked={values['team.allowGuestAccess'] === true}
          onChange={(e) => updateSetting('team.allowGuestAccess', e.target.checked)}
        />
        Allow Guest Access
      </label>
    </div>
  );
};

// ============================================================================
// Example 3: OrganizationSecurity Component
// ============================================================================

interface OrganizationSecurityProps {
  organizationId: string;
}

export const OrganizationSecurityFixed: React.FC<OrganizationSecurityProps> = ({
  organizationId,
}) => {
  // ✅ FIX: Memoize context object
  const context = useMemo(() => ({ organizationId }), [organizationId]);
  
  const { values, updateSetting } = useSettingsGroup(
    [
      'organization.security.mfaRequired',
      'organization.security.ssoRequired',
      'organization.security.sessionTimeout',
    ],
    context,
    { scope: 'organization' }
  );

  // ✅ FIX: Add debouncing for numeric inputs
  const [sessionTimeout, setSessionTimeout] = React.useState(
    values['organization.security.sessionTimeout'] || 60
  );

  React.useEffect(() => {
    setSessionTimeout(values['organization.security.sessionTimeout'] || 60);
  }, [values]);

  // Debounce the update
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (sessionTimeout !== values['organization.security.sessionTimeout']) {
        updateSetting('organization.security.sessionTimeout', sessionTimeout);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [sessionTimeout, values, updateSetting]);

  return (
    <div>
      <label>
        <input
          type="checkbox"
          // ✅ FIX: Explicit boolean check
          checked={values['organization.security.mfaRequired'] === true}
          onChange={(e) =>
            updateSetting('organization.security.mfaRequired', e.target.checked)
          }
        />
        Require MFA for all users
      </label>

      <label>
        Session Timeout (minutes)
        <input
          type="number"
          value={sessionTimeout}
          onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 60)}
          min={5}
          max={1440}
        />
      </label>
    </div>
  );
};

// ============================================================================
// Example 4: Multi-Context Component (User + Organization)
// ============================================================================

interface UserOrgSettingsProps {
  userId: string;
  organizationId: string;
}

export const UserOrgSettingsFixed: React.FC<UserOrgSettingsProps> = ({
  userId,
  organizationId,
}) => {
  // ✅ FIX: Memoize both contexts separately
  const userContext = useMemo(() => ({ userId }), [userId]);
  const orgContext = useMemo(() => ({ organizationId }), [organizationId]);
  
  const { value: userTheme } = useSettings('user.theme', userContext, {
    scope: 'user',
  });
  
  const { value: orgMfaRequired } = useSettings(
    'organization.security.mfaRequired',
    orgContext,
    { scope: 'organization' }
  );

  return (
    <div>
      <p>Your theme: {userTheme}</p>
      <p>Organization requires MFA: {orgMfaRequired ? 'Yes' : 'No'}</p>
    </div>
  );
};

// ============================================================================
// Example 5: Component with Dynamic Context
// ============================================================================

interface DynamicSettingsProps {
  userId?: string;
  teamId?: string;
  organizationId?: string;
}

export const DynamicSettingsFixed: React.FC<DynamicSettingsProps> = ({
  userId,
  teamId,
  organizationId,
}) => {
  // ✅ FIX: Memoize context with all possible IDs
  const context = useMemo(
    () => ({
      userId,
      teamId,
      organizationId,
    }),
    [userId, teamId, organizationId]
  );
  
  const { value: theme } = useSettings('user.theme', context);

  return <div>Theme: {theme}</div>;
};

// ============================================================================
// Anti-Pattern Examples (DO NOT USE)
// ============================================================================

// ❌ WRONG: Creating new object on every render
export const BadExample1: React.FC<{ userId: string }> = ({ userId }) => {
  // This creates a new object on EVERY render, causing infinite loop
  const { value } = useSettings('user.theme', { userId });
  return <div>{value}</div>;
};

// ❌ WRONG: Using ?? with booleans
export const BadExample2: React.FC<{ userId: string }> = ({ userId }) => {
  const context = useMemo(() => ({ userId }), [userId]);
  const { values } = useSettingsGroup(['user.notifications.email'], context);
  
  // If DB returns null, this shows checked, but saving false creates mismatch
  return (
    <input
      type="checkbox"
      checked={values['user.notifications.email'] ?? true}
      onChange={() => {}}
    />
  );
};

// ❌ WRONG: No debouncing on numeric input
export const BadExample3: React.FC<{ orgId: string }> = ({ orgId }) => {
  const context = useMemo(() => ({ organizationId: orgId }), [orgId]);
  const { values, updateSetting } = useSettingsGroup(
    ['organization.security.sessionTimeout'],
    context
  );
  
  // This hits the database on EVERY keystroke
  return (
    <input
      type="number"
      value={values['organization.security.sessionTimeout'] || 60}
      onChange={(e) =>
        updateSetting('organization.security.sessionTimeout', parseInt(e.target.value))
      }
    />
  );
};

// ============================================================================
// Correct Pattern Summary
// ============================================================================

/**
 * ALWAYS:
 * 1. Import useMemo from 'react'
 * 2. Memoize context objects: useMemo(() => ({ userId }), [userId])
 * 3. Use explicit boolean checks: value === true (not value ?? true)
 * 4. Debounce numeric inputs with setTimeout
 * 5. Use functional state updates in hooks: setValue(prev => newValue)
 * 
 * NEVER:
 * 1. Pass object literals directly: { userId } ❌
 * 2. Use ?? for boolean defaults without DB defaults ❌
 * 3. Update on every keystroke for numeric inputs ❌
 * 4. Use non-functional state updates: setValue(newValue) ❌
 */

export {};
