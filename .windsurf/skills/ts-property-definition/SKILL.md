# Property Definition Architect — SKILL.md

Fix TS2339 (Property does not exist on type).

## Activation
Use when seeing:
- `Property 'x' does not exist on type 'Y'` (TS2339)
- `Property 'x' does not exist on type 'never'`

## Root Causes & Solutions

### 1. Missing property in interface
```typescript
// Add to interface definition
interface User {
  id: string;
  name: string;
  email: string;
  // Add missing property
  profileImage?: string;
}
```

### 2. Type narrowing exhausted to `never`
```typescript
// Before - causes TS2339 on 'never'
if (typeof value === 'string') {
  // handle string
} else if (typeof value === 'number') {
  // handle number
} else {
  value.someProp; // Error: 'never'
}

// After - add exhaustive check or unknown fallback
if (typeof value === 'string') {
  // handle string
} else if (typeof value === 'number') {
  // handle number
} else {
  // Exhaustive check or handle unexpected
  const _exhaustive: never = value;
  throw new Error(`Unexpected type: ${value}`);
}
```

### 3. Dynamic property access
```typescript
// Before
const value = obj[key]; // TS2339 if key not in obj type

// After - use indexed signature or Record
interface ConfigMap {
  [key: string]: string;
}
// or
const value = (obj as Record<string, unknown>)[key];
```

### 4. API type drift
```typescript
// Update types to match actual API response
// Check network tab or API documentation
```

## Cross-Boundary Changes
If the type is defined in @valueos/shared:
1. Update the shared type definition first
2. Run typecheck on dependent packages
3. Update all usages in dependent packages

## Example Transformation

```typescript
// Before
interface ApiResponse {
  data: unknown;
}

const id = response.userId; // TS2339

// After
interface ApiResponse {
  data: unknown;
  userId: string; // Added missing property
}

const id = response.userId; // ✅
```
