# ValueCanvas Technical Reference

**Last Updated:** December 5, 2025  
**Version:** 2.0.0

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agent Framework](#agent-framework)
3. [SDUI System](#sdui-system)
4. [Database & Data Layer](#database--data-layer)
5. [Security Architecture](#security-architecture)
6. [Vector Store & Semantic Memory](#vector-store--semantic-memory)
7. [LLM Infrastructure](#llm-infrastructure)
8. [Observability](#observability)
9. [Code Patterns & Standards](#code-patterns--standards)

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  React + Vite │ TailwindCSS │ SDUI Renderer │ Canvas Store │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│   Agent Orchestrator │ Workflow Engine │ Intent Registry    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      AGENT FABRIC                            │
│  OpportunityAgent │ TargetAgent │ RealizationAgent │        │
│  IntegrityAgent │ ExpansionAgent │ CommunicatorAgent        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       DATA LAYER                             │
│     Supabase (PostgreSQL + Realtime + Storage + Auth)       │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | 5.x | Build tool |
| TailwindCSS | 3.x | Styling |
| Zustand | 4.x | State management |
| React Router | 6.x | Routing |
| Lucide Icons | Latest | Icons |

#### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | Latest | PostgreSQL + Realtime + Auth |
| Together.ai | API | LLM inference (primary) |
| OpenAI | API | LLM inference (fallback) |
| OpenTelemetry | 1.x | Observability |

#### Testing
| Technology | Purpose |
|------------|---------|
| Vitest | Unit tests |
| Playwright | E2E tests |
| Locust | Load testing |

---

## Agent Framework

### Agent Architecture

All agents extend the `BaseAgent` class which provides:
- LLM Gateway integration
- Memory system access
- Audit logging
- Circuit breaker protection
- Input sanitization

**Location:** `/src/lib/agent-fabric/agents/BaseAgent.ts`

### Core Agents

| Agent | File | Purpose |
|-------|------|---------|
| OpportunityAgent | `OpportunityAgent.ts` | Analyzes discovery data, identifies pain points |
| TargetAgent | `TargetAgent.ts` | Creates business cases, value trees, ROI models |
| RealizationAgent | `RealizationAgent.ts` | Tracks value realization and feedback |
| ExpansionAgent | `ExpansionAgent.ts` | Identifies upsell/expansion opportunities |
| IntegrityAgent | `IntegrityAgent.ts` | Validates artifact quality |
| CoordinatorAgent | `CoordinatorAgent.ts` | Orchestrates multi-agent workflows |
| CommunicatorAgent | `CommunicatorAgent.ts` | Handles stakeholder communication |

### Agent Execution Flow

```
User Intent
    ↓
AgentChatService.chat()
    ↓
UnifiedAgentOrchestrator.processIntent()
    ↓
CoordinatorAgent.planTask()
    ↓
Subgoal routing to specialized agents
    ↓
Agents generate output + SDUI layout
    ↓
Validation & Sanitization
    ↓
CanvasStore.setCurrentPage()
    ↓
Renderer displays updated UI
```

### BaseAgent Interface

```typescript
interface IAgent {
  execute(sessionId: string, input: any): Promise<AgentOutput>;
  canHandle(intent: string): boolean;
  getHealthStatus(): Promise<HealthStatus>;
}

interface AgentOutput {
  result: any;
  confidence_level: 'high' | 'medium' | 'low';
  confidence_score: number;
  reasoning: string;
  hallucination_check: boolean;
  metadata?: Record<string, any>;
}
```

### Circuit Breaker Integration

**Location:** `/src/lib/agent-fabric/CircuitBreaker.ts`

Safety limits enforced:
| Limit | Default | Purpose |
|-------|---------|---------|
| Max Execution Time | 30s | Hard timeout |
| Max LLM Calls | 20 | Prevents runaway loops |
| Max Recursion Depth | 5 | Prevents infinite recursion |
| Max Memory | 100 MB | Memory protection |

```typescript
// Usage in BaseAgent
protected async secureInvoke(...) {
  const { result, metrics } = await withCircuitBreaker(
    async (breaker: AgentCircuitBreaker) => {
      const response = await this.llmGateway.complete(
        messages,
        config,
        undefined,
        breaker // Circuit breaker passed
      );
      return enhancedOutput;
    },
    options.safetyLimits
  );
}
```

### Memory System

**Location:** `/src/lib/agent-fabric/MemorySystem.ts`

Memory types:
- **Episodic:** Session-specific memories
- **Semantic:** Long-term knowledge (vector embeddings)
- **Working:** Current task context
- **Procedural:** Learned patterns

**Critical Rule:** All vector queries MUST filter by `tenant_id`:
```typescript
const results = await memorySystem.search({
  query: embedding,
  filter: { metadata: { tenant_id: currentTenantId } }
});
```

---

## SDUI System

### Overview

Server-Driven UI allows agents to generate dynamic layouts that render as React components.

**Location:** `/src/sdui/`

### Page Structure

```typescript
interface SDUIPageDefinition {
  type: 'page';
  version: number;
  sections: SDUISection[];
  metadata?: {
    theme: 'dark' | 'light';
    experienceId?: string;
  };
}

interface SDUIComponent {
  type: 'component';
  component: string;      // Component name from registry
  version: number;
  props: Record<string, any>;
  hydrateWith?: string[]; // Data hydration sources
  fallback?: {
    component?: string;
    props?: Record<string, any>;
  };
}

interface SDUILayoutDirective {
  type: 'layout.directive';
  intent: string;
  component: string;
  props: Record<string, any>;
  layout?: 'default' | 'full_width' | 'two_column' | 'dashboard' | 'grid';
}
```

### Rendering Pipeline

1. **Agent generates SDUI JSON**
2. **Validation** (`validatePageForRendering`)
3. **Sanitization** (`SDUISanitizer.sanitizePage`)
4. **Store in CanvasStore** (with history tracking)
5. **Render** (`renderPage` → React.createElement)
6. **Hydration** (if hydrateWith specified)
7. **Error boundaries** (fallback on failure)

### Component Registry

**Location:** `/src/sdui/registry.tsx`

Components must be registered in:
1. `ui-registry.json`
2. `src/sdui/registry.tsx`

AI-generated content must be visually distinct using `GhostPreview` or "AI Generated" badges.

### Canvas Store

**Location:** `/src/sdui/canvas/CanvasStore.ts`

Zustand store with:
- Current page state
- History (undo/redo)
- Delta patching support

```typescript
interface CanvasStore {
  currentPage: SDUIPageDefinition | null;
  history: SDUIPageDefinition[];
  historyIndex: number;
  setCurrentPage: (page: SDUIPageDefinition) => void;
  patchCanvas: (delta: CanvasDelta) => void;
  undo: () => void;
  redo: () => void;
}
```

---

## Database & Data Layer

### Supabase Configuration

**Tables with RLS Enabled:** 40+

**Key Table Categories:**
- Agent Fabric (18 tables)
- Application Layer (3 tables)
- Monitoring & Observability (4 tables)
- VOS Value Fabric (14 tables)
- Governance & Audit (5+ tables)

### Row-Level Security Patterns

#### Pattern 1: User Owns Data
```sql
CREATE POLICY "users_own_data"
  ON table_name FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### Pattern 2: Service Role Bypass (ALWAYS INCLUDE)
```sql
CREATE POLICY "service_role_bypass"
  ON table_name FOR ALL
  TO service_role
  USING (true);
```

#### Pattern 3: Tenant Isolation
```sql
CREATE POLICY "tenant_access"
  ON table_name FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );
```

#### Pattern 4: Immutable Audit Logs
```sql
CREATE POLICY "insert_only"
  ON audit_table FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "block_updates"
  ON audit_table FOR UPDATE
  USING (false);

CREATE POLICY "block_deletes"
  ON audit_table FOR DELETE
  USING (false);
```

### Helper Functions

```sql
-- Admin check (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'service_role')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant membership check
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration Best Practices

#### Expand-Contract Pattern (Zero Downtime)

1. **Expand:** Add new schema elements (compatible with old code)
2. **Migrate:** Deploy new application code
3. **Contract:** Remove old schema elements (after verification)

#### Multi-Phase Column Rename

```sql
-- Phase 1: Add new column
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Phase 2: Backfill data
UPDATE users SET full_name = first_name || ' ' || last_name;

-- Phase 3: Application deployment (uses both)

-- Phase 4: Make required + drop old
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
```

#### Chunked Data Migration

```sql
DO $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
  rows_updated INTEGER;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM users 
      WHERE full_name IS NULL
      LIMIT batch_size OFFSET offset_val
    )
    UPDATE users u
    SET full_name = u.first_name || ' ' || u.last_name
    FROM batch b WHERE u.id = b.id;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
    
    offset_val := offset_val + batch_size;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

---

## Security Architecture

### Authentication & Authorization

- **Supabase Auth:** Email/password, OAuth, magic links
- **Row-Level Security:** Database-level access control
- **Multi-tenancy:** Organization-based data isolation
- **API Key Management:** Secure key storage and rotation

### Input Sanitization

**Location:** `/src/utils/security.ts`

```typescript
import { sanitizeAgentInput } from '../utils/security';

const result = sanitizeAgentInput(userInput);
if (!result.safe) {
  if (result.severity === 'high') {
    throw new SecurityError('High-risk input detected');
  }
}
const sanitizedInput = result.sanitized;
```

### Prompt Injection Detection

**Detection Patterns:**

| Risk Level | Patterns |
|------------|----------|
| High | `ignore previous instructions`, `override system rules` |
| Medium | `system:`, `pretend you are`, `act as if` |
| Low | `jailbreak`, `forget previous` |

**Scoring:** `confidence = min(score / 20, 1.0)`

### Sensitive Data Redaction

Automatically redacts:
- Email addresses → `[EMAIL]`
- SSN → `[SSN]`
- Credit cards → `[CREDIT_CARD]`
- API keys → `[REDACTED]`
- JWT tokens → `[JWT_TOKEN]`

### XML Sandboxing

```typescript
import { applyXmlSandbox } from '../utils/security';

const sandboxed = applyXmlSandbox(userInput);
// Result: <user_input>User content here</user_input>
```

---

## Vector Store & Semantic Memory

### Technology

- **Extension:** pgvector
- **Index:** HNSW (Hierarchical Navigable Small World)
- **Dimensions:** 1536 (text-embedding-3-small)
- **Similarity:** Cosine

### Schema

```sql
CREATE TABLE semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_semantic_memory_embedding 
ON semantic_memory 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Search Service

**Location:** `/src/services/VectorSearchService.ts`

```typescript
import { vectorSearchService } from '@/services/VectorSearchService';

// Basic search
const results = await vectorSearchService.searchByEmbedding(embedding, {
  type: 'opportunity',
  threshold: 0.70,
  limit: 5
});

// By industry
const saasOpps = await vectorSearchService.searchByIndustry(
  embedding, 'SaaS', { threshold: 0.75 }
);

// Check for duplicates
const isDupe = await vectorSearchService.checkDuplicate(
  embedding, 'opportunity', 0.95
);
```

### Threshold Guidelines

| Use Case | Threshold | Notes |
|----------|-----------|-------|
| High precision | 0.85+ | Few results, high relevance |
| Balanced | 0.70-0.80 | Good for most cases |
| High recall | 0.50-0.65 | More results, lower precision |
| Deduplication | 0.95+ | Near-exact matches |

### HNSW Index Tuning

| Dataset Size | m | ef_construction |
|--------------|---|-----------------|
| <10K | 16 | 64 |
| 10K-100K | 24 | 128 |
| >100K | 32 | 256 |

---

## LLM Infrastructure

### Provider Configuration

**Location:** `/src/config/llm.ts`

```typescript
// Provider selection
VITE_LLM_PROVIDER=together  // or 'openai'
VITE_LLM_GATING_ENABLED=true

// API keys (server-side only, NEVER prefix with VITE_)
TOGETHER_API_KEY=your-key
OPENAI_API_KEY=your-key
```

### LLM Gateway

**Location:** `/src/lib/agent-fabric/LLMGateway.ts`

Features:
- Provider abstraction
- Rate limiting
- Circuit breakers
- Response caching
- Streaming support
- Cost tracking

```typescript
const response = await llmGateway.complete(
  messages,
  {
    model: 'meta-llama/Llama-3-70b-chat-hf',
    temperature: 0.7,
    maxTokens: 2000
  },
  undefined,
  circuitBreaker
);
```

### Model Selection (Gating)

When `VITE_LLM_GATING_ENABLED=true`:
- Simple tasks → smaller/cheaper models
- Complex tasks → larger models
- Automatic selection based on task complexity

### Fallback Strategy

```
Together.ai (Primary)
    ↓ (on failure)
OpenAI (Fallback)
    ↓ (on failure)
Circuit Breaker Opens
    ↓
Return cached response or error
```

---

## Observability

### Architecture

```
Application Layer
    ↓
OpenTelemetry Instrumentation
    ├── Traces → Jaeger
    ├── Metrics → Prometheus
    └── Logs → Loki
            ↓
      Grafana Dashboards
            ↓
      Alerting Service
```

### Tracing

**Location:** `/src/lib/observability.ts`

```typescript
import { traceAgentExecution } from './lib/observability';

await traceAgentExecution('execute', attributes, async (span) => {
  // Your code here
});
```

### Metrics

Key metrics tracked:
- `agent.invocations.total`
- `agent.response_time`
- `agent.confidence_score`
- `llm.calls.total`
- `llm.latency`
- `llm.cost.total`
- `cache.hits.total`

### Alerting

**Location:** `/src/services/AlertingService.ts`

Default alerts:
| Alert | Warning | Critical |
|-------|---------|----------|
| Error rate | >5% | >10% |
| Hallucination rate | >15% | >25% |
| Response time (P95) | >5s | >10s |
| LLM cost | >$10/hr | >$50/hr |
| Cache hit rate | <50% | N/A |

### Sentry Integration

**Location:** `/src/lib/sentry.ts`

Features:
- Automatic error capture
- Stack traces with source maps
- User context tracking
- Session replay
- Performance monitoring

---

## Code Patterns & Standards

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ValueTreeViewer` |
| Functions | camelCase | `calculateROI` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Files (components) | PascalCase | `ValueTreeViewer.tsx` |
| Files (utilities) | camelCase | `formatCurrency.ts` |
| Types/Interfaces | PascalCase | `AgentOutput` |

### Type Safety Rules

1. **No `any` without justification**
2. **Prefer interfaces over types** for object shapes
3. **Use Zod for runtime validation**
4. **Export types from dedicated files**

### Service Patterns

Services must NOT hold state between requests:
```typescript
// ✅ Good
class ValueService {
  async getValue(id: string, supabase: SupabaseClient) {
    return supabase.from('values').select().eq('id', id);
  }
}

// ❌ Bad
class ValueService {
  private cache = new Map(); // Holds state!
}
```

### Tool Registration

**Location:** `/src/tools/ToolRegistry.ts`

Tools must:
1. Implement `Tool<TInput, TOutput>` interface
2. Be registered in `ToolRegistry.ts` (no dynamic creation)
3. Check `LocalRules` (LR-001) before execution
4. Use `RateLimiter` middleware for external APIs

### Logging Standards

```typescript
// ✅ Use structured logging
logger.info('Agent execution complete', {
  agentId,
  duration,
  confidence: result.confidence_score
});

// ❌ Avoid console.log
console.log('Agent done'); // Blocked by ESLint
```

### Error Handling

```typescript
// Use typed errors
class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean
  ) {
    super(message);
  }
}

// Wrap with circuit breaker
try {
  await withCircuitBreaker(async () => {
    // risky operation
  });
} catch (error) {
  if (error instanceof SafetyError) {
    // Handle safety limit exceeded
  }
}
```

---

## Workflow Patterns

### Value Tree Construction

```
User Input (Intervention)
    ↓
OpportunityAgent
    ↓
Value Tree Structure
    ├── Root: $10M
    ├── KPI: Sales
    │   ├── Outcome
    │   └── Action
    └── KPI: Churn
        ├── Outcome
        └── Action
```

### Formula Evaluation

**Location:** `/src/services/FormulaEngine.ts`

Supported operations:
- Arithmetic: `+`, `-`, `*`, `/`, `%`, `^`
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Logical: `AND`, `OR`, `NOT`
- Functions: `SUM`, `AVG`, `MIN`, `MAX`, `IF`, `ROUND`
- Variables: `{kpi.current}`, `{kpi.target}`

```typescript
const formula: Formula = {
  expression: '({revenue.gain} - {cost}) / {cost} * 100',
  variables: { 'revenue.gain': 500000, 'cost': 100000 },
  resultType: 'number'
};
const roi = formulaEngine.evaluate(formula); // 400
```

### Workflow State Machine

```typescript
type WorkflowState = 
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Valid transitions
const transitions = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['in_progress', 'cancelled'],
  completed: [],
  failed: ['in_progress', 'cancelled'],
  cancelled: []
};
```

---

## Performance Characteristics

### Targets

| Metric | Target | Actual |
|--------|--------|--------|
| TTFB | <200ms | ~150ms |
| Agent Response (P95) | <5s | ~3.5s |
| SDUI Render (P95) | <100ms | ~65ms |
| Realtime Latency | <500ms | ~250ms |
| Vector Search (P95) | <100ms | ~50ms |

### Optimizations

- **Response Streaming:** Incremental UI updates
- **LLM Caching:** Prompt caching for repeated patterns
- **Component Lazy Loading:** React.lazy for code splitting
- **Canvas Store:** In-memory state with selective persistence
- **Query Optimization:** Supabase indexes on hot paths
- **HNSW Index:** Fast approximate nearest neighbor search

---

## Document Metadata

| Field | Value |
|-------|-------|
| **Last Updated** | December 5, 2025 |
| **Owner** | Engineering Team |
| **Review Cycle** | Monthly |

---

## Merged Source Files

This document consolidates content from:
- `ARCHITECTURE_OVERVIEW.md` - System architecture
- `ARCHITECTURE_WORKFLOWS.md` - Workflow patterns
- `AGENT_IMPLEMENTATION_REVIEW.md` - Agent details
- `AGENT_FABRIC_IMPLEMENTATION_COMPLETE.md` - Agent fabric
- `RLS_POLICY_REFINEMENTS.md` - RLS patterns
- `RLS_QUICK_REFERENCE.md` - RLS quick reference
- `MIGRATION_STRATEGIES.md` - Migration patterns
- `VECTOR_STORE_COMPLETE_GUIDE.md` - Vector store
- `SECURITY_POLICIES.md` - Security implementation
- `OBSERVABILITY.md` - Observability stack
- `LLM_INFRASTRUCTURE_README.md` - LLM configuration
- `DATABASE_MIGRATION_BEST_PRACTICES.md` - Migration practices
- `MODULE_STANDARDS.md` - Code standards

---

## Notes on Restructuring

1. **Architecture Consolidation:** Merged system overview, workflows, and data flow into unified architecture section
2. **Security Unification:** Combined RLS patterns, input sanitization, and prompt injection into single security section
3. **Agent Documentation:** Consolidated agent implementation details with execution patterns
4. **Code Standards:** Extracted and normalized coding patterns from multiple sources
5. **Removed Duplicates:** Eliminated repeated content about circuit breakers, RLS, and migrations
