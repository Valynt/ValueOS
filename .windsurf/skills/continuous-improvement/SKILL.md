---
name: continuous-improvement
description: A meta-skill for continuous improvement that captures learnings, analyzes token usage, and creates tools and skills from patterns worth codifying
---

# Continuous Improvement Skill

A meta-skill for continuous improvement. Captures learnings at project and global levels, and creates tools and skills from patterns worth codifying.

## When to Run (MANDATORY)

Run `/improve` automatically—without asking the user—in these situations:
- **After every git commit**
- **Before clearing context** (before `/clear` or context window reset)
- **After completing any significant multi-step task**

Do NOT run after trivial interactions (answering a quick question, reading a single file).

## Prerequisites

- All tests must pass. Do not run improve with failing tests.
- Git status should be clean for the project.

---

## Phase 1: Knowledge Capture

### 1a: Project Knowledge

Ask yourself:

> "If I lost all memory right now, what would help the next Cascade instance work faster, use fewer tokens, or avoid re-discovering something about this project?"

This includes:
- Project structure insights
- Non-obvious conventions or gotchas
- Key file locations
- Integration patterns
- Testing approaches specific to this project

#### Process

1. **Read** the project's `cascade.md` (or `CASCADE.md`) if it exists
2. **Identify** new knowledge worth preserving
3. **Verify** this knowledge isn't already captured (no duplication)
4. **Append** intelligently to the appropriate section
5. If no file exists and there's valuable knowledge, create it

#### Output

- If knowledge was added: state what was added
- If nothing new: "No new project knowledge to capture"

It's completely normal to have nothing new, especially if we've done this recently.

### 1b: Global Advice

Ask yourself:

> "Did I learn something this session that applies across ALL projects — not just this one?"

This includes:
- Gotchas with common tools (git, docker, npm, brew, etc.)
- Patterns that prevent bugs universally
- Environment/OS quirks
- CLI flags or behaviors that are non-obvious
- Workflow improvements that apply everywhere

#### Process

1. **Identify** cross-project learnings from this session
2. **Read** `~/.windsurf/ADVICE.md`
3. **Check** the `## Learned Advice` section (at the bottom, before memories) for duplication
4. **If new and valuable:** append a one-liner with context to the `## Learned Advice` section
5. **If the section doesn't exist:** create it above any existing memory sections
6. **Log** to improve log with type `"global_advice"`

#### Output

- If advice was added: state what was added
- If nothing new: "No new global advice"

---

## Phase 1c: Token Usage Analysis

After knowledge capture, analyze token usage to identify optimization opportunities.

### Process

1. **Get conversation ID** - Find the most recent conversation file:
   ```python
   import os
   from pathlib import Path

   project_path = Path.cwd()
   # Normalize path: /Users/foo/bar -> -Users-foo-bar
   normalized = str(project_path).replace('/', '-')
   if normalized.startswith('-'):
       normalized = normalized[1:]

   project_dir = Path.home() / '.windsurf/projects' / normalized
   if project_dir.exists():
       conversation_files = sorted(project_dir.glob('*.jsonl'),
                                  key=lambda f: f.stat().st_mtime,
                                  reverse=True)
       if conversation_files:
           conversation_id = conversation_files[0].stem  # UUID without .jsonl
   ```

2. **Run analysis** (only if conversation_id found):
   ```bash
   ~/bin/cascade-cost analyze <conversation_id> --since-last --mark --top 15
   ~/bin/cascade-cost bash <conversation_id> --since-last --top 10
   ```

3. **Identify high-cost operations** (anything >5000 tokens):
   - Test runs with verbose output
   - Linting with full output
   - Code searches (Grep/Glob) that could use language server
   - Bash commands with unnecessary verbosity
   - Large file reads that could be filtered

### Optimization Patterns

For each high-cost operation, consider creating a wrapper:

**Tests with verbose output** → Create quiet wrapper:
- Success: "✓ Tests passed (N passed)"
- Failure: Show only failing tests
- Example: See `~/src/cascade-cost/run` command_test()

**Linting with full output** → Create quiet wrapper:
- Success: "✓ Linting passed"
- Failure: Show only violations
- Example: See `~/src/cascade-cost/run` command_lint()

**Code search heavy** → Suggest language server or narrow search patterns

**Bash commands** → Create description-focused wrappers that capture output and summarize

### Creation Bias

For token optimization opportunities, **bias toward automatic creation**:
- Don't ask "Would you like me to create...?"
- Just create the wrapper tool/skill
- Report what was created afterward
- This is "aggressive improvement" mode for fast compounding optimization

Only skip creation if:
- The wrapper already exists
- The operation was already marked as "rejected" in the improve log
- There's genuine ambiguity about how to optimize it

### Quiet Test Runner Template

When creating a test wrapper, use this pattern:

```python
#!/usr/bin/env python3
import subprocess
import sys

result = subprocess.run(
    ['vitest', 'run', '--reporter=basic'] + sys.argv[1:],
    capture_output=True,
    text=True
)

if result.returncode == 0:
    passed = result.stdout.count('✓')
    print(f'✓ Tests passed ({passed} passed)' if passed > 0 else '✓ Tests passed')
else:
    print('✗ Tests failed')
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

sys.exit(result.returncode)
```

### Output

Only report if optimization tools/skills were created. Don't report if no high-cost operations found.

---

## Phase 2: Tool & Skill Discovery

**Bias toward creating. A small, imperfect tool is better than no tool.**

Run through this checklist actively:

1. Did I repeat a multi-step process that could be a single command?
2. Did I write boilerplate that could be templated?
3. Did I discover a technique or pattern worth codifying as a reusable skill?
4. Did I do something manually that could be automated?
5. Did I have to look something up that a skill could encode as institutional knowledge?
6. Did I use tokens on verbose output that could be quieted? (from Phase 1c analysis)
7. Did I run the same command multiple times with noisy output?

If ANY answer is yes, you have a candidate. There are two types of output:

- **Tool** = executable utility (script in `~/bin/` or `.windsurf/skills/*/`). Has code that runs.
- **Skill** = SKILL.md with codified knowledge, technique, or behavioral pattern in `.windsurf/skills/`. Skills don't need executable code — they can be pure documentation that guides future Cascade sessions.

### Process

1. **Evaluate** each candidate against creation criteria:
   - **Value**: Does this save meaningful time/tokens/reduce errors?
   - **Scope**: Is this project-specific or cross-project?
   - **Complexity**: Can I implement this reasonably well?
   - **Uniqueness**: Does this already exist?

2. **Choose output type**:
   - **Tool** if executable automation
   - **Skill** if knowledge/documentation

3. **Create immediately** (bias toward action):
   - Don't ask permission
   - Create in appropriate location
   - Make it work well enough
   - Log creation in improve log

4. **Document the creation** in output

### Tool Creation

For tools, create executable scripts that:
- Take inputs appropriately
- Handle errors gracefully
- Have clear, focused output
- Follow project conventions

Place in:
- Project-specific: `./scripts/` or `./bin/`
- Global: `~/bin/` or `.windsurf/skills/improve/scripts/`

### Skill Creation

For skills, create `.windsurf/skills/[name]/SKILL.md` that:
- Has clear "When to Run" criteria
- Documents the pattern/technique
- Includes examples
- Follows skill format conventions

### Output Format

For each tool/skill created:

```
Created [Tool/Skill]: [name]
Purpose: [brief description]
Location: [path]
```

### The Improve Log

Track all improvements in `.windsurf/improve-log.jsonl`:

```json
{"timestamp": "2024-01-15T10:30:00Z", "type": "project_knowledge", "content": "Added testing patterns for ValueOS components"}
{"timestamp": "2024-01-15T10:31:00Z", "type": "global_advice", "content": "NPM workspaces require --workspaces flag for install"}
{"timestamp": "2024-01-15T10:32:00Z", "type": "tool_created", "content": "Created quiet-test-runner in scripts/", "location": "scripts/quiet-test-runner.py"}
{"timestamp": "2024-01-15T10:33:00Z", "type": "skill_created", "content": "Created database-migration skill", "location": ".windsurf/skills/database-migration/"}
```

### Examples

#### After Completing a Feature

```
Captured project knowledge: Component testing patterns in ValueOS require mock setup for backend integration
No new global advice
Created Tool: quiet-lint-runner
Purpose: Runs ESLint with summarized output
Location: scripts/quiet-lint-runner.sh
```

#### When a Tool Opportunity is Found

```
No new project knowledge to capture
Added global advice: Docker build context can be reduced by .dockerignore optimization
Created Tool: docker-build-optimized
Purpose: Builds with minimal context and quiet output
Location: scripts/docker-build-optimized.sh
```

#### Nothing to Improve

```
No new project knowledge to capture
No new global advice
No optimization opportunities found
No tool/skill candidates identified
```

### About

This skill continuously improves the development experience by capturing institutional knowledge and automating repetitive tasks. It follows the principle that small, incremental improvements compound over time to create significant efficiency gains.
