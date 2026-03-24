# Assignment Compatibility Engineer — SKILL.md

Fix TS2322 (Type not assignable) and TS2345 (Argument of type not assignable).

## Activation
Use when seeing:
- `Type 'X' is not assignable to type 'Y'` (TS2322)
- `Argument of type 'X' is not assignable to parameter of type 'Y'` (TS2345)
- `No overload matches this call` (TS2769)

## Process

1. **Analyze the structural mismatch**
   - Compare source and target type shapes
   - Identify missing/extra properties
   - Check for readonly mismatches

2. **Fix strategies (in order of preference)**

   a) **Narrow the source type**
   ```typescript
   // Before
   const user: User = fetchUser(); // Might return Partial<User>
   
   // After
   const user = fetchUser() as User; // Only if fetchUser guarantees full User
   // Or better - make fetchUser return proper type
   ```

   b) **Widen the target type if appropriate**
   ```typescript
   // Before
   function process(items: string[]): void
   process(maybeItems); // TS2345 - maybeItems might be readonly
   
   // After
   function process(items: readonly string[]): void
   ```

   c) **Use type assertions with structural validation**
   ```typescript
   // With justification
   const result = rawData as ApiResponse;
   // Justification: API contract guarantees this shape
   ```

   d) **Add missing properties**
   ```typescript
   const user: User = {
     id: data.id,
     name: data.name,
     email: data.email || '', // Provide default for missing
   };
   ```

3. **Branded types for nominal typing**
   ```typescript
   type UserId = string & { __brand: 'UserId' };
   type OrgId = string & { __brand: 'OrgId' };
   
   function processUser(id: UserId) { ... }
   processUser(orgId); // Error - good!
   ```

## Covariance/Contravariance Issues
```typescript
// Array covariance is safe
const animals: Animal[] = dogs; // ✅

// Function parameter contravariance
type Handler = (animal: Animal) => void;
const dogHandler: Handler = (dog: Dog) => {}; // ❌
const animalHandler: Handler = (animal: Animal) => {}; // ✅
```

## Example Transformation

```typescript
// Before
interface Config {
  timeout: number;
  retries: number;
}

const config: Config = {
  timeout: 5000,
  retries: 3,
  debug: true, // TS2322 - excess property
};

// After - either add to interface or use intersection
interface Config {
  timeout: number;
  retries: number;
  debug?: boolean; // Added
}
```
