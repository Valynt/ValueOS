# Glossary

Technical terms used across ValueOS, explained in plain language.

---

## A

### Agent
An AI-powered module that performs a specific task automatically — like analyzing data, finding opportunities, or validating claims. ValueOS has 5 lifecycle agents that work together in a pipeline.

### Agent Fabric
The framework that manages how agents are created, configured, and run. Handles dependency injection, memory access, and LLM communication for all agents.

### Agent Orchestrator
The coordinator that decides which agents to run, in what order, and how to combine their results. Think of it as a project manager for AI agents.

### API (Application Programming Interface)
The set of endpoints that the frontend uses to communicate with the backend. When you click a button in ValyntApp, it sends a request to an API endpoint.

## B

### BaseAgent
The template that all AI agents extend. Provides shared functionality like `secureInvoke` (safe LLM calls), memory access, and output formatting.

### BullMQ
A job queue system built on Redis. Used for background tasks that don't need to happen immediately — like processing large datasets or sending batch notifications.

## C

### Circuit Breaker
A safety mechanism that detects when an external service (like an AI provider) is failing and temporarily stops sending it requests. Prevents cascading failures. Named after electrical circuit breakers that trip to prevent fires.

### CloudEvents
A standard format for describing events (things that happened). Used for inter-agent messaging so all agents speak the same "language" when communicating.

## D

### DAG (Directed Acyclic Graph)
A workflow structure where tasks flow in one direction without loops. Used to define the order agents execute in — Agent A must finish before Agent B starts, but Agent B never loops back to Agent A.

## E

### Express
The Node.js web framework used for the backend API server. Handles HTTP requests, routing, and middleware.

## G

### Ground Truth
Verified, factual data used to validate AI-generated claims. If an agent says "Customer X saved $100K," ground truth is the actual data proving (or disproving) that claim.

## H

### Hallucination Detection
A check that identifies when an AI model generates information that isn't supported by the input data. Built into `secureInvoke` to catch fabricated claims before they reach users.

## I

### Integration
A connection between ValueOS and an external platform (HubSpot, Salesforce, Slack, etc.) that allows data to flow between systems.

## J

### JWT (JSON Web Token)
A compact, signed token used for authentication. When you log in, you receive a JWT that proves your identity on subsequent requests.

## L

### LLM (Large Language Model)
The AI models (like GPT, Claude, Gemini) that agents use to analyze data and generate insights. ValueOS supports multiple providers.

### LLMGateway
The single point through which all LLM calls are routed. Handles provider selection, cost tracking, rate limiting, and resilience.

## M

### MCP (Model Context Protocol)
A standard interface that lets AI agents use tools — query databases, call APIs, look up CRM records. Think of it as a universal plug that connects agents to data sources.

### Memory System
How agents store and retrieve knowledge across interactions. Includes episodic memory (what happened), semantic memory (what things mean), and vector memory (finding similar past situations).

### MessageBus
The internal communication system that lets agents send messages to each other. Built on Redis pub/sub with support for message compression and delivery guarantees.

### Monorepo
A single repository containing multiple projects (apps and packages). ValueOS uses pnpm workspaces to manage all code in one place.

### Multi-Tenancy
The ability to serve multiple organizations from a single deployment while keeping their data completely separate. Each organization is a "tenant."

## P

### pnpm
The package manager used by ValueOS. Similar to npm but faster and more disk-efficient, with strict dependency isolation.

## R

### RBAC (Role-Based Access Control)
A permission system where users are assigned roles (admin, member, viewer) that determine what they can do. Different roles see different features and data.

### Redis
An in-memory data store used for caching, real-time messaging (pub/sub), rate limiting, and session management. Fast because it keeps data in RAM.

### RLS (Row-Level Security)
A Postgres feature that restricts which rows a user can see based on policies. In ValueOS, RLS ensures that Organization A can never see Organization B's data — enforced at the database level, not just in application code.

## S

### Saga Pattern
A way to handle multi-step operations where each step can be undone if a later step fails. If step 3 of 5 fails, steps 1 and 2 are automatically reversed (compensated).

### SDUI (Server-Driven UI)
An approach where the backend defines what the frontend should display. Instead of hardcoding screens, the server sends a schema describing the layout, and the frontend renders it. Enables dynamic, personalized interfaces.

### secureInvoke
The method all agents use to call LLM models. Wraps each call with circuit breaker protection, hallucination detection, and response validation (via Zod schemas). Prevents unsafe or malformed AI responses from reaching users.

### Supabase
The backend-as-a-service platform providing the database (Postgres), authentication, real-time subscriptions, and row-level security. The primary data store for ValueOS.

## T

### Tenant
An organization using ValueOS. Each tenant's data is isolated from all others. See Multi-Tenancy.

### Turborepo
A build system that runs tasks (build, test, lint) across the monorepo efficiently by caching results and parallelizing work.

## V

### Value Case
A structured argument showing the business value a product delivers to a customer. The core artifact that users create and manage in ValyntApp.

### Vite
The frontend build tool and dev server. Provides fast hot-module replacement during development and optimized production builds.

## W

### WebAuthn / FIDO2
A passwordless authentication standard. Lets users log in with biometrics (fingerprint, face) or hardware security keys instead of passwords.

### Workflow
A defined sequence of agent executions structured as a DAG. Workflows move through lifecycle stages (opportunity → target → expansion → integrity → realization).

## Z

### Zod
A TypeScript schema validation library. Used to define and enforce the shape of data at runtime — especially for validating AI model responses before they're used.
