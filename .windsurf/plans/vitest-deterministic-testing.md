# Fix Vitest Deterministic Testing in Docker and CI

This plan eliminates mysterious test skips and creates a robust, deterministic testing infrastructure with clear separation between unit and integration tests.

## Root Cause Analysis

**PRIMARY ISSUE**: The global test setup uses `SKIP_TESTCONTAINERS="1"` environment variable to conditionally skip testcontainers setup. When this flag is set (default in many environments), the integration setup returns early, causing all tests to be skipped.

**Key findings:**

1. **Global skip mechanism**: `src/test/testcontainers-global-setup.ts` line 20 checks `SKIP_TESTCONTAINERS="1"` and returns early
2. **Integration setup dependency**: `src/test/setup-integration.ts` also checks this flag and skips if set
3. **No unit/integration separation**: All tests go through the same setup pipeline
4. **Silent fallback**: Tests are silently skipped rather than failing with clear messages
5. **Docker environment**: Docker containers likely have `SKIP_TESTCONTAINERS="1"` set by default

## Implementation Plan

### Phase 1: Create Unit/Integration Test Separation

1. **Restructure Vitest config** with two distinct projects:
   - `unit`: Default project, no external dependencies
   - `integration`: Opt-in project with testcontainers

2. **Create separate setup files**:
   - `src/test/setup-unit.ts` - Pure unit test setup
   - `src/test/setup-integration.ts` - Integration setup with proper error handling

3. **Update package scripts** for clear test modes

### Phase 2: Eliminate Silent Skipping

1. **Remove global SKIP_TESTCONTAINERS logic** from setup files
2. **Add explicit preflight checks** that fail fast with clear messages
3. **Replace conditional describe.skip** with explicit test patterns

### Phase 3: Docker Infrastructure Hardening

1. **Update docker-compose** with proper health checks
2. **Ensure stable networking** and service discovery
3. **Add readiness checks** before running tests

### Phase 4: Documentation and Guardrails

1. **Create testing documentation** with clear commands
2. **Add CI checks** to prevent silent skips
3. **Implement lint rules** for explicit test categorization

## Files to Modify

- `vitest.config.ts` - Add project configuration
- `src/test/setup-unit.ts` - New file for unit setup
- `src/test/setup-integration.ts` - Modify integration setup
- `src/test/testcontainers-global-setup.ts` - Remove skip logic
- `package.json` - Update test scripts
- `docker-compose.yml` - Add health checks
- `.github/workflows/` - Update CI configuration
- `docs/testing.md` - New documentation file

## Expected Outcomes

- Unit tests run everywhere with zero dependencies
- Integration tests run only when explicitly requested
- Clear error messages when required services are missing
- Deterministic behavior across local, Docker, and CI environments
- No more "all tests skipped" scenarios
