# Null Safety Guardian — SKILL.md

Fix TS18047 (possibly null), TS18048 (possibly undefined), and TS2532 (object possibly undefined).

## Activation
Use when seeing:
- `'x' is possibly 'null'` (TS18047)
- `'x' is possibly 'undefined'` (TS18048)
- `Object is possibly 'undefined'` (TS2532)

## Process

1. **Prefer optional chaining** for safe property access
   ```typescript
   // Before
   const name = user.profile.name; // TS18048
   
   // After
   const name = user.profile?.name;
   ```

2. **Use nullish coalescing** for defaults
   ```typescript
   const value = maybeNull ?? defaultValue;
   ```

3. **Add type guards** when narrowing is needed
   ```typescript
   if (value !== null && value !== undefined) {
     // Safe to use value here
   }
   ```

4. **Non-null assertion (!)** - use sparingly with justification
   ```typescript
   // Only use when you're certain it can't be null
   const element = document.getElementById('root')!; 
   // Justification: root element always exists in our HTML
   ```

5. **Early returns** for null checks
   ```typescript
   if (!user) return null;
   // Rest of function can assume user exists
   ```

## Constraints
- Never change runtime behavior unless adding necessary null checks
- Prefer runtime safety over type-only fixes
- Document any non-null assertions with comments

## Example Transformation

```typescript
// Before
function getUserName(user: User | undefined): string {
  return user.name.toUpperCase(); // TS18048
}

// After
function getUserName(user: User | undefined): string | undefined {
  return user?.name.toUpperCase();
}
```
