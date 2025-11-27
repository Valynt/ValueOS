# MCP Ground Truth Server - Test Execution Guide

**Version:** 1.0  
**Date:** November 27, 2025  
**Audience:** QA Engineers, Developers, DevOps

---

## Quick Start

### Prerequisites

1. **Environment Setup:**
   ```bash
   cd /workspaces/ValueCanvas
   npm install
   ```

2. **Environment Variables:**
   ```bash
   # Create .env.test file
   cat > .env.test << EOF
   ALPHA_VANTAGE_API_KEY=demo
   NODE_ENV=test
   EOF
   ```

3. **Verify Installation:**
   ```bash
   npm test -- --version
   ```

### Run All Tests

```bash
# Run all MCP Ground Truth tests
npm test test/mcp-ground-truth

# Run with coverage
npm test test/mcp-ground-truth -- --coverage

# Run in watch mode
npm test test/mcp-ground-truth -- --watch
```

### Run Specific Test Phases

```bash
# Phase 1: Analyst/Developer Features
npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts

# Phase 2: AI Query Generation
npm test test/mcp-ground-truth/phase2-ai-query-generation.test.ts

# Phase 3: Integration and Governance (when implemented)
npm test test/mcp-ground-truth/phase3-integration-governance.test.ts
```

---

## Test Structure

### Test Organization

```
test/mcp-ground-truth/
├── TEST_PLAN.md                           # Detailed test specifications
├── TEST_EXECUTION_GUIDE.md                # This file
├── phase1-analyst-developer.test.ts       # Phase 1 tests
├── phase2-ai-query-generation.test.ts     # Phase 2 tests
├── phase3-integration-governance.test.ts  # Phase 3 tests (TBD)
└── fixtures/                              # Test data
    ├── sample-financials.json
    └── mock-responses.json
```

### Test Naming Convention

```typescript
describe('Phase X: Feature Category', () => {
  describe('QA-XX-NNN: Test Case Name', () => {
    it('should verify specific behavior', async () => {
      // Test implementation
    });
  });
});
```

---

## Phase 1: Analyst/Developer Features

### Test Cases

| Test ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| QA-FE-001 | Native SQL Editor | ✅ Implemented | High |
| QA-FE-002 | Interactive Notebooks | ✅ Implemented | High |
| QA-FE-003 | Multi-Language Support | ✅ Implemented | Medium |
| QA-FE-004 | Multi-Warehouse Connectivity | ✅ Implemented | High |
| QA-FE-005 | Data Caching Performance | ✅ Implemented | High |

### Running Phase 1 Tests

```bash
# Run all Phase 1 tests
npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts

# Run specific test suite
npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts -t "QA-FE-001"

# Run with verbose output
npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts -- --reporter=verbose
```

### Expected Results

**Success Criteria:**
- All tests pass
- Average latency < 400ms
- Cache performance improvement > 50%
- Tier 1 confidence > 0.9

**Sample Output:**
```
✓ QA-FE-001: Native SQL Editor with Ground Truth Data (5)
  ✓ should execute SQL query with MCP Ground Truth data (245ms)
  ✓ should complete query within performance target (189ms)
  ✓ should include monitoring metrics (156ms)
  
✓ QA-FE-002: Interactive Notebooks with Financial Modeling (2)
  ✓ should fetch data for notebook analysis (234ms)
  ✓ should preserve provenance in analysis (145ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Time:        3.456s
```

---

## Phase 2: AI Query Generation

### Test Cases

| Test ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| QA-AI-001 | AI-Assisted Query Generation | ✅ Implemented | High |
| QA-AI-002 | Visualization Interactivity | ✅ Implemented | High |
| QA-AI-003 | Automated Python Workflows | ✅ Implemented | Medium |

### Running Phase 2 Tests

```bash
# Run all Phase 2 tests
npm test test/mcp-ground-truth/phase2-ai-query-generation.test.ts

# Run specific test suite
npm test test/mcp-ground-truth/phase2-ai-query-generation.test.ts -t "QA-AI-001"

# Run with AI debugging
DEBUG=ai:* npm test test/mcp-ground-truth/phase2-ai-query-generation.test.ts
```

### Expected Results

**Success Criteria:**
- Zero hallucinations (all claims verified)
- AI query accuracy > 95%
- Follow-up context maintained
- Automated workflows execute successfully

**Sample Output:**
```
✓ QA-AI-001: AI-Assisted Query with Ground Truth Validation (5)
  ✓ should generate accurate query from natural language (312ms)
  ✓ should verify AI-generated claims with Aletheia (278ms)
  ✓ should provide citations for AI responses (156ms)
  ✓ should handle comparative queries (445ms)
  ✓ should prevent hallucination with missing data (123ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Time:        2.789s
```

---

## Phase 3: Integration and Governance

### Test Cases

| Test ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| QA-INT-001 | SaaS API Integration | ⏳ Pending | Medium |
| QA-GOV-001 | Role-Based Governance | ⏳ Pending | High |
| QA-GOV-002 | Insight Embedding | ⏳ Pending | Medium |

### Running Phase 3 Tests (When Implemented)

```bash
# Run all Phase 3 tests
npm test test/mcp-ground-truth/phase3-integration-governance.test.ts

# Run with integration environment
ENV=integration npm test test/mcp-ground-truth/phase3-integration-governance.test.ts
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/mcp-ground-truth-tests.yml
name: MCP Ground Truth Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'src/mcp-ground-truth/**'
      - 'test/mcp-ground-truth/**'
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Phase 1 tests
        run: npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts
        env:
          ALPHA_VANTAGE_API_KEY: ${{ secrets.ALPHA_VANTAGE_API_KEY }}
      
      - name: Run Phase 2 tests
        run: npm test test/mcp-ground-truth/phase2-ai-query-generation.test.ts
        env:
          ALPHA_VANTAGE_API_KEY: ${{ secrets.ALPHA_VANTAGE_API_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Running in CI

```bash
# Simulate CI environment locally
CI=true npm test test/mcp-ground-truth -- --coverage --reporter=json
```

---

## Performance Testing

### Latency Benchmarks

```bash
# Run performance benchmarks
npm test test/mcp-ground-truth -- -t "Performance"

# Run with detailed timing
npm test test/mcp-ground-truth -- -t "Performance" --reporter=verbose
```

### Expected Performance Metrics

| Operation | Target | Typical | Max Acceptable |
|-----------|--------|---------|----------------|
| Single metric fetch | <250ms | ~180ms | 400ms |
| Multiple metrics | <400ms | ~280ms | 600ms |
| Cache hit | <50ms | ~30ms | 100ms |
| Cross-source join | <2000ms | ~1200ms | 3000ms |

### Load Testing

```bash
# Run concurrent request tests
npm test test/mcp-ground-truth -- -t "concurrent"

# Stress test (requires k6 or similar)
k6 run test/mcp-ground-truth/load-test.js
```

---

## Debugging Tests

### Enable Debug Logging

```bash
# Enable all debug logs
DEBUG=* npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts

# Enable MCP-specific logs
DEBUG=mcp:* npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts

# Enable module-specific logs
DEBUG=mcp:edgar,mcp:xbrl npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts
```

### Run Single Test

```bash
# Run specific test by name
npm test test/mcp-ground-truth/phase1-analyst-developer.test.ts -t "should execute SQL query"

# Run with debugger
node --inspect-brk node_modules/.bin/vitest test/mcp-ground-truth/phase1-analyst-developer.test.ts
```

### Common Issues

#### Issue: "Module not initialized"

**Solution:**
```typescript
// Ensure beforeAll is called
beforeAll(async () => {
  mcpServer = await createDevServer();
});
```

#### Issue: "Rate limit exceeded"

**Solution:**
```bash
# Use demo API key for testing
export ALPHA_VANTAGE_API_KEY=demo

# Or add delays between tests
npm test test/mcp-ground-truth -- --test-timeout=10000
```

#### Issue: "Timeout errors"

**Solution:**
```typescript
// Increase timeout for slow tests
it('should fetch data', async () => {
  // Test implementation
}, 30000); // 30 second timeout
```

---

## Test Data Management

### Mock Data

```typescript
// test/mcp-ground-truth/fixtures/mock-responses.json
{
  "apple_financials": {
    "data": [{
      "entity": { "name": "Apple Inc.", "cik": "0000320193" },
      "metric": "revenue_total",
      "value": 383285000000,
      "unit": "USD",
      "period": "FY2024"
    }],
    "metadata": [{
      "source_tier": 1,
      "source_name": "xbrl-parser",
      "extraction_confidence": 0.97
    }]
  }
}
```

### Using Mock Data

```typescript
import mockData from './fixtures/mock-responses.json';

it('should handle mock data', () => {
  const data = mockData.apple_financials;
  expect(data.data[0].value).toBeGreaterThan(0);
});
```

---

## Coverage Reports

### Generate Coverage

```bash
# Generate HTML coverage report
npm test test/mcp-ground-truth -- --coverage

# Open coverage report
open coverage/index.html
```

### Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| Core modules | >90% | TBD |
| Data modules | >85% | TBD |
| Integration | >80% | TBD |
| Overall | >85% | TBD |

---

## Test Maintenance

### Adding New Tests

1. **Create test file:**
   ```bash
   touch test/mcp-ground-truth/new-feature.test.ts
   ```

2. **Follow template:**
   ```typescript
   import { describe, it, expect, beforeAll } from 'vitest';
   import { createDevServer } from '../../src/mcp-ground-truth';

   describe('New Feature', () => {
     let mcpServer;

     beforeAll(async () => {
       mcpServer = await createDevServer();
     });

     it('should test new feature', async () => {
       // Test implementation
     });
   });
   ```

3. **Run new tests:**
   ```bash
   npm test test/mcp-ground-truth/new-feature.test.ts
   ```

### Updating Tests

1. **Identify failing tests:**
   ```bash
   npm test test/mcp-ground-truth -- --reporter=verbose
   ```

2. **Update test expectations:**
   ```typescript
   // Update expected values
   expect(result.value).toBe(newExpectedValue);
   ```

3. **Verify fixes:**
   ```bash
   npm test test/mcp-ground-truth
   ```

---

## Troubleshooting

### Test Failures

**Symptom:** Tests fail intermittently

**Possible Causes:**
- Network issues
- Rate limiting
- Timing issues

**Solutions:**
1. Add retries:
   ```typescript
   it.retry(3)('should fetch data', async () => {
     // Test implementation
   });
   ```

2. Increase timeouts:
   ```typescript
   it('should fetch data', async () => {
     // Test implementation
   }, 30000);
   ```

3. Use mock data for flaky tests

### Performance Issues

**Symptom:** Tests run slowly

**Solutions:**
1. Run tests in parallel:
   ```bash
   npm test test/mcp-ground-truth -- --threads
   ```

2. Use caching:
   ```typescript
   // Cache server instance
   let cachedServer;
   beforeAll(async () => {
     if (!cachedServer) {
       cachedServer = await createDevServer();
     }
     mcpServer = cachedServer;
   });
   ```

3. Skip slow tests in development:
   ```typescript
   it.skip('slow test', async () => {
     // Test implementation
   });
   ```

---

## Reporting

### Generate Test Report

```bash
# JSON report
npm test test/mcp-ground-truth -- --reporter=json > test-results.json

# HTML report
npm test test/mcp-ground-truth -- --reporter=html

# JUnit XML (for CI)
npm test test/mcp-ground-truth -- --reporter=junit --outputFile=test-results.xml
```

### Test Metrics

Track these metrics over time:
- Test count
- Pass rate
- Average execution time
- Coverage percentage
- Flaky test rate

---

## Best Practices

### DO:
✅ Use descriptive test names  
✅ Test one thing per test  
✅ Clean up after tests  
✅ Use appropriate timeouts  
✅ Mock external dependencies when appropriate  
✅ Document complex test logic  

### DON'T:
❌ Test implementation details  
❌ Use hard-coded values without explanation  
❌ Skip error handling  
❌ Ignore flaky tests  
❌ Commit commented-out tests  

---

## Support

### Getting Help

- **Documentation:** `/src/mcp-ground-truth/README.md`
- **Test Plan:** `/test/mcp-ground-truth/TEST_PLAN.md`
- **Issues:** GitHub Issues
- **Slack:** #valuecanvas-testing

### Contributing

1. Write tests for new features
2. Ensure all tests pass
3. Update documentation
4. Submit PR with test results

---

**Guide Version:** 1.0  
**Last Updated:** November 27, 2025  
**Maintainer:** QA Team
