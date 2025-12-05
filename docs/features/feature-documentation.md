# Feature Documentation – SDUI, Tools, Rules & Prompts

**Last Updated:** December 5, 2025  
**Version:** 1.0.0

Consolidated reference for key ValueCanvas platform features:

- Dynamic Data Bindings (live data in SDUI)
- Partial Mutations (delta updates to layouts)
- SDUI State Management & Workflow Integration
- Tool System (MCP-compatible tools)
- Rules Framework (policy-as-code for agents)
- Prompt Version Control (prompt lifecycle & A/B testing)

Source documents:

- `DYNAMIC_DATA_BINDINGS.md`
- `PARTIAL_MUTATIONS.md`
- `STATE_MANAGEMENT.md`
- `TOOL_SYSTEM_GUIDE.md`
- `RULES_FRAMEWORK.md`
- `PROMPT_VERSION_CONTROL_GUIDE.md`

---

## 1. Dynamic Data Bindings (Live SDUI Data)

Dynamic data bindings let SDUI components render **live data** from backends, agents, tools, or memory instead of hardcoded values. Agents emit *pointers* (bindings) and the client resolves them at runtime.

### 1.1 Binding Schema

```ts
interface DataBinding {
  $bind: string;               // Logical path, e.g. "metrics.revenue_uplift"
  $source: DataSourceType;     // e.g. 'realization_engine', 'supabase', 'mcp_tool'
  $fallback?: any;             // Value shown while loading / on error
  $refresh?: number;           // Auto-refresh interval (ms)
  $transform?: string;         // e.g. 'currency', 'percentage', 'date'
  $params?: Record<string, any>;
  $cache?: string;             // Cache key
  $cacheTTL?: number;          // Cache lifetime (ms)
}
```

**Typical sources:** realization engine metrics, other agents, semantic memory, MCP tools, Supabase queries.

**Transforms:** `currency`, `percentage`, `number`, `date`, `relative_time`, `round`, `array_length`, etc.

### 1.2 Usage Pattern

Agents output bindings in SDUI props:

```ts
{
  type: 'metric-card',
  props: {
    title: 'Revenue Uplift',
    value: {
      $bind: 'metrics.revenue_uplift',
      $source: 'realization_engine',
      $transform: 'currency',
      $fallback: 'Calculating…',
      $refresh: 30_000
    }
  }
}
```

The frontend resolves bindings via `DataBindingResolver` / `useDataBinding` hook, with batching + caching.

### 1.3 Best Practices

- Use bindings for **any** value that changes over time.
- Always set a meaningful `$fallback` and handle loading in components.
- Use `$refresh` conservatively (30–60s for dashboards, shorter only when needed).
- Prefer server-side formatting for complex domain logic; client transforms for simple display.
- Cache expensive operations (e.g. MCP/web search) with `$cache` + `$cacheTTL`.

---

## 2. Partial Mutations (Delta Updates to SDUI)

Partial mutations implement **surgical updates** to SDUI layouts without full regeneration, powering the "playground" UX.

### 2.1 Atomic UI Actions

Core action types:

- `mutate_component` – change props of an existing component
- `add_component` – insert a new component
- `remove_component` – delete a component
- `reorder_components` – change order
- `update_layout` – update layout directives
- `batch` – group multiple actions atomically

Selectors can target by id, type, index, props, or natural language description.

```ts
// Example: change chart type to bar
{
  type: 'mutate_component',
  selector: { type: 'InteractiveChart', description: 'ROI chart' },
  mutation: {
    path: 'props.type',
    operation: 'set',
    value: 'bar'
  }
}
```

Operations: `set`, `merge`, `append`, `prepend`, `remove`, `replace`.

### 2.2 Flow

1. User expresses change (NL or UI action).
2. UIRefinementLoop converts to atomic actions.
3. `ComponentMutationService` validates & applies actions to current layout.
4. Client updates only affected components (<100 ms typical).
5. Fallback to full regeneration when mutation is unsafe or too broad.

### 2.3 Best Practices

- Use **specific selectors** (type + description + props) to avoid wrong targets.
- Use `merge` for partial object updates; avoid overwriting whole config with `set`.
- Batch related changes into a single `batch` action to minimize roundtrips.
- Always inspect mutation results; fall back to full regeneration if `success === false`.

---

## 3. SDUI State Management & Workflows

### 3.1 SDUIStateManager

Central state service coordinating SDUI state, persistence, and subscriptions.

Key capabilities:

- In-memory cache with LRU & size limits
- Keyed state (`"user"`, `"workflow.current"`, `"components.chart_1"`, …)
- Subscriber pattern for reactive updates
- Debounced persistence to Supabase (`sdui_state`, workflows, sessions)
- Versioning / metadata per state key

API (simplified):

```ts
const mgr = getSDUIStateManager({
  supabase,
  persistence: { enabled: true, sessionId: 'session-123', debounceMs: 1000 },
  maxCacheSize: 1000
});

mgr.set('user', { name: 'John' });
const user = mgr.get('user');

const unsubscribe = mgr.subscribe('user', (e) => {
  console.log(e.newValue);
});

mgr.update('user', { name: 'Jane' });
mgr.delete('user');
```

React hooks:

- `useSDUIState(key, initial)` – standard shared state
- `useOptimisticSDUIState(key)` – optimistic updates with pending/error flags

### 3.2 WorkflowLifecycleIntegration (Saga)

- Orchestrates value lifecycle workflows (opportunity → target → realization → expansion).
- Uses Saga pattern with per-stage compensation handlers.
- Stores workflow execution state; supports resume & cleanup.

```ts
const integration = getWorkflowLifecycleIntegration(supabase);

const execution = await integration.executeWorkflow(
  userId,
  { companyName: 'Test' },
  { autoCompensate: true }
);
```

Compensation handlers undo side effects when later stages fail, keeping data consistent.

---

## 4. Tool System (MCP-Compatible Tools)

ValueCanvas tools follow an MCP-style interface and are registered in a **Tool Registry** with rate limiting and (optionally) sandboxed execution.

### 4.1 Tool Interface

```ts
interface MCPTool {
  name: string;               // unique id
  description: string;        // human-readable
  parameters: JSONSchema;     // JSON Schema for inputs
  execute(params: any, ctx?: ToolExecutionContext): Promise<ToolResult>;
  validate?(params: any): Promise<ValidationResult>;
  metadata?: {
    version?: string;
    author?: string;
    category?: string;
    tags?: string[];
    rateLimit?: { maxCalls: number; windowMs: number };
  };
}
```

Tools must:

- Implement the `Tool<TInput,TOutput>` interface (see codebase).
- Be registered in `ToolRegistry.ts` (no dynamic creation).
- Pass **LocalRules (LR-001, etc.)** before executing.
- Use `RateLimiter` middleware for external APIs.

### 4.2 Examples

- Web search tool
- Financial modeling / ROI tools
- Database query tools (safe, RLS-respecting)
- Sandbox execution via E2B for high-risk code

Best practices:

- Validate parameters using JSON Schema + custom `validate()`.
- Return structured `ToolResult` with success flag & error codes.
- Set aggressive rate limits for high-cost tools; higher for cheap, cached tools.

---

## 5. Rules Framework (Policy-as-Code)

Two-tier rules system enforcing safety, compliance, and governance for agents.

### 5.1 Tiers

- **Global Rules (GR-xxx)** – platform "constitution"; immutable, apply to all agents/tenants.
- **Local Rules (LR-xxx)** – agent/tenant specific; behaviour, workflows, experiments.

Global categories:

- Systemic safety (dangerous commands, network allowlist, recursion limits)
- Data sovereignty (tenant isolation, cross-tenant transfer blocks)
- PII protection (detection, log redaction)
- Cost control (max steps, LLM calls, cost/session, execution time)

### 5.2 Enforcement

```ts
import { enforceRules, isActionAllowed } from '@/lib/rules';

const allowed = await isActionAllowed({
  agentId,
  agentType: 'coordinator',
  userId,
  tenantId,
  sessionId,
  action: 'build_value_tree',
  payload,
  environment: 'production'
});

const result = await enforceRules({
  agentId,
  agentType: 'outcome_engineer',
  userId,
  tenantId,
  sessionId,
  action: 'calculate_roi',
  tool: 'generate_roi_model',
  payload
});

if (!result.allowed) {
  // inspect result.violations, userMessages, fallbackActions
}
```

**EnforcementResult** captures:

- `allowed` boolean
- `violations[]` (id, name, category, severity, message, remediation)
- `warnings[]`
- `fallbackActions[]`, `userMessages[]`
- metrics (rules checked, latency, requestId)

Best practices:

- **Fail safe**: if enforcement errors in production, deny action.
- Use **audit mode** for new rules (log-only) before enforcing.
- Always surface user-friendly messages and safe fallbacks.
- Log and monitor all critical violations.

---

## 6. Prompt Version Control

Prompt Version Control manages the lifecycle of LLM prompts: versioning, templates, A/B tests, and performance metrics.

### 6.1 Version Lifecycle

States: `draft → testing → active → deprecated`.

```ts
const version = await promptVersionControl.createVersion({
  promptKey: 'canvas.generate',
  template: `Generate a business model canvas for {{businessDescription}} in {{industry}}`,
  variables: ['businessDescription', 'industry'],
  metadata: {
    author: 'john@example.com',
    description: 'Industry-aware canvas',
    tags: ['canvas','v2'],
    model: 'meta-llama/Llama-3-70b-chat-hf',
    temperature: 0.7,
    maxTokens: 1000
  }
});

await promptVersionControl.activateVersion('canvas.generate', version.version);
```

Executing prompts:

```ts
const { prompt, version: activeVersion, executionId } =
  await promptVersionControl.executePrompt(
    'canvas.generate',
    { businessDescription, industry },
    userId
  );

// Call LLM, then record results
await promptVersionControl.recordExecution(executionId, {
  response: llmResponse.content,
  latency: llmResponse.latency,
  cost: llmResponse.cost,
  tokens: {
    prompt: llmResponse.promptTokens,
    completion: llmResponse.completionTokens,
    total: llmResponse.totalTokens
  },
  success: true
});
```

### 6.2 A/B Testing

```ts
const versionA = await promptVersionControl.createVersion({ /* … */ });
const versionB = await promptVersionControl.createVersion({ /* … */ });

const test = await promptVersionControl.createABTest({
  name: 'Canvas: Detailed vs Concise',
  promptKey: 'canvas.generate',
  variants: [
    { name: 'Detailed', versionId: versionA.id, weight: 50 },
    { name: 'Concise',  versionId: versionB.id, weight: 50 }
  ]
});

await promptVersionControl.startABTest(test.id);

const { prompt, version } = await promptVersionControl.executePrompt(
  'canvas.generate',
  vars,
  userId,
  { abTestId: test.id }
);

// Later: determine winner via `getABTestResults()` and mark winning variant.
```

### 6.3 Metrics & Queries

Tracked per prompt version:

- Avg latency, avg cost
- Success rate
- User satisfaction scores (1–5)

SQL helpers identify:

- Slow versions (`avgLatency > threshold`)
- Low-success versions (`successRate < 0.9`)

---

## 7. How These Features Work Together

- **Dynamic data bindings** keep SDUI layouts live without re-calling the LLM.
- **Partial mutations** let agents refine UIs surgically, with state managed by **SDUIStateManager**.
- **Tool system** gives agents structured capabilities, guarded by the **Rules Framework**.
- **Prompt Version Control** governs how prompts evolve, are tested, and rolled out safely.

Together, these features make ValueCanvas a **highly interactive, policy-safe, and optimizable** agentic application platform.
