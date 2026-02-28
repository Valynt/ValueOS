---
name: service-integration-architecture
description: |
  Enforce and scaffold service integrations in the ValueOS monorepo using the
  4-layer architecture standard. Covers scaffolding new integrations, reviewing
  existing ones for compliance, adding CI enforcement rules, wiring health
  registries, and hardening webhook/queue patterns.
  Use when asked to: add a new third-party integration, create a service client,
  scaffold an integration, review integration architecture, set up webhooks,
  add a provider adapter, enforce integration standards, add health checks for
  integrations, or harden an integration for production.
  Triggers: "new integration", "service client", "integration architecture",
  "scaffold integration", "webhook handler", "add provider", "external API",
  "integration compliance", "integration health", "enforce integration standard".
---

# Service Integration Architecture

Binding standard for all third-party integrations in the ValueOS monorepo. Every integration must conform to the 4-layer model and pass CI enforcement checks.

## Layer Model

```
API Layer          → Routes, webhook endpoints, rate limit keys
Service Layer      → Business logic, orchestration, tenant scoping
Client Layer       → EnterpriseAdapter subclass, circuit breaker, typed DTOs
Infrastructure     → Cache (Redis), queue (BullMQ), health registry
```

Each layer only calls the layer directly below it. Client layer internals are never exported.

## Existing Codebase

Integrations live in `packages/integrations/`. The base layer provides:

- `EnterpriseAdapter` — abstract base class with connect/disconnect lifecycle
- `IEnterpriseAdapter` — interface contract
- `RateLimiter` — per-provider rate limiting
- `errors.ts` — base error types
- `types.ts` — `NormalizedEntity`, `IntegrationConfig`, `FetchOptions`

Existing adapters: `hubspot/`, `salesforce/`, `servicenow/`, `sharepoint/`, `slack/`.

## Required Structure

Every integration under `packages/integrations/<provider>/` must contain:

```
<provider>/
├── <Provider>Adapter.ts   # Extends EnterpriseAdapter (client layer)
├── config.ts              # Zod-validated env config
├── errors.ts              # Provider-specific error boundary
├── health.ts              # Exports checkHealth(): Promise<HealthStatus>
├── types.ts               # Provider-specific typed DTOs
├── index.ts               # Public API (named exports only)
├── handlers/              # (if accepting inbound)
│   └── webhooks.ts        #   Zod payload validation + HMAC signature check
├── services/              # (if business logic beyond adapter)
│   └── sync.ts            #   Tenant-scoped sync logic
├── jobs/                  # (if background work needed)
│   └── sync.ts            #   BullMQ worker
└── __tests__/
    ├── adapter.test.ts
    └── errors.test.ts
```

## Workflow

### Step 1: Scaffold

Create the directory tree. Extend `EnterpriseAdapter` from `../base/index.js`. See [references/patterns.md](references/patterns.md) § Client Wrapper.

### Step 2: Config + error boundary

Zod-validate env vars. Create `<Provider>ServiceError` with retryable flag. See [references/patterns.md](references/patterns.md) § Config and § Error Boundary.

### Step 3: Health check

Export `checkHealth()`. See [references/patterns.md](references/patterns.md) § Health Check. Register it in the health registry per [references/enforcement.md](references/enforcement.md) § Integration Health Registry.

### Step 4: Service layer (if needed)

Every DB/memory query must include `organization_id`. No exceptions.

### Step 5: Webhook handler (if accepting inbound)

HMAC signature verification, Zod payload validation, replay protection, per-tenant rate limit keys. See [references/patterns.md](references/patterns.md) § Webhook Handler.

### Step 6: Background jobs (if needed)

BullMQ workers only. No fire-and-forget in the request path. See [references/patterns.md](references/patterns.md) § Background Job.

### Step 7: Tests

Mock the provider SDK. Verify tenant isolation in service tests. Integration tests in `*.integration.test.ts`.

## Enforcement

This standard is enforced in three places. See [references/enforcement.md](references/enforcement.md) for implementation details.

### CI lint rules

A CI check fails PRs when a new or modified integration folder:

- Is missing required files (`config.ts`, `errors.ts`, `health.ts`, `index.ts`)
- Has config not validated by Zod
- Makes external SDK calls not wrapped with `ExternalCircuitBreaker` or `EnterpriseAdapter`
- Has service-layer DB queries missing `organization_id` / `tenant_id`

### Runtime safety rails

- Health checks wired per integration via the health registry
- No raw SDK errors escape the client layer — error boundary required
- No network calls on module import — lazy initialization behind circuit breaker
- Nontrivial async work goes through BullMQ, not fire-and-forget

### Repo structure

- Public surface is `index.ts` only — adapter internals stay unexported
- `packages/integrations/README.md` documents the 4-layer rule and import restrictions

## Constraints

- TypeScript strict mode, no `any`. Integration layers are the model for replacing `any` elsewhere.
- Named exports only.
- Zod for all runtime validation (config, webhook payloads, API responses).
- Tenant isolation: every DB/memory query filters on `organization_id` or `tenant_id`.
- External calls wrapped with `ExternalCircuitBreaker` or routed through `EnterpriseAdapter`.
- Secrets via environment variables, never committed.

## Production Readiness Mapping

| Production risk | How this standard mitigates it |
|---|---|
| Slow startup / crash loops (P0) | `health.ts` provides startup probes; no network calls on import |
| Type debt / `any` (P0) | Client returns typed DTOs, service maps to domain types, API validates with Zod |
| Webhook DoS vectors (P1) | HMAC verification, Zod validation, per-tenant rate limit keys, replay protection |
| Missing worker HPA (P1) | BullMQ queue depth → HPA metric; job runtime + failures → SLOs |
| Mystery dependencies | Health registry enumerates all integrations at `/health/deps` |

## Troubleshooting

| Issue | Fix |
|---|---|
| Circular dependency between layers | Move shared types to `types.ts`, keep layers unidirectional |
| Config not loading | Verify env var names match Zod schema keys |
| Webhook signature mismatch | Check raw body parsing — Express must pass raw buffer for HMAC |
| Test isolation failures | Use dependency injection for adapter; reset singleton in tests |
| Health check blocking startup | Make health check async with timeout; don't fail readiness on optional deps |
