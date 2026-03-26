# Backend Staged Hardening Plan (TypeScript + ESLint)

## Scope and Goals

This plan hardens `packages/backend` in four tracks:

1. Enforce strict TypeScript zone checks with **zero new errors** in:
   - `auth` (`tsconfig.strict-zone.auth.json`)
   - `tenant-data` (`tsconfig.strict-zone.tenant-data.json`)
   - `security` (`tsconfig.strict-zone.security.json`)
2. Reduce ESLint warning budget in `packages/backend/package.json` on a fixed sprint cadence.
3. Add CI ratchets that fail on **increases** in TS/ESLint debt.
4. Publish debt burndown metrics as CI dashboard artifacts so PR-level regressions are visible.

---

## Principles

- **No regressions:** new debt is blocked immediately.
- **Predictable burn-down:** warning ceilings shrink on a scheduled cadence.
- **Auditability:** every PR emits machine-readable debt metrics.
- **Risk-first focus:** strictness starts with auth, tenant isolation, and security-critical code.

---

## Baselines (Sprint 0)

Create/update debt baseline artifacts in `artifacts/backend-debt/` (or similar committed baseline directory):

- `ts-zones-baseline.json`
  - keys: `auth`, `tenant-data`, `security`
  - value per key: current TypeScript error count
- `eslint-baseline.json`
  - keys: `totalWarnings`, `maxWarningsBudget`, `byRule`

Baseline generation commands:

- `pnpm --filter @valueos/backend run typecheck:strict:auth`
- `pnpm --filter @valueos/backend run typecheck:strict:tenant-data`
- `pnpm --filter @valueos/backend run typecheck:strict:security`
- `pnpm --filter @valueos/backend run lint`

> Baselines are captured once at Sprint 0 and only updated intentionally as debt is paid down.

---

## Stage 1 — Strict-Zone Guardrails (Sprint 1)

### Objective
Freeze debt growth in `auth`, `tenant-data`, and `security` zones.

### Changes

1. Ensure zone scripts are the canonical CI commands:
   - `typecheck:strict:auth`
   - `typecheck:strict:tenant-data`
   - `typecheck:strict:security`
2. Add a CI script (`scripts/ci/backend-strict-zone-ratchet.mjs`) that:
   - runs all three zone checks,
   - parses TS diagnostics count per zone,
   - compares against `ts-zones-baseline.json`,
   - fails when any zone count increases.
3. Add PR annotation output with per-zone delta:
   - `auth: +N/-N`
   - `tenant-data: +N/-N`
   - `security: +N/-N`

### Exit Criteria

- PR fails on any strict-zone increase.
- Each PR includes a zone debt summary artifact.

---

## Stage 2 — ESLint Budget Cadence (Sprints 1+)

### Objective
Reduce warning budget in fixed increments with no backsliding.

### Cadence

- Budget reduction: **-200 warnings per sprint**.
- Source of truth: `packages/backend/package.json` `lint` script `--max-warnings=<budget>`.

### Planned ceiling schedule (example)

| Sprint | Max Warnings |
| --- | ---: |
| S0 (current) | 2443 |
| S1 | 2243 |
| S2 | 2043 |
| S3 | 1843 |
| S4 | 1643 |
| S5 | 1443 |
| S6 | 1243 |
| S7 | 1043 |
| S8 | 843 |

> If a sprint misses target due to priority interrupts, the missed reduction is rolled into the next sprint (e.g., -400).

### Controls

- CI ratchet validates:
  - actual warnings `<= max-warnings` in `package.json`, and
  - warning count does not exceed `eslint-baseline.json.totalWarnings` for current sprint branch policy.
- Sprint kickoff task updates `--max-warnings` and baseline metadata in one PR.

### Exit Criteria

- Budget decreases every sprint (or catch-up applied next sprint).
- No PR can merge with warning regression.

---

## Stage 3 — Unified Debt Ratchet in CI (Sprint 2)

### Objective
Consolidate TS and ESLint debt enforcement into one backend hardening lane.

### Workflow additions

Add/extend a CI job (e.g., in `pr-fast.yml`):

1. `backend-hardening-ratchet`
   - Run strict-zone ratchet script.
   - Run eslint ratchet script (`scripts/ci/backend-eslint-ratchet.mjs`).
2. Upload artifacts:
   - `artifacts/backend-debt/strict-zone-summary.json`
   - `artifacts/backend-debt/eslint-summary.json`
   - `artifacts/backend-debt/hardening-summary.md`
3. Add required status check for PR merge.

### Exit Criteria

- One required CI lane enforces both debt types.
- Failures clearly identify which ratchet regressed and by how much.

---

## Stage 4 — Burndown Dashboard Artifacts per PR (Sprint 2+)

### Objective
Make quality trend visible and reviewable at PR time.

### Artifact contract

Emit `artifacts/backend-debt/dashboard.json`:

```json
{
  "timestamp": "ISO-8601",
  "commit": "sha",
  "branch": "name",
  "tsStrictZones": {
    "auth": { "current": 0, "baseline": 0, "delta": 0 },
    "tenant-data": { "current": 0, "baseline": 0, "delta": 0 },
    "security": { "current": 0, "baseline": 0, "delta": 0 }
  },
  "eslint": {
    "currentWarnings": 0,
    "maxWarningsBudget": 0,
    "deltaFromBaseline": 0,
    "topRules": []
  }
}
```

Also emit `artifacts/backend-debt/dashboard.md` with:

- traffic-light status (green: no regression, red: regression),
- sprint target budget vs actual,
- top 10 warning rules,
- strict-zone trend table.

### Optional enhancement

Push the same JSON to a long-lived branch artifact store (or external dashboard) for trend graphs across PRs.

### Exit Criteria

- Every PR has downloadable debt dashboard artifacts.
- Reviewers can see debt deltas without running local checks.

---

## Operating Rhythm

### Sprint planning

- Confirm next `--max-warnings` target (-200).
- Select zone-focused debt tickets (`auth`, `tenant-data`, `security`) first.

### During sprint

- Any PR touching critical zones must be net-neutral or debt-reducing.
- New lint suppressions require inline justification.

### Sprint close

- Publish burndown summary in sprint notes:
  - TS zone deltas,
  - ESLint total delta,
  - next sprint ceiling.

---

## Ownership and Accountability

- **Owner:** Backend Platform (team-platform)
- **Approvers:** Security + Tenant Architecture representatives for strict-zone policy changes
- **Definition of Done (hardening):**
  - zero new strict-zone errors in target zones,
  - max warning ceiling reduced on schedule,
  - CI ratchets passing,
  - dashboard artifacts published on PR.
