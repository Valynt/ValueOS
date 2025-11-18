# Agent Fabric: Complete Implementation

## Overview

The Agent Fabric is a production-ready, enterprise-grade substrate for autonomous AI agent orchestration. This implementation provides a complete 72-component framework across five distinct layers with full governance, observability, and security.

## Architecture Summary

### Five Core Layers

1. **Agent Definition Layer** (12 Agents)
   - Orchestrator, Company Intelligence, Value Mapping, KPI Hypothesis
   - Financial Modeling, Cost Stack, Evidence & Confidence
   - Sensitivity Analysis, Narrative Synthesis
   - Canvas Visualization, Widget Generation, Deliverable Compilation

2. **Runtime Layer** (8 Components)
   - AgentRuntime, Session Management, Memory Store (4-part)
   - Message Bus, Context Manager, Metrics Recorder
   - Tool Executor, State Persister

3. **Orchestration Layer** (6 Components)
   - WorkflowOrchestrator (DAG engine), Graph Planner, Task Router
   - Reflection Engine (18-point quality rubric)
   - Termination Controller, Error Recovery System

4. **Governance & Observability Layer** (9 Components)
   - Audit Log Writer, Metrics Dashboard, Policy Engine
   - Explainability Engine, Compliance Checker
   - Database tables: agent_audit_log, agent_metrics, policy_rules

5. **Integration Layer** (10 Components)
   - Tool Registry, Tool Schema Validator, Tool Executor
   - Web Scraper, Industry Classifier, Financial Calculator
   - Chart Generator, Widget Factory
   - LLM Gateway, Knowledge Fabric

## Database Schema (18 Tables)

### Agent Infrastructure (6 tables)
- `agents` - Registry of autonomous agents
- `agent_tools` - Tool assignments per agent
- `agent_ontologies` - Domain knowledge
- `agent_sessions` - Isolated execution contexts
- `agent_memory` - Four-part memory system with pgvector embeddings
- `message_bus` - Async inter-agent communication

### Orchestration (3 tables)
- `workflows` - DAG workflow definitions
- `workflow_executions` - Runtime execution tracking
- `task_queue` - Agent task assignments

### Governance (3 tables)
- `agent_audit_log` - Complete execution trace with reasoning
- `agent_metrics` - Performance tracking (tokens, latency, cost)
- `policy_rules` - Access control and rate limiting

### Value Engineering Domain (6 tables)
- `value_cases` - Top-level value case orchestration
- `company_profiles` - Company and industry intelligence
- `value_maps` - Feature-to-outcome value chains
- `kpi_hypotheses` - Baseline and target KPIs
- `financial_models` - ROI, NPV, payback calculations
- `assumptions` - Provenance tracking for all claims

## Four-Part Memory System

1. **Episodic Memory** - Event stream of "what happened"
2. **Semantic Memory** - Vector embeddings for "what we know"
3. **Working Memory** - Current task state
4. **Procedural Memory** - Learned patterns for "how to do things"

## 18-Point Quality Rubric

The Reflection Engine scores output on 6 dimensions (0-3 points each):

1. **Traceability** (3 pts) - Assumptions documented with provenance
2. **Relevance** (3 pts) - KPIs align with buyer persona
3. **Realism** (3 pts) - Targets are industry-validated
4. **Clarity** (3 pts) - Insights in non-technical language
5. **Actionability** (3 pts) - Explicit next steps provided
6. **Polish** (3 pts) - Deliverables are production-ready

**Threshold:** 15/18 (workflows automatically refine if below threshold, max 3 iterations)

## Setup Instructions

### 1. Database Setup

The complete schema is already applied via Supabase migration:
- 18 tables created with Row Level Security (RLS) enabled
- 12 agents seeded into `agents` table
- `value_case_generation` workflow defined in `workflows` table

### 2. Environment Configuration

The Agent Fabric uses **Together.ai as the primary LLM provider** (vLLM router) with OpenAI as a fallback. LLM credentials must
be injected on the server-side only to avoid leaking them in the browser bundle. Configure the Supabase Edge Function
`llm-proxy` with server environment variables:

```bash
TOGETHER_API_KEY=your-together-api-key-here
OPENAI_API_KEY=sk-... # optional fallback
```

Keys are read exclusively by the proxy function and are never exposed to the client runtime.

#### LLM Provider Configuration

**Together.ai (Default - Recommended)**
- **Base URL**: `https://api.together.xyz/v1`
- **Default Model**: `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`
- **Embedding Model**: `togethercomputer/m2-bert-80M-8k-retrieval`
- **Benefits**:
  - Faster inference with vLLM optimization
  - Lower cost than OpenAI
  - Wide model selection (Llama, Mixtral, Qwen, Gemma, DeepSeek)
  - Better open-source model support

**Supported Models on Together.ai:**
- `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` (default)
- `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`
- `mistralai/Mistral-7B-Instruct-v0.2`
- `Qwen/Qwen2.5-72B-Instruct-Turbo`
- `google/gemma-2-27b-it`
- `deepseek-ai/deepseek-llm-67b-chat`

**OpenAI (Fallback)**
- **Base URL**: `https://api.openai.com/v1`
- **Default Model**: `gpt-4`
- **Embedding Model**: `text-embedding-ada-002`
- Only used if `VITE_TOGETHER_API_KEY` is not provided

### 3. Usage

#### From UI (Command Bar)

1. Open the application
2. Press `⌘K` (or `Ctrl+K` on Windows) to open the command bar
3. Type your request, for example:

```
Create a value case for DataSift AI, a B2B SaaS that automates
support ticket triage for enterprises with 500 agents.
```

4. Press Enter
5. The Agent Fabric will:
   - Analyze the company and industry context
   - Create feature-to-outcome value chains
   - Establish KPI baselines and targets
   - Calculate ROI, NPV, and payback period
   - Generate canvas components automatically
   - Score quality and refine if needed (up to 3 iterations)

#### Programmatic Usage

```typescript
import { AgentFabric } from './lib/agent-fabric';

// Using Together.ai (default)
const fabric = new AgentFabric(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_TOGETHER_API_KEY,
  'together'
);

await fabric.initialize();

const result = await fabric.processUserInput(
  "Create a value case for DataSift AI, a B2B SaaS that automates " +
  "support ticket triage for enterprises with 500 agents."
);

console.log(result);
// {
//   value_case_id: "...",
//   company_profile: { company_name: "DataSift AI", ... },
//   value_maps: [...],
//   kpi_hypotheses: [...],
//   financial_model: {
//     roi_percentage: 793,
//     npv_amount: 3590000,
//     payback_months: 4,
//     ...
//   },
//   quality_score: 16,
//   execution_metadata: {
//     total_tokens: 12500,
//     total_latency_ms: 8300,
//     ...
//   }
// }
```

**Using a specific model:**

```typescript
import { LLMGateway } from './lib/agent-fabric';

// Use Mixtral instead of default Llama
const gateway = new LLMGateway(
  import.meta.env.VITE_TOGETHER_API_KEY,
  'together'
);

const response = await gateway.complete(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain ROI calculation.' }
  ],
  {
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    temperature: 0.7,
    max_tokens: 1000
  }
);
```

**Switching to OpenAI:**

```typescript
const fabric = new AgentFabric(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_OPENAI_API_KEY,
  'openai'  // Explicitly use OpenAI
);
```

## Key Features

### Complete Auditability

Every decision is logged with reasoning. Full provenance chain maintained via database joins:

```sql
SELECT
  aal.action,
  aal.reasoning,
  aal.confidence_level,
  a.name as agent_name,
  aal.timestamp
FROM agent_audit_log aal
JOIN agents a ON a.id = aal.agent_id
WHERE aal.session_id = '<session-id>'
ORDER BY aal.timestamp;
```

### Confidence Signaling

All claims tagged with confidence level (high/medium/low) and supporting evidence:

```typescript
{
  "kpi_name": "Ticket Resolution Time",
  "baseline_value": 45,
  "target_value": 15,
  "confidence_level": "high",
  "assumptions": [
    "Based on industry benchmarks for enterprise support teams",
    "Assumes 70% automation rate for routine tickets"
  ]
}
```

### Quality-Driven Iteration

Automatic refinement loop with 18-point rubric:

```typescript
// Iteration 1: Score 13/18 (below threshold)
// → Reflection Engine identifies weak dimensions
// → Orchestrator refines with specific instructions

// Iteration 2: Score 16/18 (above threshold)
// → Workflow completes
```

### Graph-Based Orchestration

Workflows defined as DAGs with parallel execution support:

```json
{
  "nodes": [
    { "id": "company_intelligence", "dependencies": [] },
    { "id": "value_mapping", "dependencies": ["company_intelligence"] },
    {
      "id": "parallel_financial",
      "type": "parallel",
      "branches": [
        { "id": "financial_modeling" },
        { "id": "cost_stack" }
      ]
    }
  ]
}
```

## File Structure

```
src/
├── lib/
│   └── agent-fabric/
│       ├── AgentFabric.ts           # Main orchestrator
│       ├── LLMGateway.ts            # OpenAI integration
│       ├── MemorySystem.ts          # 4-part memory
│       ├── AuditLogger.ts           # Governance
│       ├── ReflectionEngine.ts      # Quality rubric
│       ├── types.ts                 # TypeScript definitions
│       └── agents/
│           ├── BaseAgent.ts
│           ├── CompanyIntelligenceAgent.ts
│           ├── ValueMappingAgent.ts
│           └── FinancialModelingAgent.ts
├── services/
│   └── AgentFabricService.ts        # UI integration layer
└── components/
    └── Layout/
        └── MainLayout.tsx            # Command bar integration
```

## Performance Metrics

All metrics automatically tracked per session:

- **Token Usage**: Total tokens consumed by LLM calls
- **Latency**: End-to-end execution time per agent
- **Cost**: Calculated based on model pricing
- **Quality Score**: 18-point rubric result
- **Iteration Count**: Number of refinement loops

Query metrics:

```typescript
const totalTokens = await auditLogger.getTotalTokens(sessionId);
const totalLatency = await auditLogger.getTotalLatency(sessionId);
```

## Security

### Row Level Security (RLS)

All tables enforce RLS policies:

```sql
-- Users can only access their own sessions
CREATE POLICY "Users can view own session memory"
  ON agent_memory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_sessions
      WHERE agent_sessions.id = agent_memory.session_id
      AND agent_sessions.user_id = auth.uid()
    )
  );
```

### Data Isolation

- Complete tenant isolation per user session
- No cross-session data leakage
- Immutable audit trail for compliance

## Extending the System

### Adding a New Agent

1. Create agent class extending `BaseAgent`:

```typescript
export class CustomAgent extends BaseAgent {
  async execute(sessionId: string, input: any): Promise<any> {
    // Your logic here
    await this.logExecution(/* ... */);
    return result;
  }
}
```

2. Register in database:

```sql
INSERT INTO agents (name, type, description, capabilities, config)
VALUES ('custom_agent', 'analysis', 'Description', '["capability"]'::jsonb, '{}'::jsonb);
```

3. Add to workflow DAG in `workflows.dag_definition`

### Adding Custom Tools

Tools can be registered and invoked by agents:

```typescript
const tools = [
  {
    name: 'web_scraper',
    schema: {
      type: 'function',
      function: {
        name: 'scrape_company_data',
        parameters: { /* ... */ }
      }
    },
    handler: async (params) => { /* ... */ }
  }
];
```

## Troubleshooting

### "AgentFabric not initialized"

```typescript
await fabric.initialize();
```

### OpenAI API Errors

Check your API key in `.env`:
```bash
VITE_OPENAI_API_KEY=sk-...
```

### Database Permission Errors

Ensure RLS policies are properly configured and user is authenticated.

### Low Quality Scores

The system will automatically refine up to 3 times. Check audit logs for specific dimension failures:

```sql
SELECT dimension_scores
FROM workflow_executions
WHERE id = '<execution-id>';
```

## Production Checklist

- [ ] OpenAI API key configured
- [ ] Supabase database provisioned
- [ ] All 18 tables created with RLS
- [ ] 12 agents seeded
- [ ] Workflow definition created
- [ ] pgvector extension enabled
- [ ] Rate limiting policies configured
- [ ] Monitoring and alerts set up
- [ ] Backup and disaster recovery tested

## License

Enterprise-grade production system. All rights reserved.
