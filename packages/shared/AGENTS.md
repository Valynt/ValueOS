# packages/shared — Agent Instructions

Extends root `AGENTS.md`. Rules here are specific to the shared domain model package.

## Purpose

This package is the canonical domain model. All agent reasoning and API contracts must operate on these types — never define domain types elsewhere and import them here.

## Domain objects (`src/domain/`)

Nine first-class Zod schemas:
- `Account`, `Opportunity`, `Stakeholder`, `ValueHypothesis`
- `Assumption`, `Evidence`, `BusinessCase`
- `RealizationPlan`, `ExpansionOpportunity`

**Adding a new domain object:** define the Zod schema here, export it, then update `traceability.md`.

## Key conventions

**Zod schemas only** — no plain TypeScript interfaces for domain types. Infer TypeScript types from Zod: `type Opportunity = z.infer<typeof OpportunitySchema>`.

**No `any`.** Current ceiling: 0 usages (enforced by `scripts/check-any-count.sh`).

**No backend or frontend imports.** This package must remain dependency-free of `packages/backend` and `apps/*`. It may import from other `packages/` utilities only.

**Named exports only.**

## Other notable modules

- `src/lib/SemanticMemory.ts` — shared semantic memory types
- `src/lib/health/` — health check types shared across packages
- `src/infra/eso/` — external data source utilities (BLS, Census, SEC)
- `src/config/client-config.ts` — client-safe config schema

## Testing

```bash
pnpm --filter shared test
```
