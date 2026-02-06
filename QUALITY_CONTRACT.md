# ValueOS A-Grade Code Quality Contract

**Status:** Proposed ratchet policy (no remediation in this document).
**Scope:** Monorepo (`apps/*`, `packages/*`, root CI).
**North Star:** Move from debt-tolerant to **A-grade** quality without freezing delivery.

---

## 1) A-Grade Definition (Target State)

A-grade means **all** of the following are true on protected branches:

1. **Typing**
   - `pnpm run typecheck` passes globally (0 blocking TypeScript errors).
   - `pnpm run typecheck:signal --verify` passes with no regression against baselines.
   - Strict zones remain zero-error and expand over time.
2. **Lint**
   - `pnpm run lint` passes (no errors).
   - `pnpm run lint:all` passes for CSS + inline-style checks where applicable.
3. **Formatting**
   - `pnpm run format:check` passes on changed files and CI baseline set.
4. **Tests**
   - Unit/integration checks pass through `pnpm run test`.
   - Browser/a11y/rls suites run in scheduled or release-gate lanes (`test:a11y`, `test:rls`, smoke/playwright suites).
5. **Coverage**
   - Coverage reported on every PR touching runtime code.
   - Minimum maintained at or above repo thresholds (currently in Vitest: lines 75 / statements 75 / functions 70 / branches 65), then ratcheted up.
6. **Dead Code / Unused Surface**
   - No newly introduced dead exports/files in strict zones.
   - Repo-wide dead-code budget trends down each sprint; no regressions in touched packages.

---

## 2) Ratchet Strategy (Strict Islands + Error Budget)

### Core policy
- **No regressions**: PRs cannot increase debt in governed signals.
- **Strict islands**: selected directories/packages are always 0-error, enforced every PR.
- **Error budget**: legacy areas have explicit, numeric debt budgets that can only stay flat or decrease.
- **Promotion path**: packages graduate from legacy budget -> strict island once they hit zero.

### Measurement model
- Baseline source of truth: `pnpm run typecheck:signal --json` artifact committed/recorded in CI.
- Ratchet comparator: `pnpm run typecheck:signal --verify` (blocking).
- Island enforcement: `pnpm run typecheck:islands` + strict-zone config (`config/strict-zones.json`).

---

## 3) Phase Gates (D -> C -> B -> A)

| Phase | Grade | Objective | Required CI gates (blocking unless noted) | Pass threshold |
|---|---|---|---|---|
| **Phase 0: Stabilize** | D | Deterministic CI + stop accidental backsliding | `pnpm install --frozen-lockfile`; `pnpm run ci:governance:self-check`; `pnpm run lint`; `pnpm run typecheck:islands`; `pnpm run typecheck:signal --verify`; `pnpm run test` | CI reproducible; islands = 0 errors; total TS errors **<= baseline**; tests/lint pass |
| **Phase 1: Contain** | C | Freeze growth + establish strict zones | All Phase 0 gates + `pnpm run guard:strict-zones` + `pnpm run format:check` + PR label for debt-touching changes | No TS regression globally or per-package baseline; strict-zone file impact must remain 0-error; formatting passes |
| **Phase 2: Reduce** | B | Burn down debt at steady pace | All Phase 1 gates + weekly governance job validating trend from telemetry JSON + coverage publication in CI | TS error count decreases by **>= 5% week-over-week** (or sprint-equivalent target); zero missed weekly report; coverage not below configured floor |
| **Phase 3: Enforce** | A | Full A-grade enforcement on protected branches | All Phase 2 gates + `pnpm run typecheck` (global) + `pnpm run lint:all` + coverage gate + release lanes (`test:a11y`, `test:rls`, playwright smoke) | Global typecheck passes (0 blocking TS errors); lint/format/tests pass; coverage floor met; no dead-code regressions in touched areas |

### Phase advancement rule
- Advance only after **2 consecutive weeks** of pass-rate >= 95% for current phase gates.
- Any breach resets the promotion clock for that phase.

---

## 4) Ownership, Override, and Escalation

### Owners
- **Primary owner:** Quality Governor (staff+ delegate) for policy + metrics.
- **Code owners:** Package/app maintainers for local remediation and zone promotion.
- **Platform/DevEx:** CI determinism, workflow integrity, telemetry retention.

### Override policy (exception process)
Overrides are rare, time-boxed, and auditable.

Required for any override:
1. Linked issue titled `quality-exception:<scope>:<date>`.
2. Written justification (impact, risk, why unblock is needed now).
3. Expiry date (max 14 days) + rollback/remediation plan.
4. Approval by **two** roles: (a) Quality Governor or delegate, (b) owning Eng Manager/Tech Lead.

Hard constraints:
- No override for security-critical gate failures.
- No silent baseline increases; all debt-budget changes must be explicit in PR description and governance artifact.

Escalation:
- Missed target 2 weeks in a row -> escalate to Engineering leadership review with recovery plan.

---

## 5) Baseline Commands (Run Now)

Use these commands to capture the current quality baseline:

```bash
# Install deterministically
pnpm install --frozen-lockfile

# TypeScript debt telemetry (human + machine readable)
pnpm run typecheck:signal
pnpm run typecheck:signal:json
pnpm run typecheck:signal --verify

# Strict islands / zones
pnpm run typecheck:islands
pnpm run guard:strict-zones

# Lint + format
pnpm run lint
pnpm run lint:all
pnpm run format:check

# Tests
pnpm run test
pnpm run test:unit -- --coverage
pnpm run test:integration
pnpm run test:a11y
pnpm run test:rls

# CI contract check
pnpm run ci:governance:self-check
```

Optional snapshot helpers for dashboards:

```bash
# Capture TypeScript error count from telemetry JSON
pnpm run typecheck:signal:json && node -e "const fs=require('fs');const p='artifacts/typecheck-telemetry.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));console.log('totalErrors=',j.totalErrors,'filesWithErrors=',j.filesWithErrors);"

# Persist baseline record
mkdir -p artifacts/quality && date -Iseconds > artifacts/quality/baseline.timestamp
```

---

## 6) Non-Negotiables

- Protected branches must enforce the phase-appropriate gates.
- Metrics are **ratchet-only**: equal or better, never worse.
- “Green today” areas never go red again.
- This contract is reviewed monthly; thresholds may tighten, never loosen without formal exception.
