# ValueOS — High-Level Overview Documents

This document catalogs the files in the ValueOS repository that serve as **high-level overview documents** meant to inform developers (and other stakeholders) about the codebase, its architecture, product purpose, and how to get started.

---

## Tier 1: Primary Entry Points

These are the first documents a new developer or AI agent should read to understand what ValueOS is and how the codebase is organized.

| File | Size | Purpose |
|---|---|---|
| `README.md` | 8 KB | Top-level project README — product summary, repo structure, dev commands, and quick orientation. |
| `AGENTS.md` | 13 KB | **Single source of truth for coding conventions and agent rules.** Non-negotiable constraints (tenant isolation, LLM invocation, dependency directions), dev commands, and architectural patterns. Referenced by every AI-agent config in the repo. |
| `docs/getting-started/00-what-is-valueos.md` | — | Plain-language explanation of what ValueOS is, aimed at all audiences (developers, PMs, sales engineers, new team members). |
| `docs/getting-started/01-introduction.md` | — | Consolidated introduction covering system architecture, data/infrastructure context, frontend/UX context, and security/compliance context (merged from 8 source documents). |
| `docs/getting-started/README.md` | — | Index of the Getting Started section with links to all onboarding docs. |
| `docs/README.md` | 4.4 KB | Master index for the entire `docs/` directory, linking to all documentation categories. |

---

## Tier 2: Architecture and Codebase Maps

These documents explain the system's structure, module boundaries, and how components interact.

| File | Size | Purpose |
|---|---|---|
| `docs/architecture/architecture-overview.md` | — | Consolidated architecture overview (from 8 source documents): active ADRs, DX architecture, billing blueprint, package boundaries, agent containerization, system architecture, module boundary map, and system invariants. |
| `docs/architecture/README.md` | — | Index of all architecture documents (10 docs covering agents, API, data, frontend, infra, memory, module ownership, security, and component interaction diagrams). |
| `docs/codebase-map.md` | 16.5 KB | A navigational map of the entire codebase — directory-by-directory explanation of what lives where and why. |
| `docs/architecture/module-ownership-boundaries.md` | — | Domain ownership map defining which teams/modules own which paths, and the allowed dependency directions between them. |
| `docs/architecture/agent-architecture.md` | — | Consolidated agent architecture (from 13 source documents) covering all agent types and their roles. |
| `docs/architecture/frontend-architecture.md` | — | Frontend application architecture — React, Tailwind, component structure. |
| `docs/architecture/data-architecture.md` | — | Data architecture (from 14 source documents): database audit, encryption, migrations, RLS policies, indexing strategy, schema governance. |
| `docs/architecture/infrastructure-architecture.md` | — | Infrastructure-level architecture. |
| `docs/architecture/security-architecture.md` | — | Security architecture overview. |
| `docs/architecture/memory-first-architecture.md` | — | Memory-first architecture pattern used by the agent system. |
| `docs/architecture/component-interaction-diagram.md` | — | Visual maps of system flows (Mermaid diagrams). |

---

## Tier 3: Product and Domain Context

These documents explain the product domain, the "why" behind the system, and the product vision.

| File | Size | Purpose |
|---|---|---|
| `docs/Architectural Design Brief for ValueOS - Agentic Workflow Platform for Value Engineering.md` | 7.9 KB | The foundational design brief describing the hypothesis-first agentic workflow, the 7-step core loop, integrity engine, saga-driven orchestration, and SDUI. |
| `conductor/product.md` | — | Product definition — what ValueOS does, the hypothesis-first approach, key components (Hypothesis Loop, Integrity Engine, Saga Orchestration, SDUI), and the success metric. |
| `conductor/index.md` | — | Index for the Conductor extension linking to product, tech stack, workflow, guidelines, and tracks. |
| `conductor/tech-stack.md` | — | Complete tech stack reference: frontend (React, Tailwind, Zustand, TanStack Query), backend (Node.js, Express, BullMQ, Kafka), persistence (Supabase/Postgres, Redis), and AI/orchestration. |
| `conductor/product-guidelines.md` | — | Product guidelines and design principles. |
| `conductor/workflow.md` | — | Workflow definitions for the product. |
| `conductor/tracks.md` | — | Tracks registry listing all active development tracks and their status. |
| `spec.md` | 20.5 KB | Full product/technical specification — detailed requirements and design. |
| `docs/getting-started/glossary.md` | — | Glossary of technical terms (Agent, Agent Fabric, Orchestrator, API, etc.) explained in plain language. |

---

## Tier 4: Developer Onboarding and Setup

These documents help developers get the environment running and understand workflows.

| File | Size | Purpose |
|---|---|---|
| `CONTRIBUTING.md` | 8 KB | Contribution guidelines — how to submit PRs, coding standards, and review process. |
| `docs/getting-started/02-quickstart.md` | — | Quick start guide: prerequisites, one-command boot, and first steps. |
| `docs/getting-started/QUICKSTART.md` | — | Step-by-step development environment setup (5-minute guide). |
| `docs/getting-started/SCAFFOLD_README.md` | — | Complete scaffold description — 138 files across 39 directories, covering scripts, configs, Dockerfiles, docs, migrations, and packages. |
| `DEPLOY.md` | 4.8 KB | Deployment guide. |
| `docs/engineering/development-setup.md` | — | Engineering-focused development setup instructions. |
| `docs/developer-experience/README.md` | — | Index of developer experience docs (dev environment, DX performance, tools, troubleshooting, workflows). |
| `docs/engineering/README.md` | — | Index of engineering docs (ADRs, agent dev, API dev, code standards, database, frontend, messaging, migration, platform, SDUI, testing). |

---

## Tier 5: AI Agent Context Files

These files are specifically designed to give AI coding agents structured context about the codebase.

| File | Size | Purpose |
|---|---|---|
| `.windsurf/context/README.md` | 2.5 KB | Explains the 7-layer context engineering approach and how AI agents should use the context files. |
| `.windsurf/context/decisions.md` | 10.8 KB | Architectural Decision Record (ADR) digest — all key decisions and their rationale. |
| `.windsurf/context/traceability.md` | 11.1 KB | Full-stack traceability map: agent lifecycle stage → DB table → API endpoint → UI component. |
| `.windsurf/context/memory.md` | 8.5 KB | Persistent lessons learned — patterns that worked and anti-patterns to avoid. |
| `.windsurf/context/tools.md` | 6 KB | Tool inventory — MCP Tools vs. BFA Semantic Tools, their interfaces, registries, and how to add new ones. |
| `.windsurf/context/debt.md` | 9.5 KB | Prioritized technical debt inventory with linked GitHub issues. |
| `.windsurf/context/user-stories.md` | 8.3 KB | Core user stories with acceptance criteria and implementation status. |
| `.github/copilot-instructions.md` | — | GitHub Copilot-specific instructions referencing AGENTS.md, with quick context, non-negotiables, and dev commands. |
| `GEMINI.md` | 4.3 KB | Gemini AI agent-specific instructions. |
| `.windsurf/rules/global.md` | — | Global rules for Windsurf/Cascade AI agents. |

---

## Tier 6: Feature and Domain Overviews

These documents provide overviews of specific feature areas.

| File | Size | Purpose |
|---|---|---|
| `docs/features/README.md` | — | Index of all feature documentation (agents, billing, design system, portal, roadmap, individual agents). |
| `docs/features/agents-overview.md` | — | Overview of all agent types and their roles in the system. |
| `docs/features/design-system.md` | — | Design system documentation. |
| `docs/features/roadmap.md` | — | Product/feature roadmap. |

---

## Recommended Reading Order for New Developers

1. **`docs/getting-started/00-what-is-valueos.md`** — Understand the product in plain language.
2. **`README.md`** — Repo orientation and dev commands.
3. **`AGENTS.md`** — Non-negotiable rules and conventions.
4. **`docs/codebase-map.md`** — Navigate the directory structure.
5. **`docs/architecture/architecture-overview.md`** — Understand the system design.
6. **`conductor/product.md`** + **`conductor/tech-stack.md`** — Product vision and tech stack.
7. **`docs/getting-started/glossary.md`** — Learn the domain vocabulary.
8. **`docs/getting-started/02-quickstart.md`** — Get the environment running.
9. **`.windsurf/context/traceability.md`** — Understand full-stack slices before touching code.
10. **`CONTRIBUTING.md`** — Know the contribution process.
