Plan: Merge Legacy ValyntApp UI

TL;DR — Two‑week sprint to safely reintroduce legacy UI into `apps/ValyntApp/src`. Work in `work/valynt-src` using a `legacy-merge/` staging area; merge incrementally (types → services → components → pages → integrations), run typecheck/tests/build after each batch, and open small PRs. This minimizes risk and keeps CI green.

Objectives

- Restore Deleted UI: revert and recover removed ValyntApp UI files.
- Preserve Current Code: place restored files non-destructively under `apps/ValyntApp/src/legacy-restored` while merging selectively.
- Organize Working Tree: merge relevant legacy code into `apps/ValyntApp/src` and continue development on `work/valynt-src`.
- Compare & Audit Changes: use diffs (`diff-outputs/`) and semantic indexing to review differences before merging.
- Plan Safe Merge: choose per-directory/file merges to minimize disruption and keep CI green.

Sprint Outline (2 weeks)

Steps

1. Create branch and baseline: `work/valynt-src`, run typecheck/lint/tests/build and capture baseline failures.
2. Inventory restored files and assign owners; produce per-directory counts.
3. Merge `types` first in small batches; fix TS errors.
4. Merge `services` with safe stubs for env/API calls.
5. Merge core `components` (AppShell/ChatCanvas) and verify render.
6. Merge pages/routes and gate integrations behind feature flags; run CI + staging smoke tests.

Prioritization (recommended)

- High priority: `types`, `services`, `components`.
- Medium: `App.tsx`, `main.tsx`, `pages`.
- Lower: small `integrations`, tests (once core types/services are stable).

Concrete Backlog (10–15 tasks)

1. Create working branch and baseline

- Estimate: 2h
- Description: Create `work/valynt-src` from `main`, run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, capture failing counts.
- Acceptance: Branch exists and baseline run recorded.

2. Add `legacy-restored` file inventory & ownership

- Estimate: 4h
- Description: Generate map of restored files and assign owners for components/types/services.
- Acceptance: Inventory doc (markdown) with file-groups and owners.

3. Fix path aliases + tsconfig include

- Estimate: 4h
- Description: Ensure tsconfig path aliases resolve for the merged files.
- Acceptance: `npm run typecheck` runs without path errors.

4. Merge `types` incrementally

- Estimate: 16h
- Description: Integrate `legacy-restored/types/*` in batches and resolve duplicate definitions.
- Acceptance: Type-only merges produce zero new global TS errors.

5. Integrate `services` safely (SessionManager, analytics, rate-limit)

- Estimate: 12h
- Description: Merge service modules, stub external calls for dev, run unit tests.
- Acceptance: Service tests pass; no runtime crashes in simple dev run.

6. Reintroduce core components (AppShell, ChatCanvas)

- Estimate: 16h
- Description: Add essential UI components and verify app renders.
- Acceptance: Dev server starts and core layout renders without fatal errors.

7. Integrate routing/pages (auth + dashboard)

- Estimate: 12h
- Description: Merge auth flow pages and dashboard; confirm routing and login flow.
- Acceptance: Manual smoke: login renders; dashboard navigates without crash.

8. Restore integrations behind flags + mocks

- Estimate: 8h
- Description: Merge adapter code (HubSpot, Salesforce, Slack) behind feature flags and provide mocks for CI.
- Acceptance: Modules compile; no external calls in CI.

9. Re-enable and fix tests

- Estimate: 16h
- Description: Run unit and integration tests; fix setup, mocks, and flakey tests.
- Acceptance: Unit tests pass locally; integration tests documented or passing where possible.

10. Merge `main.tsx` / bootstrap sequence

- Estimate: 8h
- Description: Safely integrate bootstrap/provider changes and verify analytics/logger init works in dev.
- Acceptance: App boots in dev and logs expected startup output.

11. Lint/format and small refactors

- Estimate: 6h
- Description: Fix lint errors introduced by merges; apply formatting.
- Acceptance: `npm run lint` and `npm run format:check` pass (or exceptions documented).

12. Build & bundle-size check

- Estimate: 8h
- Description: Run `npm run build` and verify bundle-size budget; optimize where necessary.
- Acceptance: Build succeeds and meets budget or an optimization plan is documented.

13. CI adjustments & gating

- Estimate: 6h
- Description: Ensure PR workflows validate merged subsets; add staging deploy + smoke tests in CI.
- Acceptance: PRs for `work/valynt-src` run required checks and produce preview deploys.

14. Staging deploy + smoke E2E

- Estimate: 8h
- Description: Deploy to staging and run Playwright smoke tests for critical flows.
- Acceptance: Smoke tests pass and issues triaged.

15. Final review & merge

- Estimate: 4h
- Description: PR prep, owner sign-offs, merge with feature flag off by default.
- Acceptance: PR merged; rollback plan and release notes added.

Local verification commands (recommended)

```bash
git checkout -b work/valynt-src origin/main
pnpm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev  # manual smoke
```

Env vars & CI gating notes

- Provide dev placeholders for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and other third-party keys; never commit service keys.
- CI gates: `lint`, `typecheck`, `test`, `build` required before merge. Add `staging-deploy` job for smoke tests.

Indexing & search recommendations (optional but helpful)

- Use local Ollama + ChunkHound to index `apps/ValyntApp/src` and `diff-outputs` to generate semantic inventories and usage references.
- Example `.chunkhound.json` (create in repo root):

```json
{
  "embedding": {
    "provider": "openai",
    "model": "nomic-embed-text",
    "base_url": "http://localhost:11434/v1",
    "api_key": "ollama"
  },
  "indexing": {
    "include": [
      "apps/ValyntApp/src/**/*.ts",
      "apps/ValyntApp/src/**/*.tsx",
      "diff-outputs/**/*.diff",
      "docs/**/*.md"
    ],
    "exclude": ["node_modules/**", "dist/**", ".git/**"],
    "watch": false
  }
}
```

Why indexing helps

- Quickly list and prioritize restored files
- Find all references/usages before merging
- Detect duplicate types and API drift early
- Provide focused search results for PR reviewers

Open questions

- Which commit should be used as the authoritative baseline for merge work? (54924514e7..., e9035313..., 561815a4, or 0ba2b28f...)
- Should merged code be feature-flagged off by default? (Recommended: yes.)
- Which integrations should be enabled in staging and where can test credentials be provided?
- Who are owners for components/types/services for review sign-offs?

Next actions (pick one):
A) I will create the `.chunkhound.json` file in the repo root (safe, no services started).
B) I will start Ollama + ChunkHound and run a full index locally (requires permission to run background services).
C) I will run regex semantic searches against the repository and produce the initial inventories (no external services required).

Choose A, B, or C and I will proceed.
