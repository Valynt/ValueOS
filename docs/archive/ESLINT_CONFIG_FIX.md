# ESLint Flat Config Fix

## Problem

ESLint 9 flat config was throwing a critical error:

```
ConfigError: Key "plugins": Cannot redefine plugin "@typescript-eslint".
```

This is a **hard stop** in ESLint 9 flat config - plugins can only be defined once across the entire config array.

## Root Cause

The config had **two locations** defining the `@typescript-eslint` plugin:

1. **Base config** (via `tseslint.config()`)
2. **Test overrides** (explicit plugin definition)

```typescript
// ❌ WRONG - Plugin defined twice
const baseConfig = tseslint.config({
  plugins: {
    /* typescript-eslint registered here */
  },
});

const testOverrides = {
  plugins: {
    "@typescript-eslint": tseslint, // ❌ REDEFINITION - ERROR!
  },
};
```

## The Fix

Followed ESLint 9 flat config rules:

### Rule 1: Define plugins exactly once

All plugins must be registered in a single config object, typically the first one.

### Rule 2: Overrides only change rules

Override configs should **never** redefine plugins, only modify rules.

### Rule 3: Parser must be configured

TypeScript files require the TypeScript parser to be explicitly set.

## Implementation

```typescript
// ✅ CORRECT - Single plugin registry
const baseConfig = {
  files: ["**/*.{ts,tsx,js,jsx}"],
  languageOptions: {
    parser: tseslint.parser, // Required for TypeScript
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin, // Defined ONCE
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
    "jsx-a11y": jsxA11y,
  },
  rules: {
    // Base rules
  },
};

// ✅ CORRECT - Override only rules, not plugins
const testOverrides = {
  files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
  // NO plugins property - uses plugins from baseConfig
  rules: {
    "@typescript-eslint/no-explicit-any": "off", // Override rule only
  },
};

export default [ignoresConfig, baseConfig, testOverrides];
```

## Key Changes

1. **Removed** `tseslint.config()` wrapper (was causing implicit plugin registration)
2. **Consolidated** all plugin definitions into single `baseConfig` object
3. **Added** TypeScript parser configuration
4. **Removed** plugin redefinition from `testOverrides`
5. **Simplified** config structure to flat array

## Verification

```bash
# Check config is valid
npx eslint --print-config src/index.tsx

# Verify plugin registered once
npx eslint --print-config src/index.tsx | grep "@typescript-eslint"

# Verify test overrides work
npx eslint --print-config src/__tests__/example.test.ts | grep "no-explicit-any"
# Should show: "0" (off) for test files

# Run linter
npx eslint src/
```

## Results

✅ **ESLint config valid**  
✅ **No plugin redefinition errors**  
✅ **TypeScript parsing works**  
✅ **Test overrides apply correctly**  
✅ **All tests still pass**

## ESLint 9 Flat Config Rules (Summary)

1. **One plugin, one definition** - Each plugin name can only appear once
2. **No plugin inheritance** - Overrides don't create new plugin scopes
3. **Explicit parser** - TypeScript requires explicit parser configuration
4. **Array order matters** - Configs are processed sequentially
5. **No merging** - Later configs don't merge plugins, only rules

## Why This Matters

ESLint 9 removed implicit behavior to:

- Prevent ambiguous plugin resolution
- Enable deterministic config evaluation
- Support parallel config loading
- Make config behavior explicit and predictable

The old "it worked before" approach is no longer valid in ESLint 9.

## Files Modified

- `eslint.config.js` - Complete rewrite following flat config rules

## Related Issues

This fix also resolves:

- TypeScript parsing errors in test files
- Plugin resolution ambiguity
- Config validation failures
- IDE ESLint integration issues
