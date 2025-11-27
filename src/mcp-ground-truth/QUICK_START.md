# MCP Ground Truth Server - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies

```bash
# Already included in ValueCanvas package.json
npm install
```

### 2. Set Environment Variables

```bash
# Create .env file
cat > .env << EOF
ALPHA_VANTAGE_API_KEY=demo
EOF
```

### 3. Initialize Server

```typescript
import { createDevServer } from './src/mcp-ground-truth';

// Create server with defaults
const server = await createDevServer();

// Server is ready to use!
```

### 4. Make Your First Query

```typescript
// Get Apple's revenue
const result = await server.executeTool('get_authoritative_financials', {
  entity_id: 'AAPL',
  metrics: ['revenue_total'],
});

console.log(result);
```

---

## Common Use Cases

### Use Case 1: Public Company Analysis

```typescript
// Get comprehensive financials
const result = await server.executeTool('get_authoritative_financials', {
  entity_id: '0000320193', // Apple CIK
  metrics: [
    'revenue_total',
    'gross_profit',
    'operating_income',
    'net_income',
    'eps_diluted',
  ],
  period: 'FY2024',
});

// Parse response
const data = JSON.parse(result.content[0].text);
console.log('Revenue:', data.data[0].value);
console.log('Confidence:', data.metadata[0].extraction_confidence);
```

### Use Case 2: Private Company Estimation

```typescript
// Estimate private company revenue
const result = await server.executeTool('get_private_entity_estimates', {
  domain: 'stripe.com',
  industry_code: '522320', // Financial Transactions Processing
});

const data = JSON.parse(result.content[0].text);
console.log('Estimated Revenue:', data.data.value);
console.log('Confidence:', data.data.confidence_score);
console.log('Rationale:', data.data.rationale);
```

### Use Case 3: Verify Financial Claims

```typescript
// Verify a claim from a document
const result = await server.executeTool('verify_claim_aletheia', {
  claim_text: 'The company generated $50M in revenue last year',
  context_entity: '0001234567',
  strict_mode: true,
});

const data = JSON.parse(result.content[0].text);
if (data.verified) {
  console.log('✅ Claim verified');
} else {
  console.log('❌ Discrepancy:', data.discrepancy);
}
```

### Use Case 4: Value Driver Analysis

```typescript
// Calculate productivity gap
const result = await server.executeTool('populate_value_driver_tree', {
  target_cik: '0000320193',
  benchmark_naics: '541511',
  driver_node_id: 'productivity_delta',
  simulation_period: '2025-2027',
});

const data = JSON.parse(result.content[0].text);
console.log('Potential Value:', data.value);
console.log('Rationale:', data.rationale);
```

---

## Integration with Agents

### Step 1: Create Server Instance

```typescript
// In your agent initialization
import { createMCPServer } from './src/mcp-ground-truth';

const mcpServer = await createMCPServer({
  edgar: {
    userAgent: 'YourCompany contact@yourcompany.com',
  },
  marketData: {
    provider: 'alphavantage',
    apiKey: process.env.ALPHA_VANTAGE_API_KEY,
  },
});
```

### Step 2: Register Tools with Agent

```typescript
// Get available tools
const tools = mcpServer.getTools();

// Register each tool
for (const tool of tools) {
  agent.registerTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    execute: async (args) => {
      const result = await mcpServer.executeTool(tool.name, args);
      return result;
    },
  });
}
```

### Step 3: Agent Can Now Use Tools

```typescript
// Agent prompt
const systemPrompt = `
You are a financial analyst with access to authoritative financial data.

IMPORTANT RULES:
1. Always use get_authoritative_financials for public company data
2. Never generate financial numbers from memory
3. Check source_tier in responses:
   - Tier 1: State as fact with SEC citation
   - Tier 2: State as estimate with confidence
   - Tier 3: Use for context only
4. Before final output, verify claims with verify_claim_aletheia

Available tools:
- get_authoritative_financials: Get SEC filing data
- get_private_entity_estimates: Estimate private company metrics
- verify_claim_aletheia: Verify financial claims
- populate_value_driver_tree: Calculate value drivers
`;

// Agent will automatically call tools when needed
const response = await agent.chat('What was Apple\'s revenue in FY2024?');
```

---

## Configuration Options

### Basic Configuration

```typescript
const server = await createMCPServer({
  // EDGAR configuration
  edgar: {
    userAgent: 'YourCompany contact@yourcompany.com',
    rateLimit: 10, // requests per second
  },
  
  // XBRL configuration
  xbrl: {
    userAgent: 'YourCompany contact@yourcompany.com',
    rateLimit: 10,
  },
  
  // Market data configuration
  marketData: {
    provider: 'alphavantage', // or 'polygon', 'tiingo'
    apiKey: process.env.ALPHA_VANTAGE_API_KEY,
    rateLimit: 5, // requests per minute
  },
});
```

### Advanced Configuration

```typescript
const server = await createMCPServer({
  // ... basic config ...
  
  // Truth layer configuration
  truthLayer: {
    enableFallback: true,      // Allow fallback to lower tiers
    strictMode: true,          // Require Tier 1 for public companies
    maxResolutionTime: 30000,  // 30 second timeout
    parallelQuery: false,      // Query tiers sequentially
  },
  
  // Security configuration
  security: {
    enableWhitelist: true,     // Only allow whitelisted domains
    enableRateLimiting: true,  // Enforce rate limits
    enableAuditLogging: true,  // Log all requests
  },
});
```

---

## Error Handling

### Check for Errors

```typescript
const result = await server.executeTool('get_authoritative_financials', {
  entity_id: 'INVALID',
  metrics: ['revenue_total'],
});

if (result.isError) {
  const error = JSON.parse(result.content[0].text);
  console.error('Error:', error.error.code);
  console.error('Message:', error.error.message);
}
```

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `NO_DATA_FOUND` | No data available for request | Check CIK/ticker, try different period |
| `UPSTREAM_FAILURE` | External API failed | Check API keys, network connectivity |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |
| `INVALID_REQUEST` | Bad request parameters | Check required fields |
| `TIMEOUT` | Request took too long | Increase timeout or simplify query |

---

## Health Monitoring

### Check Server Health

```typescript
const health = await server.healthCheck();

console.log('Status:', health.status); // 'healthy', 'degraded', or 'unhealthy'
console.log('Modules:', health.details.modules);

// Check specific module
if (!health.details.modules['sec-edgar'].healthy) {
  console.error('EDGAR module is down');
}
```

---

## Performance Tips

### 1. Use Caching

```typescript
// First call - fetches from SEC
const result1 = await server.executeTool('get_authoritative_financials', {
  entity_id: 'AAPL',
  metrics: ['revenue_total'],
});

// Second call - returns from cache (instant)
const result2 = await server.executeTool('get_authoritative_financials', {
  entity_id: 'AAPL',
  metrics: ['revenue_total'],
});
```

### 2. Batch Queries

```typescript
// Instead of multiple calls
const companies = ['AAPL', 'MSFT', 'GOOGL'];

for (const ticker of companies) {
  const result = await server.executeTool('get_authoritative_financials', {
    entity_id: ticker,
    metrics: ['revenue_total'],
  });
  // Process result
}
```

### 3. Use Appropriate Tiers

```typescript
// For public companies - use Tier 1 (fastest, most reliable)
const publicResult = await server.executeTool('get_authoritative_financials', {
  entity_id: 'AAPL',
  metrics: ['revenue_total'],
});

// For private companies - use Tier 2 (estimation)
const privateResult = await server.executeTool('get_private_entity_estimates', {
  domain: 'stripe.com',
});

// For benchmarks - use Tier 3 (contextual)
// Access via industry benchmark module
```

---

## Troubleshooting

### Problem: "Module not initialized"

**Solution:** Ensure you call `await server.initialize()` or use `createMCPServer()` which initializes automatically.

### Problem: "Rate limit exceeded"

**Solution:** 
- Wait before retrying
- Reduce request frequency
- Increase rate limit in configuration (if allowed by provider)

### Problem: "No data found"

**Solution:**
- Verify CIK/ticker is correct
- Check if company has filed required documents
- Try different period (e.g., FY2023 instead of FY2024)
- Use fallback to Tier 2 for private companies

### Problem: "API key invalid"

**Solution:**
- Check environment variables are set
- Verify API key is active
- For Alpha Vantage, use 'demo' for testing

---

## Next Steps

1. **Read Full Documentation:** [README.md](./README.md)
2. **View Examples:** [examples/basic-usage.ts](./examples/basic-usage.ts)
3. **Integration Guide:** [integration/FinancialModelingIntegration.ts](./integration/FinancialModelingIntegration.ts)
4. **Implementation Details:** [/MCP_GROUND_TRUTH_IMPLEMENTATION.md](../../MCP_GROUND_TRUTH_IMPLEMENTATION.md)

---

## Support

- **Documentation:** `/src/mcp-ground-truth/README.md`
- **Examples:** `/src/mcp-ground-truth/examples/`
- **Issues:** Contact platform team

---

**Quick Start Version:** 1.0  
**Last Updated:** November 27, 2025
