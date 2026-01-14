# Testing Guide

This guide covers how to run tests in the ValueOS project with deterministic behavior across local, Docker, and CI environments.

## Test Types

### Unit Tests

- **Purpose**: Test individual functions and components in isolation
- **Dependencies**: Zero external dependencies
- **Execution**: Fast, deterministic, runs everywhere
- **File Pattern**: `*.test.ts`, `*.spec.ts` (excluding integration patterns)
- **Command**: `npm run test:unit`

### Integration Tests

- **Purpose**: Test integration between services and external dependencies
- **Dependencies**: Docker, PostgreSQL, Redis, testcontainers
- **Execution**: Requires Docker setup, runs only when explicitly requested
- **File Pattern**: `*.int.test.ts`, `*.integration.test.ts`, `integration/**/*.{test,spec}.{ts,tsx}`
- **Command**: `npm run test:integration`

## Quick Start

### Run Unit Tests (Recommended for Development)

```bash
# Run all unit tests with coverage
npm test

# Run unit tests without coverage
npm run test:unit

# Watch mode for development
npm run test:watch
```

### Run Integration Tests

```bash
# Run integration tests (requires Docker)
npm run test:integration

# Watch mode for integration tests
npm run test:watch:integration
```

### Run All Tests

```bash
# Run both unit and integration tests
npm run test:all
```

## Docker Testing

### Unit Tests in Docker

```bash
# Run unit tests in Docker container
npm run test:docker
```

### Integration Tests in Docker

```bash
# Run integration tests with Docker services
npm run test:docker:integration
```

### Manual Docker Setup

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
docker-compose -f docker-compose.test.yml logs -f test-ready

# Run tests
TEST_MODE=integration npm run test:integration

# Stop services
docker-compose -f docker-compose.test.yml down
```

## Environment Setup

### Required for Unit Tests

- Node.js 18+
- npm/yarn

### Required for Integration Tests

- Docker Desktop or Docker Engine
- Docker permissions to run containers
- Sufficient disk space for Docker images (~2GB)

### Environment Variables

```bash
# Test mode (auto-set by scripts)
TEST_MODE=unit|integration|all

# Override default ports (optional)
TEST_POSTGRES_PORT=5433
TEST_REDIS_PORT=6380
```

## File Organization

### Unit Test Files

```
src/
├── components/
│   └── Button.test.ts          # Unit test
├── services/
│   └── UserService.test.ts     # Unit test
└── lib/
    └── utils.test.ts           # Unit test
```

### Integration Test Files

```
src/
├── services/
│   └── UserService.int.test.ts    # Integration test
├── integration/
│   ├── auth-flow.test.ts           # Integration test
│   └── database-operations.test.ts # Integration test
└── api/
    └── endpoints.integration.test.ts # Integration test
```

## Writing Tests

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { UserService } from "../UserService";

describe("UserService Integration", () => {
  let supabase: ReturnType<typeof createClient>;
  let userService: UserService;

  beforeAll(async () => {
    // Integration tests automatically get testcontainers setup
    supabase = createClient(process.env.DATABASE_URL!);
    userService = new UserService(supabase);
  });

  it("creates and retrieves user", async () => {
    const user = await userService.create({
      email: "test@example.com",
      name: "Test User",
    });

    expect(user).toBeDefined();
    expect(user.email).toBe("test@example.com");
  });
});
```

## Troubleshooting

### Unit Tests Fail

```bash
# Check Node version
node --version  # Should be 18+

# Clear cache
npm run test:unit -- --no-cache

# Check TypeScript compilation
npm run typecheck
```

### Integration Tests Fail

```bash
# Check Docker status
docker version
docker ps

# Check if ports are available
netstat -an | grep 5433
netstat -an | grep 6380

# Reset Docker environment
docker system prune -f
docker-compose -f docker-compose.test.yml down -v
```

### Tests Skip Unexpectedly

```bash
# Run preflight check manually
tsx scripts/test-preflight.ts

# Check test file naming
find src -name "*.test.ts" | grep -E "(int|integration)"
```

### Docker Issues

```bash
# Check Docker permissions
docker run hello-world

# Reset Docker daemon
sudo systemctl restart docker  # Linux
# Or restart Docker Desktop

# Check disk space
docker system df
```

## CI Configuration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:integration
```

## Best Practices

### Unit Tests

- Keep tests fast and focused
- Mock external dependencies
- Test one thing at a time
- Use descriptive test names
- Arrange-Act-Assert pattern

### Integration Tests

- Test realistic scenarios
- Use actual services when possible
- Clean up test data
- Handle async operations properly
- Use appropriate timeouts

### File Naming

- Unit tests: `Component.test.ts`, `service.spec.ts`
- Integration tests: `Component.int.test.ts`, `service.integration.test.ts`
- Integration directory: `integration/feature-name.test.ts`

### Performance

- Unit tests: < 5 seconds total
- Integration tests: < 30 seconds per test
- Use test isolation to prevent cross-contamination
- Limit database operations in tests

## Advanced Usage

### Custom Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    project: [
      {
        name: "e2e",
        include: ["**/*.e2e.test.ts"],
        testTimeout: 60000,
      },
    ],
  },
});
```

### Coverage Reports

```bash
# Generate coverage report
npm test

# View coverage in browser
open coverage/lcov-report/index.html

# Coverage thresholds (in vitest.config.ts)
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80
  }
}
```

### Debugging Tests

```bash
# Run single test file
npm run test:unit -- src/components/Button.test.ts

# Run with debugger
node --inspect-brk node_modules/.bin/vitest run

# Verbose output
npm run test:unit -- --reporter=verbose
```
