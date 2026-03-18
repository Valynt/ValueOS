# Error Pattern → Fix Mapping

Quick reference for matching test output to the correct fix in SKILL.md.

## Module resolution failures

| Error text | Fix |
|---|---|
| `Cannot find module './literal/gridRole'` | Fix 1 — `aria-query@5.1.3` broken install, override to `5.3.2` |
| `Cannot find module '…/getActiveElement.js'` | Fix 1 — `@testing-library/user-event@14.6.1` broken install, override to `14.5.2` |
| `Failed to resolve import "@shared/…"` | Fix 2 — missing alias in `vitest.config.ts` |
| `Failed to resolve import "@valueos/…"` | Fix 2 — missing alias in `vitest.config.ts` |
| `Failed to resolve import "react-dnd"` | Fix 2 — add stub alias |
| `Failed to resolve import "node-vault"` | Fix 2 — add stub alias |
| `Failed to resolve import "../DeletedComponent"` | Fix 6 — orphaned test, delete it |
| `Failed to resolve import "../../sdui/schema"` | sdui symlink note — fix relative path to `../schema` |

## Matcher / assertion failures

| Error text | Fix |
|---|---|
| `Invalid Chai property: toBeInTheDocument` | Fix 3 — remove local `expect` import OR switch setup to `import "@testing-library/jest-dom"` |
| `Invalid Chai property: toHaveClass` | Fix 3 — same as above |
| `Invalid Chai property: toBeVisible` | Fix 3 — same as above |

## Provider / context failures

| Error text | Fix |
|---|---|
| `useDrawer must be used within a DrawerProvider` | Fix 4 — add `DrawerContext` mock to `setup.ts` |
| `Tooltip must be used within TooltipProvider` | Fix 4 — add `@/components/ui/tooltip` mock to `setup.ts` |
| `useLocation() may only be used in a Router` | Fix 4 — add `react-router-dom` mock to `setup.ts` |
| `No QueryClient set` | Fix 4 — add `createWrapper()` with `QueryClientProvider` to the individual test |

## Hoisting / initialization failures

| Error text | Fix |
|---|---|
| `Cannot access 'mockX' before initialization` inside `vi.mock` | Fix 5 — move mock object inside factory |
| `ReferenceError: X is not defined` inside `vi.mock` factory | Fix 5 — same |

## Environment / config failures

| Error text | Fix |
|---|---|
| `expected 'development' to be 'test'` | Fix 7 — add `env.NODE_ENV: "test"` to `vitest.config.ts` |
| `expected false to be true` on `isTest()` | Fix 7 — add `env.TEST_MODE: "true"` to `vitest.config.ts` |
| `expected 'http://localhost:54321' to match /^https/` | Fix 7 — guard test against localhost URLs, or add localhost exception to assertion |

## Distinguishing infrastructure failures from real test failures

Infrastructure failures share these traits:
- Many test files fail with **0 tests collected** (the file can't even load)
- The same error message appears across dozens of unrelated test files
- Errors reference `node_modules` paths or module resolution

Real test failures:
- Tests load and run, then produce `AssertionError` or `TestingLibraryElementError`
- Failures are isolated to specific test files or describe blocks
- Error messages reference application code line numbers

Fix infrastructure first — real failures become visible once the suite loads cleanly.
