# @valueos/integrations

Enterprise integration adapters for ValueOS.

## Structure

```
integrations/
├── base/           # Interface, abstract class, shared utilities
├── hubspot/        # HubSpot CRM adapter
├── salesforce/     # Salesforce adapter
├── servicenow/     # ServiceNow adapter
├── sharepoint/     # SharePoint adapter
└── slack/          # Slack adapter
```

## 4-Layer Architecture (Binding Standard)

Every integration must follow the 4-layer model. CI enforces this via `scripts/lint-integrations.sh`.

```
API Layer          → Routes, webhook endpoints, rate limit keys
Service Layer      → Business logic, orchestration, tenant scoping
Client Layer       → EnterpriseAdapter subclass, circuit breaker, typed DTOs
Infrastructure     → Cache (Redis), queue (BullMQ), health registry
```

### Required files per integration

| File | Purpose |
|---|---|
| `<Provider>Adapter.ts` | Extends `EnterpriseAdapter` — client layer |
| `config.ts` | Zod-validated environment config |
| `errors.ts` | Provider-specific error boundary with retryable flag |
| `health.ts` | Exports `check<Provider>Health()` for health registry |
| `types.ts` | Typed DTOs — no raw vendor payloads cross the boundary |
| `index.ts` | Public API (named exports only) |

Optional: `handlers/` (webhooks), `services/` (business logic), `jobs/` (BullMQ workers), `__tests__/`.

### Scaffold a new integration

```bash
pnpm scaffold:integration <provider-name>
```

Full architecture spec: `.ona/skills/service-integration-architecture/SKILL.md`

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | ✅ Yes |
| `packages/agents` | ✅ Yes |
| `packages/memory` | ✅ Yes (for ingestion) |
| `apps/ValyntApp` | ❌ No |

**Frontend never talks to external systems directly.**

## Design Principles

1. **Adapters return normalized domain objects** — not raw vendor payloads
2. **No UI, no Express, no database writes** — pure integration logic
3. **Rate limiting is per-provider** — each adapter respects vendor limits
4. **Auth refresh is handled internally** — consumers don't manage tokens
5. **No network calls on module import** — lazy initialization behind `connect()`
6. **External SDK calls wrapped with circuit breaker** — use `ExternalCircuitBreaker`
7. **Tenant isolation** — service-layer DB queries must include `organization_id`
8. **Health checks registered** — each integration exports a health check for `/health/deps`
