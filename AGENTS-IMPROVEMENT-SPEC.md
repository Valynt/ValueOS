# Agent Configuration Audit & Improvement Spec

## Inventory

| File / Directory | Tool | Purpose |
|---|---|---|
| `AGENTS.md` | **All** (convention) | ✅ Created (this commit) |
| `.github/copilot-instructions.md` | GitHub Copilot | Project-wide instructions |
| `.github/copilot/agents/*.md` (12 files) | GitHub Copilot | Persona definitions |
| `.github/CODEOWNERS` | GitHub | Review routing |
| `.windsurf/rules/*.md` (9 files) | Windsurf | Domain-scoped rules |
| `.windsurf/skills/` (21 skills) | Windsurf | Reusable procedures |
| `.windsurf/workflows/` (16 workflows) | Windsurf | Step-by-step guides |
| `.windsurf/plans/` (40+ files) | Windsurf | Historical sprint plans |
| `.ona/automations.yaml` | Ona | Dev container tasks |
| `GEMINI.md` | Gemini CLI | Project context |
| `.roomodes` | Roo/Cline | Custom modes |

---

## What's Good

1. **Multi-tenancy rules are well-defined.** `copilot-instructions.md` and `.windsurf/rules/global.md` both enforce `organization_id`/`tenant_id` scoping with concrete code examples. This is the single most important safety constraint and it's covered thoroughly.

2. **Domain-scoped Windsurf rules.** Each rule file uses `trigger: glob` to activate only for relevant file paths (e.g., `agents.md` triggers on `src/lib/agent-fabric/**/*.ts`). This keeps context small and relevant.

3. **Copilot persona agents are focused.** Each of the 12 `.github/copilot/agents/*.md` files has a clear role, constraints section, and output format expectations. They avoid overlap.

4. **Reproducible-builds rule is unusually thorough.** Covers deterministic outputs, pinned versions, environment neutrality, and rebuild verifiability — well beyond typical agent configs.

5. **CODEOWNERS maps cleanly to team boundaries.** Agents, orchestration, security, billing, frontend, and devops each have distinct owners.

6. **Automations.yaml is minimal and correct.** Two tasks with proper dependency ordering (`setupTools` depends on `installDeps`).

---

## What's Wrong

### W1: `copilot-instructions.md` is corrupted / duplicated

The file contains two concatenated versions of itself. Around line 100, a second `# GitHub Copilot Instructions for ValueOS (Concise)` header appears, and the file ends mid-sentence with `// ✅ CORRECT - Always fetch user context`. This means Copilot receives garbled instructions.

**Fix:** Deduplicate. Keep the concise version (it's more actionable). Remove the verbose version and the trailing code fragment.

### W2: `.windsurf/plans/` contains 40+ stale plan files

Files like `MIGRATION_COMPLETE.md`, `FINAL_STATUS_SUMMARY.md`, `TEST_FINAL.md`, and `AGENT_FIX_VERIFICATION.md` are historical artifacts, not active guidance. They inflate context for any tool that scans the `.windsurf/` directory.

**Fix:** Move completed plans to `docs/archive/plans/` or delete them. Keep only active plans in `.windsurf/plans/`.

### W3: Windsurf skills are bloated with boilerplate

`run-tests/SKILL.md` is ~300 lines including generic Vitest config examples, GitHub Actions YAML, and debugging tips that duplicate upstream docs. `setup-dev-environment/SKILL.md` is ~250 lines covering nvm installation, Docker Desktop setup, and Prettier config — none of which is ValueOS-specific.

**Fix:** Trim skills to project-specific commands and decisions only. Remove generic framework documentation that belongs in upstream docs.

### W4: `reproducable-builds.md` filename is misspelled

`reproducable` → `reproducible`. Minor but it makes the file harder to find via search.

**Fix:** Rename to `reproducible-builds.md`.

---

## What's Missing

### M1: No `AGENTS.md` at repository root

This is the standard location for tool-agnostic agent instructions. Without it, each tool (Copilot, Windsurf, Ona, Gemini, Roo) maintains its own copy of project context, leading to drift. `AGENTS.md` should be the single source of truth that all tool-specific configs reference.

**Action:** Create `AGENTS.md` containing:
- 10-line architecture summary (monorepo layout, key packages, tech stack)
- Non-negotiable rules (tenant isolation, `secureInvoke`, `service_role` restrictions)
- Dev commands (`pnpm run dx`, `pnpm test`, `pnpm run test:rls`)
- File pointers (BaseAgent, MemorySystem, WorkflowOrchestrator, MessageBus)
- Coding conventions (no `any`, named exports, Zod validation, path aliases)

### M2: No Ona-specific skill or rule files

`.ona/automations.yaml` exists but there are no `.ona/skills/` or agent instructions for Ona. Ona is the active dev environment tool (this environment runs on it), yet it has no project-specific guidance beyond what's in `copilot-instructions.md`.

**Action:** Either:
- (a) Create `AGENTS.md` (M1) which Ona reads automatically, or
- (b) Add `.ona/skills/` with ValueOS-specific workflows (dev setup, test, deploy)

Option (a) is preferred — it benefits all tools simultaneously.

### M3: No mapping between Copilot agents and Windsurf rules

The 12 Copilot persona agents and the 9 Windsurf rule files cover overlapping domains (agents, backend, frontend, orchestration, security) but with different conventions and sometimes different advice. There's no cross-reference or canonical source.

**Action:** In `AGENTS.md`, define the canonical rules. Tool-specific files should reference `AGENTS.md` for shared rules and only add tool-specific behavior (e.g., Windsurf glob triggers, Copilot persona framing).

### M4: No error-handling or incident-response guidance for agents

The rules cover what agents must do (tenant isolation, `secureInvoke`) but not what to do when things fail. No guidance on:
- How to handle LLM timeouts or rate limits
- Circuit breaker recovery patterns
- What to log vs. what to suppress
- Escalation paths when confidence is below threshold

**Action:** Add a "Failure Modes" section to `AGENTS.md` or create `.windsurf/rules/error-handling.md`.

### M5: No test patterns or fixtures guidance

The `run-tests` skill describes how to run tests but not how to write them for this specific codebase. Missing:
- How to mock Supabase client with tenant context
- How to set up agent test fixtures (mock LLMGateway, mock MemorySystem)
- RLS test patterns
- Required test file naming and co-location conventions

**Action:** Add a "Testing Conventions" section to `AGENTS.md` or a dedicated `.windsurf/rules/testing.md`.

### M6: No branch/PR/commit conventions documented for agents

CODEOWNERS defines review routing but there's no guidance on:
- Branch naming conventions
- Commit message format
- PR description template
- What checks must pass before merge

**Action:** Add a "Git Workflow" section to `AGENTS.md`.

### M7: `GEMINI.md` and `.roomodes` are disconnected from the rest

`GEMINI.md` defines its own file resolution protocol (`conductor/` paths) that no other tool references. `.roomodes` defines a documentation mode with instructions that overlap with `.github/copilot/agents/docs.md`. Neither references the shared rules.

**Action:** After creating `AGENTS.md`, update `GEMINI.md` to reference it for project rules (keep only Gemini-specific file resolution protocol). Update `.roomodes` to reference `AGENTS.md` for project conventions.

---

## Priority Order

| Priority | Item | Effort | Impact |
|---|---|---|---|
| **P0** | M1: Create `AGENTS.md` | Medium | Fixes the root cause — no single source of truth |
| **P0** | W1: Fix corrupted `copilot-instructions.md` | Small | Copilot currently receives broken instructions |
| **P1** | W2: Archive stale `.windsurf/plans/` | Small | Reduces noise in agent context |
| **P1** | M3: Cross-reference tool configs to `AGENTS.md` | Medium | Prevents drift between tools |
| **P2** | W3: Trim bloated Windsurf skills | Medium | Reduces token waste |
| **P2** | M4: Add error-handling guidance | Small | Fills a safety gap |
| **P2** | M5: Add test patterns | Small | Agents currently guess at test conventions |
| **P3** | M6: Add git workflow conventions | Small | Standardizes agent PRs |
| **P3** | M7: Unify GEMINI.md and .roomodes | Small | Reduces maintenance burden |
| **P3** | W4: Fix filename typo | Trivial | Cosmetic |
