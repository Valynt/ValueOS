# Tool System Guide

## Overview

ValueCanvas implements a **Model Context Protocol (MCP) compatible** tool system that enables hot-swappable tools without orchestrator refactoring. This allows agents to use standardized tools for web search, financial calculations, database queries, and more.

## Architecture

```
┌─────────────────────────────────────────┐
│         Agent / Orchestrator            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│          Tool Registry                   │
│  - MCP-compatible interface              │
│  - Hot-swap capability                   │
│  - Rate limiting                         │
│  - Execution tracking                    │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬───────────┬──────────┐
       ▼               ▼           ▼          ▼
┌──────────┐    ┌──────────┐  ┌──────────┐  ┌──────────┐
│   Web    │    │Financial │  │Database  │  │  Custom  │
│  Search  │    │ Modeling │  │  Query   │  │   Tool   │
└──────────┘    └────┬─────┘  └──────────┘  └──────────┘
                     │
                     ▼
              ┌──────────────┐
              │   Sandbox    │
              │  (E2B/VM)    │
              └──────────────┘
```

## Key Features

### 1. MCP-Compatible Interface

Tools implement a standardized interface compatible with:
- **Anthropic's Model Context Protocol (MCP)**
- **OpenAI Function Calling**
- **Custom tool specifications**

### 2. Hot-Swap Capability

Register, unregister, and replace tools at runtime without restarting:

```typescript
// Register tool
toolRegistry.register(new WebSearchTool());

// Replace with improved version
toolRegistry.unregister('web_search');
toolRegistry.register(new ImprovedWebSearchTool());

// No orchestrator changes needed!
```

### 3. Sandboxed Execution

Secure code execution for complex calculations:
- **E2B integration** for isolated Python/JavaScript execution
- **Resource limits** (CPU, memory, timeout)
- **Security validation** to prevent dangerous code
- **Automatic cleanup** after execution

### 4. Rate Limiting

Per-tool, per-user rate limiting:

```typescript
metadata: {
  rateLimit: {
    maxCalls: 10,
    windowMs: 60000 // 10 calls per minute
  }
}
```

## Tool Interface

### MCPTool Interface

```typescript
interface MCPTool {
  // Unique identifier
  name: string;
  
  // Human-readable description
  description: string;
  
  // JSON Schema for parameters
  parameters: JSONSchema;
  
  // Execute the tool
  execute(params: any, context?: ToolExecutionContext): Promise<ToolResult>;
  
  // Optional: Validate parameters
  validate?(params: any): Promise<ValidationResult>;
  
  // Optional: Metadata
  metadata?: {
    version?: string;
    author?: string;
    category?: string;
    tags?: string[];
    rateLimit?: {
      maxCalls: number;
      windowMs: number;
    };
  };
}
```

### Creating a Tool

```typescript
import { BaseTool, ToolResult, ToolExecutionContext } from '../services/ToolRegistry';

export class MyCustomTool extends BaseTool {
  name = 'my_custom_tool';
  description = 'Does something useful';
  
  parameters = {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
  };

  metadata = {
    version: '1.0.0',
    category: 'utility',
    rateLimit: {
      maxCalls: 100,
      windowMs: 60000,
    },
  };

  async execute(
    params: { input: string },
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      // Your tool logic here
      const result = await this.doSomething(params.input);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error.message,
        },
      };
    }
  }
}
```

## Built-in Tools

### 1. Web Search Tool

Search the web for current information:

```typescript
import { WebSearchTool } from './tools/WebSearchTool';
import { toolRegistry } from './services/ToolRegistry';

// Register tool
toolRegistry.register(new WebSearchTool());

// Use tool
const result = await toolRegistry.execute('web_search', {
  query: 'latest AI trends 2024',
  maxResults: 5
});

console.log(result.data.results);
```

**Use Cases**:
- Market research
- Competitor analysis
- Current events
- Industry trends

### 2. Financial Modeling Tool

Complex financial calculations with sandboxed execution:

```typescript
import { FinancialModelingTool } from './tools/FinancialModelingTool';

// Register tool
toolRegistry.register(new FinancialModelingTool());

// Calculate NPV
const npvResult = await toolRegistry.execute('financial_modeling', {
  calculation: 'npv',
  cashFlows: [-100000, 30000, 40000, 50000, 60000],
  discountRate: 0.1
});

console.log(`NPV: $${npvResult.data.result}`);

// Calculate IRR
const irrResult = await toolRegistry.execute('financial_modeling', {
  calculation: 'irr',
  cashFlows: [-100000, 30000, 40000, 50000, 60000]
});

console.log(`IRR: ${(irrResult.data.result * 100).toFixed(2)}%`);

// Monte Carlo simulation
const mcResult = await toolRegistry.execute('financial_modeling', {
  calculation: 'monte_carlo',
  monteCarloParams: {
    initialValue: 100000,
    expectedReturn: 0.08,
    volatility: 0.15,
    periods: 10,
    simulations: 1000
  }
});

console.log(`Expected value: $${mcResult.data.result.mean}`);
console.log(`5th percentile: $${mcResult.data.result.percentile5}`);
console.log(`95th percentile: $${mcResult.data.result.percentile95}`);
```

**Calculations Supported**:
- **NPV** (Net Present Value)
- **IRR** (Internal Rate of Return)
- **Payback Period**
- **Monte Carlo Simulation**

**Why Sandboxed Execution?**

LLMs are notoriously bad at complex math. By generating Python code and executing it in a sandbox, we get:
- ✅ Accurate calculations
- ✅ Complex algorithms (Newton-Raphson, Monte Carlo)
- ✅ Security through isolation
- ✅ Support for scientific libraries (NumPy, SciPy)

## Sandboxed Execution

### E2B Integration

ValueCanvas uses [E2B](https://e2b.dev) for secure code execution:

```typescript
import { sandboxedExecutor } from './services/SandboxedExecutor';

// Execute Python code
const result = await sandboxedExecutor.executePython(`
import numpy as np

# Complex calculation
data = np.array([1, 2, 3, 4, 5])
mean = np.mean(data)
std = np.std(data)

print(f"Mean: {mean}, Std: {std}")
`, {
  timeout: 5000,
  memory: '128MB',
  cpu: 1
});

console.log(result.stdout);
```

### Security Features

1. **Isolated Execution**: Code runs in separate VM
2. **Resource Limits**: CPU, memory, timeout constraints
3. **Code Validation**: Detect dangerous patterns
4. **Automatic Cleanup**: Sessions destroyed after execution

### Code Validation

```typescript
const validation = sandboxedExecutor.validateCode(`
import os
os.system('rm -rf /')  # Dangerous!
`, 'python');

if (!validation.safe) {
  console.error('Dangerous code detected:', validation.issues);
  // Block execution
}
```

## Agent Integration

### Using Tools in Agents

```typescript
import { toolRegistry } from './services/ToolRegistry';

class OpportunityAgent {
  async generate(input: any): Promise<any> {
    // Agent decides it needs market research
    const searchResult = await toolRegistry.execute('web_search', {
      query: `${input.industry} market trends 2024`,
      maxResults: 5
    });
    
    // Use search results to inform generation
    const marketInsights = searchResult.data.results;
    
    // Agent decides it needs financial analysis
    const npvResult = await toolRegistry.execute('financial_modeling', {
      calculation: 'npv',
      cashFlows: input.projectedCashFlows,
      discountRate: 0.1
    });
    
    // Generate opportunity with real data
    return {
      valueProposition: this.generateWithContext(marketInsights),
      financialViability: npvResult.data.result > 0,
      npv: npvResult.data.result
    };
  }
}
```

### Tool Selection

Agents can dynamically select tools based on context:

```typescript
// Convert tools to OpenAI function format
const functions = toolRegistry.toOpenAIFunctions();

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a business analyst.' },
    { role: 'user', content: 'Analyze this business opportunity...' }
  ],
  functions,
  function_call: 'auto'
});

// Execute selected tool
if (response.choices[0].function_call) {
  const toolName = response.choices[0].function_call.name;
  const params = JSON.parse(response.choices[0].function_call.arguments);
  
  const result = await toolRegistry.execute(toolName, params);
  // Continue conversation with result
}
```

## Tool Registry API

### Register Tool

```typescript
toolRegistry.register(new MyTool());
```

### Unregister Tool

```typescript
toolRegistry.unregister('tool_name');
```

### List Tools

```typescript
// All tools
const allTools = toolRegistry.list();

// By category
const financialTools = toolRegistry.list('financial');
```

### Execute Tool

```typescript
const result = await toolRegistry.execute(
  'tool_name',
  { param1: 'value1' },
  {
    userId: 'user-123',
    workflowId: 'workflow-456',
    traceId: 'trace-789'
  }
);
```

### Get Statistics

```typescript
const stats = toolRegistry.getStatistics();
console.log(`Total executions: ${stats.totalExecutions}`);
console.log('By tool:', stats.byTool);
```

## Configuration

### Environment Variables

```bash
# E2B API Key (for sandboxed execution)
E2B_API_KEY=your-e2b-api-key

# Tool-specific configuration
WEB_SEARCH_API_KEY=your-search-api-key
```

### Tool Configuration

```typescript
// Configure tool at registration
const tool = new WebSearchTool();
tool.metadata.rateLimit = {
  maxCalls: 20,
  windowMs: 60000
};

toolRegistry.register(tool);
```

## Best Practices

### 1. Use Descriptive Names

```typescript
// Good
name = 'financial_npv_calculator';

// Bad
name = 'calc';
```

### 2. Provide Clear Descriptions

```typescript
description = 'Calculate Net Present Value (NPV) for a series of cash flows using a specified discount rate. Returns the present value of future cash flows.';
```

### 3. Define Complete Schemas

```typescript
parameters = {
  type: 'object',
  properties: {
    cashFlows: {
      type: 'array',
      items: { type: 'number' },
      description: 'Array of cash flows, where index 0 is the initial investment (typically negative)',
      minItems: 2
    },
    discountRate: {
      type: 'number',
      description: 'Discount rate as a decimal (e.g., 0.1 for 10%)',
      minimum: 0,
      maximum: 1
    }
  },
  required: ['cashFlows', 'discountRate']
};
```

### 4. Implement Validation

```typescript
async validate(params: any): Promise<ValidationResult> {
  const errors: string[] = [];
  
  if (params.cashFlows && params.cashFlows.length < 2) {
    errors.push('At least 2 cash flows required');
  }
  
  if (params.discountRate && (params.discountRate < 0 || params.discountRate > 1)) {
    errors.push('Discount rate must be between 0 and 1');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

### 5. Handle Errors Gracefully

```typescript
async execute(params: any): Promise<ToolResult> {
  try {
    const result = await this.doWork(params);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Tool execution failed', error);
    return {
      success: false,
      error: {
        code: 'EXECUTION_FAILED',
        message: error.message,
        details: { originalError: error }
      }
    };
  }
}
```

### 6. Set Appropriate Rate Limits

```typescript
// High-cost operations
metadata: {
  rateLimit: {
    maxCalls: 5,
    windowMs: 60000 // 5 per minute
  }
}

// Low-cost operations
metadata: {
  rateLimit: {
    maxCalls: 100,
    windowMs: 60000 // 100 per minute
  }
}
```

## Testing

### Unit Testing Tools

```typescript
import { MyTool } from './tools/MyTool';

describe('MyTool', () => {
  let tool: MyTool;
  
  beforeEach(() => {
    tool = new MyTool();
  });
  
  it('should execute successfully', async () => {
    const result = await tool.execute({ input: 'test' });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
  
  it('should validate parameters', async () => {
    const validation = await tool.validate({});
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Missing required parameter: input');
  });
});
```

### Integration Testing

```typescript
import { toolRegistry } from './services/ToolRegistry';
import { MyTool } from './tools/MyTool';

describe('Tool Registry Integration', () => {
  beforeEach(() => {
    toolRegistry.clear();
    toolRegistry.register(new MyTool());
  });
  
  it('should execute tool through registry', async () => {
    const result = await toolRegistry.execute('my_tool', { input: 'test' });
    
    expect(result.success).toBe(true);
  });
  
  it('should enforce rate limits', async () => {
    // Execute tool multiple times
    for (let i = 0; i < 10; i++) {
      await toolRegistry.execute('my_tool', { input: 'test' });
    }
    
    // Next call should be rate limited
    const result = await toolRegistry.execute('my_tool', { input: 'test' });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

## Troubleshooting

### Tool Not Found

```typescript
const result = await toolRegistry.execute('unknown_tool', {});

if (!result.success && result.error?.code === 'TOOL_NOT_FOUND') {
  console.error('Tool not registered');
  // Register tool or use different tool
}
```

### Rate Limit Exceeded

```typescript
if (result.error?.code === 'RATE_LIMIT_EXCEEDED') {
  const retryAfter = result.error.details?.retryAfter;
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
  
  // Wait and retry
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  const retryResult = await toolRegistry.execute(toolName, params);
}
```

### Sandbox Execution Failed

```typescript
if (result.error?.code === 'EXECUTION_ERROR') {
  console.error('Sandbox execution failed:', result.error.message);
  
  // Check E2B API key
  if (!process.env.E2B_API_KEY) {
    console.error('E2B_API_KEY not configured');
  }
  
  // Check code for security issues
  const validation = sandboxedExecutor.validateCode(code, 'python');
  if (!validation.safe) {
    console.error('Dangerous code detected:', validation.issues);
  }
}
```

## Future Enhancements

### Planned Tools

1. **Database Query Tool** - Execute SQL queries safely
2. **Salesforce Connector** - CRM integration
3. **Email Tool** - Send emails via SMTP
4. **Slack Tool** - Post messages to Slack
5. **Calendar Tool** - Schedule meetings
6. **Document Generator** - Create PDFs, Word docs

### Planned Features

1. **Tool Composition** - Chain multiple tools
2. **Async Execution** - Background tool execution
3. **Tool Versioning** - Multiple versions of same tool
4. **Tool Marketplace** - Share and discover tools
5. **Tool Analytics** - Usage patterns and optimization

## Support

For questions or issues:
- **Documentation**: This file
- **Slack**: #tool-development
- **Email**: tools@valuecanvas.com

## References

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [E2B Documentation](https://e2b.dev/docs)
- [Anthropic Tool Use](https://docs.anthropic.com/claude/docs/tool-use)

---

**Status**: Production Ready ✅  
**Version**: 1.0.0  
**Last Updated**: 2024-11-23
