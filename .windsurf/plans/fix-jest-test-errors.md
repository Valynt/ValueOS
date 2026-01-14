# Fix Jest Test Errors Plan

This plan addresses the Jest-related TypeScript errors in the billing test file by migrating from Jest to Vitest, which is already configured as the project's test runner.

## Current Issues

The test file `/src/services/billing/__tests__/schema-fixes.test.ts` has several errors:

1. Missing `@jest/globals` module
2. Incorrect type usage for service classes
3. Undefined `jest` global functions
4. Constructor issues with service classes

## Root Cause Analysis

The project uses Vitest as its test runner (configured in `vitest.config.ts` with `globals: true`), but the test file is written using Jest syntax and imports. Vitest provides Jest-compatible globals when `globals: true` is set, but the explicit import from `@jest/globals` is causing conflicts.

## Solution Strategy

1. **Remove Jest imports**: Remove the `@jest/globals` import since Vitest provides these globals automatically
2. **Fix type declarations**: Change service type references from values to types using `typeof`
3. **Update constructor calls**: Fix service instantiation to work with actual class constructors
4. **Add missing dependencies**: Ensure `@jest/globals` is either installed or removed if not needed

## Implementation Steps

1. Update import statements to use Vitest globals instead of Jest imports
2. Fix type annotations for service declarations
3. Update service instantiation to use proper constructor patterns
4. Verify all test functions work with Vitest's Jest-compatible API
5. Run tests to confirm fixes work correctly

## Benefits

- Aligns with project's existing Vitest setup
- Removes dependency conflicts between Jest and Vitest
- Maintains test functionality while using the correct test runner
- Follows project's established testing patterns
