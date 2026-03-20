# Fix Plan: PR #1883 Critical Issues

## Problem Summary
PR #1883 refactored LLM calls to use `secureLLMComplete` but introduced critical bugs:
- **Critical**: Tenant isolation logic errors could cause data leakage
- **Critical**: Inconsistent metadata handling violates `TenantMetadata` type
- **Medium**: Missing error handling, race conditions, type safety, audit logging inconsistencies

## Root Causes

### 1. Tenant Isolation Violation
- `secureLLMComplete` allows both `organizationId` and `tenantId` to be passed with different values
- The gateway's `TenantMetadata` type requires these to be mutually exclusive
- Passing both could cause downstream systems to use inconsistent tenant identifiers → data leakage

### 2. Metadata Spreading Issue
- Artifact generators build `request.metadata` with both fields
- Then spread it: `...request.metadata` before adding more fields
- The wrapper extracts tenant fields but `...rest` may still contain the other field
- This violates the `TenantMetadata` contract

### 3. Type Safety Gaps
- `SecureLLMCompleteOptions` uses `[key: string]: unknown` allowing arbitrary fields
- No validation that tenant-related fields are consistent

## Fix Strategy

### A. Core Wrapper Fix (`secureLLMWrapper.ts`)
1. **Enforce tenant field exclusivity**: Validate that `organizationId` and `tenantId` are not both provided with different values
2. **Canonicalize tenant identifier**: Use `tenantId` as the canonical field; `organizationId` is only for input compatibility
3. **Clean metadata**: Ensure only the canonical `tenantId` is passed to gateway, never both
4. **Add runtime guard**: Throw early if conflicting tenant identifiers are provided

### B. Artifact Generators Fix
1. **Remove `organizationId` from metadata objects** - only pass `tenantId`
2. **Keep `organizationId` as a separate custom field** if needed for business logic (e.g., memory storage), but not in the LLM metadata
3. **Standardize audit logging** to use consistent field names

### C. HandoffNotesGenerator Improvements
1. **Add retry logic** for data fetching operations
2. **Improve error handling** - don't silently return fallback notes; consider partial failure handling
3. **Fix potential race condition** - actually none exists with `Promise.all`, but add error boundaries

### D. Type Safety Enhancements
1. **Restrict index signature** in `SecureLLMCompleteOptions` to known safe fields
2. **Add explicit tenant field filtering** before calling gateway

## Implementation Order

1. Fix `secureLLMComplete` to enforce tenant isolation
2. Update all artifact generators to use consistent metadata
3. Improve HandoffNotesGenerator error handling
4. Add retry logic for database fetches
5. Standardize audit logging patterns
6. Run tests to verify fixes
7. Create PR with detailed description

## Files to Modify

- `packages/backend/src/lib/llm/secureLLMWrapper.ts` (critical)
- `packages/backend/src/services/artifacts/CFORecommendationGenerator.ts`
- `packages/backend/src/services/artifacts/CustomerNarrativeGenerator.ts`
- `packages/backend/src/services/artifacts/ExecutiveMemoGenerator.ts`
- `packages/backend/src/services/artifacts/InternalCaseGenerator.ts`
- `packages/backend/src/services/handoff/HandoffNotesGenerator.ts`

## Testing Strategy

- Run existing unit tests for secureLLMWrapper
- Run artifact generator tests
- Add specific test cases for tenant isolation enforcement
- Verify no data leakage scenarios through code review

## Success Criteria

- ✅ `secureLLMComplete` enforces that only one tenant identifier is used
- ✅ All calls to `secureLLMComplete` pass consistent metadata
- ✅ No TypeScript errors or type violations
- ✅ Audit logging is consistent across all generators
- ✅ Error handling is robust and doesn't mask failures
- ✅ All tests pass