# Mock Configuration Guide

This document details how to configure mocks for external APIs used in core service tests.

## Overview

All external API calls are mocked in tests to ensure:
- **Fast execution**: No network latency
- **Reliability**: No dependency on external service availability
- **Determinism**: Consistent test results
- **Isolation**: Tests don't affect production data

## External APIs Mocked

### 1. SEC EDGAR API

Used by: `SECEdgarClient`

**Base URL**: `https://www.sec.gov/Archives/edgar/`

**Mock Pattern**:

```typescript
// Mock company tickers endpoint
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    "0": { ticker: "AAPL", title: "Apple Inc.", cik_str: "320193" },
    "1": { ticker: "MSFT", title: "Microsoft Corp", cik_str: "789019" },
  }),
} as unknown as Response);

// Mock submissions endpoint
const mockSubmissions = {
  filings: {
    recent: {
      form: ["10-K", "10-Q", "8-K"],
      filingDate: ["2024-01-15", "2024-04-15", "2024-02-20"],
      accessionNumber: ["0000320193-24-000001", "0000320193-24-000002"],
      primaryDocument: ["aapl-2023.htm", "aapl-2024q1.htm"],
    },
  },
};

// Mock filing content
const mockFilingContent = `
<html>
  <body>
    <div>ITEM 1. BUSINESS</div>
    <p>Apple Inc. designs, manufactures, and markets smartphones...</p>
    <div>ITEM 1A. RISK FACTORS</div>
    <p>The Company's business is subject to various risks...</p>
  </body>
</html>
`;
```

**Test File**: `src/services/__tests__/ground-truth/SECEdgarClient.test.ts`

### 2. XBRL Company Facts API

Used by: `XBRLParser`

**Base URL**: `https://data.sec.gov/api/xbrl/companyfacts`

**Mock Pattern**:

```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    cik: "0000320193",
    entityName: "Apple Inc.",
    facts: {
      "us-gaap": {
        Revenues: {
          label: "Revenues",
          description: "Amount of revenue",
          units: {
            USD: [
              { val: 394328000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" },
              { val: 365817000000, filed: "2022-10-28", fy: "2022", fp: "FY", form: "10-K" },
            ],
          },
        },
        NetIncomeLoss: {
          label: "Net Income",
          units: {
            USD: [
              { val: 96995000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" },
            ],
          },
        },
      },
    },
  }),
} as unknown as Response);
```

**Test File**: `src/services/__tests__/ground-truth/XBRLParser.test.ts`

### 3. HubSpot CRM API

Used by: `CRMConnector`

**Mock Pattern**:

The `CRMConnector` uses a built-in mock implementation:

```typescript
// In CRMConnector.ts, the mockHubSpotFetch method returns:
const mockResponse = {
  opportunity: {
    id: "opp-123",
    name: "Enterprise Expansion Opportunity",
    stage: "qualified",
    amount: 150000,
    close_date: "2024-06-30",
    probability: 0.6,
    owner: { id: "owner-1", name: "Sales Rep", email: "rep@example.com" },
  },
  account: {
    id: "acc-1",
    name: "ACME Corporation",
    industry: "Technology",
    size_employees: 500,
    annual_revenue: 50000000,
  },
  contacts: [
    { id: "c1", first_name: "John", last_name: "Smith", role: "economic_buyer", is_primary: true },
  ],
};
```

**Test File**: `src/services/__tests__/deal/CRMConnector.test.ts`

### 4. LLM Gateway

Used by: `ContextExtractionAgent`, `DealAssemblyAgent`, and other agents

**Mock Pattern**:

```typescript
const mockLLMGateway = {
  complete: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      stakeholders: [
        { name: "John Smith", role: "economic_buyer", priority: 9, source_type: "crm-derived" },
      ],
      use_cases: [
        { name: "Efficiency", description: "Improve", pain_signals: ["slow"], expected_outcomes: ["fast"], source_type: "crm-derived" },
      ],
      pain_points: ["slow processes"],
      baseline_clues: {},
      value_driver_candidates: [
        { driver_name: "Auto", impact_estimate_low: 100, impact_estimate_high: 200, evidence_strength: 0.8, signal_sources: ["crm"], confidence_score: 0.8 },
      ],
      objection_signals: [],
      missing_data: [],
      extraction_confidence: 0.8,
    }),
    model: "gpt-4",
    usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
  }),
};
```

**Test Files**:
- `src/lib/agent-fabric/agents/__tests__/ContextExtractionAgent.test.ts`
- `src/lib/agent-fabric/agents/__tests__/DealAssemblyAgent.test.ts`

### 5. Supabase Client

Used by: Most services for database operations

**Mock Pattern**:

```typescript
vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));
```

**Test Files**: Various service test files

### 6. Memory System

Used by: All agents for storing/retrieving context

**Mock Pattern**:

```typescript
const mockMemorySystem = {
  storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
  retrieve: vi.fn().mockResolvedValue([]),
};
```

**Test Files**: All agent test files

## Mock Helper Functions

### Fetch Mock Helpers

```typescript
// Create a successful fetch mock
export function createFetchMock(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  } as unknown as Response);
}

// Create a failed fetch mock
export function createFetchErrorMock(status: number, statusText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
  } as Response);
}

// Create a network error mock
export function createNetworkErrorMock(error: string) {
  return vi.fn().mockRejectedValue(new Error(error));
}
```

### SEC EDGAR Mock Helpers

```typescript
// Mock CIK lookup response
export function createCIKMock(ticker: string, cik: string) {
  return {
    ok: true,
    json: async () => ({
      "0": { ticker, title: `${ticker} Corp`, cik_str: cik },
    }),
  };
}

// Mock filing submissions response
export function createSubmissionsMock(cik: string, forms: string[]) {
  return {
    ok: true,
    json: async () => ({
      filings: {
        recent: {
          form: forms,
          filingDate: forms.map((_, i) => `2024-0${i + 1}-15`),
          accessionNumber: forms.map((_, i) => `${cik}-24-00000${i + 1}`),
          primaryDocument: forms.map((f) => `${cik}-${f.toLowerCase()}.htm`),
        },
      },
    }),
  };
}
```

### LLM Response Mock Helpers

```typescript
// Create a structured LLM response for context extraction
export function createContextExtractionResponse(partial: Partial<ContextExtractionOutput> = {}) {
  return {
    content: JSON.stringify({
      stakeholders: partial.stakeholders ?? [],
      use_cases: partial.use_cases ?? [],
      pain_points: partial.pain_points ?? [],
      baseline_clues: partial.baseline_clues ?? {},
      value_driver_candidates: partial.value_driver_candidates ?? [],
      objection_signals: partial.objection_signals ?? [],
      missing_data: partial.missing_data ?? [],
      extraction_confidence: partial.extraction_confidence ?? 0.8,
    }),
    model: "gpt-4",
    usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
  };
}
```

## Circuit Breaker Testing

Circuit breakers are tested by simulating repeated failures:

```typescript
it("should open circuit after repeated failures", async () => {
  // Mock fetch to always fail
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

  const client = new SECEdgarClient();

  // Trigger multiple failures
  for (let i = 0; i < 6; i++) {
    try {
      await client.fetchLatest10K("0000320193");
    } catch {
      // Expected
    }
  }

  // Circuit should be open
  const status = client.getCircuitStatus();
  expect(status.isOpen).toBe(true);
  expect(status.failures).toBeGreaterThanOrEqual(5);
});
```

## Best Practices

### 1. Reset Mocks Between Tests

```typescript
import { beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### 2. Mock at the Module Level

```typescript
// At the top of the test file
vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
```

### 3. Use Type-Safe Mocks

```typescript
const mockLLMGateway = {
  complete: vi.fn<[], Promise<LLMResponse>>().mockResolvedValue({
    content: "...",
    model: "gpt-4",
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  }),
};
```

### 4. Test Both Success and Failure Cases

```typescript
it("should handle API success", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  // Test success path
});

it("should handle API failure", async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
  // Test failure path
});

it("should handle network error", async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
  // Test error path
});
```

### 5. Mock Timeouts

```typescript
it("should handle timeout", async () => {
  global.fetch = vi.fn().mockImplementation(() => 
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 31000)
    )
  );
  // Test timeout handling
});
```

## Troubleshooting

### Mock Not Being Called

If your mock isn't being called:
1. Check that the mock is defined before importing the module under test
2. Verify the import path in the mock matches the actual import path
3. Use `vi.clearAllMocks()` in `beforeEach` to ensure clean state

### Mock Returning Wrong Data

If the mock returns wrong data:
1. Check the structure matches what the code expects
2. Use `console.log` to inspect the mock return value
3. Verify the mock is properly typed

### Network Calls Still Happening

If real network calls are happening:
1. Ensure `global.fetch` is properly mocked
2. Check for any code paths that bypass the mock
3. Use `vi.spyOn(global, 'fetch')` to intercept calls

## Related Files

- `src/services/__tests__/integration/helpers/testHelpers.ts` - Shared test utilities
- `src/services/__tests__/fixtures/securityFixtures.ts` - Security test payloads
- `src/services/__tests__/README.md` - General testing documentation
