# Test Data Factory Guide

Comprehensive guide for using test data factories in core service tests.

## Overview

Test data factories provide consistent, realistic test data generation. They ensure tests are:
- **Maintainable**: Change data structure in one place
- **Realistic**: Use production-like data shapes
- **Flexible**: Override specific fields per test
- **Type-safe**: Full TypeScript support

## Factory Location

**File**: `src/services/__tests__/integration/helpers/testHelpers.ts`

## Available Factories

### 1. Benchmark Factory

Generates benchmark data for plausibility testing.

```typescript
import { factories } from "./integration/helpers/testHelpers";

// Default benchmark
const benchmark = factories.benchmark();
// Result: { id: "uuid", tenant_id: "tenant-1", metric_name: "ROI", p25: 100, ... }

// Custom benchmark for specific metric
const npvBenchmark = factories.benchmark({
  metric_name: "NPV",
  p25: 50000,
  p50: 100000,
  p75: 150000,
  p90: 200000,
});

// Benchmark for specific industry
const industryBenchmark = factories.benchmark({
  metric_name: "ROI",
  source: "SaaS Industry Report 2024",
  industry: "Software",
  company_size_tier: "enterprise",
});
```

**Default Values**:
- `metric_name`: "ROI"
- `p25`: 100
- `p50`: 150
- `p75`: 200
- `p90`: 250
- `source`: "test"
- `date`: Current ISO timestamp
- `sample_size`: 100
- `tenant_id`: "tenant-1"

### 2. Assumption Factory

Generates assumption data for value modeling tests.

```typescript
import { factories } from "./integration/helpers/testHelpers";

// Validated assumption with evidence
const validatedAssumption = factories.assumption({
  source_type: "customer-confirmed",
  confidence_score: 0.9,
  benchmark_reference_id: "bm-1",
});

// Inferred assumption (needs validation)
const inferredAssumption = factories.assumption({
  source_type: "inferred",
  confidence_score: 0.4,
  benchmark_reference_id: null,
});

// Assumption with specific value
const costAssumption = factories.assumption({
  name: "Current Annual Cost",
  value: 500000,
  unit: "USD",
});
```

**Default Values**:
- `name`: "Test Assumption"
- `value`: 100
- `unit`: "hours"
- `source_type`: "customer-confirmed"
- `confidence_score`: 0.8
- `tenant_id`: "tenant-1"
- `case_id`: "case-1"

### 3. Case Factory

Generates value case data for testing workflows.

```typescript
import { factories } from "./integration/helpers/testHelpers";

// Draft case
const draftCase = factories.case({
  status: "draft",
  title: "Q1 Enterprise Deal",
});

// Active case
const activeCase = factories.case({
  status: "active",
  title: "ACME Corporation Expansion",
});

// Case with specific tenant
const tenantCase = factories.case({
  tenant_id: "tenant-123",
  title: "Multi-tenant Test Case",
});
```

**Default Values**:
- `title`: "Test Case"
- `status`: "draft"
- `tenant_id`: "tenant-1"

## Factory Patterns

### Creating Multiple Related Records

```typescript
// Create a complete test scenario
const tenantId = "tenant-1";
const caseId = "case-123";

// Create benchmarks
const benchmarks = [
  factories.benchmark({ tenant_id: tenantId, metric_name: "ROI" }),
  factories.benchmark({ tenant_id: tenantId, metric_name: "NPV" }),
];

// Create assumptions for the case
const assumptions = [
  factories.assumption({
    tenant_id: tenantId,
    case_id: caseId,
    source_type: "customer-confirmed",
    confidence_score: 0.9,
  }),
  factories.assumption({
    tenant_id: tenantId,
    case_id: caseId,
    source_type: "crm-derived",
    confidence_score: 0.7,
  }),
];

// Create the case
const testCase = factories.case({
  id: caseId,
  tenant_id: tenantId,
  status: "active",
});
```

### Creating Arrays of Records

```typescript
// Create 5 assumptions with varying confidence
const assumptions = Array.from({ length: 5 }, (_, i) =>
  factories.assumption({
    name: `Assumption ${i + 1}`,
    confidence_score: 0.5 + i * 0.1,
  })
);

// Create assumptions with different source types
const sourceTypes = ["customer-confirmed", "crm-derived", "call-derived", "inferred"];
const diverseAssumptions = sourceTypes.map((source) =>
  factories.assumption({ source_type: source })
);
```

### Overriding Nested Properties

```typescript
// Create assumption with complex metadata
const complexAssumption = factories.assumption({
  value: 1000,
  metadata_json: {
    original_value: 800,
    override_reason: "Customer provided updated data",
    override_by: "user-123",
    sources: ["crm", "call-notes"],
  },
});
```

## Using Factories in Tests

### Setup with Factories

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { factories, createMockSupabase } from "./helpers/testHelpers";

describe("Value Modeling Integration", () => {
  const mockSupabase = createMockSupabase();
  let testData: {
    case: ReturnType<typeof factories.case>;
    assumptions: ReturnType<typeof factories.assumption>[];
    benchmarks: ReturnType<typeof factories.benchmark>[];
  };

  beforeAll(() => {
    // Seed test data
    testData = {
      case: factories.case({ tenant_id: "tenant-1" }),
      assumptions: [
        factories.assumption({ case_id: "case-1", confidence_score: 0.9 }),
        factories.assumption({ case_id: "case-1", confidence_score: 0.7 }),
      ],
      benchmarks: [factories.benchmark({ tenant_id: "tenant-1" })],
    };

    // Seed mock database
    mockSupabase._mockData.set("assumptions", testData.assumptions);
    mockSupabase._mockData.set("benchmarks", testData.benchmarks);
  });

  it("should calculate readiness score", async () => {
    // Use testData in assertions
    expect(testData.assumptions).toHaveLength(2);
  });
});
```

### Factory Helpers for Readiness Testing

```typescript
// Create assumptions with specific validation states
function createValidationSet() {
  return {
    validated: factories.assumption({
      is_validated: true,
      has_evidence: true,
      has_benchmark: true,
      source_type: "customer-confirmed",
      confidence_score: 0.9,
    }),
    partiallyValidated: factories.assumption({
      is_validated: true,
      has_evidence: true,
      has_benchmark: false,
      source_type: "call-derived",
      confidence_score: 0.7,
    }),
    unvalidated: factories.assumption({
      is_validated: false,
      has_evidence: false,
      has_benchmark: false,
      source_type: "inferred",
      confidence_score: 0.3,
    }),
  };
}

// Use in test
it("should handle mixed validation states", () => {
  const { validated, partiallyValidated, unvalidated } = createValidationSet();
  
  const assumptions = [validated, partiallyValidated, unvalidated];
  const validationRate = assumptions.filter(a => a.is_validated).length / assumptions.length;
  
  expect(validationRate).toBe(0.67); // 2/3 validated
});
```

### Creating Evidence for Grounding Tests

```typescript
// Factory for evidence records
const evidenceFactory = {
  tier1: (assumptionId: string) => ({
    assumption_id: assumptionId,
    grounding_score: 0.9,
    tier: "tier_1" as const,
    source: "customer-confirmed",
  }),
  tier2: (assumptionId: string) => ({
    assumption_id: assumptionId,
    grounding_score: 0.7,
    tier: "tier_2" as const,
    source: "crm-derived",
  }),
  tier3: (assumptionId: string) => ({
    assumption_id: assumptionId,
    grounding_score: 0.4,
    tier: "tier_3" as const,
    source: "inferred",
  }),
};

// Use in test
const assumption = factories.assumption();
const evidence = [
  evidenceFactory.tier1(assumption.id),
  evidenceFactory.tier2(assumption.id),
];
```

## Extending Factories

### Adding New Factories

To add a new factory:

1. Define the type interface
2. Add to the factories object
3. Provide sensible defaults
4. Support override parameters

```typescript
// In testHelpers.ts
export interface StakeholderInput {
  id?: string;
  tenant_id?: string;
  name?: string;
  role?: string;
  priority?: number;
  source_type?: string;
}

export const factories = {
  // ... existing factories

  stakeholder: (overrides: StakeholderInput = {}) => ({
    id: crypto.randomUUID(),
    tenant_id: "tenant-1",
    name: "Test Stakeholder",
    role: "economic_buyer",
    priority: 5,
    source_type: "crm-derived",
    ...overrides,
  }),
};
```

### Factory Composition

Combine multiple factories for complex scenarios:

```typescript
// Complete deal context factory
function createDealContext(overrides: Partial<DealContext> = {}) {
  const tenantId = overrides.tenant_id ?? "tenant-1";
  const caseId = overrides.case_id ?? crypto.randomUUID();

  return {
    tenant_id: tenantId,
    case_id: caseId,
    opportunity_id: "opp-123",
    stakeholders: [
      factories.stakeholder({ tenant_id: tenantId, role: "economic_buyer" }),
      factories.stakeholder({ tenant_id: tenantId, role: "champion" }),
    ],
    use_cases: [
      {
        name: "Efficiency",
        description: "Improve process efficiency",
        pain_signals: ["slow workflows"],
        expected_outcomes: ["faster processing"],
        source_type: "crm-derived",
      },
    ],
    ...overrides,
  };
}

// Use in test
const dealContext = createDealContext({
  tenant_id: "tenant-456",
  stakeholders: [
    factories.stakeholder({ name: "John Smith", priority: 9 }),
  ],
});
```

## Best Practices

### 1. Use Defaults, Override Specifics

```typescript
// Good: Override only what matters for the test
const assumption = factories.assumption({
  confidence_score: 0.3, // Low confidence for this test
});

// Avoid: Recreating entire object
const assumption = {
  id: crypto.randomUUID(),
  tenant_id: "tenant-1",
  case_id: "case-1",
  name: "Test Assumption",
  value: 100,
  unit: "hours",
  source_type: "customer-confirmed",
  confidence_score: 0.3, // Only this matters
  // ... 10 more fields
};
```

### 2. Create Helper Functions for Common Patterns

```typescript
// Helper for creating validated assumptions
function createValidatedAssumption(count: number) {
  return Array.from({ length: count }, () =>
    factories.assumption({
      is_validated: true,
      has_evidence: true,
      has_benchmark: true,
      source_type: "customer-confirmed",
      confidence_score: 0.8 + Math.random() * 0.2,
    })
  );
}

// Use in multiple tests
const assumptions = createValidatedAssumption(5);
```

### 3. Use TypeScript for Type Safety

```typescript
// Define factory input types
type AssumptionOverrides = Partial<Omit<Assumption, "id">> & { id?: string };

// Typed factory function
function createAssumption(overrides: AssumptionOverrides = {}): Assumption {
  return factories.assumption(overrides);
}
```

### 4. Document Factory Usage in Tests

```typescript
it("should calculate readiness with high validation rate", () => {
  // Given: 5 validated assumptions with strong evidence
  const assumptions = Array.from({ length: 5 }, () =>
    factories.assumption({
      is_validated: true,
      has_evidence: true,
      has_benchmark: true,
      confidence_score: 0.9,
    })
  );

  // When: calculating readiness score
  const readiness = scorer.computeReadiness("case-1", assumptions, []);

  // Then: score should be high
  expect(readiness.overall_score).toBeGreaterThan(0.8);
});
```

### 5. Clean Up Test Data

```typescript
afterEach(async () => {
  // Clean up seeded data
  await cleanupTestData(supabase, testTenantId);
});
```

## Related Files

- `src/services/__tests__/integration/helpers/testHelpers.ts` - Factory definitions
- `src/services/__tests__/README.md` - General testing documentation
- `src/services/__tests__/MOCKS.md` - Mock configuration guide

## Troubleshooting

### Factory Returns Wrong Type

Ensure your factory returns the correct shape:

```typescript
// Check factory output
const result = factories.assumption();
console.log(result); // Inspect the output

// Add explicit return type
const assumption: Assumption = factories.assumption();
```

### Overriding Nested Properties

For nested overrides, use spread syntax:

```typescript
const assumption = factories.assumption({
  ...factories.assumption(), // Start with defaults
  metadata_json: {
    nested: "value",
  },
});
```

### Factory Performance

If creating many records, consider caching:

```typescript
// Cache expensive-to-create objects
const baseAssumption = factories.assumption();

// Clone and modify for multiple tests
const assumptions = Array.from({ length: 100 }, () => ({
  ...baseAssumption,
  id: crypto.randomUUID(), // Only change ID
}));
```
