# LLM-MARL Test Suite

Comprehensive tests for the LLM-MARL (Multi-Agent Reinforcement Learning) implementation.

## Test Coverage

### CoordinatorAgent (`coordinator-agent.test.ts`)
- Task planning and decomposition
- Subgoal generation from patterns
- Agent routing based on capabilities
- Dependency resolution
- Complexity calculation
- SDUI layout generation
- Error handling

### MessageBus (`message-bus.test.ts`)
- Message publishing and delivery
- Subscription management
- Message compression/decompression
- Request-response patterns
- Broadcasting
- Channel statistics
- Message history
- Error handling

### Additional Test Files (To Be Created)
- `communicator-agent.test.ts` - CommunicatorAgent functionality
- `episodic-memory.test.ts` - Memory system operations
- `llm-gating.test.ts` - LLM gating logic
- `value-eval-agent.test.ts` - Artifact evaluation
- `simulation-loop.test.ts` - Workflow simulation
- `sdui-integration.test.ts` - SDUI rendering
- `integration.test.ts` - End-to-end workflows

## Running Tests

### Run All LLM-MARL Tests
```bash
npm test test/llm-marl
```

### Run Specific Test File
```bash
npm test test/llm-marl/coordinator-agent.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage test/llm-marl
```

### Watch Mode
```bash
npm test -- --watch test/llm-marl
```

## Test Structure

Each test file follows this structure:

1. **Setup**: Import dependencies and create test fixtures
2. **Test Suites**: Organized by functionality (describe blocks)
3. **Test Cases**: Individual test scenarios (it blocks)
4. **Cleanup**: Remove test data after tests (afterEach)

## Test Data

Tests use generated test IDs to avoid conflicts:
- Task IDs: `task-{timestamp}`
- Subgoal IDs: `subgoal-{timestamp}`
- Agent IDs: `agent-{timestamp}`
- Message IDs: `msg-{timestamp}`

## Mocking

Tests use Vitest mocking capabilities:
- `vi.fn()` for function mocks
- `vi.spyOn()` for method spies
- Mock LLM responses where appropriate
- Mock database calls for unit tests

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Descriptive Names**: Test names should clearly describe what they test
4. **Assertions**: Use specific assertions, not just truthy checks
5. **Error Cases**: Test both success and failure scenarios
6. **Async Handling**: Properly handle async operations with await

## Test Categories

### Unit Tests
Test individual functions and methods in isolation.

### Integration Tests
Test interactions between components.

### End-to-End Tests
Test complete workflows from start to finish.

## Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%

## Adding New Tests

When adding new LLM-MARL functionality:

1. Create test file in `test/llm-marl/`
2. Follow existing naming conventions
3. Include setup and cleanup
4. Test happy path and error cases
5. Update this README

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

### Async Issues
Always await async operations:
```typescript
await messageBus.publishMessage(...);
await new Promise(resolve => setTimeout(resolve, 100));
```

## Performance Tests

Performance benchmarks for LLM-MARL operations:
- Task planning time
- Message delivery latency
- Simulation execution time
- SDUI generation time

See `test/performance/` for performance test suite.

## Future Test Coverage

Planned test additions:
- Load testing for message bus
- Stress testing for coordinator
- Memory leak detection
- Concurrent operation tests
- Failure recovery tests
