# Spec: Code Context Alignment — ValueOS Constitution Layer

## Problem Statement

The repository's code context layer (AGENTS.md files, skills, workflows, rules, and context files) is fragmented across four tool namespaces (`.windsurf/`, `.roo/`, `.gitpod/`, `docs/`) with no enforced single source of truth. This produces:

1. **Contradictory instructions**: `init.md` workflow says `pnpm install --no-frozen-lockfile`; `docs/AGENTS.md` mandates `--frozen-lockfile`. Skills reference Node 18.17.0; the devcontainer runs 20.19.5.
2. **Missing system intent**: No file states what ValueOS *is* at the constitutional level. Agents receive architecture facts but no governing philosophy about what quality bar matters or what outputs are acceptable.
3. **Stale/misleading skills**: `setup-dev-environment` references Docker-based local setup, wrong clone URL (`ValueCanvas`), wrong versions, and wrong ports — directly contradicting the devcontainer-first model.
4. **Tool-specific logic in shared skills**: `continuous-improvement` references `~/bin/cascade-cost` and `~/.windsurf/ADVICE.md` — Windsurf-only tooling that doesn't exist in this environment.
5. **Duplicate skills with silent divergence**: Agent scaffold logic exists in `.windsurf/skills/agent-onboarding/`, `.roo/skills/agent-scaffold/`, and partially in `.gitpod/skills/`. They diverge on lifecycle stage names, file structure, and registration steps.
6. **No constitutional header**: Context files (`decisions.md`, `memory.md`, `traceability.md`, etc.) have no shared preamble establishing the system intent that should govern all agent behavior.
7. **Product naming drift**: Some files say "ValueCanvas", some "Valynt", some "ValueOS".

---

## System Intent (Constitutional Layer)

This is the root statement that must flow through all context files, agent prompts, and skill definitions:

> **ValueOS is a system of intelligence that structures, validates, and operationalizes business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.**

### Constitutional Invariants

Every context file, skill, workflow, and agent behavior must preserve these:

1. **Value truth over fluent generation** — The system exists to improve the truth, structure, and usability of business value claims, not merely to generate plausible language.
2. **Economic defensibility** — All meaningful outputs must connect to economic logic: revenue uplift, cost savings, risk reduction, timing, confidence, or realization.
3. **Evidence over assertion** — Claims must be grounded in evidence, benchmarks, user inputs, or clearly labeled assumptions.
4. **Auditability by default** — Outputs must be inspectable. Agents must preserve how they arrived at a recommendation, not only the recommendation itself.
5. **Lifecycle continuity** — The system supports discovery, modeling, approval, realization, and expansion as one continuous value lifecycle — not only pre-sale.
6. **Integrity before convenience** — When confidence is low or evidence is missing, the system must constrain, qualify, or block outputs rather than overstate certainty.
7. **Multi-tenant enterprise discipline** — All design choices must preserve tenant isolation, role-aware access, and organizational trust boundaries.
8. **Agents serve the value model** — Agents are not the product. Agents exist to create, refine, validate, and maintain the value system of record.

### Rejection Criteria

A file, prompt, workflow, or agent behavior is **off-intent** if it:
- Treats ValueOS as just a sales copilot or generic workflow automation
- Generates ROI claims without assumptions or support
- Produces polished narrative without model traceability
- Optimizes for persuasion while weakening defensibility
- Ignores post-sale realization or expansion
- Treats evidence as optional
- Bypasses integrity controls for convenience
- Frames the product mainly as "chat with AI" rather than "system of intelligence for value"

---

## Requirements

### R1 — Canonical source of truth structure

- `docs/AGENTS.md` is the single canonical policy file for all AI agents, regardless of tool.
- All tool-specific files (`.windsurf/rules/`, `.roo/`, `.gitpod/`) are **thin environment adapters** only — they may add tool-specific trigger syntax but must not duplicate or contradict `docs/AGENTS.md`.
- Skills live canonically in `docs/skills/` (new location) as tool-agnostic markdown. Tool namespaces may reference them but must not maintain independent copies with diverging content.
- Every tool-specific file that currently duplicates `docs/AGENTS.md` content must be replaced with a reference header pointing to the canonical source.

### R2 — Constitutional header in all core context files

Every file in `.windsurf/context/`, `docs/AGENTS.md`, and root `AGENTS.md` must open with a compact constitutional header:

```markdown
<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Constitutional rules: value truth · economic defensibility · evidence over assertion ·
auditability · lifecycle continuity · integrity before convenience · tenant discipline ·
agents serve the value model.
Full policy: docs/AGENTS.md -->
```

### R3 — Stale skills: deprecation then rewrite

**Phase 1 (immediate):** Add a deprecation header to each stale skill pointing to the canonical source.

Stale skills requiring Phase 1 + Phase 2 rewrite:

| File | Problem |
|---|---|
| `.windsurf/skills/setup-dev-environment/SKILL.md` | Wrong Node version (18 vs 20), wrong clone URL (`ValueCanvas`), Docker-based setup contradicts devcontainer model |
| `.windsurf/skills/architecture-map/SKILL.md` | Placeholder paths (`src/agents/`, `src/backend/`) don't match actual monorepo |
| `.windsurf/skills/run-tests/SKILL.md` | Coverage thresholds and commands don't match `vitest.config.ts` or `docs/AGENTS.md` |
| `.windsurf/skills/dev-environment-health/SKILL.md` | Stub with no actionable content |
| `.windsurf/skills/continuous-improvement/SKILL.md` | References `cascade-cost`, `~/.windsurf/ADVICE.md` — Windsurf-only tooling |
| `.windsurf/workflows/init.md` | `--no-frozen-lockfile` contradicts `docs/AGENTS.md` mandate |
| `.windsurf/workflows/start-dev.md` | `APP_ENV=cloud-dev` pattern contradicts automations model |
| `.windsurf/workflows/verification-checklist.md` | `APP_ENV=cloud-dev` + `--no-frozen-lockfile` contradictions |

**Phase 2 (rewrite):** Replace each deprecated skill with accurate content aligned to:
- Devcontainer-first setup (`.devcontainer/`, `.ona/automations.yaml`)
- Actual monorepo structure (`apps/ValyntApp`, `apps/mcp-dashboard`, `packages/backend`, etc.)
- Current automation flows (`gitpod automations service start backend/frontend`)
- System intent and lifecycle

**Phase 3 (delete):** Once rewrites are validated, remove the deprecated versions. (Out of scope for this spec — tracked as follow-up.)

### R4 — Tool-agnostic skill rewrites

Skills that contain Windsurf-specific behavior must be rewritten to be tool-agnostic:
- Remove references to `cascade-cost`, `~/.windsurf/ADVICE.md`, Cascade-specific commands
- Remove references to Windsurf "Planning Mode" as a required step
- Skills must work when invoked from Ona, Cursor, Copilot, or any other agent

### R5 — Duplicate skill consolidation

The following skill pairs cover the same capability and must be consolidated. The `.windsurf/` version is canonical; the `.roo/` version is replaced with a redirect stub:

| Capability | Canonical | Redirect |
|---|---|---|
| Agent scaffold | `.windsurf/skills/agent-onboarding/SKILL.md` | `.roo/skills/agent-scaffold/SKILL.md` |
| OpenSpec apply | `.windsurf/skills/openspec-apply-change/SKILL.md` | `.roo/skills/openspec-apply-change/SKILL.md` |
| OpenSpec archive | `.windsurf/skills/openspec-archive-change/SKILL.md` | `.roo/skills/openspec-archive-change/SKILL.md` |
| OpenSpec explore | `.windsurf/skills/openspec-explore/SKILL.md` | `.roo/skills/openspec-explore/SKILL.md` |
| OpenSpec propose | `.windsurf/skills/openspec-propose/SKILL.md` | `.roo/skills/openspec-propose/SKILL.md` |

### R6 — Product naming normalization

All context files must use **ValueOS** as the product name. Occurrences of "ValueCanvas" must be corrected to "ValueOS".

### R7 — New skills for genuine gaps

New skills are created only for reusable, system-aligned capabilities that strengthen ValueOS as a system of intelligence for auditable business value. Each must represent a repeatable capability with a clear input/output contract that operates on the value model.

**Approved new skills:**

1. **`docs/skills/ona-environment/SKILL.md`** — Ona/Gitpod devcontainer setup, automation commands (`gitpod automations service start/stop/logs`), port management, and health checks. Replaces the stale `setup-dev-environment` skill.

2. **`docs/skills/value-graph-integration/SKILL.md`** — How agents read from and write to `ValueGraphService`, including the `BaseGraphWriter` pattern, correct context key extraction (`opportunity_id`), UUID validation, and tenant isolation. Fills a gap currently undocumented in any skill.

### R8 — `docs/AGENTS.md` constitutional preamble

`docs/AGENTS.md` must be updated to open with the full constitutional layer (system intent statement + 8 invariants + rejection criteria + agent preamble) before the existing Architecture section. All existing content is preserved and follows the preamble.

### R9 — Root `AGENTS.md` update

The root `AGENTS.md` must be updated to include the one-sentence system intent and a reference to the constitutional layer in `docs/AGENTS.md`.

---

## Acceptance Criteria

- [ ] `docs/AGENTS.md` opens with the constitutional preamble (system intent + invariants + rejection criteria)
- [ ] Root `AGENTS.md` includes the one-sentence system intent and references `docs/AGENTS.md`
- [ ] All 8 stale skills/workflows have a deprecation header pointing to the canonical source
- [ ] All 8 stale skills/workflows have been rewritten with accurate, devcontainer-first content
- [ ] `.windsurf/skills/continuous-improvement/SKILL.md` contains no references to `cascade-cost`, `~/.windsurf/ADVICE.md`, or Cascade-specific tooling
- [ ] `.windsurf/workflows/init.md` uses `--frozen-lockfile` (not `--no-frozen-lockfile`)
- [ ] `.windsurf/workflows/start-dev.md` and `verification-checklist.md` reference `gitpod automations service start` as the canonical dev start method
- [ ] All 5 duplicate `.roo/skills/` entries are replaced with redirect stubs pointing to the `.windsurf/` canonical version
- [ ] No file in the context layer contains "ValueCanvas" as the product name
- [ ] `docs/skills/ona-environment/SKILL.md` exists and covers devcontainer setup, automation commands, and port management
- [ ] `docs/skills/value-graph-integration/SKILL.md` exists and covers `BaseGraphWriter`, context key extraction, and UUID validation
- [ ] All `.windsurf/context/` files open with the constitutional header comment
- [ ] `docs/AGENTS.md` "Context Engineering Layer" section references `docs/skills/` as the canonical skill home

---

## Implementation Approach

Steps are ordered by dependency — each step's output is referenced by subsequent steps.

1. **Write the constitutional preamble block** — Draft the reusable constitutional header text (compact comment form + full prose form) that will be inserted into multiple files. This is the foundation everything else references.

2. **Update `docs/AGENTS.md`** — Prepend the full constitutional layer (system intent + 8 invariants + rejection criteria + agent preamble) before the existing Architecture section. Update the "Context Engineering Layer" section to reference `docs/skills/` as the canonical skill home.

3. **Update root `AGENTS.md`** — Add the one-sentence system intent and a reference to the constitutional layer.

4. **Add constitutional headers to `.windsurf/context/` files** — Insert the compact constitutional header comment at the top of: `decisions.md`, `debt.md`, `traceability.md`, `user-stories.md`, `memory.md`, `tools.md`, `README.md`.

5. **Deprecate stale skills (Phase 1)** — Add deprecation headers to all 8 stale files listed in R3.

6. **Rewrite stale skills (Phase 2)** — Rewrite each deprecated skill with accurate content:
   - `setup-dev-environment` → devcontainer-first, correct versions (Node 20.19.5, pnpm 10.4.1), correct automations
   - `architecture-map` → actual monorepo structure from `docs/AGENTS.md`
   - `run-tests` → match `vitest.config.ts` and `docs/AGENTS.md` testing conventions (`pnpm test`, `pnpm run test:rls`, sequential execution)
   - `dev-environment-health` → actionable health checks using `gitpod automations service` commands
   - `continuous-improvement` → tool-agnostic, remove all Windsurf-specific tooling references
   - `init.md` → fix `--frozen-lockfile`, reference automations as the canonical setup path
   - `start-dev.md` → `gitpod automations service start` as primary method, manual commands as fallback
   - `verification-checklist.md` → align with automations model, correct health check commands

7. **Create new canonical skills** — Create `docs/skills/ona-environment/SKILL.md` and `docs/skills/value-graph-integration/SKILL.md`.

8. **Consolidate duplicate `.roo/` skills** — Replace each of the 5 duplicate `.roo/skills/` entries with a redirect stub pointing to the `.windsurf/` canonical version.

9. **Fix product naming** — Replace all "ValueCanvas" occurrences with "ValueOS" across context files.

10. **Verify** — Confirm no contradictions remain between `docs/AGENTS.md` and any skill, workflow, or rule file. Confirm all acceptance criteria are met.

---

## Out of Scope

- Phase 3 deletion of deprecated skills (tracked as follow-up after validation)
- Updating `.windsurf/rules/` glob-triggered rules (these are tool-specific adapters and are correct in form; content accuracy is a separate pass)
- Updating `.windsurf/context/decisions.md`, `debt.md`, `traceability.md` substantive content (only the constitutional header is added; content updates are sprint-driven)
- Creating skills for the full approved taxonomy (evidence ingestion, benchmark validation, scenario simulation) — those are future sprints
