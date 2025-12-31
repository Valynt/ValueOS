# SOF Test Suite

Comprehensive tests for the Systemic Outcome Framework (SOF) implementation.

## Test Coverage

### Agent Tests

#### SystemMapperAgent (`system-mapper-agent.test.ts`)
- System map creation from discovery data
- Entity identification and categorization
- Relationship mapping
- Leverage point identification
- System map updates
- Error handling

#### InterventionDesignerAgent (`intervention-designer-agent.test.ts`)
- Intervention design from system maps
- Feasibility assessment
- Intervention option generation
- Intervention sequencing
- Risk identification
- Resource estimation
- Error handling

### Service Tests

#### SOF Governance (`sof-governance.test.ts`)
- Governance control creation and management
- Compliance status tracking
- Compliance checking
- Audit event creation and retrieval
- Entity audit trail
- Lifecycle artifact linking
- Error handling

## Running Tests

### Run All SOF Tests
```bash
npm test test/sof
```

### Run Specific Test File
```bash
npm test test/sof/system-mapper-agent.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage test/sof
```

### Watch Mode
```bash
npm test -- --watch test/sof
```

## Test Structure

Each test file follows this structure:

1. **Setup**: Import dependencies and create test fixtures
2. **Test Suites**: Organized by functionality
3. **Test Cases**: Individual test scenarios
4. **Cleanup**: Remove test data after tests

## Test Data

Tests use generated test IDs to avoid conflicts:
- Business Case IDs: `test-bc-{timestamp}`
- System Map IDs: `test-map-{timestamp}`
- Entity IDs: `test-entity-{timestamp}`

## Mocking

Tests use Vitest mocking capabilities:
- `vi.fn()` for function mocks
- `vi.spyOn()` for method spies
- Mock database responses where appropriate

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Descriptive Names**: Test names should clearly describe what they test
4. **Assertions**: Use specific assertions, not just truthy checks
5. **Error Cases**: Test both success and failure scenarios

## Adding New Tests

When adding new SOF functionality:

1. Create test file in `test/sof/`
2. Follow existing naming conventions
3. Include setup and cleanup
4. Test happy path and error cases
5. Update this README

## Integration Tests

For full integration testing:

1. Set up test database
2. Run migrations
3. Execute integration test suite
4. Verify end-to-end workflows

## Performance Tests

Performance benchmarks for SOF operations:
- System map creation time
- Intervention design time
- Audit query performance
- Governance compliance checks

See `test/performance/` for performance test suite.

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Commits to main branch
- Pre-deployment checks

## Troubleshooting

### Database Connection Issues
Ensure test database is configured in `.env.test`

### Timeout Errors
Increase timeout for long-running tests:
```typescript
it('long test', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Mock Issues
Clear mocks between tests:
```typescript
afterEach(() => {
  vi.clearAllMocks();
});
```

## Future Test Coverage

Planned test additions:
- OutcomeEngineerAgent tests
- RealizationLoopAgent tests
- SDUI template rendering tests
- Component integration tests
- End-to-end workflow tests
