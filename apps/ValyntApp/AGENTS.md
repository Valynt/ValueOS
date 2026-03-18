# apps/ValyntApp — Agent Instructions

Extends root `AGENTS.md`. Rules here are specific to the ValyntApp React frontend.

## Stack

React 18 + Vite + Tailwind. TypeScript strict mode. State via Zustand stores. Data fetching via custom hooks in `src/hooks/`.

## Entry points

- `src/main.tsx` → `src/App.tsx`
- Routes: `src/App.tsx` (React Router)
- Dev server: port 5173 (`pnpm run dev:frontend`)

## Key conventions

**No default exports.** All components and hooks use named exports.

**Functional components only.** No class components.

**SDUI components** must be registered in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`. See `.windsurf/skills/sdui-component/SKILL.md`.

**Path aliases** (from `tsconfig.app.json`):
- `@/*` → `src/*`
- `@shared/*` → `../../packages/shared/src/*`

**No `any`.** Current ceiling: 6 usages (enforced by `scripts/check-any-count.sh`). Use `unknown` + type guards.

## Directory structure

```
src/
  api/           # API client functions
  components/    # Shared UI components
  features/      # Feature-scoped code (canvas, templates, …)
  hooks/         # Data-fetching and state hooks
  stores/        # Zustand stores
  views/         # Page-level components (Auth, Settings, …)
  config/        # Client-side config and env validation
  security/      # Client-side security utilities
  types/         # Shared TypeScript types
```

## Testing

```bash
pnpm --filter ValyntApp test
```

Tests use Vitest + jsdom. Co-locate test files as `*.test.tsx` next to source.

## Linting

```bash
pnpm --filter ValyntApp lint
```
