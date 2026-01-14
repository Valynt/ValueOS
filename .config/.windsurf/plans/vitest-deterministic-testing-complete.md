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
6. **Widespread usage**: Documentation shows `SKIP_TESTCONTAINERS=1` is used throughout the codebase as a workaround

## Implementation Strategy

### Phase 1: Create Unit/Integration Test Separation

**Current Problem**: All tests use the same setup pipeline that includes testcontainers
**Solution**: Create separate Vitest projects with different setup requirements

1. **Restructure Vitest config** with two distinct projects:
   - `unit`: Default project, no external dependencies, fast execution
   - `integration`: Opt-in project with testcontainers and external services

2. **Create separate setup files**:
   - `src/test/setup-unit.ts` - Pure unit test setup (no testcontainers)
   - Modify `src/test/setup-integration.ts` - Integration setup with proper error handling

3. **Update package scripts** for clear test modes:
   - `npm test` → unit tests only (default behavior)
   - `npm run test:integration` → integration tests with services
   - `npm run test:all` → both unit and integration

### Phase 2: Eliminate Silent Skipping

**Current Problem**: Tests silently skip when services unavailable
**Solution**: Fail fast with clear, actionable error messages

1. **Remove global SKIP_TESTCONTAINERS logic** from setup files
2. **Add explicit preflight checks** that fail with clear messages:
   - Unit mode: No external dependencies required
   - Integration mode: Fail fast if Docker/services unavailable
3. **Replace conditional describe.skip** with explicit test patterns:
   - Use file naming conventions: `*.unit.test.ts` vs `*.int.test.ts`
   - Use Vitest project configuration instead of runtime skips

### Phase 3: Docker Infrastructure Hardening

**Current Problem**: Unreliable service discovery and health checks
**Solution**: Robust Docker setup with proper networking and readiness checks

1. **Update docker-compose** with proper health checks:
   - Add healthcheck to Redis service
   - Ensure stable network aliases
   - Add proper depends_on conditions

2. **Ensure stable networking**:
   - Use custom network with predictable names
   - Add service discovery via container names
   - Ensure proper port mapping

3. **Add readiness checks** before running tests:
   - Wait for Postgres to be ready
   - Wait for Redis to be ready
   - Verify connectivity before test execution

### Phase 4: Documentation and Guardrails

**Current Problem**: No clear guidance on test execution modes
**Solution**: Comprehensive documentation and automated checks

1. **Create testing documentation** (`docs/testing.md`):
   - Clear commands for each test mode
   - Environment setup requirements
   - Troubleshooting guide

2. **Add CI checks** to prevent silent skips:
   - Fail CI if all tests skipped
   - Separate CI jobs for unit vs integration
   - Clear error messages for missing dependencies

3. **Implement guardrails**:
   - Lint rule to prevent `describe.skip` without justification
   - CI assertion that unit tests always run
   - Automated check for test file naming conventions

## Files to Modify

### Core Configuration

- `vitest.config.ts` - Add project configuration for unit/integration separation
- `package.json` - Update test scripts and add new commands
- `src/test/setup-unit.ts` - New file for pure unit test setup
- `src/test/setup-integration.ts` - Modify to remove skip logic, add proper error handling

### Infrastructure

- `src/test/testcontainers-global-setup.ts` - Remove SKIP_TESTCONTAINERS logic
- `docker-compose.yml` - Add health checks and stable networking
- `docker-compose.test.yml` - Create dedicated test compose file
- `.github/workflows/` - Update CI configuration for separate test jobs

### Documentation & Tools

- `docs/testing.md` - New comprehensive testing guide
- `scripts/test-preflight.ts` - New preflight check script
- `.eslintrc.js` - Add lint rules for test patterns

## Expected Outcomes

- **Unit tests**: Run everywhere with zero dependencies, always deterministic
- **Integration tests**: Run only when explicitly requested, clear failure modes
- **No silent skips**: Clear error messages when requirements not met
- **Deterministic behavior**: Same results across local, Docker, and CI
- **Fast feedback**: Unit tests complete in seconds, integration tests isolated

## Verification Commands

```bash
# Unit tests (should always run, no dependencies)
npm test
npm run test:unit

# Integration tests (require Docker services)
npm run test:integration
docker-compose -f docker-compose.test.yml up -d
npm run test:integration

# All tests
npm run test:all

# CI simulation
npm run test:ci-unit
npm run test:ci-integration
```

## Success Criteria

1. Unit tests run successfully without any external services
2. Integration tests fail fast with clear messages when services unavailable
3. No more "all tests skipped" scenarios in any environment
4. Clear documentation exists for all test modes
5. CI runs unit tests deterministically, integration tests in separate job
6. Test execution time is predictable and reasonable
