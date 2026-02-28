---
name: ts-type-fix
description: Gathers and applies strategies for resolving TypeScript errors project-wide
---

# TypeScript Type Fix

This skill provides comprehensive strategies and automated tools for resolving TypeScript errors across the entire ValueOS codebase.

## When to Run

Run this skill when:
- TypeScript compilation fails with type errors
- After major refactoring or code changes
- Before deploying to catch type issues
- During CI/CD pipeline validation
- When introducing new TypeScript features
- Debugging type-related runtime errors

## TypeScript Configuration Analysis

### tsconfig.json Validation
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./packages/components/src/*"],
      "@/backend/*": ["./packages/backend/src/*"]
    }
  },
  "include": [
    "src/**/*",
    "packages/**/*",
    "types/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ]
}
```

### Type Checking Commands
```bash
# Basic type check
pnpm type-check

# Type check with detailed output
pnpm tsc --noEmit --pretty

# Type check specific files
pnpm tsc --noEmit packages/backend/src/api/users.ts

# Generate type diagnostics
pnpm tsc --noEmit --diagnostics
```

## Common TypeScript Error Patterns

### 1. Implicit Any Types

#### Error Pattern
```
Parameter 'x' implicitly has an 'any' type.
Property 'y' does not exist on type 'z'.
```

#### Resolution Strategies
```typescript
// Strategy 1: Explicit typing
function processUser(user: { id: number; name: string }) {
  return user.name;
}

// Strategy 2: Interface definition
interface User {
  id: number;
  name: string;
  email?: string;
}

function processUser(user: User) {
  return user.name;
}

// Strategy 3: Type assertion (use sparingly)
const user = getUser() as User;

// Strategy 4: Generic constraints
function processEntity<T extends { id: number }>(entity: T) {
  return entity.id;
}
```

### 2. Null/Undefined Safety

#### Error Pattern
```
Object is possibly 'null' or 'undefined'.
Cannot invoke an object which is possibly 'null'.
```

#### Resolution Strategies
```typescript
// Strategy 1: Optional chaining
const userName = user?.profile?.name;

// Strategy 2: Nullish coalescing
const displayName = user?.name ?? 'Anonymous';

// Strategy 3: Type guards
function isUser(obj: any): obj is User {
  return obj && typeof obj.id === 'number';
}

if (isUser(data)) {
  console.log(data.name); // TypeScript knows data is User
}

// Strategy 4: Non-null assertion (use carefully)
const element = document.getElementById('app')!;

// Strategy 5: Strict null checks in tsconfig
{
  "compilerOptions": {
    "strictNullChecks": true,
    "strict": true
  }
}
```

### 3. Module Resolution Issues

#### Error Pattern
```
Cannot find module '@/components/Button'.
Module '"express"' has no exported member 'Request'.
```

#### Resolution Strategies
```typescript
// Strategy 1: Path mapping configuration
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["packages/components/src/*"]
    }
  }
}

// Strategy 2: Type declarations for untyped modules
// types/module.d.ts
declare module 'some-untyped-package' {
  export function doSomething(): void;
  export interface Config {
    apiKey: string;
  }
}

// Strategy 3: Ambient module declarations
declare module '*.svg' {
  const content: string;
  export default content;
}

// Strategy 4: Triple-slash directives
/// <reference types="node" />
/// <reference path="../types/custom.d.ts" />
```

### 4. Generic Type Issues

#### Error Pattern
```
Type 'string' is not assignable to type 'number'.
Property 'length' does not exist on type 'T'.
```

#### Resolution Strategies
```typescript
// Strategy 1: Generic constraints
function getLength<T extends { length: number }>(item: T): number {
  return item.length;
}

// Strategy 2: Union types
type StringOrNumber = string | number;

function processValue(value: StringOrNumber) {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value.toString();
}

// Strategy 3: Discriminated unions
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResponse<T>(response: ApiResponse<T>) {
  if (response.success) {
    return response.data; // TypeScript knows this is T
  }
  throw new Error(response.error);
}

// Strategy 4: Conditional types
type NonNullable<T> = T extends null | undefined ? never : T;
type RequiredKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]>
};
```

### 5. React Component Types

#### Error Pattern
```
Property 'children' does not exist on type 'IntrinsicAttributes & Props'.
Type 'FC<Props>' is not assignable to type 'ComponentType<any>'.
```

#### Resolution Strategies
```typescript
// Strategy 1: Proper React.FC usage
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary'
}) => {
  return (
    <button className={`btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
};

// Strategy 2: Component props with children
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  children: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, children, ...props }, ref) => (
    <div ref={ref} {...props}>
      <h3>{title}</h3>
      {children}
    </div>
  )
);

// Strategy 3: Event handler types
interface FormProps {
  onSubmit: (data: FormData) => void;
}

const Form: React.FC<FormProps> = ({ onSubmit }) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
};
```

## Automated Type Fixing Tools

### TypeScript Compiler Fixes
```bash
# Auto-fix simple issues
npx tsc --noEmit --fix

# Generate type declaration files
npx tsc --declaration --emitDeclarationOnly

# Strict mode migration
npx tsc --noEmit --strict --noImplicitAny
```

### ESLint TypeScript Rules
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error'
  }
}
```

### Custom Type Fixer Script
```typescript
// scripts/fix-types.ts
import { Project, ts } from 'ts-morph';

async function fixTypes() {
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
  });

  // Find all source files
  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    // Fix implicit any parameters
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const parameters = func.getParameters();
      for (const param of parameters) {
        if (!param.getTypeNode()) {
          // Add explicit type annotation
          param.setType('unknown');
        }
      }
    }

    // Fix missing return types
    for (const func of functions) {
      if (!func.getReturnTypeNode()) {
        const returnType = func.getReturnType();
        if (returnType.getText() !== 'any') {
          func.setReturnType(returnType.getText());
        }
      }
    }
  }

  // Save changes
  await project.save();
}

fixTypes();
```

## CI/CD Integration

### GitHub Actions Type Check
```yaml
name: Type Check
on: [push, pull_request]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run type check
        run: pnpm type-check

      - name: Run strict type check
        run: pnpm tsc --noEmit --strict
```

### Pre-commit Type Validation
```javascript
// .husky/pre-commit
#!/usr/bin/env sh

# Run type check
pnpm type-check

if [ $? -ne 0 ]; then
  echo "TypeScript errors found. Please fix them before committing."
  exit 1
fi
```

## Advanced Type Strategies

### Utility Types for Common Patterns
```typescript
// API Response wrapper
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
};

// Pagination types
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Form field types
type FormField<T> = {
  value: T;
  error?: string;
  touched: boolean;
  validating: boolean;
};

// Event handler types
type ChangeHandler<T> = (value: T) => void;
type SubmitHandler<T> = (data: T) => Promise<void>;
```

### Type Guards and Assertions
```typescript
// Runtime type checking
function isApiError(obj: any): obj is ApiError {
  return obj && typeof obj.code === 'number' && typeof obj.message === 'string';
}

function assertIsUser(obj: any): asserts obj is User {
  if (!obj || typeof obj.id !== 'number') {
    throw new Error('Object is not a valid User');
  }
}

// Usage
try {
  assertIsUser(someData);
  console.log(someData.name); // TypeScript knows this is User
} catch (error) {
  console.error('Invalid user data');
}
```

### Declaration Merging for Extensions
```typescript
// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

// Extend built-in types
interface Array<T> {
  first(): T | undefined;
  last(): T | undefined;
}

Array.prototype.first = function() {
  return this[0];
};

Array.prototype.last = function() {
  return this[this.length - 1];
};
```

## Performance Considerations

### Type Checking Performance
```json
// tsconfig.json optimizations
{
  "compilerOptions": {
    "skipLibCheck": true,
    "incremental": true,
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.tsbuildinfo"
  }
}
```

### Large Codebase Strategies
- **Isolated modules**: Use `isolatedModules: true`
- **Skip lib check**: Use `skipLibCheck: true` for faster checking
- **Incremental builds**: Use `incremental: true`
- **Project references**: Split large codebases into smaller projects

## Migration Strategies

### Gradual Adoption
```json
// Phase 1: Basic checking
{
  "compilerOptions": {
    "noImplicitAny": false,
    "strictNullChecks": false
  }
}

// Phase 2: Strict null checks
{
  "compilerOptions": {
    "strictNullChecks": true,
    "noImplicitAny": false
  }
}

// Phase 3: Full strict mode
{
  "compilerOptions": {
    "strict": true
  }
}
```

### Legacy Code Handling
```typescript
// eslint-disable for legacy files
/* eslint-disable @typescript-eslint/no-explicit-any */

// Type assertions for gradual migration
const legacyApi = (window as any).legacyApi;

// Progressive typing with Partial
interface LegacyConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

type PartialConfig = Partial<LegacyConfig>;
```

This comprehensive approach ensures robust TypeScript type safety across the entire ValueOS codebase while providing practical strategies for resolving common type errors.
