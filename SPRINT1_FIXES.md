# Sprint 1 Fixes - Implementation Guide

**Date**: January 5, 2026  
**Status**: Ready for Implementation

---

## Overview

This document provides the exact code changes needed to fix the 4 critical issues identified in the tenant settings review.

---

## Fix 1: Functional State Updates in useSettings Hook

**File**: `src/lib/settingsRegistry.ts`  
**Line**: ~890 (in `useSettings` hook, `update` function)

### Current Code (BROKEN):
```typescript
const update = async (newValue: T): Promise<void> => {
  try {
    setError(null);

    const scope = options.scope || inferScope(context);
    const scopeId = getScopeId(context, scope);

    if (!scopeId) {
      throw new Error(`No ${scope} ID provided in context`);
    }

    await settingsRegistry.saveSetting(key, newValue, scope, scopeId);
    setValue(newValue);  // ❌ STALE CLOSURE RISK
  } catch (err) {
    setError(err as Error);
    throw err;
  }
};
```

### Fixed Code:
```typescript
const update = async (newValue: T): Promise<void> => {
  try {
    setError(null);

    const scope = options.scope || inferScope(context);
    const scopeId = getScopeId(context, scope);

    if (!scopeId) {
      throw new Error(`No ${scope} ID provided in context`);
    }

    await settingsRegistry.saveSetting(key, newValue, scope, scopeId);
    
    // ✅ FIX: Use functional update to prevent stale closure
    setValue(prev => newValue);
  } catch (err) {
    setError(err as Error);
    throw err;
  }
};
```

**Note**: `useSettingsGroup` already uses functional updates correctly (`setValues(prev => ...)`), so no change needed there.

---

## Fix 2: Scope Prefix Stripping

**File**: `src/lib/settingsRegistry.ts`  
**Location**: Add new private method after `getColumnForScope`

### Add This Method:
```typescript
/**
 * Strip scope prefix from key (e.g., 'user.theme' -> 'theme')
 * Prevents redundant nesting in JSONB columns
 * 
 * Example:
 * - Input: 'user.theme', scope: 'user'
 * - Output: 'theme'
 * - Stored in DB: { "theme": "dark" } (not { "user": { "theme": "dark" } })
 */
private stripScopePrefix(key: string, scope: 'user' | 'team' | 'organization'): string {
  const prefixes = {
    user: 'user.',
    team: 'team.',
    organization: 'organization.',
  };
  
  const prefix = prefixes[scope];
  if (key.startsWith(prefix)) {
    return key.substring(prefix.length);
  }
  
  return key;
}
```

### Update `loadFromDatabase` Method:
**Line**: ~480

```typescript
private async loadFromDatabase(
  key: string,
  scope: 'user' | 'team' | 'organization',
  scopeId: string
): Promise<any> {
  const table = this.getTableForScope(scope);
  const column = this.getColumnForScope(scope);

  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq('id', scopeId)
    .single();

  if (error || !data) {
    return null;
  }

  const settings = data[column] || {};
  // ✅ FIX: Strip scope prefix before looking up in JSONB
  const strippedKey = this.stripScopePrefix(key, scope);
  return this.getNestedValue(settings, strippedKey);
}
```

### Update `saveSetting` Method:
**Line**: ~200

```typescript
async saveSetting(
  key: string,
  value: any,
  scope: 'user' | 'team' | 'organization',
  scopeId: string
): Promise<void> {
  const table = this.getTableForScope(scope);
  const column = this.getColumnForScope(scope);
  
  // ✅ FIX: Strip scope prefix to prevent redundant nesting
  const strippedKey = this.stripScopePrefix(key, scope);
  
  const { data: existing } = await supabase
    .from(table)
    .select(column)
    .eq('id', scopeId)
    .single();

  const settings = existing?.[column] || {};
  const updatedSettings = this.setNestedValue(settings, strippedKey, value);

  await supabase
    .from(table)
    .update({
      [column]: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scopeId);

  // ... rest of method
}
```

### Update `deleteSetting` Method:
**Line**: ~250

```typescript
async deleteSetting(
  key: string,
  scope: 'user' | 'team' | 'organization',
  scopeId: string
): Promise<void> {
  const table = this.getTableForScope(scope);
  const column = this.getColumnForScope(scope);
  
  // ✅ FIX: Strip scope prefix
  const strippedKey = this.stripScopePrefix(key, scope);

  const { data: existing } = await supabase
    .from(table)
    .select(column)
    .eq('id', scopeId)
    .single();

  const settings = existing?.[column] || {};
  const updatedSettings = this.deleteNestedValue(settings, strippedKey);

  await supabase
    .from(table)
    .update({
      [column]: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scopeId);

  // ... rest of method
}
```

---

## Fix 3: Add Explicit Database Defaults

**File**: `supabase/migrations/20251230013534_organization_configurations.sql`  
**Action**: Already has defaults, but verify user/team tables

### Check/Add to User Table Migration:
```sql
-- Ensure user_preferences has explicit default
ALTER TABLE users 
  ALTER COLUMN user_preferences 
  SET DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN users.user_preferences IS 
  'User-level settings with explicit defaults. Never null.';
```

### Check/Add to Team Table Migration:
```sql
-- Ensure team_settings has explicit default
ALTER TABLE teams 
  ALTER COLUMN team_settings 
  SET DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN teams.team_settings IS 
  'Team-level settings with explicit defaults. Never null.';
```

### Check/Add to Organization Table Migration:
```sql
-- Ensure organization_settings has explicit default
ALTER TABLE organizations 
  ALTER COLUMN organization_settings 
  SET DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN organizations.organization_settings IS 
  'Organization-level settings with explicit defaults. Never null.';
```

---

## Fix 4: Memoize Context Objects in Components

### Example: UserProfile Component

**File**: `src/views/Settings/UserProfile.tsx`

### Current Usage (BROKEN):
```typescript
export const UserProfile: React.FC = () => {
  const userId = useCurrentUserId(); // Assume this exists
  
  // ❌ BROKEN: { userId } creates new object on every render
  const { value, update } = useSettings('user.theme', { userId });
  
  // ...
};
```

### Fixed Usage:
```typescript
import { useMemo } from 'react';

export const UserProfile: React.FC = () => {
  const userId = useCurrentUserId();
  
  // ✅ FIX: Memoize context object
  const context = useMemo(() => ({ userId }), [userId]);
  const { value, update } = useSettings('user.theme', context);
  
  // ...
};
```

### Example: TeamSettings Component

**File**: `src/views/Settings/TeamSettings.tsx`

```typescript
import { useMemo } from 'react';

export const TeamSettings: React.FC<{ teamId: string }> = ({ teamId }) => {
  // ✅ FIX: Memoize context
  const context = useMemo(() => ({ teamId }), [teamId]);
  
  const { values, updateSetting } = useSettingsGroup(
    ['team.defaultRole', 'team.allowGuestAccess'],
    context,
    { scope: 'team' }
  );
  
  // ...
};
```

### Example: OrganizationSecurity Component

**File**: `src/views/Settings/OrganizationSecurity.tsx`

```typescript
import { useMemo } from 'react';

export const OrganizationSecurity: React.FC<{ organizationId: string }> = ({ 
  organizationId 
}) => {
  // ✅ FIX: Memoize context
  const context = useMemo(() => ({ organizationId }), [organizationId]);
  
  const { values, updateSetting } = useSettingsGroup(
    [
      'organization.security.mfaRequired',
      'organization.security.sessionTimeout',
    ],
    context,
    { scope: 'organization' }
  );
  
  // ...
};
```

---

## Verification Checklist

After applying fixes, verify:

- [ ] **Fix 1**: Run rapid checkbox clicks - no state overwrites
- [ ] **Fix 2**: Check database - no redundant nesting (e.g., `{ "user": { "theme": ... } }`)
- [ ] **Fix 3**: Check database - all JSONB columns default to `{}`, never `null`
- [ ] **Fix 4**: Check React DevTools - no infinite re-renders

---

## Testing Script

```typescript
// test/settings-fixes.test.ts

describe('Sprint 1 Fixes', () => {
  describe('Fix 1: Functional State Updates', () => {
    it('should handle rapid updates without stale state', async () => {
      const { result } = renderHook(() => 
        useSettings('user.theme', { userId: 'test-user' })
      );
      
      // Rapid updates
      await act(async () => {
        await result.current.update('dark');
        await result.current.update('light');
        await result.current.update('system');
      });
      
      expect(result.current.value).toBe('system');
    });
  });

  describe('Fix 2: Scope Prefix Stripping', () => {
    it('should strip scope prefix before saving to DB', async () => {
      await settingsRegistry.saveSetting(
        'user.theme',
        'dark',
        'user',
        'test-user'
      );
      
      const { data } = await supabase
        .from('users')
        .select('user_preferences')
        .eq('id', 'test-user')
        .single();
      
      // Should be { "theme": "dark" }, not { "user": { "theme": "dark" } }
      expect(data.user_preferences).toEqual({ theme: 'dark' });
      expect(data.user_preferences.user).toBeUndefined();
    });
  });

  describe('Fix 3: Explicit Defaults', () => {
    it('should never return null for JSONB columns', async () => {
      const { data } = await supabase
        .from('users')
        .insert({ email: 'test@example.com' })
        .select('user_preferences')
        .single();
      
      expect(data.user_preferences).toEqual({});
      expect(data.user_preferences).not.toBeNull();
    });
  });

  describe('Fix 4: Memoized Context', () => {
    it('should not cause infinite re-renders', () => {
      const renderCount = jest.fn();
      
      function TestComponent({ userId }: { userId: string }) {
        renderCount();
        const context = useMemo(() => ({ userId }), [userId]);
        useSettings('user.theme', context);
        return null;
      }
      
      const { rerender } = render(<TestComponent userId="test" />);
      
      // Should render once
      expect(renderCount).toHaveBeenCalledTimes(1);
      
      // Rerender with same userId
      rerender(<TestComponent userId="test" />);
      
      // Should not re-render (context is memoized)
      expect(renderCount).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

## Migration Script

If you have existing data with redundant nesting, run this migration:

```sql
-- Fix existing user_preferences with redundant nesting
UPDATE users
SET user_preferences = (
  CASE 
    WHEN user_preferences ? 'user' THEN user_preferences->'user'
    ELSE user_preferences
  END
)
WHERE user_preferences ? 'user';

-- Fix existing team_settings with redundant nesting
UPDATE teams
SET team_settings = (
  CASE 
    WHEN team_settings ? 'team' THEN team_settings->'team'
    ELSE team_settings
  END
)
WHERE team_settings ? 'team';

-- Fix existing organization_settings with redundant nesting
UPDATE organizations
SET organization_settings = (
  CASE 
    WHEN organization_settings ? 'organization' THEN organization_settings->'organization'
    ELSE organization_settings
  END
)
WHERE organization_settings ? 'organization';
```

---

## Rollout Plan

1. **Apply Fix 2 (Scope Prefix Stripping)** - Most critical, prevents data corruption
2. **Run Migration Script** - Clean up existing data
3. **Apply Fix 3 (Database Defaults)** - Prevents future null issues
4. **Apply Fix 1 (Functional Updates)** - Prevents race conditions
5. **Apply Fix 4 (Memoization)** - Prevents performance issues
6. **Run Tests** - Verify all fixes work
7. **Deploy to Staging** - Test in staging environment
8. **Deploy to Production** - Roll out to production

---

## Estimated Effort

- **Fix 1**: 15 minutes
- **Fix 2**: 30 minutes
- **Fix 3**: 15 minutes
- **Fix 4**: 45 minutes (multiple components)
- **Testing**: 1 hour
- **Total**: ~2.5 hours

---

## Success Criteria

✅ No stale state overwrites in rapid updates  
✅ No redundant nesting in JSONB columns  
✅ No null values in settings columns  
✅ No infinite re-renders in settings components  
✅ All tests passing  
✅ No performance degradation

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026
