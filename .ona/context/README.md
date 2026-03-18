# Context Engineering — ValueOS

This directory provides structured context for AI agents working in this codebase.
It is IDE-agnostic: Ona, Cursor, Windsurf, Copilot, and any other agent can read these files.

## What this is

Context engineering treats the information an AI agent receives as infrastructure, not an afterthought.
Good context has seven layers (from Zilliz / Philschmid):

| Layer | What it is | Where it lives here |
|---|---|---|
| Instructions | Standing rules and constraints | `AGENTS.md`, `.windsurf/rules/` |
| State / history | What has been built and decided | `decisions.md` (this dir) |
| Long-term memory | Lessons learned, recurring patterns | `memory.md` (this dir) |
| Retrieved information | Domain knowledge, architecture | `traceability.md`, `debt.md` (this dir) |
| Available tools | What the agent can call | `tools.md` (this dir) |
| Structured output | Expected formats and schemas | `AGENTS.md` + Zod schemas in source |
| User prompt | The immediate task | Provided per-session |

## Files in this directory

| File | Purpose |
|---|---|
| `decisions.md` | Architectural decisions and their rationale (ADR digest) |
| `debt.md` | Known technical debt, stubs, and gaps — prioritised |
| `traceability.md` | Agent lifecycle → DB table → API endpoint → UI component map |
| `user-stories.md` | Core user stories with acceptance criteria and implementation status |
| `memory.md` | Persistent lessons: patterns that worked, anti-patterns to avoid |
| `tools.md` | Available tools, their interfaces, and registration requirements |

## How to use these files

- **Before starting a task**: read `traceability.md` to understand the full stack slice you are touching.
- **Before adding a new agent**: read `traceability.md` + `decisions.md` ADR-0006.
- **Before writing a service**: read `debt.md` to avoid re-introducing known patterns.
- **After solving a non-obvious problem**: add a note to `memory.md`.
- **After making an architectural decision**: add an ADR to `docs/engineering/adr/` and update `decisions.md`.

## When to update each file

- **`decisions.md`** — after a new ADR is accepted, or when an undocumented decision is made that future agents need to know about.
- **`debt.md`** — when debt is resolved (mark it in the Resolved section) or newly discovered. Link GitHub issues. Re-measure `any` counts with grep before writing targets — do not trust table values as current.
- **`user-stories.md`** — when a story's implementation status changes (a stage moves from ❌ to ✅).
- **`traceability.md`** — when a new DB table, repository, endpoint, hook, or UI component is added for a lifecycle stage.
- **`memory.md`** — after solving a non-obvious problem, removing a recurring anti-pattern, or completing a significant migration.
- **`tools.md`** — when a new tool is registered or an existing tool's interface changes.

## Relationship to other context sources

These files complement, not replace, existing sources:

- `AGENTS.md` — non-negotiable rules and coding conventions (single source of truth for agents)
- `.windsurf/rules/` — glob-triggered rules for Windsurf/Cascade
- `.windsurf/workflows/` — step-by-step task workflows
- `docs/engineering/adr/` — full ADR records
- `docs/architecture/` — detailed architecture documents
