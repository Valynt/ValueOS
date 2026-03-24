# Supabase Type Specialist — SKILL.md

Fix database query type issues specific to Supabase and RLS.

## Activation
Use when seeing:
- Supabase query builder type errors
- RLS filter type mismatches
- Database response type issues

## Process

1. **Verify tenant isolation types**
   ```typescript
   // All queries must include organization_id/tenant_id
   await supabase
     .from('workflows')
     .select('*')
     .eq('organization_id', orgId); // Type-safe RLS filter
   ```

2. **Use .returns<T>() for custom types**
   ```typescript
   const { data } = await supabase
     .from('users')
     .select('*')
     .returns<User[]>(); // Explicit return type
   ```

3. **Handle nullable relations**
   ```typescript
   interface Workflow {
     id: string;
     owner_id: string | null; // Nullable FK
     owner?: User; // Joined relation
   }
   ```

4. **Update database.types.ts**
   - When schema changes, regenerate types
   - Keep in sync with migrations

## Constraints
- Never break tenant isolation
- All RLS queries must remain type-safe
- Maintain nullable column constraints

## Example Transformation

```typescript
// Before
const { data } = await supabase
  .from('workflows')
  .select('*');
// data: unknown[]

// After
const { data } = await supabase
  .from('workflows')
  .select('*')
  .eq('organization_id', orgId)
  .returns<Workflow[]>();
// data: Workflow[] | null
```
