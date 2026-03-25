---
name: run-tests
description: >
  Run the ValueOS test suite correctly. Use when asked to run tests, check
  coverage, validate a change, or debug test failures.
  Triggers on: "run tests", "test suite", "pnpm test", "vitest", "test coverage",
  "RLS tests", "test failing", "test setup".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Run Tests

The authoritative testing contract is `docs/testing/pnpm-test-contract.md`. This skill provides the quick-reference commands.

## Test lanes

| Command | What it runs | When to use |
|---|---|---|
| `pnpm test` | Unit tests only (Vitest, sequential) | Default — all feature work |
| `pnpm run test:rls` | RLS policy validation | After any DB migration or tenant-scoped query change |
| `bash scripts/test-agent-security.sh` | Agent security suite | After any agent code change |
| `pnpm run lint` | ESLint across workspace via Turbo | Before committing |
| `pnpm run check` | TypeScript `tsc --noEmit` via Turbo | Before committing |

## Key constraints (from `docs/AGENTS.md`)

- **Sequential execution** — `fileParallelism: false` in `vitest.config.ts`. Do not override.
- **Unit-only default** — `pnpm test` excludes integration (`*.integration.*`, `*.int.*`), performance (`*.perf.*`), load (`*.load.*`), E2E (`*.e2e.*`), and security/RLS suites.
- **Co-located tests** — `*.test.ts` / `*.spec.ts` next to source, or in `__tests__/` directories.
- **Mock LLMGateway and MemorySystem** in all agent tests.

## Running a specific file or pattern

```bash
# Single file
pnpm test -- packages/backend/src/lib/agent-fabric/agents/__tests__/OpportunityAgent.test.ts

# Pattern
pnpm test -- --testNamePattern="tenant isolation"

# Watch mode (development only)
pnpm test -- --watch
```

## Agent test setup pattern

Agent tests must hoist mocks with `vi.hoisted` and clear in `beforeEach`:

```typescript
const { mockComplete, mockRetrieve, mockStore } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockRetrieve: vi.fn(),
  mockStore: vi.fn(),
}));

vi.mock("../../lib/LLMGateway", () => ({ LLMGateway: vi.fn(() => ({ complete: mockComplete })) }));
vi.mock("../../lib/agent-fabric/MemorySystem", () => ({ MemorySystem: vi.fn(() => ({ retrieve: mockRetrieve, storeSemanticMemory: mockStore })) }));

beforeEach(() => { vi.clearAllMocks(); });
```

## RLS test validation

Run after every migration that adds or modifies a tenant-scoped table:

```bash
pnpm run test:rls
```

All tests must pass before the migration is merged. See `.windsurf/skills/rls-policy/SKILL.md` for the full RLS workflow.

## CI automation

```bash
gitpod automations task start test      # unit tests
gitpod automations task start testRls   # RLS tests
gitpod automations task start lint      # ESLint
gitpod automations task start typecheck # tsc --noEmit
```

## Debugging failures

```bash
# Verbose output
pnpm test -- --reporter=verbose

# Inspect a specific failure
pnpm test -- --run --testNamePattern="<failing test name>"

# Check TypeScript signal report
pnpm run check
```
