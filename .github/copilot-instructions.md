# GitHub Copilot Instructions for ValueCanvas

AI agent workflow platform with multi-tenant architecture, agent fabric orchestration, and server-driven UI.

---

## Architecture Overview

**ValueCanvas** is a multi-tenant SaaS platform combining React (Vite), Supabase backend, and an AI agent orchestration system. Key characteristics:

- **Frontend:** React + TypeScript + Vite + TailwindCSS, Server-Driven UI (SDUI) system
- **Backend:** Express (Node.js) for billing/webhooks, Supabase for data/auth/RLS
- **Agent Fabric:** Orchestrated workflows via `WorkflowOrchestrator`, event-driven via `MessageBus`
- **Database:** PostgreSQL with Row-Level Security (RLS), managed via Supabase
- **Observability:** OpenTelemetry tracing, structured logging with `src/lib/logger.ts`
- **Security:** Secrets manager (AWS/Vault), RLS policies, multi-tenant isolation
- **Testing:** Vitest (unit/integration), Playwright (E2E), sequential execution (`fileParallelism: false`)

**Service Boundaries:**
- Frontend communicates via Supabase client (anon key)
- Backend uses service_role key ONLY for `AuthService`, `TenantProvisioning`, `CronJobs`
- Agents communicate asynchronously via `MessageBus` (CloudEvents protocol)
- Workflows persist state to Supabase after every DAG node transition

---

## Critical Multi-Tenancy Rules

**ALL database operations MUST scope by `organization_id` or `tenant_id`:**

```typescript
// ✅ CORRECT - Scoped query
const data = await supabase
  .from('workflows')
  .select('*')
  .eq('organization_id', user.organizationId);

// ❌ WRONG - Missing tenant scope
const data = await supabase.from('workflows').select('*');
```

**Memory/Vector Queries:**
```typescript
// ✅ CORRECT - Memory queries filter by tenant
await memorySystem.query(embedding, {
  metadata: { tenant_id: organizationId },
  limit: 10
});
```

**RLS Policies:** All tables enforce RLS. Run `npm run test:rls` to validate policies.

---

## Agent Fabric Architecture

### Agent Development (`src/lib/agent-fabric/agents/**`, `src/agents/**`)

All agents extend `BaseAgent` and follow strict patterns:

```typescript
// ✅ Agent structure
export class MyAgent extends BaseAgent {
  public readonly lifecycleStage = 'discovery';
  public readonly version = '1.0.0';
  public readonly name = 'MyAgent';

  async execute(input: Input): Promise<Output> {
    // Use handlebars for prompts (NO string concatenation)
    const prompt = Handlebars.compile(PROMPT_TEMPLATE)({ data: input });
    
    // ALWAYS use secureInvoke() for LLM calls
    const result = await this.secureInvoke(prompt, {
      trackPrediction: true,
      confidenceThresholds: { low: 0.6, high: 0.85 }
    });
    
    return result;
  }
}
```

**Rules:**
- Each agent = single file `[AgentName]Agent.ts`
- LLM calls ONLY via `this.secureInvoke()` (includes safety limits, circuit breakers)
- 100% test coverage required (mock `LLMGateway` and `MemorySystem`)
- NO direct agent-to-agent working memory access

### Workflow Orchestration (`src/services/WorkflowOrchestrator.ts`)

Workflows are DAGs defined in `src/data/lifecycleWorkflows.ts`:

```typescript
// Workflow = DAG with stages and transitions
const workflow: WorkflowDAG = {
  initial_stage: 'start',
  stages: {
    start: { agent: 'DiscoveryAgent', retry: { max: 3, delay: 1000 } },
    analysis: { agent: 'AnalysisAgent', compensation: 'rollback_analysis' }
  },
  transitions: {
    start: [{ to: 'analysis', condition: 'has_data' }]
  }
};
```

**Rules:**
- Workflows MUST be acyclic (cycles forbidden)
- Saga pattern: every state mutation needs a compensation function
- Persist `WorkflowState` to Supabase after EVERY node transition
- Use `WorkflowOrchestrator.executeWorkflow(definitionId, context)`

### Inter-Agent Communication (`src/services/MessageBus.ts`)

Agents communicate via CloudEvents-compliant messages:

```typescript
// ✅ Asynchronous event
await messageBus.publish({
  type: 'workflow.stage.completed',
  source: 'DiscoveryAgent',
  data: { findings: [...] },
  trace_id: context.traceId // MUST propagate
});

// ❌ WRONG - NO synchronous agent calls (except Orchestrator)
const result = await otherAgent.execute(data);
```

**Rules:**
- Default: asynchronous messaging
- `trace_id` MUST propagate across all async boundaries
- Use `MessageBus` for cross-agent communication
- Share data via `SharedArtifacts` table, not direct memory access

---

## Service Layer Patterns (`src/services/**`)

Backend services are stateless and tenant-aware:

```typescript
export class MyService {
  // ✅ Services must NOT hold state between requests
  async processData(organizationId: string, data: any) {
    // Always use supabase.auth.getUser() for context
    const { data: { user } } = await supabase.auth.getUser();
    
    // Multi-table writes in SQL transactions
    const { data: result } = await supabase.rpc('atomic_update', {
      org_id: organizationId,
      payload: data
    });
    
    return result;
  }
}
```

**Bypass RLS with service_role ONLY for:**
- `AuthService` (user provisioning)
- `TenantProvisioning` (org creation)
- `CronJobs` (background tasks)

---

## Server-Driven UI (SDUI) (`src/sdui/**`)

Components must be registered in TWO places:

1. `config/ui-registry.json` (intent mappings)
2. `src/sdui/registry.tsx` (component exports)

```json
// config/ui-registry.json
{
  "intentType": "visualize_graph",
  "component": "SystemMapCanvas",
  "fallback": "JsonViewer"
}
```

```typescript
// src/sdui/registry.tsx
export const componentRegistry = {
  SystemMapCanvas: lazy(() => import('./components/SystemMapCanvas'))
};
```

**AI-Generated Content:**
- Mark with `GhostPreview` wrapper or "AI Generated" badge
- Use `useRealtimeUpdates` for WebSocket subscriptions

---

## Tool System (`src/tools/**`, `src/services/tools/**`)

```typescript
// ✅ Tool implementation
export class MyTool implements Tool<Input, Output> {
  async execute(input: Input, context: ToolContext): Promise<Output> {
    // Check LocalRules before execution (LR-001)
    await checkLocalRules(context.organizationId, 'tool.my_tool');
    
    // External APIs MUST use RateLimiter middleware
    const result = await rateLimiter.execute(
      () => externalApi.call(input),
      { key: `tool:${context.organizationId}` }
    );
    
    return result;
  }
}
```

**Rules:**
- Implement `Tool<TInput, TOutput>` interface
- Register in `ToolRegistry.ts` (dynamic creation FORBIDDEN)
- External API tools require `RateLimiter` middleware

---

## Development Workflow

### Start Development
```bash
npm run dev              # Frontend (Vite on 0.0.0.0:3000)
npm run backend:dev      # Backend (Express on :8000)
npm run db:setup         # Bootstrap Supabase locally
npm run db:types         # Regenerate TypeScript types
```

### Testing
```bash
npm test                 # Unit + integration (sequential)
npm run test:rls         # RLS policy validation
npm run test:watch       # Watch mode
npm run typecheck        # TypeScript validation
npm run security:scan    # Dependency audit
```

**Test Configuration:**
- `fileParallelism: false` (avoid race conditions on single container)
- Mock Supabase with `createBoltClientMock()` from `test/mocks/mockSupabaseClient`
- Timeout: 30s tests, 120s hooks

### Pre-Production Verification
```bash
# Automated verification suite
./scripts/verify-production.sh staging

# SQL health checks
psql $DATABASE_URL -f scripts/verify-production-readiness.sql

# Critical queries
SELECT * FROM security.verify_rls_enabled();
SELECT * FROM security.health_check();
```

**Before Production Deploy:**
- Configure JWT custom claims (`organization_id` in token)
- Test cross-tenant access isolation in staging
- Enable service role operation monitoring
- Deploy Edge Functions with secure secrets
- Configure Storage RLS policies
- Complete checklist: `docs/deployment/PRE_PRODUCTION_CHECKLIST.md`

### Path Aliases
```typescript
import { logger } from '@lib/logger';
import { MyService } from '@services/MyService';
import { Button } from '@components/ui/Button';
```

Configured in `vitest.config.ts` and `tsconfig.json`.

---

## Security & Compliance

### Secrets Management
- `SECRETS_MANAGER_ENABLED=true` (AWS or Vault)
- `.env` for non-sensitive defaults only
- NEVER commit `SUPABASE_SERVICE_KEY` or `STRIPE_SECRET_KEY`

### Input Sanitization
```typescript
// ✅ Sanitize SDUI payloads
import { SDUISanitizer } from '@lib/security/SDUISanitizer';
const clean = SDUISanitizer.sanitize(userInput);

// ✅ Validate with Zod
const schema = z.object({ email: z.string().email() });
const validated = schema.parse(req.body);
```

### Logging
```typescript
// ✅ Structured logging (NO console.log)
logger.info('Workflow started', {
  workflowId,
  organizationId,
  trace_id: context.traceId
});

// ❌ NEVER log sensitive data
logger.error('Auth failed', { password: user.password }); // WRONG
```

Run `npm run lint:console` to detect console.log usage.

---

## Communication Style

**Be concise. NO conversational filler.**

Examples:
- ❌ "Sure, I can help with that. Here's the code..."
- ✅ *Just provide the code with filename*
- ❌ "I've updated the file to add the feature."
- ✅ *Perform the edit silently*

Only explain complex logic or architectural decisions, not obvious code changes.

---

## Key Files Reference

| Path | Purpose |
|------|---------|
| `src/services/WorkflowOrchestrator.ts` | Workflow DAG execution engine |
| `src/services/MessageBus.ts` | CloudEvents message bus |
| `src/lib/agent-fabric/agents/BaseAgent.ts` | Agent base class |
| `src/lib/agent-fabric/MemorySystem.ts` | Vector memory (tenant-scoped) |
| `src/lib/supabase.ts` | Supabase client singleton |
| `config/ui-registry.json` | SDUI component mappings |
| `supabase/tests/database/rls_policies.test.sql` | RLS test suite |
| `docs/database/enterprise_saas_hardened_config_v2.sql` | Production database schema |
| `docs/deployment/PRE_PRODUCTION_CHECKLIST.md` | Deployment verification guide |
| `scripts/verify-production.sh` | Automated readiness checks |
| `.github/instructions/*.md` | Component-specific rules |

**Detailed instructions:** See `.github/instructions/{agents,backend,frontend,orchestration,memory,communication,tools}.instructions.md` for domain-specific guidelines.

---

**Last Updated:** 2025-12-10
