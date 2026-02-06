# QUALITY CONTRACT — B→A Promotion Ratchet

> **Scope:** Repository-wide quality governance.
> **Activation rule:** Only active once phases 0–3 are stable (green in CI for 7 consecutive days, no P0/P1 incidents, no rollback in prior sprint).

## 1) Gate Updates (Effective immediately after stability precondition)

### Gate A — Strict Zone Expansion (X% weekly)
- **Current strict-zone footprint baseline:** 49 TS/TSX files.
- **Weekly expansion ratchet:** **+15% of strict-zone files per week** (minimum +7 files/week).
- **4-week target:** 49 → 81 strict-zone files (+65%).
- **Rule:** Any file promoted into strict zone must stay at `0` TypeScript errors and cannot be removed without Architecture + Quality approval.

### Gate B — Coverage Ratchet (gradual)
- **Overall line coverage:** 80% → 82% → 84% → 85% → **86%**.
- **Security + billing coverage:** 95% → 95.5% → 96% → 96.5% → **97%**.
- **Agents coverage:** lock at **100%** (non-negotiable).
- **Rule:** Thresholds never decrease; only raise or hold.

### Gate C — TypeScript Strictness Ratchet
- **Week 1:** Keep `strict` family ON; preflight for next flags.
- **Week 2:** Enable `noPropertyAccessFromIndexSignature=true`.
- **Week 3:** Enable `exactOptionalPropertyTypes=true`.
- **Week 4:** Enable `noUnusedLocals=true` and `noUnusedParameters=true` in governed packages.
- **Rule:** flag promotions are irreversible once CI is green for 5 consecutive days.

### Gate D — Import Boundary Enforcement Ratchet
- **Week 1:** Boundary policy in warn mode + baseline capture.
- **Week 2:** Block legacy route back-imports and app↔package forbidden crossings as errors for new/changed files.
- **Week 3:** Enforce all boundary violations in CI for affected packages.
- **Week 4:** Enforce repository-wide, no temporary allowlist without expiry date.

## 2) A-Grade Conditions (definition of success)

A-grade is reached when all conditions are true for two consecutive weekly release cycles:

1. **Strict zones:** ≥81 files and 0 errors in strict zones.
2. **Coverage:** overall ≥86%, security/billing ≥97%, agents =100%.
3. **TS strictness:** staged flags enabled per Gate C with no rollback.
4. **Imports:** boundary enforcement at repo-wide error level with no permanent exceptions.
5. **Debt ratchet:** no package `.ts-debt.json` regression and all improvements locked within same PR cycle.

### Lock policy (after A-grade)
- Freeze thresholds as minimums in CI.
- Any downgrade requires written exception with owner, expiry, and remediation issue.
- Exceptions auto-expire in 14 days and fail CI if not renewed.
