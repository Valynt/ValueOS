## MCP Financial Ground Truth Server

**Version:** 2.1.0-Enterprise  
**Security Level:** IL4 (Impact Level 4 - Controlled Unclassified Information)  
**Standard:** Model Context Protocol (MCP) v1.0

### Overview

The MCP Financial Ground Truth Server is a deterministic, whitelisted, zero-hallucination data plane that powers all financial and operational assumptions for ValueCanvas. It replaces manual research and eliminates hallucinated baselines by providing authoritative financial data with full provenance tracking.

### Architecture

The server implements a **Tiered Truth Model** that guarantees reliability:

- **Tier 1:** Authoritative Public Data (SEC EDGAR, XBRL) - Confidence: 0.9-1.0
- **Tier 2:** High-confidence private data and inferred ranges (Crunchbase, ZoomInfo, Census) - Confidence: 0.5-0.85
- **Tier 3:** Narrative/contextual data (Industry benchmarks, wage data) - Confidence: 0.2-0.6

All outputs contain provenance, timestamps, confidence scores, and raw extracts.

### Key Features

✅ **Zero Hallucination** - All numeric data is cited from deterministic sources  
✅ **Whitelisted Data Access** - Only approved sources can be queried  
✅ **Deterministic Resolution** - EDGAR/XBRL override all other sources  
✅ **Provenance-First Design** - Every number includes source, confidence, timestamp  
✅ **Secure-by-Default** - Sandboxed execution, isolated egress, key rotation  
✅ **Full Observability** - Structured logs, metrics, distributed tracing

### Quick Start

```typescript
import { createMCPServer } from './mcp-ground-truth';

// Create and initialize server
const server = await createMCPServer({
  edgar: {
    userAgent: 'YourCompany contact@yourcompany.com',
  },
  marketData: {
    provider: 'alphavantage',
    apiKey: process.env.ALPHA_VANTAGE_API_KEY,
  },
});

// Execute a tool
const result = await server.executeTool('get_authoritative_financials', {
  entity_id: '0000320193', // Apple Inc.
  metrics: ['revenue_total', 'net_income'],
  period: 'FY2024',
});

console.log(result);
```

### Available MCP Tools

#### 1. `get_authoritative_financials` (Tier 1)

Retrieves legally binding GAAP financial data from SEC EDGAR filings.

```typescript
await server.executeTool('get_authoritative_financials', {
  entity_id: '0000320193', // CIK or ticker
  period: 'FY2024',
  metrics: ['revenue_total', 'gross_profit', 'net_income'],
  currency: 'USD',
});
```

**Returns:**
```json
{
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
    "filing_type": "10-K",
    "accession_number": "0000320193-24-000123",
    "extraction_confidence": 0.97
  }],
  "audit": {
    "trace_id": "mcp-req-1234567890",
    "timestamp": "2025-11-27T00:00:00Z",
    "verification_hash": "sha256:abc123..."
  }
}
```

#### 2. `get_private_entity_estimates` (Tier 2)

Generates financial estimates for private companies using proxy data.

```typescript
await server.executeTool('get_private_entity_estimates', {
  domain: 'openai.com',
  proxy_metric: 'headcount_linkedin',
  industry_code: '541511', // NAICS code
});
```

**Returns:**
```json
{
  "data": {
    "domain": "openai.com",
    "metric": "revenue_estimate",
    "value": [50000000, 100000000],
    "confidence_score": 0.72,
    "rationale": "Estimated using headcount range (200-400) × industry benchmark ($250,000/employee)"
  },
  "metadata": {
    "source_tier": 2,
    "estimation_method": "headcount_proxy",
    "quality_factors": [1.0, 1.1, 1.05]
  }
}
```

#### 3. `verify_claim_aletheia` (Verification)

Cross-references natural language claims against ground truth data.

```typescript
await server.executeTool('verify_claim_aletheia', {
  claim_text: 'Apple generated $383B in revenue in FY2024',
  context_entity: '0000320193',
  strict_mode: true,
});
```

**Returns:**
```json
{
  "verified": true,
  "confidence": 0.97,
  "evidence": {
    "metric": "revenue_total",
    "value": 383285000000,
    "source": "xbrl-parser",
    "tier": "tier1"
  }
}
```

#### 4. `populate_value_driver_tree` (Value Engineering)

Calculates productivity deltas for value driver analysis.

```typescript
await server.executeTool('populate_value_driver_tree', {
  target_cik: '0000320193',
  benchmark_naics: '541511',
  driver_node_id: 'productivity_delta',
  simulation_period: '2025-2027',
});
```

**Returns:**
```json
{
  "node_id": "productivity_delta",
  "value": 70000000,
  "rationale": "Productivity gap of $70,000/employee vs industry benchmark",
  "confidence": 0.85,
  "supporting_data": [...]
}
```

### Module Architecture

```
src/mcp-ground-truth/
├── core/
│   ├── BaseModule.ts          # Abstract base for all modules
│   ├── UnifiedTruthLayer.ts   # Tiered resolution engine
│   └── MCPServer.ts            # MCP protocol implementation
├── modules/
│   ├── EDGARModule.ts          # SEC EDGAR filing retrieval
│   ├── XBRLModule.ts           # XBRL structured data parser
│   ├── MarketDataModule.ts     # Real-time market data
│   ├── PrivateCompanyModule.ts # Private company estimation
│   └── IndustryBenchmarkModule.ts # Industry benchmarks
├── types/
│   └── index.ts                # TypeScript type definitions
└── index.ts                    # Main export
```

### Data Contracts

All modules return a standardized `FinancialMetric` object:

```typescript
interface FinancialMetric {
  type: 'metric' | 'range' | 'text' | 'narrative';
  metric_name: string;
  value: number | string | [number, number];
  confidence: number; // 0.0 to 1.0
  tier: 'tier1' | 'tier2' | 'tier3';
  source: string;
  timestamp: string; // ISO 8601
  metadata: Record<string, any>;
  raw_extract?: string;
  provenance: ProvenanceInfo;
}
```

### Tiered Resolution Hierarchy

The Unified Truth Layer implements deterministic resolution:

1. **Try Tier 1 (EDGAR/XBRL)** - If public company data exists, use it
2. **Fallback to Tier 2 (Market/Private)** - If Tier 1 unavailable
3. **Fallback to Tier 3 (Benchmarks)** - For contextual data only

```typescript
const result = await truthLayer.resolve({
  identifier: '0000320193',
  metric: 'revenue_total',
  prefer_tier: 'tier1',
  fallback_enabled: true,
});
```

### Security Features

#### Whitelisted Domains
Only approved data sources can be accessed:
- `sec.gov` (EDGAR/XBRL)
- `alphavantage.co` (Market data)
- `polygon.io` (Market data)
- `census.gov` (Industry benchmarks)
- `bls.gov` (Wage data)

#### Rate Limiting
Each module enforces provider-specific rate limits:
- SEC EDGAR: 10 requests/second
- Alpha Vantage: 5 requests/minute
- Custom limits per API key

#### Audit Logging
All requests are logged with:
- Trace ID
- User/Agent ID
- Request parameters
- Response data
- Provenance information
- Execution time

### Performance Targets

- EDGAR fetch: ~250ms (cached)
- XBRL parse: ~60ms
- Market API: ~80ms
- Private data: 120-300ms
- **Total round-trip target: <400ms**

### Integration with Agents

The MCP server integrates seamlessly with LLM agents:

```typescript
// In your agent's tool registry
import { createMCPServer } from './mcp-ground-truth';

const mcpServer = await createMCPServer(config);

// Register MCP tools with agent
const tools = mcpServer.getTools();
for (const tool of tools) {
  agentToolRegistry.register(tool);
}

// Agent can now call tools
const result = await agent.callTool('get_authoritative_financials', {
  entity_id: 'AAPL',
  metrics: ['revenue_total'],
});
```

### Agent Reasoning Rules

To ensure zero-hallucination, agents must follow these rules:

**Rule 1: The Citation Imperative**
> "You are forbidden from generating specific financial figures from your internal training data. You must invoke `get_authoritative_financials` for every numeric claim. If the tool returns `null`, state that data is unavailable."

**Rule 2: Tiered Trust Handling**
> "Check the `source_tier` in the JSON response:
> - Tier 1: State as fact. 'Revenue was $10B [Source: SEC]'
> - Tier 2: State as estimate. 'Revenue is estimated at $8-12B based on headcount'
> - Tier 3: Use for context only. 'Industry benchmark is $250k/employee'"

**Rule 3: The Aletheia Loop**
> "Before outputting the final response, pass your draft summary to `verify_claim_aletheia`. If `verified` is `false`, rewrite the claim using the provided `evidence_snippet`."

### Environment Variables

```bash
# Market Data API Keys
ALPHA_VANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
TIINGO_API_KEY=your_key_here

# Private Company Data
CRUNCHBASE_API_KEY=your_key_here
ZOOMINFO_API_KEY=your_key_here
LINKEDIN_API_KEY=your_key_here

# Government Data
BLS_API_KEY=your_key_here
CENSUS_API_KEY=your_key_here
```

### Testing

```bash
# Run unit tests
npm test src/mcp-ground-truth

# Run integration tests
npm test src/mcp-ground-truth/integration

# Test specific module
npm test src/mcp-ground-truth/modules/EDGARModule.test.ts
```

### Monitoring

The server exposes health check and metrics endpoints:

```typescript
// Health check
const health = await server.healthCheck();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'

// Module-specific health
console.log(health.details.modules);
```

### Error Handling

All errors follow a standardized format:

```typescript
{
  error: {
    code: 'NO_DATA_FOUND' | 'UPSTREAM_FAILURE' | 'RATE_LIMIT_EXCEEDED' | ...,
    message: 'Human-readable error message',
    details: { /* Additional context */ }
  }
}
```

### Future Enhancements

- [ ] LLM-based structured extraction for non-XBRL filings
- [ ] Sector-specific benchmark enrichment
- [ ] Automated peer set detection
- [ ] Real-time filing alerts
- [ ] Multi-currency support
- [ ] Historical trend analysis
- [ ] Predictive analytics integration

### License

Proprietary - ValueCanvas Platform

### Support

For issues or questions, contact: support@valuecanvas.com
