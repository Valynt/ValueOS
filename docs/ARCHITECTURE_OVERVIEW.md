# ValueCanvas Architecture Overview

**Last Updated:** December 5, 2025  
**Version:** 1.0.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Core Components](#core-components)
4. [Agent Framework](#agent-framework)
5. [SDUI System](#sdui-system)
6. [Data Flow](#data-flow)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)

---

## System Overview

ValueCanvas is a multi-tenant AI workflow platform for creating and managing value cases across the value lifecycle: **Opportunity** → **Target** → **Realization** → **Expansion**.

### Key Design Principles

- **Server-Driven UI (SDUI)**: Dynamic UI generation from agent outputs
- **Agent-Based Architecture**: Specialized AI agents for each value stage
- **Event-Driven**: Real-time updates via Supabase realtime subscriptions
- **Security-First**: Input sanitization, RBAC, audit logging
- **Observability**: OpenTelemetry instrumentation throughout

---

## Architecture Layers

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

---

## Core Components

### 1. Frontend (React + Vite)

**Location:** `/src/components`, `/src/pages`

- **ChatCanvasLayout**: Main UI shell with sidebar + canvas
- **CommandBar**: ⌘K agent invocation interface
- **SDUI Renderer**: Dynamic component rendering from agent outputs
- **CanvasStore**: Zustand store for undo/redo and state management

**Key Features:**
- Canvas-first UX (chat + dynamic canvas)
- Keyboard shortcuts (⌘K, ⌘Z, ⌘⇧Z)
- Real-time updates via Supabase subscriptions
- Progressive Web App (PWA) capabilities

### 2. Agent Fabric

**Location:** `/src/agents`, `/src/lib/agent-fabric`

**Core Agents:**

| Agent | Purpose | Stage |
|-------|---------|-------|
| `OpportunityAgent` | Identifies and analyzes value opportunities | Opportunity |
| `TargetAgent` | Designs targeted interventions | Target |
| `RealizationAgent` | Tracks value realization and feedback loops | Realization |
| `IntegrityAgent` | Validates artifact quality | All |
| `ExpansionAgent` | Identifies upsell/expansion opportunities | Expansion |
| `CoordinatorAgent` | Orchestrates multi-agent workflows | All |
| `CommunicatorAgent` | Handles stakeholder communication | All |

**Agent Architecture:**
- Each agent extends `BaseAgent` interface
- LLM Gateway for provider abstraction (Together.ai, OpenAI)
- Agent Memory for long-term learning
- Telemetry instrumentation

### 3. SDUI System

**Location:** `/src/sdui`

**Components:**
- **Schema**: TypeScript definitions for SDUI page structure
- **Renderer**: Converts SDUI JSON to React components
- **CanvasPatcher**: Applies incremental updates
- **ComponentRegistry**: Maps SDUI components to React components
- **Sanitizer**: Security validation and XSS prevention

**SDUI Flow:**
```
Agent Output (JSON) 
  → Validation 
  → Sanitization 
  → CanvasStore 
  → Renderer 
  → React Components
```

### 4. Workflow Engine

**Location:** `/src/services/WorkflowOrchestrator.ts`

- State machine for value lifecycle stages
- Task routing and agent selection
- Event emission for real-time updates
- Workflow persistence via Supabase

### 5. Data Services

**Location:** `/src/services`, `/src/repositories`

**Key Services:**
- `AgentChatService`: Agent interaction and streaming
- `ValueCaseService`: Value case CRUD + subscriptions
- `ValueMetricsTracker`: Value delivery measurement
- `DemoAnalyticsService`: Onboarding funnel analytics
- `WorkflowStateService`: Workflow persistence

---

## Agent Framework

### LLM Gateway

**Location:** `/src/lib/agent-fabric/LLMGateway.ts`

- Provider abstraction (Together.ai, OpenAI, Anthropic)
- Rate limiting and circuit breakers
- Response caching
- Streaming support
- Cost tracking

### Agent Memory

**Location:** `/src/lib/agent-fabric/AgentMemory.ts`

**Features:**
- Long-term memory storage
- Semantic search with embeddings
- Confidence scoring
- Access count tracking
- Automatic memory pruning

**Memory Types:**
- **Facts**: Static information learned
- **Preferences**: User preferences
- **Patterns**: Detected patterns
- **Feedback**: User feedback on outputs
- **Outcomes**: Result tracking

### Prompt Templates

**Location:** `/src/data/promptTemplates.ts`

- 12+ pre-built templates for common scenarios
- Variable interpolation
- Category-based organization (Opportunity, Target, Realization, Expansion)
- Estimated completion times

---

## SDUI System

### Page Structure

```typescript
interface SDUIPageDefinition {
  type: 'page';
  version: number;
  sections: SDUISection[];
  metadata?: {
    theme: 'dark' | 'light';
    experienceId?: string;
    // ... additional metadata
  };
}

type SDUISection = SDUIComponent | SDUILayoutDirective;

interface SDUIComponent {
  type: 'component';
  component: string;      // Component name from registry
  version: number;
  props: Record<string, any>;
  hydrateWith?: string[]; // Data hydration sources
  fallback?: {            // Fallback if component fails
    component?: string;
    props?: Record<string, any>;
  };
}

interface SDUILayoutDirective {
  type: 'layout.directive';
  intent: string;         // Agent intent
  component: string;
  props: Record<string, any>;
  layout?: 'default' | 'full_width' | 'two_column' | 'dashboard' | 'grid';
  metadata?: Record<string, any>;
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

### Nested Layouts

Supports recursive layout rendering:
```typescript
{
  layout: {
    type: 'grid',
    children: [
      { type: 'component', component: 'Card', ... },
      { type: 'component', component: 'Chart', ... }
    ]
  }
}
```

---

## Data Flow

### User Interaction Flow

```
User types in CommandBar (⌘K)
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

### Realtime Updates

```
Agent completes task
  ↓
Update Supabase (value_cases, workflow_state, etc.)
  ↓
Supabase Realtime broadcasts change
  ↓
Frontend subscription receives update
  ↓
CanvasStore updates
  ↓
React re-renders affected components
```

---

## Security Architecture

### Authentication & Authorization

- **Supabase Auth**: Email/password, OAuth, magic links
- **Row-Level Security (RLS)**: Database-level access control
- **Multi-tenancy**: Organization-based data isolation
- **API Key Management**: Secure key storage and rotation

### Input Validation

1. **Schema Validation**: Zod schemas for all API inputs
2. **SDUI Sanitization**: `SDUISanitizer` removes malicious content
3. **Prompt Injection Defense**: LLM prompt templating with escaping
4. **SQL Injection**: Supabase client uses parameterized queries

### Audit Logging

**Location:** `/src/lib/sof-governance.ts`

- All agent decisions logged
- Workflow state transitions tracked
- User actions recorded
- Anomaly detection

---

## Deployment Architecture

### Development

```
Vite Dev Server (localhost:5173)
  ↓
Supabase Local (localhost:54321)
  ↓
Together.ai API (remote)
```

### Production

```
┌─────────────────┐
│  Cloudflare CDN │ (Static assets)
└────────┬────────┘
         │
    ┌────▼────┐
    │  Vite   │ (SSR/SSG)
    │  Build  │
    └────┬────┘
         │
┌────────▼─────────┐
│  Supabase Cloud  │
│  - PostgreSQL    │
│  - Realtime      │
│  - Storage       │
│  - Edge Functions│
└──────────────────┘
         │
    ┌────▼────┐
    │Together │ (LLM inference)
    │   AI    │
    └─────────┘
```

### Observability

- **OpenTelemetry**: Distributed tracing
- **Sentry**: Error tracking
- **Custom Telemetry**: SDUI performance, agent latency
- **Analytics**: Posthog for product analytics

---

## Performance Characteristics

### Targets

| Metric | Target | Actual |
|--------|--------|--------|
| TTFB (Time to First Byte) | < 200ms | ~150ms |
| Agent Response (P95) | < 5s | ~3.5s |
| SDUI Render (P95) | < 100ms | ~65ms |
| Realtime Latency | < 500ms | ~250ms |

### Optimizations

- **Response Streaming**: Incremental UI updates during agent processing
- **LLM Caching**: Prompt caching for repeated patterns
- **Component Lazy Loading**: React.lazy for code splitting
- **Canvas Store**: In-memory state with selective persistence
- **Query Optimization**: Supabase indexes on hot paths

---

## Technology Stack

### Frontend
- React 18
- Vite 5
- TailwindCSS
- Zustand (state management)
- React Router
- Lucide Icons

### Backend
- Supabase (PostgreSQL + Realtime + Storage + Auth)
- Together.ai (LLM inference)
- OpenTelemetry (observability)

### Testing
- Vitest (unit tests)
- Playwright (E2E tests)
- Locust (load testing)

### Tooling
- TypeScript
- ESLint + Prettier
- Husky (git hooks)
- Snyk (security scanning)

---

## Future Architecture

### Planned Enhancements

1. **Multi-Model Routing**: Automatic model selection based on task
2. **Agent Marketplace**: Plugin architecture for custom agents
3. **Collaborative Editing**: Multi-user canvas collaboration
4. **Offline Mode**: Service worker with local storage
5. **Advanced Analytics**: Embedded BI dashboards

---

**Maintained by:** ValueCanvas Engineering  
**Last Review:** December 5, 2025
