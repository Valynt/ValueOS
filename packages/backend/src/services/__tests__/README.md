# Core Services Integration Testing

Comprehensive test suite for V1 Core Backend and Infrastructure integration across all service domains.

## Overview

This test suite validates the integration of all backend services including:

- **Deal Assembly**: CRMConnector, ContextExtractionAgent, DealAssemblyAgent
- **Ground Truth**: SECEdgarClient, XBRLParser
- **Trust Layer**: ReadinessScorer, PlausibilityClassifier
- **Promise Baseline**: PromiseBaselineService, checkpoint scheduling
- **Executive Output**: ArtifactGeneratorService

## Test Organization

```
packages/backend/src/services/__tests__/
├── deal/                    # Deal Assembly tests
│   └── CRMConnector.test.ts
├── ground-truth/            # Ground Truth tests
│   ├── SECEdgarClient.test.ts
│   └── XBRLParser.test.ts
├── integrity/               # Trust Layer tests
│   ├── ReadinessScorer.test.ts
│   └── PlausibilityClassifier.test.ts
├── realization/             # Promise Baseline tests
│   └── PromiseBaselineService.test.ts
├── export/                  # Executive Output tests
│   └── ArtifactGeneratorService.test.ts
├── integration/             # End-to-end integration tests
│   ├── servicePipeline.test.ts
│   └── helpers/testHelpers.ts
├── security/                # Security & tenant isolation tests
│   └── tenantIsolation.test.ts
└── widgets/                 # SDUI Widget tests
    ├── StakeholderMap.test.tsx
    ├── GapResolution.test.tsx
    ├── SDUIStateProvider.test.tsx
    └── LifecycleNav.test.tsx
```

## Prerequisites

### Environment Variables

Create `.env.test` file:

```bash
# Supabase (required)
VITE_SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# SEC EDGAR (optional - uses mocks by default)
SEC_USER_AGENT="YourApp (contact@example.com)"

# HubSpot CRM (optional - uses mocks by default)
HUBSPOT_API_KEY=test-key
```

### Database Setup

Ensure your test database has all migrations applied:

```bash
# Run migrations
pnpm run db:migrate

# Verify 4 migrations applied:
# - 20260318160647_value_modeling_assumptions_scenarios
# - 20260318160751_billing_v2_core_tables
# - 20260318161110_deal_assembly_tables
# - 20260318161200_trust_layer_provenance
```

### Install Dependencies

```bash
pnpm install
```

## Running Tests

### All Tests

```bash
pnpm --filter backend test
```

### Specific Test Suites

```bash
# Deal Assembly tests
pnpm --filter backend test deal/CRMConnector.test.ts

# Ground Truth tests
pnpm --filter backend test ground-truth/

# Trust Layer tests
pnpm --filter backend test integrity/

# Integration tests
pnpm --filter backend test integration/

# Security tests
pnpm --filter backend test security/
```

### Watch Mode

```bash
pnpm --filter backend test -- --watch
```

### Coverage

```bash
pnpm --filter backend test -- --coverage
```

### RLS Policy Validation

```bash
pnpm run test:rls
```

## Test Categories

### Unit Tests

Test individual service methods and agent behaviors in isolation.

**Key unit test files:**
- `CRMConnector.test.ts` - CRM data fetching, circuit breaker
- `SECEdgarClient.test.ts` - SEC API integration, circuit breaker
- `XBRLParser.test.ts` - XBRL fact parsing, deduplication
- `ContextExtractionAgent.test.ts` - LLM context extraction
- `DealAssemblyAgent.test.ts` - Deal context assembly
- `ReadinessScorer.test.ts` - Readiness score calculation
- `PlausibilityClassifier.test.ts` - Benchmark comparison

### Integration Tests

Test service-to-service communication and data flow.

**Key integration test files:**
- `servicePipeline.test.ts` - End-to-end service orchestration
  - CRM → DealAssembly → Database
  - SEC EDGAR → XBRL → Ground Truth
  - Assumptions → Readiness → Plausibility
  - Scenario approval → PromiseBaseline → Checkpoints
  - DealContext → Artifact generation

### Security Tests

Validate tenant isolation and RBAC enforcement.

**Key security test files:**
- `tenantIsolation.test.ts` - Cross-tenant access blocking
  - RLS policy validation
  - RBAC permission checks
  - Service role constraints

## Mock Configuration

### External API Mocks

Tests use Vitest mocking for external services:

```typescript
// Mock SEC EDGAR API
vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    filings: {
      recent: {
        form: ["10-K"],
        filingDate: ["2024-01-15"],
        accessionNumber: ["0000320193-24-000001"],
        primaryDocument: ["aapl-2023.htm"],
      },
    },
  }),
} as unknown as Response);
```

### LLM Gateway Mock

```typescript
const mockLLMGateway = {
  complete: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      stakeholders: [{ name: "John", role: "economic_buyer", priority: 9 }],
      use_cases: [],
      pain_points: [],
      baseline_clues: {},
      value_driver_candidates: [],
      objection_signals: [],
      missing_data: [],
      extraction_confidence: 0.8,
    }),
    model: "gpt-4",
    usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
  }),
};
```

### Memory System Mock

```typescript
const mockMemorySystem = {
  storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
  retrieve: vi.fn().mockResolvedValue([]),
};
```

## Test Data Factories

Located in `src/services/__tests__/integration/helpers/testHelpers.ts`:

```typescript
export const factories = {
  benchmark: (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    metric_name: "ROI",
    p25: 100,
    p50: 150,
    p75: 200,
    p90: 250,
    source: "test",
    date: new Date().toISOString(),
    sample_size: 100,
    ...overrides,
  }),

  assumption: (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    case_id: "case-1",
    name: "Test Assumption",
    value: 100,
    unit: "hours",
    source_type: "customer-confirmed",
    confidence_score: 0.8,
    benchmark_reference_id: null,
    ...overrides,
  }),

  case: (overrides: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    title: "Test Case",
    status: "draft",
    ...overrides,
  }),
};
```

## Common Test Patterns

### Agent Test Setup

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("MyAgent", () => {
  const mockMemorySystem = {
    storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
    retrieve: vi.fn().mockResolvedValue([]),
  };

  const mockLLMGateway = {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({ /* response */ }),
      model: "gpt-4",
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  };

  const mockCircuitBreaker = {
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });
});
```

### Service Test with Supabase

```typescript
import { supabase } from "../../../lib/supabase.js";

vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
```

### Testing Circuit Breakers

```typescript
it("should open circuit after repeated failures", async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

  // Trigger multiple failures
  for (let i = 0; i < 6; i++) {
    try {
      await client.fetchLatest10K("0000320193");
    } catch {
      // Expected
    }
  }

  const status = client.getCircuitStatus();
  expect(status.isOpen).toBe(true);
});
```

## Best Practices

1. **Isolation**: Each test should be independent and clean up after itself
2. **Mocking**: Mock external APIs (SEC EDGAR, HubSpot, LLM) to keep tests fast
3. **Idempotency**: Tests should produce same results when run multiple times
4. **Realistic Data**: Use factories to create realistic test data
5. **Clear Assertions**: Test one thing per test, with clear expectations
6. **Fast Execution**: Keep tests under 100ms each by mocking external services

## Test Coverage Goals

- **Unit tests**: 100% coverage of service public methods
- **Integration tests**: All critical service-to-service flows
- **Security tests**: 100% coverage of RLS policies and RBAC
- **Overall**: >70% line coverage for all new services

## Troubleshooting

### Database Connection Issues

```bash
# Verify database is running
pnpm run db:status

# Reset database if needed
pnpm run db:reset
```

### Test Failures

```bash
# Run with verbose output
pnpm --filter backend test -- --verbose

# Run specific failing test
pnpm --filter backend test -- -t "should extract context"
```

### Memory Leaks

```bash
# Run with memory profiling
pnpm --filter backend test -- --expose-gc
```

## CI/CD Integration

Tests run automatically in GitHub Actions on pull requests:

```yaml
- name: Run tests
  run: pnpm --filter backend test

- name: Validate RLS policies
  run: pnpm run test:rls

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Related Documentation

- [Backend Agent Instructions](../../AGENTS.md)
- [Database Migrations](../../../../infra/supabase/supabase/migrations/)
- [API Documentation](../../api/)
