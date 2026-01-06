# Agent System Context

## Overview
ValueOS uses a multi-agent architecture where specialized AI agents collaborate to analyze companies, identify opportunities, and generate business cases.

## Agent Fabric Location
`src/lib/agent-fabric/`

## Core Components

### BaseAgent (`agents/BaseAgent.ts`)
Abstract base class for all agents. Provides:
- LLM gateway integration
- Memory system
- Audit logging
- Circuit breaker
- RBAC enforcement
- Confidence calibration

### LLMGateway (`LLMGateway.ts`)
Unified interface to LLM providers:
- Provider abstraction (Together AI, OpenAI)
- Request routing
- Response caching
- Rate limiting
- Cost tracking

### ContextFabric (`ContextFabric.ts`)
Manages agent context and memory:
- Context persistence
- Memory management
- Context sharing between agents
- Context compression
- Relevance scoring

### CircuitBreaker (`CircuitBreaker.ts`)
Prevents cascading failures:
- Failure detection
- Automatic circuit opening
- Exponential backoff
- Health monitoring
- Automatic recovery

## Agent Types

### OpportunityAgent
**File:** `agents/OpportunityAgent.ts`  
**Authority Level:** 3  
**Purpose:** Discover customer pain points and business objectives  
**Lifecycle Stage:** Discovery  

**Inputs:**
- Company name
- Discovery data (calls, emails, meetings)
- Industry context

**Outputs:**
```typescript
{
  opportunity_summary: string;
  persona_fit: {
    score: number;
    role: string;
    seniority: string;
    decision_authority: 'low' | 'medium' | 'high';
    fit_reasoning: string;
  };
  business_objectives: BusinessObjective[];
  pain_points: PainPoint[];
  confidence_score: number;
  data_sources: string[];
}
```

### TargetAgent
**File:** `agents/TargetAgent.ts`  
**Authority Level:** 3  
**Purpose:** Build value models and map capabilities to outcomes  
**Lifecycle Stage:** Modeling  

**Inputs:**
- Opportunity analysis
- Product capabilities
- Customer context

**Outputs:**
- Value tree
- Capability mapping
- Benefit quantification
- Value drivers

### FinancialModelingAgent
**File:** `agents/FinancialModelingAgent.ts`  
**Authority Level:** 4  
**Purpose:** Calculate financial metrics (ROI, NPV, IRR)  
**Lifecycle Stage:** Modeling  

**Inputs:**
- Value model
- Cost assumptions
- Revenue projections
- Time horizon

**Outputs:**
```typescript
{
  roi: number;
  npv: number;
  irr: number;
  payback_period: number;
  scenarios: {
    best_case: FinancialMetrics;
    base_case: FinancialMetrics;
    worst_case: FinancialMetrics;
  };
  sensitivity_analysis: SensitivityData;
}
```

### RealizationAgent
**File:** `agents/RealizationAgent.ts`  
**Authority Level:** 3  
**Purpose:** Track value delivery post-sale  
**Lifecycle Stage:** Realization  

**Inputs:**
- Original predictions
- Actual metrics
- Telemetry data

**Outputs:**
- Actual vs. predicted comparison
- Variance analysis
- At-risk indicators
- Trend analysis

### ExpansionAgent
**File:** `agents/ExpansionAgent.ts`  
**Authority Level:** 3  
**Purpose:** Identify upsell and expansion opportunities  
**Lifecycle Stage:** Expansion  

**Inputs:**
- Realization data
- Product catalog
- Customer usage patterns

**Outputs:**
- Expansion opportunities
- Incremental value estimates
- Recommended actions
- Confidence scores

### BenchmarkAgent
**File:** `agents/BenchmarkAgent.ts`  
**Authority Level:** 3  
**Purpose:** Provide industry benchmarks and comparative analysis  
**Used In:** All stages  

**Inputs:**
- Industry
- Company size
- KPI name

**Outputs:**
```typescript
{
  kpi_name: string;
  current_value: number;
  benchmarks: {
    p25: number;
    median: number;
    p75: number;
    best_in_class: number;
    source: string;
    vintage: string;
  };
  percentile: number;
  gap_to_median: number;
  gap_to_best_in_class: number;
  improvement_opportunity: number;
}
```

### CommunicatorAgent
**File:** `agents/CommunicatorAgent.ts`  
**Authority Level:** 2  
**Purpose:** Generate buyer-facing narratives  
**Used In:** All stages  

**Inputs:**
- Analysis results
- Buyer persona
- Template type

**Outputs:**
- Executive summary
- Detailed narrative
- Key takeaways
- Recommendations

## Agent Orchestration

### UnifiedAgentAPI
**File:** `src/services/UnifiedAgentAPI.ts`  
**Purpose:** Single interface for invoking agents

**Usage:**
```typescript
import { getUnifiedAgentAPI } from '@/services/UnifiedAgentAPI';

const api = getUnifiedAgentAPI();
const response = await api.invoke({
  agent: 'opportunity',
  query: 'Analyze Acme Corp',
  context: {
    valueCaseId: 'uuid',
    company: 'Acme Corp',
    description: 'Enterprise software company'
  }
});
```

### AgentFabric
**File:** `src/lib/agent-fabric/AgentFabric.ts`  
**Purpose:** Orchestrate multi-agent workflows

**Workflow Example:**
```typescript
const fabric = new AgentFabric();

// Step 1: Discovery
const opportunity = await fabric.invoke('opportunity', input);

// Step 2: Modeling
const valueModel = await fabric.invoke('target', {
  ...input,
  opportunityAnalysis: opportunity
});

// Step 3: Financial
const financial = await fabric.invoke('financial-modeling', {
  ...input,
  valueModel
});

// Step 4: Narrative
const narrative = await fabric.invoke('communicator', {
  ...input,
  opportunity,
  valueModel,
  financial
});
```

## Authority Levels

### Level 1: Read-Only
- View data
- Generate reports
- Send notifications

### Level 2: Data Analysis
- Read data
- Analyze patterns
- Generate insights
- Create visualizations

### Level 3: Business Operations
- Read/write business data
- Execute workflows
- Make recommendations
- Update records

### Level 4: System Integration
- External API access
- Data synchronization
- System configuration
- Financial operations

### Level 5: Administrative
- Full system access
- Agent coordination
- Policy enforcement
- Compliance management

## Safety Limits

**Configuration:** `src/config/agentFabric.ts`

```typescript
{
  maxExecutionTime: 30000,      // 30 seconds
  maxLLMCalls: 20,
  maxRecursionDepth: 5,
  maxMemoryBytes: 100 * 1024 * 1024,  // 100MB
  maxExecutionCost: 5.00       // $5.00
}
```

## Circuit Breaker States

### Closed (Normal)
- All requests pass through
- Failures are counted
- Threshold monitoring active

### Open (Failure Detected)
- Requests immediately fail
- No LLM calls made
- Timeout period active

### Half-Open (Testing Recovery)
- Limited requests allowed
- Testing if service recovered
- Transitions to closed or open

## Memory System

### Types
- **Episodic:** Specific events and interactions
- **Semantic:** General knowledge and patterns
- **Working:** Current task context
- **Shared:** Cross-agent knowledge

### Garbage Collection
- Automatic cleanup of old memories
- Relevance-based retention
- Tenant-aware isolation
- Configurable TTL

## Logging & Audit

### Agent Execution Logs
**Table:** `agent_executions`

```sql
{
  id: uuid,
  agent_name: string,
  input: jsonb,
  output: jsonb,
  confidence_score: float,
  execution_time_ms: integer,
  llm_calls: integer,
  cost: decimal,
  status: 'success' | 'error',
  error_message: text,
  created_at: timestamp
}
```

### Audit Trail
All agent actions logged with:
- User ID
- Tenant ID
- Timestamp
- Input/output
- Reasoning trace
- Data sources used

## Error Handling

### Agent Errors
```typescript
try {
  const result = await agent.execute(input);
  return result;
} catch (error) {
  if (error instanceof CircuitBreakerError) {
    // Circuit breaker open
    return fallbackResponse;
  } else if (error instanceof TimeoutError) {
    // Execution timeout
    return partialResponse;
  } else {
    // Unknown error
    logger.error('Agent execution failed', error);
    throw new AgentError('Agent failed', error);
  }
}
```

## Testing Agents

### Unit Tests
```typescript
describe('OpportunityAgent', () => {
  it('should identify pain points', async () => {
    const agent = new OpportunityAgent(config);
    const result = await agent.execute(input);
    expect(result.pain_points).toHaveLength(3);
  });
});
```

### Integration Tests
```typescript
describe('Agent Workflow', () => {
  it('should complete full workflow', async () => {
    const fabric = new AgentFabric();
    const result = await fabric.orchestrate('company-analysis', input);
    expect(result.status).toBe('success');
  });
});
```

## Performance Optimization

### Caching
- LLM responses cached by input hash
- TTL: 1 hour (configurable)
- Cache invalidation on data changes

### Batching
- Multiple requests batched when possible
- Reduces LLM API calls
- Improves latency

### Streaming
- Results streamed to UI as available
- Sub-800ms first feedback
- Progressive enhancement

## Common Patterns

### Agent Invocation
```typescript
const agent = new OpportunityAgent(config);
const result = await agent.execute({
  company: 'Acme Corp',
  context: discoveryData
});
```

### Error Recovery
```typescript
const result = await agent.executeWithRetry(input, {
  maxRetries: 3,
  backoff: 'exponential'
});
```

### Confidence Checking
```typescript
if (result.confidence_score < 0.7) {
  // Low confidence, request human review
  await requestHumanReview(result);
}
```

## Troubleshooting

### Agent Timeout
- Increase `maxExecutionTime` in config
- Break into smaller tasks
- Check LLM provider status

### Circuit Breaker Open
- Check error logs
- Verify LLM provider availability
- Wait for automatic recovery

### Low Confidence Scores
- Provide more context
- Improve data quality
- Use more specific prompts

---

**Last Updated:** 2026-01-06  
**Related:** `src/lib/agent-fabric/`, `src/services/UnifiedAgentAPI.ts`
