# Spec: TypeScript `any` Debt — Full Elimination

## Problem Statement

`DEBT-ANY-BURNDOWN` is the sole active item in `.windsurf/context/debt.md`. The goal is to reach absolute zero `any` usages across all production packages, fix the broken CI enforcement tooling, delete non-production dead code that carries `any`, and reset `debt.md` to an empty register.

**Current measured state (comment-filtered, non-test production files):**

| Package / App | Actual count | CI ceiling | CI status |
|---|---:|---:|---|
| `packages/mcp` | 128 | 158 | OK (ceiling wrong — debt.md claims 0) |
| `packages/components` | 31 | 31 | OK (ceiling wrong — debt.md claims 0) |
| `packages/backend/src` | 21 | 15 | **FAIL** |
| `apps/ValyntApp/src` | 15 | 6 | **FAIL** |
| `packages/sdui/src` | 7 | 0 | **FAIL** |
| `apps/agentic-ui-pro` | 5 | not tracked | untracked |
| `apps/VOSAcademy` | — | 0 | **FAIL** (directory does not exist) |

Additional dead code carrying `any`:
- `packages/sdui/examples/` — 4 usages, not imported anywhere
- `packages/components/admin/configuration/_archive/` — 8 usages, not imported anywhere
- `packages/backend/src/services/__benchmarks__/*.bench.ts` — 5 usages in benchmark harness files

---

## Requirements

### 1. Delete dead-code directories

Remove directories that are not imported by any production or test code and exist solely as dead weight:

- `packages/sdui/examples/`
- `packages/components/admin/configuration/_archive/`

Verify no import references exist before deletion.

### 2. Exclude benchmark files from the `any` ratchet

`packages/backend/src/services/__benchmarks__/*.bench.ts` files are performance harnesses, not production code. They are not excluded by the current ratchet pattern (`__tests__`, `*.test.*`, `*.spec.*`). Update `scripts/check-any-count.sh` and `scripts/ts-any-ratchet.sh` to also exclude `*.bench.ts` and `__benchmarks__` directories.

### 3. Eliminate all `any` usages — `packages/sdui/src`

**7 usages, all in `src/registry.tsx`.**

All are `React.ComponentType<any>`. Replace with a typed generic or a constrained component props type. The correct replacement is `React.ComponentType<Record<string, unknown>>` or a locally-defined `ComponentProps` interface, depending on call-site constraints.

### 4. Eliminate all `any` usages — `packages/backend/src`

**21 usages across 9 files** (after benchmark exclusion):

| File | Usages | Fix approach |
|---|---:|---|
| `config/ConfigurationManager.ts` | 1 | `value: unknown` + type guard |
| `config/secretsManager.ts` | 1 | Type the AWS SDK command correctly; use `SendCommandOutput` |
| `services/post-v1/PromptVersionControl.ts` | 2 | Type the Supabase client with the generated DB schema type |
| `services/agents/AgentAPI.ts` | 2 | Type `data` with the expected response shape; use `instanceof` for error property check |
| `services/agents/AgentAuditLogger.ts` | 4 | `sanitizeAndZeroMemory` return type is `unknown`; use type assertion only at the assignment boundary with a typed intermediate |
| `lib/agent-fabric/agents/NarrativeAgent.ts` | 2 | Type `previous_stage_outputs` with the integrity stage output schema |
| `lib/agent-fabric/agents/IntegrityAgent.ts` | 2 | Type `kpi.metadata` and `hyp.metadata` with their Zod-inferred types |

### 5. Eliminate all `any` usages — `apps/ValyntApp/src`

**15 usages across 7 files:**

| File | Usages | Fix approach |
|---|---:|---|
| `features/canvas/components/ValueTreeChart.tsx` | 9 | Type the tree node shape; replace `as any` data-binding casts with proper generic types |
| `security/CSPNonce.ts` | 3 | Type Express middleware params: `Request`, `Response`, `NextFunction` |
| `security/CSRFProtection.ts` | 1 | Use `RequestInfo \| URL` for the fetch input type |
| `security/PasswordValidator.ts` | 1 | `catch (err: unknown)` + `instanceof Error` guard |
| `lib/auth/SecureTokenManager.ts` | 1 | Type guard parameter should be `unknown` |
| `mcp-crm/core/MCPCRMServer.ts` | 1 | Use the Supabase typed client instead of casting |
| `mcp-ground-truth/core/UnifiedTruthLayer.ts` | 1 | Type the `details` field with a discriminated union or `Record<string, unknown>` |
| `pages/valueos/TemplatesPage.tsx` | 1 | `React.ComponentType<Record<string, unknown>>` |

### 6. Eliminate all `any` usages — `packages/mcp`

**128 usages across 32 files.** Highest-density files:

| File | Usages | Fix approach |
|---|---:|---|
| `ground-truth/modules/IndustryBenchmarkModule.ts` | 11 | Define typed interfaces for benchmark data shapes |
| `ground-truth/clients/BLSClient.ts` | 10 | Type BLS API response with Zod schema |
| `ground-truth/services/AutomatedInsightsService.ts` | 9 | Type insight payloads with discriminated unions |
| `common/errors/MCPBaseError.ts` | 6 | `value?: unknown`, `allowedValues?: unknown[]`; error guard params `unknown` |
| `common/types/Response.ts` | 4 | Type `metadata` and `details` with specific interfaces |
| `common/config/ConfigurationManager.ts` | 7 | `unknown` + type guards for config values |
| `crm/core/MCPCRMServer.ts` | 6 | Type response builder return types; remove `as any` casts |
| *(remaining 25 files)* | 75 | Apply `unknown` + type guards or Zod schemas per file |

### 7. Eliminate all `any` usages — `packages/components`

**23 usages across 7 files** (after `_archive/` deletion):

All usages are in the admin configuration panel. The configuration object shape is untyped. Define a `ConfigurationSchema` interface (or Zod schema) covering the full configuration tree, then propagate it through `ConfigurationPanel`, `OrganizationSettings`, `AISettings`, `ExportImportDialog`, `ChangeHistorySidebar`, `ConfigurationDiffViewer`, and `use-toast.tsx`.

### 8. Eliminate all `any` usages — `apps/agentic-ui-pro`

**5 usages across 4 files:**

| File | Usages | Fix approach |
|---|---:|---|
| `vite.config.ts` | 1 | Type the Vite HMR payload with `HmrPayload` from `vite` |
| `client/src/hooks/usePersistFn.ts` | 2 | Use `(...args: unknown[]) => unknown` |
| `client/src/components/ui/textarea.tsx` | 1 | Use `CompositionEvent` type; access `isComposing` directly |
| `client/src/components/ui/dialog.tsx` | 1 | Same as textarea — type the event properly |
| `client/src/components/ui/input.tsx` | 1 | Same as textarea |

### 9. Fix `scripts/check-any-count.sh`

- Remove the `apps/VOSAcademy` entry (directory does not exist)
- Add `apps/agentic-ui-pro` entry with ceiling 0
- Set all remaining ceilings to 0 after fixes are applied
- Add `__benchmarks__` to the exclusion pattern

### 10. Fix `scripts/ts-any-ratchet.sh` and `ts-any-baseline.json`

- Update the ratchet script to exclude `*.bench.ts` and `__benchmarks__` directories
- After all fixes, run `bash scripts/ts-any-ratchet.sh --update` to capture the new baseline (0 across all packages)
- Update `ts-any-baseline.json` to reflect 0 counts

### 11. Update `docs/debt/ts-any-dashboard.md`

After all fixes, regenerate the dashboard by running `bash scripts/ts-any-ratchet.sh --report-only`. The dashboard must show 0 for every package.

### 12. Reset `.windsurf/context/debt.md`

Move `DEBT-ANY-BURNDOWN` to the resolved table with today's date and resolution note. Clear all active sections (P0, P1, P2, Ongoing). The file retains its header, structure, and the full resolved-debt reference table — it becomes an empty register ready for future debt tracking.

---

## Acceptance Criteria

1. `bash scripts/check-any-count.sh` exits 0 with all modules showing count=0 and status=OK.
2. `bash scripts/ts-any-ratchet.sh` exits 0 with global count=0.
3. `pnpm run check` exits 0 — no new type errors introduced.
4. `pnpm test` exits 0 — no regressions.
5. `packages/sdui/examples/` directory does not exist.
6. `packages/components/admin/configuration/_archive/` directory does not exist.
7. `apps/VOSAcademy` is removed from `check-any-count.sh`.
8. `apps/agentic-ui-pro` is tracked in `check-any-count.sh` with ceiling 0.
9. `docs/debt/ts-any-dashboard.md` shows 0 for every package.
10. `.windsurf/context/debt.md` has no active debt items; `DEBT-ANY-BURNDOWN` appears only in the resolved table.

---

## Implementation Order

Work package-by-package in ascending complexity order. Run `pnpm run check` and `pnpm test` after each package to catch regressions before moving on.

1. **Delete dead code** — `packages/sdui/examples/`, `packages/components/admin/configuration/_archive/`
2. **Fix CI scripts** — update `check-any-count.sh` and `ts-any-ratchet.sh` exclusions; remove `VOSAcademy`; add `agentic-ui-pro`
3. **`packages/sdui/src`** — 7 usages in `registry.tsx` (all `React.ComponentType<any>`)
4. **`apps/agentic-ui-pro`** — 5 usages across 4 files
5. **`apps/ValyntApp/src`** — 15 usages across 7 files
6. **`packages/backend/src`** — 21 usages across 9 files (excluding benchmarks)
7. **`packages/components`** — 23 usages across 7 files (after archive deletion)
8. **`packages/mcp`** — 128 usages across 32 files (largest block; work file-by-file)
9. **Update ratchet baseline** — run `bash scripts/ts-any-ratchet.sh --update`
10. **Regenerate dashboard** — run `bash scripts/ts-any-ratchet.sh --report-only`
11. **Reset `debt.md`** — move `DEBT-ANY-BURNDOWN` to resolved, clear active sections
