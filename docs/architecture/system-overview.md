# ValueOS System Architecture Overview

_Added per audit recommendation #14: diagrams-as-code for onboarding speed._

## High-Level Architecture

The authoritative runtime inventory lives in [`runtime-inventory.json`](../../runtime-inventory.json). For the core product, the runtime boundary is: browser-only `apps/ValyntApp/src/**` on one side, and Node-only `packages/backend/src/**` for secrets, privileged Supabase adapters, workers, and server configuration on the other.

```mermaid
graph TB
    subgraph "Browser Runtimes"
        VA[ValyntApp<br/>Primary React + Vite app]
        MCP_DASH[MCP Dashboard<br/>Ops/observability browser UI]
    end

    subgraph "Node.js Runtime"
        EXPRESS[Express.js Server<br/>packages/backend · Port 3001]
        MW[Middleware Pipeline<br/>Auth / RLS / RBAC / MFA<br/>Rate Limiting / Tenant Context]
        API[REST API<br/>OpenAPI 3.1]
        SECRETS[Secret Providers + Settings<br/>server-only ownership]
    end


    subgraph "Agent Fabric"
        direction TB
        OA[OpportunityAgent]
        TA[TargetAgent]
        FMA[FinancialModelingAgent]
        IA[IntegrityAgent]
        RA[RealizationAgent]
        EA[ExpansionAgent]
        NA[NarrativeAgent]
        CAA[ComplianceAuditorAgent]
    end

    subgraph "Runtime Services"
        DR[DecisionRouter]
        ER[ExecutionRuntime]
        PE[PolicyEngine]
        CS[ContextStore]
        AC[ArtifactComposer]
        RE[RecommendationEngine]
    end

    subgraph "Messaging"
        MB[MessageBus<br/>CloudEvents]
        NATS[NATS JetStream<br/>Agent Messaging]
        BULLMQ[BullMQ<br/>Job Queues]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Supabase + RLS)]
        REDIS[(Redis<br/>Cache / Rate Limits<br/>Kill Switches)]
        MEMORY[Memory System<br/>Tenant-Scoped Vectors]
    end

    subgraph "Observability"
        PROM[Prometheus]
        GRAFANA[Grafana]
        LOKI[Loki]
        TEMPO[Tempo]
        OTEL[OTel Collector]
        SENTRY[Sentry]
    end

    subgraph "External"
        LLM[LLM Providers<br/>OpenAI / Together]
        CRM[CRM Integrations<br/>Salesforce / HubSpot]
        STRIPE[Stripe<br/>Billing]
    end

    VA --> API
    MCP_DASH --> API

    API --> MW --> EXPRESS
    EXPRESS --> SECRETS

    EXPRESS --> DR
    DR --> ER
    ER --> OA & TA & FMA & IA & RA & EA & NA & CAA
    ER --> PE
    ER --> CS
    ER --> AC
    ER --> RE

    OA & TA & FMA & IA & RA & EA & NA & CAA --> MB
    MB --> NATS

    OA & TA & FMA & IA & RA & EA & NA & CAA --> LLM
    OA & TA & FMA & IA & RA & EA & NA & CAA --> MEMORY

    EXPRESS --> PG
    EXPRESS --> REDIS
    EXPRESS --> BULLMQ
    BULLMQ --> REDIS

    MEMORY --> PG

    EXPRESS --> OTEL --> PROM & LOKI & TEMPO
    PROM --> GRAFANA
    LOKI --> GRAFANA
    TEMPO --> GRAFANA
    EXPRESS --> SENTRY

    EXPRESS --> CRM
    EXPRESS --> STRIPE
```

## Agent Lifecycle Flow

```mermaid
graph LR
    OPPORTUNITY[Opportunity<br/>Discovery] --> DRAFTING[Drafting<br/>KPI Targets]
    DRAFTING --> MODELING[Financial<br/>Modeling]
    MODELING --> VALIDATING[Integrity<br/>Validation]
    VALIDATING --> COMPOSING[Narrative<br/>Composition]
    COMPOSING --> REALIZATION[Realization<br/>Planning]
    REALIZATION --> EXPANSION[Expansion<br/>Strategy]

    OPPORTUNITY -.- OA2[OpportunityAgent]
    DRAFTING -.- TA2[TargetAgent]
    MODELING -.- FMA2[FinancialModelingAgent]
    VALIDATING -.- IA2[IntegrityAgent]
    VALIDATING -.- CAA2[ComplianceAuditorAgent]
    COMPOSING -.- NA2[NarrativeAgent]
    REALIZATION -.- RA2[RealizationAgent]
    EXPANSION -.- EA2[ExpansionAgent]

    style OPPORTUNITY fill:#e1f5fe
    style DRAFTING fill:#e8f5e9
    style MODELING fill:#fff3e0
    style VALIDATING fill:#fce4ec
    style COMPOSING fill:#f3e5f5
    style REALIZATION fill:#e0f2f1
    style EXPANSION fill:#fff8e1
```

## Multi-Tenant Data Flow

```mermaid
graph TD
    REQ[Incoming Request<br/>JWT Token] --> AUTH[Auth Middleware<br/>Extract user + org]
    AUTH --> TC[Tenant Context<br/>Middleware]
    TC --> RLS[PostgreSQL RLS<br/>organization_id filter]
    TC --> VMEM[Vector Memory<br/>tenant_id metadata filter]
    TC --> CACHE[Redis Cache<br/>Tenant-prefixed keys]

    RLS --> DATA[Query Results<br/>Tenant-isolated]
    VMEM --> EMBEDDINGS[Embeddings<br/>Tenant-isolated]
    CACHE --> CACHED[Cached Data<br/>Tenant-isolated]

    style REQ fill:#e3f2fd
    style RLS fill:#c8e6c9
    style VMEM fill:#c8e6c9
    style CACHE fill:#c8e6c9
```

## CI/CD Pipeline

```mermaid
graph TD
    PR[Pull Request] --> UNIT[Unit/Component/Schema<br/>Lint + Typecheck + Tests]
    PR --> TIS[Tenant Isolation<br/>Static Gate]
    PR --> TIR[Tenant Isolation<br/>Runtime Gate]
    PR --> SEC[Security Gate<br/>Semgrep + Gitleaks + Trivy]
    PR --> A11Y[Accessibility Audit<br/>WCAG 2.2 AA + Lighthouse]
    PR --> E2E[Live Backend E2E<br/>Playwright + Express]

    UNIT --> GATE{PR Blocking<br/>Gate}
    TIS --> GATE
    TIR --> GATE
    SEC --> GATE
    A11Y --> GATE
    E2E -.-> GATE

    GATE -->|All pass| MERGE[Merge to main]
    MERGE --> DEPLOY[Blue-Green Deploy<br/>K8s + kustomize]

    style GATE fill:#fff9c4
    style MERGE fill:#c8e6c9
    style DEPLOY fill:#bbdefb
```
