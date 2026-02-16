---
name: run-tests
description: Standardizes test execution, coverage reporting, and CI validation steps
---

# Run Tests

This skill provides standardized procedures for executing tests, generating coverage reports, and validating CI pipelines across the ValueOS codebase.

## When to Run

Run this skill when:
- Executing tests locally during development
- Running CI/CD pipeline validation
- Generating coverage reports for releases
- Validating test infrastructure changes
- Debugging test failures

## Test Types and Structure

### Test Categories

#### Unit Tests
- **Purpose**: Test individual functions, classes, and modules in isolation
- **Location**: `tests/unit/` and `**/*.test.ts`
- **Framework**: Vitest with jsdom for DOM testing
- **Coverage Target**: >90% for new code

#### Integration Tests
- **Purpose**: Test component interactions and service integrations
- **Location**: `tests/integration/`
- **Framework**: Vitest with test containers
- **Coverage Target**: >80% for integration points

#### End-to-End Tests
- **Purpose**: Test complete user workflows and system behavior
- **Location**: `tests/e2e/`
- **Framework**: Playwright
- **Coverage Target**: Critical user paths only

#### Performance Tests
- **Purpose**: Validate system performance under load
- **Location**: `tests/performance/`
- **Framework**: k6 or Artillery
- **Coverage Target**: N/A (benchmarking)

## Test Execution Commands

### Local Development Testing

#### Run All Tests
```bash
# Run complete test suite
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode during development
pnpm test:watch
```

#### Run Specific Test Categories
```bash
# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# End-to-end tests only
pnpm test:e2e

# Performance tests
pnpm test:performance
```

#### Run Tests for Specific Files
```bash
# Run tests for a specific file
pnpm test packages/backend/src/api/users.test.ts

# Run tests for a directory
pnpm test packages/components/

# Run tests matching pattern
pnpm test -- --run --testNamePattern="authentication"
```

### CI/CD Pipeline Execution

#### Pre-commit Hooks
```bash
# Run before committing (via husky)
pnpm test:pre-commit

# Quick unit test validation
pnpm test:quick
```

#### CI Pipeline Stages
```bash
# Stage 1: Lint and type check
pnpm lint
pnpm type-check

# Stage 2: Unit tests
pnpm test:unit --coverage

# Stage 3: Integration tests
pnpm test:integration

# Stage 4: E2E tests (on merge to main)
pnpm test:e2e
```

## Coverage Reporting

### Coverage Requirements

#### Minimum Coverage Thresholds
- **Overall**: 85%
- **Branches**: 80%
- **Functions**: 90%
- **Lines**: 85%
- **Statements**: 85%

#### Per-Package Coverage
```json
{
  "packages/backend": {
    "branches": 85,
    "functions": 95,
    "lines": 90,
    "statements": 90
  },
  "packages/components": {
    "branches": 75,
    "functions": 85,
    "lines": 80,
    "statements": 80
  }
}
```

### Coverage Report Generation
```bash
# Generate HTML coverage report
pnpm test:coverage -- --reporter=html

# Generate LCOV report for CI
pnpm test:coverage -- --reporter=lcov

# Generate JSON report for analysis
pnpm test:coverage -- --reporter=json
```

### Coverage Analysis
```bash
# Check coverage thresholds
pnpm test:coverage:check

# Analyze uncovered lines
pnpm test:coverage:analyze

# Generate coverage diff against main
pnpm test:coverage:diff
```

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 85,
          statements: 85
        }
      }
    }
  }
})
```

### Test Environment Setup (`tests/setup.ts`)
```typescript
import { beforeAll, afterAll } from 'vitest'
import { setupTestDatabase } from './helpers/database'

// Global test setup
beforeAll(async () => {
  await setupTestDatabase()
  // Additional global setup
})

afterAll(async () => {
  // Global cleanup
})
```

## Test Best Practices

### Test Organization
- **One test file per unit**: `users.test.ts` for `users.ts`
- **Descriptive test names**: `it('should create user with valid data')`
- **Arrange-Act-Assert pattern**: Clear test structure
- **Test isolation**: No shared state between tests

### Mocking and Stubbing
```typescript
import { describe, it, expect, vi } from 'vitest'
import { UserService } from './userService'
import { mockDatabase } from '../mocks/database'

describe('UserService', () => {
  it('should create user', async () => {
    // Arrange
    const mockDb = mockDatabase()
    const service = new UserService(mockDb)

    // Act
    const result = await service.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    })

    // Assert
    expect(result.id).toBeDefined()
    expect(mockDb.insert).toHaveBeenCalledWith('users', expect.any(Object))
  })
})
```

### Async Testing
```typescript
it('should handle async operations', async () => {
  const result = await someAsyncOperation()

  // Use expect assertions in async tests
  await expect(result).resolves.toBe('expected value')

  // Or use waitFor for polling
  await waitFor(() => {
    expect(someCondition()).toBe(true)
  }, { timeout: 5000 })
})
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run linter
        run: pnpm lint

      - name: Run type check
        run: pnpm type-check

      - name: Run unit tests
        run: pnpm test:unit --coverage

      - name: Run integration tests
        run: pnpm test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Quality Gates
- **Unit Tests**: Must pass, coverage >85%
- **Integration Tests**: Must pass, no regressions
- **E2E Tests**: Must pass on main branch merges
- **Performance**: No degradation >10%

## Debugging Test Failures

### Common Issues and Solutions

#### Flaky Tests
```typescript
// Use retry for flaky tests
it('should handle network requests', async () => {
  // Test implementation
}, { retry: 3 })
```

#### Test Timeouts
```typescript
// Increase timeout for slow tests
it('should process large dataset', async () => {
  // Test implementation
}, { timeout: 30000 })
```

#### Async Cleanup Issues
```typescript
describe('Database Tests', () => {
  let dbConnection: Database

  beforeEach(async () => {
    dbConnection = await createTestDatabase()
  })

  afterEach(async () => {
    await dbConnection.cleanup()
  })

  // Tests here
})
```

### Debugging Commands
```bash
# Run tests in debug mode
pnpm test -- --inspect-brk

# Run specific failing test
pnpm test -- --run --testNamePattern="failing test name"

# Run tests with verbose output
pnpm test -- --reporter=verbose
```

## Performance Testing

### Load Testing Setup
```javascript
// k6 load test example
import http from 'k6/http'
import { check } from 'k6'

export let options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500']
  }
}

export default function () {
  let response = http.get('http://localhost:3000/api/users')
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  })
}
```

### Performance Benchmarks
- **API Response Time**: <200ms P95
- **Page Load Time**: <3s
- **Database Query Time**: <100ms P95
- **Memory Usage**: <512MB per service

## Test Maintenance

### Regular Maintenance Tasks
- [ ] Update test dependencies monthly
- [ ] Review and update flaky tests
- [ ] Remove obsolete test cases
- [ ] Update performance benchmarks
- [ ] Audit test coverage gaps

### Test Health Metrics
- **Test Execution Time**: <5 minutes for full suite
- **Flaky Test Rate**: <2%
- **Test Failure Investigation Time**: <30 minutes average
- **New Test Addition Rate**: >95% of new features

## Integration with Development Workflow

### Pre-commit Validation
```bash
# husky pre-commit hook
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint
pnpm type-check
pnpm test:unit
```

### IDE Integration
- **VS Code Extensions**: Vitest, Coverage Gutters
- **Test Debugging**: Launch configurations for test debugging
- **Watch Mode**: Automatic test re-run on file changes

### Team Collaboration
- **Test Reviews**: Include test changes in code reviews
- **Test Ownership**: Assign test maintenance responsibilities
- **Knowledge Sharing**: Document complex test scenarios

This standardized approach ensures consistent, reliable test execution across the entire development lifecycle.
