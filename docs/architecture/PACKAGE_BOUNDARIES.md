# ValueOS Package Boundaries

## Dependency Graph (INVARIANT)

```
apps (ValyntApp)
     ↓
packages/backend
     ↓
packages/agents → packages/memory → packages/infra
     ↓
packages/integrations
     ↓
packages/shared / packages/mcp / packages/sdui-types
```

**NEVER invert. NEVER shortcut.**

---

## End-to-End Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (ValyntApp)                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   React UI   │───▶│  API Client  │───▶│   HTTP/WS    │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└─────────────────────────────────────────────────│───────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (API Boundary)                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Express    │───▶│  Middleware  │───▶│   Routes     │                  │
│  │   Server     │    │  (auth/rbac) │    │              │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└─────────────────────────────────────────────────│───────────────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│         AGENTS            │  │         MEMORY            │  │      INTEGRATIONS         │
│  ┌─────────────────────┐  │  │  ┌─────────────────────┐  │  │  ┌─────────────────────┐  │
│  │  Agent Orchestrator │  │  │  │  Semantic Memory    │  │  │  │  HubSpot Adapter    │  │
│  │  (planning/reason)  │  │  │  │  Episodic Memory    │  │  │  │  Salesforce Adapter │  │
│  │  Tool Invocation    │  │  │  │  Vector Store       │  │  │  │  ServiceNow Adapter │  │
│  └──────────┬──────────┘  │  │  │  Provenance         │  │  │  │  SharePoint Adapter │  │
│             │             │  │  └──────────┬──────────┘  │  │  │  Slack Adapter      │  │
└─────────────│─────────────┘  └─────────────│─────────────┘  │  └─────────────────────┘  │
              │                              │                 └───────────────────────────┘
              │                              │
              │                              ▼
              │               ┌───────────────────────────┐
              │               │          INFRA            │
              │               │  ┌─────────────────────┐  │
              └──────────────▶│  │  Supabase (auth/db) │  │
                              │  │  Redis (queues)     │  │
                              │  │  Storage (blobs)    │  │
                              │  │  Observability      │  │
                              │  └─────────────────────┘  │
                              └───────────────────────────┘
```

---

## Package Responsibilities

### `packages/agents`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Agent definitions | ✅ | |
| Planning & reasoning | ✅ | |
| Tool invocation | ✅ | |
| Evaluation & replay | ✅ | |
| HTTP servers | | ❌ |
| DB connections | | ❌ |
| Supabase imports | | ❌ |

**Can call:** `memory`, `integrations`, `shared`, `mcp`

### `packages/backend`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| API boundary | ✅ | |
| Auth & tenancy | ✅ | |
| Request orchestration | ✅ | |
| Billing/metering flows | ✅ | |
| Vendor SDKs directly | | ❌ |
| Agent logic | | ❌ |
| Memory internals | | ❌ |

**Can call:** `agents`, `memory`, `integrations`, `infra`, `shared`

### `packages/memory`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Semantic memory | ✅ | |
| Episodic memory | ✅ | |
| Vector embeddings | ✅ | |
| Provenance tracking | ✅ | |
| HTTP routing | | ❌ |
| Agent logic | | ❌ |

**Can call:** `infra`, `shared`

### `packages/infra`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Supabase client | ✅ | |
| Database adapters | ✅ | |
| Queue adapters | ✅ | |
| Storage adapters | ✅ | |
| Observability | ✅ | |
| Domain logic | | ❌ |
| Agents | | ❌ |

**Can call:** `shared`

### `packages/integrations`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Enterprise adapters | ✅ | |
| Rate limiting | ✅ | |
| Data normalization | ✅ | |
| Auth refresh | ✅ | |
| UI | | ❌ |
| Express | | ❌ |
| DB writes | | ❌ |

**Can call:** `shared`

### `packages/components`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| UI primitives | ✅ | |
| Design system | ✅ | |
| Business logic | | ❌ |
| API calls | | ❌ |
| Routing | | ❌ |

**Can call:** `shared`, `sdui-types`

### `packages/shared`
| Responsibility | ✅ Yes | ❌ No |
|----------------|--------|-------|
| Types/schemas | ✅ | |
| Pure utilities | ✅ | |
| Constants | ✅ | |
| Any package imports | | ❌ |

**Can call:** Nothing (leaf package)

---

## Import Rules Enforcement

ESLint boundary rules are configured in `.config/configs/eslint.boundaries.js`.

Run `npm run lint` to check for violations.

---

## Adding a New Package

1. Create `packages/<name>/package.json`:
```json
{
  "name": "@valueos/<name>",
  "version": "1.0.0",
  "type": "module",
  "private": true
}
```

2. Create `packages/<name>/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

3. Add path alias to root `tsconfig.json`
4. Add boundary rules to `eslint.boundaries.js`
5. Document allowed consumers in `index.ts`
