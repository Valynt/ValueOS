# What Is ValueOS?

**Audience:** Anyone — developers, product managers, sales engineers, new team members.

---

## The One-Liner

ValueOS is a platform that helps B2B SaaS companies prove and grow the business value they deliver to customers.

## The Problem

Sales and customer success teams often struggle to answer: *"What's the ROI of our product?"* They rely on spreadsheets, anecdotes, and gut feelings. ValueOS replaces that with data-backed value tracking powered by AI agents.

## How It Works (Plain English)

```
┌─────────────────────────────────────────────────────────┐
│                    You (the user)                       │
│  Sales engineer, CS manager, or account executive       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              ValyntApp (the main app)                   │
│  Where you build value cases, track metrics, and        │
│  collaborate with your team. Runs in your browser.      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              AI Agent System (the brain)                │
│  5 specialized AI agents that analyze data, find        │
│  opportunities, and generate insights automatically.    │
│                                                         │
│  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐     │
│  │Opportun-│ │ Target │ │Expansion │ │Integrity │     │
│  │  ity    │ │        │ │          │ │          │     │
│  └─────────┘ └────────┘ └──────────┘ └──────────┘     │
│                    ┌────────────┐                       │
│                    │Realization │                       │
│                    └────────────┘                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Data Layer (the memory)                    │
│  Stores customer data, value metrics, agent insights,   │
│  and audit trails. Fully isolated per organization.     │
└─────────────────────────────────────────────────────────┘
```

### What each AI agent does

| Agent | Role | Real-world analogy |
|---|---|---|
| **Opportunity** | Finds new ways to demonstrate value to a customer | A scout looking for untapped potential |
| **Target** | Sets measurable goals and benchmarks | A financial planner setting targets |
| **Expansion** | Identifies upsell and growth opportunities | An account strategist spotting expansion paths |
| **Integrity** | Validates that claims are backed by real data | A fact-checker ensuring honesty |
| **Realization** | Tracks whether promised value was actually delivered | An auditor measuring outcomes |

These agents work together in a pipeline. For example: Opportunity finds a potential win → Target sets the goal → Realization later checks if it happened → Integrity validates the numbers.

### The three applications

| App | Who uses it | What it does |
|---|---|---|
| **ValyntApp** | Sales, CS, and account teams | The main product. Build value cases, view dashboards, interact with AI agents, manage customer accounts. |
| **VOSAcademy** | Internal team members | Training portal for learning how to use ValueOS and value engineering concepts. |
| **MCP Dashboard** | Platform operators | Monitoring tool for observing AI agent health, tool usage, and system performance. |

## Key Concepts Explained

### Server-Driven UI (SDUI)

Instead of hardcoding every screen, the backend tells the frontend *what to render*. This means the platform can adapt its interface based on context — showing different layouts for different customers or workflows without deploying new code.

**What this means for you:** The UI can be personalized and updated dynamically. New features can appear without you needing to update anything.

### Multi-Tenancy

Every organization's data is completely isolated. Your company's data is invisible to other companies on the platform. This is enforced at the database level — not just in application code.

**What this means for you:** Your data is private by design, not by convention.

### Memory System

The AI agents remember context across interactions. They store what they've learned about your accounts in different types of memory:

- **Episodic** — What happened (events, conversations, outcomes)
- **Semantic** — What things mean (domain knowledge, definitions)
- **Vector** — Finding similar past situations by meaning, not keywords

**What this means for you:** Agents get smarter about your accounts over time. They don't start from scratch each time.

### Circuit Breakers

If an AI model is slow or failing, the system automatically stops sending it requests and falls back to alternatives. This prevents one broken component from taking down the whole platform.

**What this means for you:** The platform stays responsive even when external AI providers have issues.

### MCP (Model Context Protocol)

A standard way for AI agents to use tools — like looking up CRM data, validating claims against ground truth, or querying databases. Think of it as a universal adapter that lets agents plug into different data sources.

**What this means for you:** Agents can pull data from your existing tools (HubSpot, Salesforce, etc.) without custom integration work.

## How Components Connect

```
                        ┌──────────────┐
                        │  Your Browser│
                        └──────┬───────┘
                               │
                    ┌──────────▼──────────┐
                    │     ValyntApp       │
                    │  (React frontend)   │
                    └──────────┬──────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │   Backend API       │
                    │   (Express)         │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ Agent         │  │
                    │  │ Orchestrator  │──┼──► LLM Providers
                    │  └───────┬───────┘  │    (OpenAI, Anthropic, etc.)
                    │          │          │
                    │  ┌───────▼───────┐  │
                    │  │ Message Bus   │  │
                    │  │ (agent comms) │  │
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
     │   Supabase    │ │    Redis    │ │  BullMQ      │
     │  (Database +  │ │  (Cache +   │ │  (Background │
     │   Auth + RLS) │ │   Pub/Sub)  │ │   Jobs)      │
     └───────────────┘ └─────────────┘ └──────────────┘
```

## Integrations

ValueOS connects to external platforms your team already uses:

| Integration | Purpose |
|---|---|
| **HubSpot** | Sync CRM data for value case context |
| **Salesforce** | Pull opportunity and account data |
| **ServiceNow** | Connect IT service management data |
| **SharePoint** | Access shared documents and reports |
| **Slack** | Notifications and agent interaction |

## Security at a Glance

| Concern | How it's handled |
|---|---|
| **Data isolation** | Row-Level Security (RLS) in Postgres — enforced at the database, not just the app |
| **Authentication** | Supabase Auth with JWT tokens, optional WebAuthn/FIDO2 and MFA |
| **AI safety** | All AI calls validated with schemas; hallucination detection built in |
| **Secrets** | Managed via Vault / AWS Secrets Manager — never stored in code |
| **Audit trail** | Every significant action is logged with who, what, when |

## Next Steps

- **Developers:** Continue to [Quickstart](./02-quickstart.md) for setup instructions
- **New team members:** Check out [VOSAcademy](../../apps/VOSAcademy/) for training materials
- **Architecture deep-dive:** See [Architecture Overview](../architecture/architecture-overview.md)
