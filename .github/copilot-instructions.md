# GitHub Copilot Instructions for ValueOS

Canonical project rules live in `AGENTS.md` at the repository root. Read it first. This file adds Copilot-specific guidance only.

## Quick Context

Multi-tenant AI orchestration platform. pnpm monorepo: `apps/` (ValyntApp, VOSAcademy, mcp-dashboard) and `packages/` (agents, agent-fabric, backend, components, infra, integrations, mcp, memory, sdui, shared). Supabase (Postgres + RLS), Node.js backend, 7-agent fabric, vector memory, CloudEvents messaging.

## Non-Negotiables (from AGENTS.md)

- **Tenant isolation:** every DB/memory/vector query MUST include `organization_id` or `tenant_id`.
- **LLM calls:** production agents use `secureInvoke()` only (never direct `llmGateway.complete()`).
- **service_role:** bypasses RLS — use only for AuthService, tenant provisioning, cron jobs.

## Dev Commands

```bash
pnpm run dx           # Full stack dev
pnpm test             # Vitest (sequential)
pnpm run test:rls     # RLS validation
pnpm run lint         # ESLint
```

## Agent Patterns

- Location: `packages/backend/src/lib/agent-fabric/agents/` — one class per file (`XAgent.ts`).
- Extend `BaseAgent`, define `lifecycleStage`, `version`, `name`.
- Zod schemas for LLM responses with `hallucination_check: boolean`.
- Handlebars templates for prompts (no string concatenation).
- Memory storage always includes `this.organizationId`.

## Conventions

- TypeScript strict mode. No `any` — use `unknown` + type guards.
- Named exports only.
- Functional React components with hooks.
- Path aliases: `@/*`, `@lib/*`, `@shared/*`, `@backend/*`, `@valueos/<pkg>` (see `tsconfig.app.json`).
- SDUI components: register in `config/ui-registry.json` AND `packages/sdui/src/registry.tsx`.
- Tools: implement `Tool<TInput, TOutput>`, register in `ToolRegistry.ts` (no dynamic creation).

## Copilot-Specific Agents

Persona definitions in `.github/copilot/agents/`: architect, code, devops, docs, monitor, orchestrator, performance, planner, qa, review, security, ux.

## Safety

See `AGENTS.md` § Safety & Compliance and `.windsurf/rules/global.md` for full policy-as-code.
