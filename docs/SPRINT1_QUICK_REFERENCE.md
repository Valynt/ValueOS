# Sprint 1 Fixes - Quick Reference Card

**Print this and keep it handy while implementing!**

---

## The 4 Fixes (In Order)

### 1️⃣ Database Migration (5 min)
```bash
supabase db push
```
**File**: `supabase/migrations/20260105000001_add_settings_defaults.sql`

---

### 2️⃣ Scope Prefix Stripping (15 min)
**File**: `src/lib/settingsRegistry.ts`

**Add method** (after line ~510):
```typescript
private stripScopePrefix(key: string, scope: 'user' | 'team' | 'organization'): string {
  const prefixes = { user: 'user.', team: 'team.', organization: 'organization.' };
  const prefix = prefixes[scope];
  return key.startsWith(prefix) ? key.substring(prefix.length) : key;
}
```

**Update 3 methods**:
- `loadFromDatabase`: Add `const strippedKey = this.stripScopePrefix(key, scope);` before `getNestedValue`
- `saveSetting`: Add `const strippedKey = this.stripScopePrefix(key, scope);` before `setNestedValue`
- `deleteSetting`: Add `const strippedKey = this.stripScopePrefix(key, scope);` before `deleteNestedValue`

---

### 3️⃣ Functional State Update (5 min)
**File**: `src/lib/settingsRegistry.ts` (line ~890)

**Change**:
```typescript
// BEFORE
setValue(newValue);

// AFTER
setValue(prev => newValue);
```

**Also add** to imports (line 3):
```typescript
import { useEffect, useState, useMemo } from 'react';
```

---

### 4️⃣ Memoize Context (45 min)
**Files**: All settings components

**Pattern**:
```typescript
import { useMemo } from 'react';

// BEFORE
const { value } = useSettings('user.theme', { userId });

// AFTER
const context = useMemo(() => ({ userId }), [userId]);
const { value } = useSettings('user.theme', context);
```

**Apply to 7 components**:
- UserProfile.tsx
- UserSecurity.tsx
- TeamSettings.tsx
- TeamPermissions.tsx
- OrganizationGeneral.tsx
- OrganizationSecurity.tsx
- OrganizationBilling.tsx

---

## Verification (Quick)

```bash
# 1. Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM auth.users WHERE user_preferences IS NULL;"
# Should return 0

# 2. Check for redundant nesting
psql $DATABASE_URL -c "SELECT COUNT(*) FROM auth.users WHERE user_preferences ? 'user';"
# Should return 0

# 3. Run tests
npm test src/lib/__tests__/settingsRegistry.test.ts

# 4. Check React DevTools
# - No infinite re-renders
# - No console errors
```

---

## Common Mistakes

❌ **Don't**: Pass object literals directly
```typescript
useSettings('user.theme', { userId })  // ❌ WRONG
```

✅ **Do**: Memoize context
```typescript
const context = useMemo(() => ({ userId }), [userId]);
useSettings('user.theme', context)  // ✅ CORRECT
```

---

❌ **Don't**: Use ?? for booleans without DB defaults
```typescript
checked={values['user.notifications.email'] ?? true}  // ❌ WRONG
```

✅ **Do**: Use explicit checks
```typescript
checked={values['user.notifications.email'] === true}  // ✅ CORRECT
```

---

❌ **Don't**: Update on every keystroke
```typescript
onChange={(e) => updateSetting('timeout', parseInt(e.target.value))}  // ❌ WRONG
```

✅ **Do**: Debounce numeric inputs
```typescript
const [timeout, setTimeout] = useState(value);
useEffect(() => {
  const timer = setTimeout(() => updateSetting('timeout', timeout), 500);
  return () => clearTimeout(timer);
}, [timeout]);
```

---

## Rollback (Emergency)

```bash
# Code
cp src/lib/settingsRegistry.ts.backup src/lib/settingsRegistry.ts
git checkout HEAD -- src/views/Settings/

# Database
supabase db reset
```

---

## Success Criteria

✅ No stale state overwrites  
✅ No redundant nesting in DB  
✅ No NULL values in settings  
✅ No infinite re-renders  
✅ All tests passing

---

## Time Budget

- Database: 5 min
- settingsRegistry: 20 min
- Components: 45 min
- Testing: 30 min
- **Total: 1.5 hours**

---

## Help

- Detailed guide: `SPRINT1_FIXES.md`
- Examples: `src/views/Settings/COMPONENT_FIXES_EXAMPLES.tsx`
- Architecture: `TENANT_SETTINGS_REVIEW.md`
- Summary: `SPRINT1_IMPLEMENTATION_SUMMARY.md`

---

**Print Date**: January 5, 2026  
**Version**: 1.0
