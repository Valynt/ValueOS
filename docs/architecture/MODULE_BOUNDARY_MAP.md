# Module Boundary Map

## Intended Layering (authoritative)

```text
apps/*
  -> @valueos/backend (API boundary)
  -> @valueos/sdui (rendering + registry)
  -> @valueos/components (design system)

@valueos/backend
  -> @valueos/agents (agent framework)
  -> @valueos/memory
  -> @valueos/infra
  -> @valueos/integrations
  -> @valueos/shared | @valueos/mcp | @valueos/sdui-types

@valueos/agents
  -> @valueos/memory
  -> @valueos/infra
```

## SDUI Registry Boundary

- Registry definition and component-tool contracts live in `packages/sdui/src/registry.tsx` and `packages/sdui/src/ComponentToolRegistry.ts`.
- Consumers should import SDUI via `@valueos/sdui` (or documented subpaths), not `packages/sdui/src/*` internals.

## Agent Framework Boundary

- Agent public entrypoints are `@valueos/agents`, `@valueos/agents/core`, `@valueos/agents/orchestration`, `@valueos/agents/tools`, and `@valueos/agents/evaluation`.
- Frontends should never deep-import per-agent internals.

## Enforcement in this change

- ESLint blocks:
  - cross-package relative imports (`../packages/*`)
  - deep imports into package internals (`@valueos/*/src/*`)
- TS path aliases now prefer package-level public APIs (`@valueos/<package>`).

## Incremental Migration Plan

1. **Freeze new debt**: keep boundary lint rules at `error` in CI.
2. **Fix highest-risk imports first**:
   - imports into `@valueos/*/src/*`
   - relative hops into `packages/*`
3. **Replace each violation with a public API import** (`@valueos/<pkg>` or approved subpath export).
4. **If a needed symbol is internal**, add it to that package `index.ts` (small, explicit export).
5. **Track progress** with `eslint` output trend; fail PRs that increase violations.

## Local validation commands

- `pnpm eslint apps packages --max-warnings=0`
- `pnpm tsc --noEmit -p tsconfig.app.json`
- `pnpm --filter @valueos/sdui typecheck`
- `pnpm --filter @valueos/agents typecheck`
