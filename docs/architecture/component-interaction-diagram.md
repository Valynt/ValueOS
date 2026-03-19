---
title: Component Interaction Diagram
owner: team-platform
system: valueos-platform
---

# Component Interaction Diagram

Visual maps of how ValueOS components connect and communicate.

---

## System Overview

How a user request flows through the system:

```mermaid
graph TB
    User([User / Browser])

    subgraph Frontend["Frontend Apps"]
        VA[ValyntApp]
        Academy[VOSAcademy]
        MCP_Dash[MCP Dashboard]
    end

    subgraph Backend["Backend API — Express"]
        API[REST API Routes]
        WS[WebSocket Server]
        Auth[Auth Middleware]
        RBAC[RBAC / Permissions]
    end

    subgraph AgentSystem["Agent System"]
        Orch[Unified Agent Orchestrator]
        Factory[Agent Factory]

        subgraph Agents["Lifecycle Agents"]
            Opp[Opportunity]
            Tgt[Target]
            Exp[Expansion]
            Int[Integrity]
            Real[Realization]
        end

        LLM[LLM Gateway]
        Mem[Memory System]
        CB[Circuit Breaker]
        MB[Message Bus]
    end

    subgraph DataLayer["Data Layer"]
        SB[(Supabase / Postgres)]
        Redis[(Redis)]
        Bull[BullMQ Queues]
    end

    subgraph External["External Services"]
        AI[LLM Providers<br/>OpenAI / Anthropic / Gemini]
        CRM[CRM Integrations<br/>HubSpot / Salesforce]
        Slack_Int[Slack]
    end

    User --> VA
    User --> Academy
    User --> MCP_Dash

    VA -->|HTTPS| API
    VA -->|WSS| WS
    Academy -->|HTTPS| API
    MCP_Dash -->|HTTPS| API

    API --> Auth --> RBAC
    RBAC --> Orch

    Orch --> Factory
    Factory --> Agents
    Agents --> LLM
    Agents --> Mem
    Agents <--> MB

    LLM --> CB
    CB --> AI

    Mem --> SB
    Mem --> Redis
    MB --> Redis
    Orch --> Bull

    API --> SB
    API --> Redis

    Agents -->|MCP Tools| CRM
    Agents -->|MCP Tools| Slack_Int

    SB -.->|RLS enforced| SB
```

## Agent Lifecycle Pipeline

How the core 5 lifecycle agents collaborate on a value case (within the 8-agent fabric):

```mermaid
graph LR
    subgraph Pipeline["Value Lifecycle Pipeline"]
        O[Opportunity Agent<br/>Find potential value]
        T[Target Agent<br/>Set measurable goals]
        E[Expansion Agent<br/>Identify growth paths]
        I[Integrity Agent<br/>Validate with data]
        R[Realization Agent<br/>Measure outcomes]
    end

    O -->|"Identified opportunities"| T
    T -->|"Goals & benchmarks"| E
    E -->|"Expansion plan"| I
    I -->|"Validated claims"| R
    R -.->|"Feedback loop"| O

    subgraph Shared["Shared Infrastructure"]
        MEM[Memory System]
        BUS[Message Bus]
        LLM[LLM Gateway]
    end

    O --- MEM
    T --- MEM
    E --- MEM
    I --- MEM
    R --- MEM

    O --- BUS
    T --- BUS
    E --- BUS
    I --- BUS
    R --- BUS

    O --- LLM
    T --- LLM
    E --- LLM
    I --- LLM
    R --- LLM
```

## Request Flow: User Creates a Value Case

Step-by-step flow when a user creates a new value case:

```mermaid
sequenceDiagram
    actor User
    participant App as ValyntApp
    participant API as Backend API
    participant Auth as Auth Middleware
    participant Orch as Agent Orchestrator
    participant Opp as Opportunity Agent
    participant LLM as LLM Gateway
    participant DB as Supabase (Postgres)
    participant Mem as Memory System

    User->>App: Click "New Value Case"
    App->>API: POST /api/value-cases
    API->>Auth: Validate JWT + check permissions
    Auth-->>API: Authorized (org_id: acme-corp)

    API->>DB: INSERT value_case (org_id = acme-corp)
    DB-->>API: Created (id: vc_123)

    API->>Orch: Start value analysis workflow
    Orch->>Opp: Execute with context

    Opp->>Mem: Retrieve past account memories
    Mem-->>Opp: 3 relevant memories found

    Opp->>LLM: secureInvoke(prompt, schema)
    LLM-->>Opp: Validated response (3 opportunities)

    Opp->>Mem: Store new episodic memory
    Opp-->>Orch: AgentOutput (status: completed)

    Orch-->>API: Workflow result
    API-->>App: 200 OK + opportunities
    App-->>User: Display value case with AI insights
```

## Data Isolation Model

How tenant isolation works across layers:

```mermaid
graph TB
    subgraph TenantA["Tenant A (Acme Corp)"]
        UA[Users A]
        DA[Data A]
    end

    subgraph TenantB["Tenant B (Beta Inc)"]
        UB[Users B]
        DB_B[Data B]
    end

    subgraph AppLayer["Application Layer"]
        API[Backend API]
        Agents[Agent System]
    end

    subgraph DBLayer["Database Layer"]
        PG[(Postgres + RLS)]
    end

    UA --> API
    UB --> API

    API -->|"org_id = acme"| PG
    API -->|"org_id = beta"| PG

    Agents -->|"tenant_id in metadata"| PG

    PG -->|"RLS: WHERE org_id = current_org"| DA
    PG -->|"RLS: WHERE org_id = current_org"| DB_B

    style DA fill:#d4edda
    style DB_B fill:#cce5ff
```

## SDUI Rendering Flow

How Server-Driven UI works:

```mermaid
sequenceDiagram
    participant App as ValyntApp
    participant API as Backend API
    participant SDUI as SDUI Engine
    participant DB as Database

    App->>API: GET /api/sdui/page/dashboard
    API->>DB: Fetch page schema + user context
    DB-->>API: Schema + data bindings

    API->>SDUI: Resolve data bindings
    SDUI->>DB: Query bound data (tenant-scoped)
    DB-->>SDUI: Resolved data

    SDUI-->>API: Complete page definition (JSON)
    API-->>App: Page schema + resolved data

    Note over App: SDUI Renderer interprets<br/>the schema and renders<br/>React components dynamically

    App->>App: Render page from schema
```
