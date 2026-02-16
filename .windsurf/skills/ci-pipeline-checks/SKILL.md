---
name: ci-pipeline-checks
description: Encapsulates CI validation tasks like build, test, and security scans
---

# CI Pipeline Checks

This skill provides comprehensive validation procedures for CI/CD pipelines, ensuring code quality, security, and reliability before deployment.

## When to Run

Run this skill when:
- Setting up or modifying CI/CD pipelines
- Debugging pipeline failures
- Adding new validation checks
- Optimizing pipeline performance
- Ensuring compliance requirements
- Preparing for production deployments

## Pipeline Architecture

### CI Stages Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pre-Commit    │ -> │     Build       │ -> │   Test Suite    │
│   Validation    │    │   & Compile     │    │   Execution     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Security      │ -> │   Performance   │ -> │   Deployment    │
│   Scanning      │    │   Validation    │    │   Readiness     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Quality Gates
- **Code Quality**: Lint, format, type checking
- **Security**: Vulnerability scanning, secrets detection
- **Testing**: Unit, integration, E2E coverage
- **Performance**: Build size, runtime metrics
- **Compliance**: License checking, dependency analysis

## Pre-Commit Validation

### Git Hooks Setup
```bash
# Install husky for git hooks
pnpm add -D husky

# Initialize husky
pnpm exec husky init

# Add pre-commit hook
echo '#!/usr/bin/env sh
pnpm lint
pnpm type-check
pnpm test:unit --run' > .husky/pre-commit

# Make executable
chmod +x .husky/pre-commit
```

### Pre-commit Checks
```bash
# Run all pre-commit validations
pnpm pre-commit

# Individual checks
pnpm lint:check        # ESLint validation
pnpm format:check      # Prettier validation
pnpm type-check        # TypeScript compilation
pnpm test:unit:quick   # Fast unit test subset
pnpm build:check       # Build validation
```

## Build & Compile Validation

### Build Configuration
```javascript
// turbo.json - Build orchestration
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "public/**", "package.json", "tsconfig.json"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {
      "inputs": ["src/**", "package.json", ".eslintrc.js"]
    },
    "test": {
      "inputs": ["src/**", "tests/**", "package.json", "vitest.config.ts"],
      "outputs": ["coverage/**"]
    }
  }
}
```

### Build Commands
```bash
# Full project build
pnpm build

# Build specific packages
pnpm build --filter=@valueos/backend
pnpm build --filter=@valueos/components

# Build with dependency analysis
pnpm build:analyze

# Check build size limits
pnpm build:size-check
```

## Test Suite Execution

### Test Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 85,
          statements: 85
        }
      }
    },
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts']
  }
})
```

### Test Execution Commands
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test suites
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests only
pnpm test:e2e         # End-to-end tests only

# Run tests in watch mode
pnpm test:watch

# Run tests for specific files
pnpm test packages/backend/src/api/users.test.ts

# Run tests with debugging
pnpm test -- --inspect-brk
```

### Test Quality Validation
```bash
# Check coverage thresholds
pnpm test:coverage:check

# Analyze test performance
pnpm test:performance

# Check for flaky tests
pnpm test:flaky-check

# Validate test isolation
pnpm test:isolation-check
```

## Security Scanning

### Static Application Security Testing (SAST)
```bash
# Run Semgrep security scans
semgrep --config auto --exclude-rule deadcode

# Run CodeQL analysis
codeql database create db --language=javascript
codeql database analyze db --format=sarif-latest --output=results.sarif

# Run ESLint security rules
pnpm lint:security
```

### Software Composition Analysis (SCA)
```bash
# Check for vulnerable dependencies
pnpm audit

# Detailed vulnerability report
pnpm audit --audit-level=moderate

# Check license compliance
pnpm licenses list --json | jq '.[] | select(.licenseType == "GPL")'

# Generate SBOM (Software Bill of Materials)
pnpm sbom:generate
```

### Secrets Detection
```bash
# Scan for secrets with gitLeaks
gitleaks detect --verbose --redact

# Scan with TruffleHog
trufflehog filesystem --directory=. --only-verified

# Custom secrets patterns
grep -r "API_KEY\|SECRET" --include="*.ts" --include="*.js" src/
```

### Container Security
```bash
# Scan Docker images
trivy image --format json valueos/backend:latest

# Scan Kubernetes manifests
trivy config --format json k8s/

# Check for misconfigurations
kube-score score k8s/*.yaml
```

## Performance Validation

### Build Performance
```bash
# Measure build time
time pnpm build

# Analyze bundle size
pnpm build:analyze

# Check for performance regressions
pnpm build:benchmark

# Validate build caching
pnpm build:cache-check
```

### Runtime Performance
```bash
# Run performance tests
pnpm test:performance

# Load testing
k6 run tests/performance/load-test.js

# Memory leak detection
pnpm test:memory

# Bundle size analysis
pnpm build:size
```

## GitHub Actions CI/CD

### Main CI Workflow
```yaml
name: CI Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint and format
        run: |
          pnpm lint
          pnpm format:check

      - name: Type check
        run: pnpm type-check

      - name: Run tests
        run: pnpm test:coverage

      - name: Security scan
        run: |
          pnpm audit --audit-level=high
          semgrep --config auto

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  build:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build

      - name: Build Docker images
        run: |
          docker build -t valueos/api .
          docker build -t valueos/web .

      - name: Run integration tests
        run: pnpm test:integration

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

      - name: Run CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript

      - name: Run CodeQL analysis
        uses: github/codeql-action/analyze@v2

  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.17.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build and analyze bundle
        run: |
          pnpm build
          pnpm build:analyze

      - name: Performance regression check
        run: pnpm test:performance:regression
```

## Quality Gates Configuration

### Branch Protection Rules
```yaml
# GitHub branch protection for main
required_status_checks:
  strict: true
  contexts:
    - "ci / validate"
    - "ci / build"
    - "ci / security"
    - "ci / performance"

required_pull_request_reviews:
  required_approving_review_count: 2
  dismiss_stale_reviews: true
  require_code_owner_reviews: true

restrictions:
  enforce_admins: true
  allow_force_pushes: false
  allow_deletions: false
```

### Quality Metrics
```json
// .quality/config.json
{
  "coverage": {
    "minimum": 85,
    "branches": 80,
    "functions": 90,
    "lines": 85
  },
  "performance": {
    "maxBundleSize": "2MB",
    "maxFirstLoad": "3s",
    "maxRuntimeMemory": "512MB"
  },
  "security": {
    "maxVulnerabilities": 0,
    "allowedLicenses": ["MIT", "Apache-2.0", "BSD-3-Clause"],
    "blockedPackages": ["left-pad", "event-stream"]
  }
}
```

## Pipeline Optimization

### Caching Strategies
```yaml
# GitHub Actions caching
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

- name: Cache build artifacts
  uses: actions/cache@v3
  with:
    path: |
      .next/cache
      dist/
    key: ${{ runner.os }}-build-${{ hashFiles('**/package.json') }}
```

### Parallel Execution
```yaml
# Matrix builds for multiple Node versions
strategy:
  matrix:
    node-version: [16.x, 18.x, 20.x]
    os: [ubuntu-latest, windows-latest]

# Parallel test execution
pnpm test -- --shard=1/3
pnpm test -- --shard=2/3
pnpm test -- --shard=3/3
```

## Monitoring and Alerting

### Pipeline Health Metrics
- **Success Rate**: Target >95%
- **Average Duration**: Target <15 minutes
- **Failure Recovery Time**: Target <30 minutes
- **False Positive Rate**: Target <5%

### Alert Conditions
- Pipeline failure on main branch
- Security vulnerability detected
- Coverage below threshold
- Performance regression >10%

### Dashboard Integration
```bash
# Send metrics to monitoring system
curl -X POST $METRICS_ENDPOINT \
  -H "Content-Type: application/json" \
  -d "{
    \"pipeline\": \"ci\",
    \"status\": \"$PIPELINE_STATUS\",
    \"duration\": $BUILD_DURATION,
    \"coverage\": $COVERAGE_PERCENTAGE
  }"
```

## Troubleshooting Pipeline Issues

### Common Failure Patterns

#### Dependency Issues
```bash
# Clear caches and reinstall
rm -rf node_modules/.cache
pnpm install --force

# Check lockfile consistency
pnpm install --frozen-lockfile
```

#### Build Failures
```bash
# Debug build process
pnpm build --verbose

# Check TypeScript errors
pnpm tsc --noEmit --listFiles

# Validate build outputs
ls -la dist/
```

#### Test Flakiness
```bash
# Run tests with retries
pnpm test -- --retry=3

# Isolate flaky tests
pnpm test -- --run --testNamePattern="flaky"

# Check test environment
docker run --rm node:18 pnpm test
```

#### Security Scan Issues
```bash
# False positive handling
# Add to .semgrepignore or .gitleaks.toml

# Update scan rules
semgrep --update-rules

# Run targeted scans
semgrep --config p/security --include="src/"
```

## Compliance and Audit

### Regulatory Requirements
- **SOX**: Financial reporting controls
- **GDPR**: Data protection compliance
- **HIPAA**: Healthcare data security (if applicable)
- **PCI DSS**: Payment card industry standards

### Audit Trail
```bash
# Log all pipeline activities
echo "$(date): $STEP completed successfully" >> pipeline-audit.log

# Generate compliance reports
pnpm compliance:report

# Archive build artifacts
aws s3 cp dist/ s3://artifacts/$BUILD_ID/ --recursive
```

This comprehensive CI pipeline validation ensures code quality, security, and reliability throughout the development lifecycle.
