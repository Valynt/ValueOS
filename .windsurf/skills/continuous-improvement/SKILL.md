---
name: continuous-improvement
description: >
  Capture learnings and create skills from patterns worth codifying after
  completing significant work. Use after multi-step tasks, before context
  resets, or when a non-obvious pattern was discovered.
  Triggers on: "capture learnings", "improve", "codify pattern", "create skill",
  "what did we learn", "document this pattern".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Continuous Improvement

A meta-skill for capturing institutional knowledge and creating reusable skills from patterns discovered during work.

## When to run

Run after:
- Completing a significant multi-step task
- Solving a non-obvious problem that took more than one attempt
- Discovering a recurring anti-pattern
- Before a context reset

Do NOT run after trivial interactions (answering a quick question, reading a single file).

## Phase 1 — Knowledge capture

Ask: *"If context were lost right now, what would help the next agent work faster or avoid re-discovering something about this project?"*

1. Check `.windsurf/context/memory.md` — is this lesson already captured?
2. If not, append to `memory.md` under the appropriate section:
   - **Architecture Patterns That Work** — patterns confirmed to be correct
   - **Anti-Patterns to Avoid** — patterns that caused bugs or rework
   - **Non-Obvious Gotchas** — things not obvious from reading the code once

Format:
```markdown
### <Short title>
<One paragraph explaining what was learned, why it matters, and what to do instead.>
```

## Phase 2 — Skill creation decision

Create a new skill **only if all of the following are true**:

1. It represents a **repeatable capability** used across multiple flows (not a one-off)
2. It has a **clear input/output contract**
3. It operates on or enriches the **value model / value graph**
4. It can be **invoked independently** by agents
5. It **enforces or contributes to system intent** (value truth, defensibility, auditability)

If not all five are true → the pattern belongs in `memory.md` or inside an existing skill, not as a new skill.

### Skill taxonomy

New skills must fall into one of these categories:

| Category | Examples |
|---|---|
| Value Modeling | build/update value graph, calculate financial outputs, manage assumptions |
| Evidence & Benchmarking | ingest sources, validate claims, attach confidence scores |
| Lifecycle Orchestration | state transitions, stage validation, handoff preparation |
| Integrity & Governance | veto/re-refine, audit logging, policy enforcement |
| System Integration | CRM sync, data ingestion, external connectors |
| Dev Environment | environment setup, health checks, automation commands |

### Skill creation checklist

Before creating a skill, answer:
- What lifecycle stages will use this?
- What value artifact does it read/write?
- What economic concept does it affect?
- What evidence or validation does it require?
- Could this be a function inside an existing skill instead?
- Will another agent reasonably call this later?

If you cannot answer these → do not create the skill.

## Phase 3 — Create the skill

Location: `docs/skills/<name>/SKILL.md` (canonical, tool-agnostic)

Skill frontmatter:
```yaml
---
name: <kebab-case-name>
description: >
  One paragraph. What it does, when to use it, trigger phrases.
---
```

Required sections:
- Constitutional header comment (copy from any existing skill)
- **When to use** — specific trigger conditions
- **Workflow** — numbered steps
- **Do not proceed if** — blockers that must be resolved first
- **Anti-patterns** — table of wrong patterns and fixes
- **Completion report** — what to output when done

## Phase 4 — Update context files

After solving a non-obvious problem:
- `memory.md` — add the lesson
- `decisions.md` — if an architectural decision was made
- `traceability.md` — if a new DB table, endpoint, hook, or UI component was added
- `debt.md` — if debt was resolved (mark it) or newly discovered

See `.windsurf/context/README.md` for the update protocol.
