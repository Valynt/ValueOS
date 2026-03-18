---
name: valynt-test-infra
description: |
  Diagnose and fix test infrastructure failures in apps/ValyntApp. Use when
  the test suite has widespread failures that are not real logic bugs — e.g.
  "all tests fail with Cannot find module", "toBeInTheDocument is not a
  function", "Element type is invalid: got undefined", "must be used within a
  Provider", or "vi.mock hoisting error". Covers broken pnpm package installs,
  vitest.config.ts alias gaps, global provider mocks in setup.ts, vi.mock
  hoisting bugs, expect import conflicts with jest-dom globals, and orphaned
  test files after source deletions.
---

# ValyntApp Test Infrastructure

Key files:
- `apps/ValyntApp/vitest.config.ts` — test runner config, aliases, env vars
- `apps/ValyntApp/src/test/setup.ts` — global mocks and jest-dom setup
- `package.json` (root) — `pnpm.overrides` for broken package versions

## Diagnostic workflow

Run the suite and triage by error category before fixing anything:

```bash
cd apps/ValyntApp && pnpm test 2>&1 | grep "Failed to resolve import" | sort -u
cd apps/ValyntApp && pnpm test 2>&1 | grep "Error: Uncaught\|AssertionError\|TypeError:" | grep -v "at " | sort | uniq -c | sort -rn | head -20
cd apps/ValyntApp && pnpm test 2>&1 | grep -E "Test Files|Tests " | tail -3
```

See `references/error-patterns.md` for the full pattern → fix mapping.

## Fix 1: Broken pnpm package installs

Symptoms: `Cannot find module './literal/gridRole'`, `Cannot find module '…/getActiveElement.js'`, or any "file not found inside node_modules" error at import time.

Cause: A package was published with a truncated dist directory. The root `package.json` `pnpm.overrides` may be pinning the broken version.

Fix:
1. Identify the package: `ls node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/dist/` — look for missing files
2. Check latest working version: `npm view <pkg> versions --json`
3. Update the override in root `package.json`:
   ```json
   "pnpm": { "overrides": { "<pkg>": "<fixed-version>" } }
   ```
4. `pnpm install --no-frozen-lockfile`

Known broken versions pinned in this repo:
- `aria-query@5.1.3` → fix to `5.3.2`
- `@testing-library/user-event@14.6.1` → fix to `14.5.2`

## Fix 2: vitest.config.ts alias gaps

Symptoms: `Failed to resolve import "@shared/..."` or `"@valueos/..."` or `"@sdui/..."`.

Cause: `vitest.config.ts` has a separate `resolve.alias` block from `vite.config.ts`. Aliases added to vite for the app don't automatically apply to tests.

Fix: Keep `vitest.config.ts` aliases in sync with `vite.config.ts`. The vitest config must include:

```ts
resolve: {
  extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  alias: {
    "@": path.resolve(__dirname, "./src"),
    // ... all @/* aliases ...
    "@shared": path.resolve(__dirname, "../../packages/shared/src"),
    "@valueos/shared": path.resolve(__dirname, "../../packages/shared/src"),
    "@valueos/sdui": path.resolve(__dirname, "../../packages/sdui/src"),
    "@valueos/components": path.resolve(__dirname, "../../packages/components"),
    "@sdui/components": path.resolve(__dirname, "../../packages/sdui/src/components"),
    // sdui symlink tests need these resolved from ValyntApp's node_modules:
    "@testing-library/react": path.resolve(__dirname, "node_modules/@testing-library/react"),
    "@testing-library/jest-dom": path.resolve(__dirname, "node_modules/@testing-library/jest-dom"),
    "@testing-library/user-event": path.resolve(__dirname, "node_modules/@testing-library/user-event"),
  },
},
```

For packages in the pnpm store but not declared as deps, alias directly to the store path:
```ts
"react-dnd": path.resolve(__dirname, "./src/test/stubs/react-dnd.ts"),
"node-vault": path.resolve(__dirname, "./src/test/stubs/node-vault.ts"),
"jest-axe": path.resolve(__dirname, "../../node_modules/.pnpm/jest-axe@<ver>/node_modules/jest-axe"),
```

Stub template (`src/test/stubs/<pkg>.ts`):
```ts
import { vi } from "vitest";
export const useDrag = () => [{ isDragging: false }, vi.fn(), vi.fn()];
// ... minimal no-op exports matching the real API surface
```

## Fix 3: jest-dom matchers not available (`toBeInTheDocument is not a function`)

Two distinct causes:

**Cause A**: `expect` imported explicitly from `vitest` in a test file. With `globals: true`, the global `expect` is extended by setup, but a locally imported `expect` is a separate reference that doesn't get the extension.

Fix: Remove `expect` from all vitest imports in test files that use jest-dom matchers:
```bash
# Find affected files
grep -rln "toBeInTheDocument\|toHaveClass\|toBeVisible" apps/ValyntApp/src --include="*.test.tsx" --include="*.test.ts" | \
  xargs grep -l ", expect," | xargs grep -l "from 'vitest'\|from \"vitest\""

# Remove the local expect import
sed -i 's/,\s*expect\b//g; s/\bexpect,\s*//g' <file>
```

**Cause B**: `setup.ts` uses `expect.extend(matchers)` instead of the side-effect import. The side-effect import is more reliable across worker boundaries:

```ts
// setup.ts — use this:
import "@testing-library/jest-dom";

// NOT this:
import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
```

## Fix 4: Missing provider errors (`must be used within a Provider`)

Symptoms: `useDrawer must be used within a DrawerProvider`, `Tooltip must be used within TooltipProvider`, `useLocation() may only be used in a Router`.

Fix: Add global mocks to `setup.ts`. These are passthrough mocks — tests that need real provider behaviour supply their own wrapper.

```ts
// setup.ts
vi.mock("@/contexts/DrawerContext", () => ({
  DrawerProvider: ({ children }: { children: unknown }) => children,
  useDrawer: () => ({ isOpen: false, content: null, title: "", openDrawer: vi.fn(), closeDrawer: vi.fn() }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: unknown }) => children,
  Tooltip: ({ children }: { children: unknown }) => children,
  TooltipTrigger: ({ children }: { children: unknown }) => children,
  TooltipContent: ({ children }: { children: unknown }) => children,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: "/", search: "", hash: "", state: null, key: "default" })),
    useNavigate: vi.fn(() => vi.fn()),
    useParams: vi.fn(() => ({})),
  };
});
```

For hooks that need `QueryClientProvider` (react-query), fix the individual test to supply a wrapper — don't mock globally:
```ts
function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}
const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() });
```

## Fix 5: vi.mock hoisting bugs

Symptom: `ReferenceError: Cannot access 'mockX' before initialization` inside a `vi.mock` factory.

Cause: `vi.mock` calls are hoisted to the top of the file by vitest's transform, before any `const`/`let` declarations. A factory that references a variable declared in the module body will fail.

Fix: Move the mock object inside the factory:
```ts
// ❌ broken — mockSupabase is hoisted above its declaration
const mockSupabase = { channel: vi.fn() };
vi.mock("../supabase", () => ({ supabase: mockSupabase }));

// ✅ fixed — object defined inside factory, evaluated after hoisting
vi.mock("../supabase", () => ({
  supabase: { channel: vi.fn(), from: vi.fn() },
}));
```

## Fix 6: Orphaned test files after source deletions

Symptom: `Failed to resolve import "../DeletedComponent"` — the test file exists but its source was deleted.

Diagnosis:
```bash
# Find the deletion commit
git log --oneline --diff-filter=D -- apps/ValyntApp/src/views/DeletedComponent.tsx

# Confirm the source is gone
ls apps/ValyntApp/src/views/DeletedComponent.tsx 2>/dev/null || echo "MISSING"
```

Fix: Delete the orphaned test file. Do not stub the missing source — stubs mask real gaps.

```bash
rm apps/ValyntApp/src/views/__tests__/DeletedComponent.test.tsx
```

Check for batches: the sprint10 refactor (`734061771`) deleted many source files at once. If multiple tests fail with missing imports, check `git show <commit> --name-status | grep "^D"` to find all deleted sources and their corresponding test files.

## Fix 7: Test env vars not set

Symptom: `expected 'development' to be 'test'`, config singleton reads wrong env at module load time.

Fix: Add an `env` block to `vitest.config.ts` — these are set before any module loads:
```ts
test: {
  env: {
    NODE_ENV: "test",
    TEST_MODE: "true",
    VITE_SUPABASE_URL: "http://localhost:54321",
    VITE_SUPABASE_ANON_KEY: "test-anon-key",
  },
}
```

Note: `vi.stubEnv` in `beforeEach` only works for modules that re-read `process.env` on each call. Singleton configs evaluated at module load time are unaffected by `stubEnv`.

## sdui symlink note

`apps/ValyntApp/src/sdui` is a symlink to `packages/sdui/src`. Tests in `packages/sdui/src/__tests__/` run under ValyntApp's vitest but with relative paths anchored to `packages/sdui/src/`. Common issues:

- Wrong relative paths: `../../sdui/schema` should be `../schema`
- Missing `@testing-library/*` aliases (sdui doesn't declare them as deps — alias to ValyntApp's `node_modules`)
- `LazyComponentRegistry.js` uses extensionless imports — requires `extensions: [".ts", ".tsx", ".js"]` in vitest resolve config
