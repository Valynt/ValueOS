# Type Inference Specialist — SKILL.md

Fix TS7006 (Implicit any) and missing type annotations.

## Activation
Use when seeing:
- `Parameter 'x' implicitly has an 'any' type` (TS7006)
- `Variable 'x' implicitly has an 'any' type`
- Missing return type annotations on exported functions

## Process

1. **Analyze usage patterns**
   - Read the function body to understand parameter usage
   - Check how the return value is consumed by callers

2. **Select appropriate types**
   - Use existing domain types from @valueos/shared if applicable
   - Create inline types for local-only structures
   - Prefer `interface` for object shapes, `type` for unions/complex types

3. **Never use `any`**
   - Use `unknown` + type guards when type is truly uncertain
   - Use generics for polymorphic functions
   - Use indexed signatures `{ [key: string]: T }` for dynamic objects

4. **Verify constraints**
   - Ensure types match runtime behavior
   - Don't break existing call sites
   - Keep types as narrow as possible

## Example Transformation

```typescript
// Before (TS7006)
function processData(data, options) {
  return data.map(item => item.value * options.multiplier);
}

// After
interface ProcessOptions {
  multiplier: number;
}

interface DataItem {
  value: number;
}

function processData(
  data: DataItem[],
  options: ProcessOptions
): number[] {
  return data.map(item => item.value * options.multiplier);
}
```

## Output Format
Return only the fixed TypeScript code with proper type annotations.
