# Test All Sprint 1 Fixes

**Date**: January 5, 2026  
**Status**: Ready for Testing

---

## Pre-Test Checklist

- [x] Fix 1: Functional state updates applied
- [x] Fix 2: Scope prefix stripping applied
- [ ] Fix 3: Database migration run (manual step)
- [x] Fix 4: Context memoization applied (2 components)

---

## Test 1: Functional State Updates (Fix 1)

### Manual Test

1. Open any settings page with a checkbox
2. Rapidly click the checkbox 10 times
3. Verify final state matches last click

### Expected Result

✅ No state loss, checkbox reflects final click

### Automated Test

```typescript
// test/settings-functional-updates.test.ts
describe("Fix 1: Functional State Updates", () => {
  it("should handle rapid updates without stale state", async () => {
    const { result } = renderHook(() => useSettings("user.theme", { userId: "test-user" }));

    await act(async () => {
      await result.current.update("dark");
      await result.current.update("light");
      await result.current.update("system");
    });

    expect(result.current.value).toBe("system");
  });
});
```

---

## Test 2: Scope Prefix Stripping (Fix 2)

### Database Verification

```sql
-- After saving a setting, check database structure
SELECT
  id,
  user_preferences
FROM auth.users
WHERE id = 'test-user-id'
LIMIT 1;

-- Expected: { "theme": "dark", "notifications": { "email": true } }
-- NOT: { "user": { "theme": "dark", "notifications": { "email": true } } }
```

### Automated Test

```typescript
describe("Fix 2: Scope Prefix Stripping", () => {
  it("should strip scope prefix before saving to DB", async () => {
    await settingsRegistry.saveSetting("user.theme", "dark", "user", "test-user");

    const { data } = await supabase
      .from("users")
      .select("user_preferences")
      .eq("id", "test-user")
      .single();

    // Should be { "theme": "dark" }, not { "user": { "theme": "dark" } }
    expect(data.user_preferences).toEqual({ theme: "dark" });
    expect(data.user_preferences.user).toBeUndefined();
  });
});
```

---

## Test 3: Database Defaults (Fix 3)

### Prerequisites

```bash
# Run migration first
supabase db push
# OR
psql $DATABASE_URL -f supabase/migrations/20260105000001_add_settings_defaults.sql
```

### Verification Queries

```sql
-- 1. Check for NULL values (should return 0)
SELECT COUNT(*) as null_count
FROM auth.users
WHERE user_preferences IS NULL;

-- 2. Check for redundant nesting (should return 0)
SELECT COUNT(*) as nested_count
FROM auth.users
WHERE user_preferences ? 'user';

-- 3. Check structure (should show direct keys)
SELECT
  id,
  user_preferences->'theme' as theme,
  user_preferences->'notifications' as notifications
FROM auth.users
LIMIT 5;
```

### Automated Test

```typescript
describe("Fix 3: Explicit Defaults", () => {
  it("should never return null for JSONB columns", async () => {
    const { data } = await supabase
      .from("users")
      .insert({ email: "test@example.com" })
      .select("user_preferences")
      .single();

    expect(data.user_preferences).toEqual({});
    expect(data.user_preferences).not.toBeNull();
  });
});
```

---

## Test 4: Context Memoization (Fix 4)

### Manual Test

1. Open React DevTools
2. Navigate to a settings page
3. Check "Renders" count
4. Change a setting
5. Verify renders don't spike

### Expected Result

✅ No infinite re-renders  
✅ Renders only when userId changes or setting updates

### Automated Test

```typescript
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
```

---

## Integration Test: All Fixes Together

```typescript
describe("Sprint 1 Fixes Integration", () => {
  it("should work together correctly", async () => {
    // Setup
    const userId = "integration-test-user";
    const context = useMemo(() => ({ userId }), [userId]);

    // Test Fix 1 + Fix 2: Save with functional update and prefix stripping
    const { result } = renderHook(() => useSettings("user.theme", context));

    await act(async () => {
      await result.current.update("dark");
    });

    // Verify Fix 2: No redundant nesting
    const { data } = await supabase
      .from("users")
      .select("user_preferences")
      .eq("id", userId)
      .single();

    expect(data.user_preferences.theme).toBe("dark");
    expect(data.user_preferences.user).toBeUndefined();

    // Verify Fix 3: No null values
    expect(data.user_preferences).not.toBeNull();

    // Verify Fix 4: No infinite renders (implicit in test passing)
  });
});
```

---

## Performance Test

```typescript
describe("Performance", () => {
  it("should complete settings update in < 100ms", async () => {
    const start = performance.now();

    await settingsRegistry.saveSetting("user.theme", "dark", "user", "perf-test-user");

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it("should handle 100 rapid updates without errors", async () => {
    const { result } = renderHook(() => useSettings("user.theme", { userId: "stress-test" }));

    const updates = Array.from({ length: 100 }, (_, i) =>
      result.current.update(i % 2 === 0 ? "dark" : "light")
    );

    await expect(Promise.all(updates)).resolves.not.toThrow();
  });
});
```

---

## Manual Testing Checklist

### Settings Pages to Test

- [ ] User Profile
- [ ] User Security
- [ ] User Appearance ✅ (memoization applied)
- [ ] User Notifications ✅ (memoization applied)
- [ ] Team Settings
- [ ] Team Permissions
- [ ] Organization General
- [ ] Organization Security
- [ ] Organization Billing

### Test Scenarios

- [ ] Rapid checkbox clicks (10+ times)
- [ ] Change dropdown values quickly
- [ ] Type in numeric inputs (session timeout)
- [ ] Upload and remove avatar
- [ ] Toggle multiple settings in sequence
- [ ] Navigate between settings pages
- [ ] Refresh page and verify persistence

---

## Success Criteria

✅ **Fix 1**: No stale state overwrites  
✅ **Fix 2**: No redundant nesting in database  
✅ **Fix 3**: No NULL values in settings columns  
✅ **Fix 4**: No infinite re-renders  
✅ **Performance**: Settings update in < 100ms  
✅ **Stability**: No console errors or warnings

---

## Run All Tests

```bash
# Unit tests
npm test src/lib/__tests__/settingsRegistry.test.ts

# Integration tests
npm test src/views/Settings/__tests__/

# E2E tests
npm run test:e2e -- --grep "settings"

# Performance tests
npm run test:perf
```

---

## Rollback Plan

If any test fails:

```bash
# Rollback code
git checkout HEAD -- src/lib/settingsRegistry.ts
git checkout HEAD -- src/views/Settings/

# Rollback database
supabase db reset
```

---

## Test Results Template

```markdown
## Test Results - Sprint 1 Fixes

**Date**: YYYY-MM-DD  
**Tester**: [Name]  
**Environment**: [Dev/Staging/Prod]

### Fix 1: Functional State Updates

- [ ] Manual test passed
- [ ] Automated test passed
- [ ] Notes: ****\_\_\_****

### Fix 2: Scope Prefix Stripping

- [ ] Database verification passed
- [ ] Automated test passed
- [ ] Notes: ****\_\_\_****

### Fix 3: Database Defaults

- [ ] Migration executed successfully
- [ ] Verification queries passed
- [ ] Automated test passed
- [ ] Notes: ****\_\_\_****

### Fix 4: Context Memoization

- [ ] Manual test passed (no infinite renders)
- [ ] Automated test passed
- [ ] Notes: ****\_\_\_****

### Integration Tests

- [ ] All integration tests passed
- [ ] Performance tests passed
- [ ] Notes: ****\_\_\_****

### Overall Status

- [ ] ✅ All tests passed - Ready for deployment
- [ ] ⚠️ Some tests failed - See notes
- [ ] ❌ Critical failures - Rollback required

**Recommendation**: ****\_\_\_****
```

---

**Status**: Ready for Testing  
**Next Step**: Run tests and verify all fixes work correctly
