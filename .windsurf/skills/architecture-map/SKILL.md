---
name: architecture-map
description: >
  Orient to the ValueOS monorepo structure before making broad changes.
  Use when asked "where does X live?", "what packages exist?", "how is the
  repo structured?", or before touching cross-package concerns.
  Triggers on: "repo structure", "monorepo layout", "where is", "architecture map",
  "package overview", "codebase structure".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Architecture Map

The authoritative architecture reference is `docs/AGENTS.md` (Architecture section). This skill provides a quick orientation map — read `docs/AGENTS.md` for full detail.

## Monorepo layout

```
ValueOS/
├── apps/
│   ├── ValyntApp/          # React + Vite frontend (package: valynt-app), port 5173
│   └── mcp-dashboard/      # MCP dashboard app (package: mcp-dashboard)
├── packages/
│   ├── backend/            # @valueos/backend — Express API, agent fabric, runtime services
│   ├── components/         # @valueos/components — shared React components
│   ├── config-v2/          # @vos/config-v2 — shared configuration
│   ├── infra/              # @valueos/infra — infrastructure utilities
│   ├── integrations/       # @valueos/integrations — external service connectors
│   ├── mcp/                # @valueos/mcp — MCP protocol implementation
│   ├── memory/             # @valueos/memory — persistent memory subsystem
│   ├── sdui/               # @valueos/sdui — server-driven UI components
│   ├── services/           # @valueos/services — shared service layer
│   ├── shared/             # @valueos/shared — domain types (Zod schemas)
│   └── test-utils/         # shared test utilities
├── docs/                   # Architecture docs, ADRs, context layer
│   └── skills/             # Canonical tool-agnostic skills
├── infra/                  # Terraform, Supabase migrations
│   └── supabase/supabase/migrations/
├── .devcontainer/          # Devcontainer config, Dockerfile, bootstrap.sh
├── .ona/                   # Ona automations (automations.yaml)
├── .windsurf/              # Windsurf adapter: rules, skills (thin adapters), workflows, context
└── supabase/               # Local Supabase config
```

## Key backend paths

| Concern | Path |
|---|---|
| Agent fabric (8 agents) | `packages/backend/src/lib/agent-fabric/agents/` |
| BaseAgent | `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` |
| Runtime services (6) | `packages/backend/src/runtime/` |
| Workflow DAG definitions | `packages/backend/src/services/workflows/WorkflowDAGDefinitions.ts` |
| Tool registry | `packages/backend/src/services/ToolRegistry.ts` |
| MessageBus (CloudEvents) | `packages/backend/src/services/MessageBus.ts` |
| Express request types | `packages/backend/src/types/express.d.ts` |
| Tenant limits / feature flags | `packages/backend/src/services/tenant/TenantLimits.ts` |
| Domain Zod schemas (9) | `packages/shared/src/domain/` |

## Key frontend paths

| Concern | Path |
|---|---|
| App entry | `apps/ValyntApp/src/` |
| SDUI components | `packages/sdui/src/components/SDUI/` |
| SDUI registry | `packages/sdui/src/registry.tsx` |
| UI intent registry | `scripts/config/ui-registry.json` |

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (Postgres + RLS + Auth + Realtime)
- **Cache/Queues**: Redis + BullMQ
- **Messaging**: CloudEvents via MessageBus
- **Memory**: Vector memory with tenant-scoped queries (`packages/memory`)
- **Build**: pnpm workspaces + Turbo

## Critical constraints

- Every DB query must include `organization_id` or `tenant_id` — no exceptions
- All LLM calls go through `BaseAgent.secureInvoke()` — never `llmGateway.complete()` directly
- `service_role` client only for: AuthService, tenant provisioning, cron jobs
- No default exports — named exports only
- TypeScript strict mode — no `any`

## Before making broad changes

Read `.windsurf/context/traceability.md` for the full agent lifecycle → DB → API → UI map.
Read `.windsurf/context/decisions.md` for accepted ADRs.
Read `docs/AGENTS.md` for the complete policy.
