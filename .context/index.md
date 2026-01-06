# ValueOS Codebase Context

**Version:** 0.1.0  
**Last Updated:** 2026-01-06  
**Architecture:** Multi-Agent Sales Enablement Platform

---

## Project Overview

ValueOS is an **AI-native sales enablement platform** that helps B2B companies quantify and prove ROI throughout the customer lifecycle. It combines a proprietary Ground Truth Benchmark Layer with financial reasoning agents to replace manual spreadsheets with transparent, defensible business cases.

### Mission
To become the "Customer Value Operating System" for B2B revenue teams.

### Target Users
- Sales Representatives (generating buyer-facing business cases)
- Customer Success Teams (tracking value realization)
- Revenue Operations (analyzing pipeline and ROI)
- CFOs (validating financial projections)

---

## Architecture Principles

### 1. Multi-Agent Architecture
- **Specialization**: Each agent has a specific domain of expertise
- **Collaboration**: Agents work together through orchestration
- **Authority Levels**: Hierarchical permission system (1-5)
- **Resilience**: Circuit breakers and error handling
- **Observability**: Comprehensive logging and monitoring

### 2. Sales Enablement First
- **Deal-Centric**: Everything revolves around deals/opportunities
- **Buyer Personas**: Customized outputs for CFO, VP Sales, etc.
- **Lifecycle Stages**: Discovery → Modeling → Realization → Expansion
- **Export-Ready**: PDF/PowerPoint outputs for prospects

### 3. Trust & Transparency
- **Explainable AI**: Every decision shows reasoning
- **Confidence Scores**: Honest about uncertainty
- **Data Attribution**: Sources cited for all benchmarks
- **Audit Trails**: All actions logged

### 4. Precision & Accuracy
- **Decimal Precision**: Uses decimal.js for financial calculations
- **No Floating Point**: Avoids standard number types for currency
- **Deterministic Logic**: Pure functions for all calculations
- **Benchmark Validation**: Industry data verified and versioned

---

## Technology Stack

### Frontend
- **React 18.3** with TypeScript
- **Vite 7.2** - Build tool
- **Zustand** - State management
- **Radix UI** - Accessible components
- **Tailwind CSS** - Styling
- **React Router 6** - Navigation

### Backend (Supabase)
- **PostgreSQL 15.8** - Database
- **GoTrue** - Authentication
- **PostgREST** - Auto-generated REST API
- **Realtime** - WebSocket subscriptions
- **Storage** - File uploads
- **Kong** - API Gateway

### AI/LLM
- **Together AI** - Primary LLM provider
- **OpenTelemetry** - Observability
- **Custom Agent Fabric** - Multi-agent orchestration

### Observability
- **Jaeger** - Distributed tracing
- **Grafana** - Visualization
- **Prometheus** - Metrics
- **Loki** - Log aggregation

---

## Directory Structure

```
ValueOS/
├── src/
│   ├── components/          # React components
│   │   ├── Deals/          # Sales enablement UI (NEW)
│   │   ├── Agent/          # Agent-related components
│   │   ├── Canvas/         # Value canvas components
│   │   └── ui/             # Base UI components (Radix)
│   │
│   ├── services/           # Business logic layer
│   │   ├── ValueCaseService.ts      # Deal management
│   │   ├── UnifiedAgentAPI.ts       # Agent orchestration
│   │   ├── CRMIntegrationService.ts # CRM sync
│   │   └── [100+ services]
│   │
│   ├── lib/                # Core libraries
│   │   ├── agent-fabric/   # Agent system
│   │   │   ├── agents/     # Agent implementations
│   │   │   ├── AgentFabric.ts      # Orchestrator
│   │   │   ├── LLMGateway.ts       # LLM abstraction
│   │   │   ├── ContextFabric.ts    # Context management
│   │   │   └── CircuitBreaker.ts   # Resilience
│   │   ├── supabase.ts     # Supabase client
│   │   └── telemetry.ts    # OpenTelemetry
│   │
│   ├── views/              # Page components
│   │   ├── DealsView.tsx   # Main sales interface (NEW)
│   │   └── [other views]
│   │
│   ├── types/              # TypeScript types
│   │   ├── vos.ts          # Value OS types (lifecycle stages)
│   │   ├── agent.ts        # Agent types
│   │   └── [other types]
│   │
│   └── config/             # Configuration
│       ├── agentFabric.ts  # Agent config
│       └── environment.ts  # Environment config
│
├── supabase/               # Database
│   ├── migrations/         # SQL migrations
│   └── config.toml         # Supabase config
│
├── infra/                  # Infrastructure
│   ├── k8s/               # Kubernetes manifests
│   │   └── observability/ # Grafana, Jaeger, Prometheus
│   └── docker/            # Docker configs
│
├── tests/                  # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── docs/                   # Documentation
```

---

## Key Agents

### 1. OpportunityAgent (Authority: 3)
**Purpose:** Discover customer pain points and business objectives  
**Lifecycle Stage:** Discovery  
**Outputs:** Pain points, objectives, persona fit score

### 2. TargetAgent (Authority: 3)
**Purpose:** Build value models and ROI calculations  
**Lifecycle Stage:** Modeling  
**Outputs:** Value tree, financial metrics, scenarios

### 3. FinancialModelingAgent (Authority: 4)
**Purpose:** Calculate NPV, IRR, payback period  
**Lifecycle Stage:** Modeling  
**Outputs:** ROI, NPV, IRR, sensitivity analysis

### 4. RealizationAgent (Authority: 3)
**Purpose:** Track value delivery post-sale  
**Lifecycle Stage:** Realization  
**Outputs:** Actual vs. predicted, variance analysis

### 5. ExpansionAgent (Authority: 3)
**Purpose:** Identify upsell opportunities  
**Lifecycle Stage:** Expansion  
**Outputs:** Expansion opportunities, incremental value

### 6. BenchmarkAgent (Authority: 3)
**Purpose:** Provide industry benchmarks  
**Used In:** All stages  
**Outputs:** Percentile positioning, gap analysis

### 7. CommunicatorAgent (Authority: 2)
**Purpose:** Generate buyer-facing narratives  
**Used In:** All stages  
**Outputs:** Executive summaries, white papers

---

## Lifecycle Stages

### 1. Discovery (Opportunity)
**Goal:** Identify pain points and opportunities  
**Agent:** OpportunityAgent  
**User Action:** Select buyer persona, provide discovery data  
**Output:** Quantified pain points, business objectives

### 2. Modeling (Target)
**Goal:** Build ROI model and business case  
**Agents:** TargetAgent, FinancialModelingAgent, BenchmarkAgent  
**User Action:** Review and adjust assumptions  
**Output:** Complete business case with benchmarks

### 3. Realization
**Goal:** Track value delivery post-sale  
**Agent:** RealizationAgent  
**User Action:** Input actual metrics  
**Output:** Actual vs. predicted analysis

### 4. Expansion
**Goal:** Identify upsell opportunities  
**Agent:** ExpansionAgent  
**User Action:** Review opportunities  
**Output:** Expansion proposals

---

## Buyer Personas

### CFO
**Focus:** ROI, NPV, Cash Flow, Risk  
**Template:** TrinityDashboard  
**Language:** Financial metrics, conservative estimates

### VP Sales
**Focus:** Revenue Growth, Win Rates, Pipeline  
**Template:** ScenarioMatrix  
**Language:** Sales impact, competitive positioning

### VP Product
**Focus:** Feature Impact, User Adoption  
**Template:** ImpactCascadeTemplate  
**Language:** Product outcomes, customer value

### CTO
**Focus:** Technical Efficiency, Integration  
**Template:** TechnicalDeepDive  
**Language:** Technical feasibility, architecture

### COO
**Focus:** Operational Efficiency, Cost Reduction  
**Template:** OperationalImpact  
**Language:** Process improvement, efficiency gains

---

## Data Models

### ValueCase (Deal)
```typescript
{
  id: string;
  name: string;
  company: string;
  stage: 'opportunity' | 'target' | 'realization' | 'expansion';
  status: 'in-progress' | 'completed' | 'paused';
  quality_score?: number;
  metadata: {
    persona?: BuyerPersona;
    dealAmount?: number;
    closeDate?: string;
    crmDealId?: string;
  };
}
```

### BusinessObjective
```typescript
{
  id: string;
  value_case_id: string;
  name: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5;
  owner?: string;
}
```

### PainPoint
```typescript
{
  category: 'efficiency' | 'cost' | 'revenue' | 'risk';
  description: string;
  severity: 'high' | 'medium' | 'low';
  estimated_annual_cost: number;
  affected_stakeholders: string[];
  confidence?: number;
}
```

---

## Coding Conventions

### TypeScript
- **Strict mode enabled**
- **No `any` types** (use `unknown` if needed)
- **Interfaces over types** for object shapes
- **Explicit return types** on functions
- **Path aliases:** `@/` maps to `src/`

### React
- **Functional components** with hooks
- **Props interfaces** always defined
- **Memoization** for expensive computations
- **Error boundaries** for resilience
- **Lazy loading** for routes

### Services
- **Pure functions** for calculations
- **Service layer** for business logic (not in components)
- **Error handling** with try-catch and logging
- **Result pattern** for external calls

### Naming
- **Components:** PascalCase (e.g., `DealImportModal`)
- **Files:** PascalCase for components, camelCase for utilities
- **Functions:** camelCase (e.g., `handleDealImported`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Types/Interfaces:** PascalCase (e.g., `ValueCase`)

### File Organization
- **One component per file**
- **Co-locate tests** (ComponentName.test.tsx)
- **Index files** for clean exports
- **Barrel exports** in directories

---

## Environment Variables

### Required
```bash
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anonymous key
TOGETHER_API_KEY           # Together AI API key (server-side only)
```

### Optional
```bash
VITE_LLM_GATING_ENABLED    # Cost-control gating (default: true)
VITE_AGENT_FABRIC_ENABLED  # Enable agent fabric (default: true)
REDIS_ENABLED              # Enable Redis caching (default: false)
VITE_SENTRY_ENABLED        # Enable Sentry monitoring (default: false)
```

---

## Common Patterns

### Agent Invocation
```typescript
import { getUnifiedAgentAPI } from '@/services/UnifiedAgentAPI';

const api = getUnifiedAgentAPI();
const response = await api.invoke({
  agent: 'opportunity',
  query: 'Analyze Acme Corp',
  context: { valueCaseId, company, description }
});
```

### Database Queries (Supabase)
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('value_cases')
  .select('*')
  .eq('organization_id', orgId);
```

### Error Handling
```typescript
try {
  const result = await service.execute();
  logger.info('Success', { result });
  return result;
} catch (error) {
  logger.error('Failed', error as Error);
  throw new ServiceError('User-friendly message', error);
}
```

### Confidence Scores
```typescript
// Always show confidence with data
interface AnalysisResult {
  value: number;
  confidence: number;  // 0-1
  dataSources: string[];
  reasoning: string;
}
```

---

## Testing Strategy

### Unit Tests (Vitest)
- Component rendering
- Service logic
- Utility functions
- Target: 80%+ coverage

### Integration Tests
- API endpoints
- Database operations
- Agent workflows

### E2E Tests (Playwright)
- User flows
- Authentication
- Deal lifecycle
- Export functionality

### Performance Tests
- Load testing
- Agent execution times
- API response times

---

## Security

### Multi-Tenancy
- **Row Level Security (RLS)** enforced at database
- **Tenant ID** in all queries
- **No cross-tenant access** possible

### Authentication
- **Supabase Auth** (GoTrue)
- **JWT tokens** for API access
- **MFA support** available
- **OAuth providers** supported

### Secrets
- **Never expose** service role keys to frontend
- **Environment variables** for sensitive data
- **Kubernetes Secrets** in production
- **Audit logging** for all sensitive operations

---

## Performance

### Frontend
- **Code splitting** with lazy loading
- **Memoization** for expensive computations
- **Virtual scrolling** for large lists
- **Optimistic updates** for better UX

### Backend
- **Connection pooling** (Supabase)
- **Query optimization** with indexes
- **Caching** with Redis (optional)
- **Rate limiting** on API endpoints

### Agents
- **Circuit breakers** prevent cascading failures
- **Timeout limits** (30s default)
- **Cost limits** ($5 per execution)
- **Streaming UI** for sub-800ms feedback

---

## Deployment

### Development
```bash
npm run dev          # Start Vite dev server (port 5173)
npm run backend      # Start Express backend (port 3000)
supabase start       # Start Supabase stack
```

### Production
```bash
npm run build        # Build for production
npm run preview      # Test production build
```

### Observability
```bash
cd infra
docker-compose -f docker-compose.observability.yml up -d
# Jaeger: http://localhost:16686
# Grafana: http://localhost:3001
```

---

## Recent Changes (2026-01-06)

### Sales Enablement Frontend ✅
- **8 new components** for deal-centric workflow
- **DealsView** as main interface (replaces generic chat)
- **Lifecycle stage navigation** (4 stages)
- **Buyer persona selection** (6 personas)
- **Business case generator** with real-time progress
- **Benchmark comparison** with industry data
- **Export functionality** (PDF/PowerPoint ready)

### Security Fixes ✅
- **jspdf upgraded** from 3.0.4 → 4.0.0 (CRITICAL vulnerability fixed)
- **0 vulnerabilities** in npm audit

### Dependencies Added ✅
- **@radix-ui/react-progress** - Progress bars
- **@radix-ui/react-tabs** - Tab navigation
- **@radix-ui/react-tooltip** - Tooltips

### Observability ✅
- **Jaeger UI** running on port 16686
- **Complete stack** configured (Grafana, Prometheus, Tempo, Loki)
- **OpenTelemetry** instrumentation in code

---

## Known Issues

### Minor (Non-Blocking)
1. **Mock CRM data** in DealImportModal (replace when OAuth UI ready)
2. **Export not fully wired** (connect to existing exportToPDF utility)
3. **Large bundle chunks** (optimization opportunity)
4. **Mobile responsiveness** needs improvement

---

## Getting Help

### Documentation
- `SALES_ENABLEMENT_IMPLEMENTATION.md` - Implementation guide
- `COMPREHENSIVE_TEST_REPORT.md` - Test results
- `OBSERVABILITY_REVIEW.md` - Observability stack review
- `ARCHITECTURE_CLARIFICATION.md` - Architecture overview

### Key Files
- `src/lib/agent-fabric/` - Agent system
- `src/services/` - Business logic
- `src/components/Deals/` - Sales enablement UI
- `supabase/migrations/` - Database schema

### Commands
```bash
npm run typecheck    # Check TypeScript
npm test            # Run tests
npm run lint        # Lint code
npm run build       # Build for production
```

---

## Contributing

### Before Making Changes
1. Read this context document
2. Review relevant documentation
3. Check existing patterns in similar components
4. Run tests before committing

### Code Review Checklist
- [ ] TypeScript compiles with no errors
- [ ] Tests pass
- [ ] Follows coding conventions
- [ ] Error handling implemented
- [ ] Logging added for important operations
- [ ] Documentation updated if needed

---

## Context Modules

This `.context/` directory contains:
- **`index.md`** - This overview (you are here)
- **`agents.md`** - Agent system architecture, types, and usage patterns
- **`database.md`** - Database schema, RLS policies, and query patterns
- **`frontend.md`** - Frontend components, routing, and state management
- **`.contextignore`** - Files to exclude from context generation

---

**Last Updated:** 2026-01-06  
**Maintainer:** AI Implementation Team  
**Status:** Production Ready
