---
name: any-cast-fixer
description: Detect and fix TypeScript 'any' casts to improve type safety. Use to address technical debt and reduce bug potential by replacing unsafe type assertions with proper typing.
license: MIT
compatibility: TypeScript projects
metadata:
  author: ValueOS
  version: "1.0"
  generatedBy: "1.2.0"
---

# Any Cast Fixer Skill

Detects and fixes TypeScript `any` casts to improve type safety, addressing technical debt and reducing bug potential by replacing unsafe type assertions with proper typing.

## When to Use

- Addressing TypeScript technical debt burn-down
- Improving code quality and type safety
- Preparing for TypeScript strict mode migration
- Reducing bug potential from unsafe type assertions
- Code review and quality assurance
- Before major refactoring or feature development

## Input

- **scanPath**: File path or directory to scan (default: current directory)
- **fixMode**: Auto-fix mode (--fix flag)
- **strictMode**: Strict checking mode (--strict flag)
- **backupMode**: Create backup files (--backup flag)
- **outputFormat**: Output format (text, json, csv)
- **maxComplexity**: Maximum complexity for auto-fixes (default: 3)

## Output

Comprehensive type safety report including:

- Any cast analysis results
- Fix suggestions with confidence levels
- Before/after code comparisons
- Type definition recommendations
- Technical debt metrics

## Implementation Steps

1. **Parse and Validate Input**
   - Validate scan path exists
   - Check file permissions
   - Set up TypeScript compiler integration

2. **Scan for Any Casts**
   - Find all `: any` type annotations
   - Detect `as any` assertions
   - Identify `<any>` type casts
   - Analyze context and usage patterns

3. **Analyze Type Context**
   - Examine variable initialization
   - Check function return types
   - Analyze object property access
   - Review array and generic usage

4. **Generate Type Definitions**
   - Infer proper types from context
   - Create interface definitions
   - Generate union types where appropriate
   - Suggest generic type parameters

5. **Apply Fixes (if enabled)**
   - Replace any with inferred types
   - Add proper type assertions
   - Create missing type definitions
   - Update import statements

6. **Generate Report**
   - Calculate type safety improvement
   - Provide before/after comparisons
   - Suggest additional improvements

## Detection Patterns

### Type Annotations

```typescript
// ❌ VIOLATION: Explicit any annotation
let userData: any = getUserData();

// ✅ FIXED: Proper type annotation
let userData: User = getUserData();
```

### Type Assertions

```typescript
// ❌ VIOLATION: Unsafe type assertion
const result = apiResponse as any;

// ✅ FIXED: Proper type assertion
const result = apiResponse as ApiResponse;
```

### Generic Types

```typescript
// ❌ VIOLATION: Any in generics
const cache = new Map<string, any>();

// ✅ FIXED: Proper generic type
const cache = new Map<string, UserData>();
```

### Function Parameters

```typescript
// ❌ VIOLATION: Any parameter
declare function processData(data: any): void;

// ✅ FIXED: Typed parameter
declare function processData(data: UserData): void;
```

## Fix Confidence Levels

### High Confidence (90-100%)

- Simple variable assignments with clear types
- Function return types with existing definitions
- Object property access with known shapes
- Array element types with clear usage

### Medium Confidence (70-89%)

- Complex object structures
- Union types with limited context
- Generic constraints
- Callback function types

### Low Confidence (50-69%)

- Dynamic object shapes
- Complex generic usage
- External API responses
- Plugin/extension points

### Manual Review Required (<50%)

- Highly dynamic code
- Complex conditional types
- Runtime type determination
- External library integration

## Example Usage

```bash
# Scan current directory for any casts
/any-cast-fixer

# Scan specific file with auto-fix and backup
/any-cast-fixer --scanPath="packages/backend/src/services/UserService.ts" --fix --backup

# Strict mode scan with JSON output
/any-cast-fixer --scanPath="packages/backend/src" --strict --outputFormat=json

# Fix with maximum complexity level 5
/any-cast-fixer --scanPath="." --fix --maxComplexity=5

# Check before commit (common patterns)
/any-cast-fixer --scanPath="." --outputFormat=text | grep "VIOLATION"
```

## Auto-fix Capabilities

### Simple Fixes (Applied Automatically)

- Replace `: any` with inferred types
- Fix `as any` with proper assertions
- Update generic type parameters
- Add basic interface definitions

### Complex Fixes (Require Review)

- Create complex type definitions
- Refactor function signatures
- Update import statements
- Modify class hierarchies

## Type Definition Generation

### Interface Creation

```typescript
// Generated from usage patterns
interface UserData {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}
```

### Union Types

```typescript
// Generated from conditional logic
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Generic Constraints

```typescript
// Generated from usage patterns
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}
```

## Integration Points

- **CI/CD Pipeline**: Pre-commit hooks and PR checks
- **Code Review**: Automated review comments
- **TypeScript Compiler**: Integration with tsc
- **IDE Integration**: Language service support

## Error Handling

- Graceful handling of syntax errors
- Clear violation explanations
- Suggested fix implementations
- Backup file creation for auto-fixes

## Performance Considerations

- Efficient file parsing and analysis
- Caching of type analysis results
- Parallel processing for large codebases
- Incremental scanning for changed files

## Technical Debt Metrics

### Before Fix

- Any cast count: 277 instances
- Type safety score: 65%
- Technical debt: High

### After Fix

- Any cast count: <50 instances
- Type safety score: 95%
- Technical debt: Low

## Best Practices Enforced

- Use specific types instead of any
- Create proper interface definitions
- Leverage TypeScript's type inference
- Avoid unsafe type assertions
- Maintain type consistency across boundaries
