# Lint Warning Burn-Down Plan

**Current State:** 2302 warnings (with all security rules re-enabled)
**Target:** 0 warnings (phased approach)
**Ceiling:** 2400 (enforced in CI, prevents regression)

## Warning Breakdown (as of 2026-03-18)

| Rule                                         | Count | Category      | Status                            |
| -------------------------------------------- | ----- | ------------- | --------------------------------- |
| `@typescript-eslint/no-explicit-any`         | 1122  | Type Safety   | Active debt                       |
| `security/detect-object-injection`           | 610   | Security      | High false-positive, needs review |
| `@typescript-eslint/no-unused-vars`          | 425   | Code Quality  | Active debt                       |
| `security/detect-non-literal-fs-filename`    | 56    | Security      | Needs review                      |
| `security/detect-unsafe-regex`               | 33    | Security      | Needs review                      |
| `@typescript-eslint/no-require-imports`      | 28    | ESM Migration | Acceptable                        |
| `@typescript-eslint/no-unsafe-function-type` | 19    | Type Safety   | Active debt                       |
| `no-case-declarations`                       | 17    | Code Style    | Fixable                           |
| `@typescript-eslint/ban-ts-comment`          | 13    | Code Quality  | Fixable                           |
| `no-useless-escape`                          | 13    | Code Style    | Auto-fixable                      |

## Suppression Policy

### Permanent (Documented)

**`src/types/**/\*.ts`-`no-explicit-any: off`\*\*

- **Rationale:** Type definition files often need `any` for external API boundaries where we don't control the shape
- **Justification:** Type definitions are contracts, not implementation. External APIs may not provide full type coverage.
- **Review cadence:** Quarterly - check if external packages now provide types

**`src/test-utils/**/\*.ts`-`no-unused-vars: off`\*\*

- **Rationale:** Test utilities export helpers consumed by test files outside this directory
- **Justification:** The lint rule cannot detect cross-file usage in test suites
- **Review cadence:** Never - this is a structural limitation

### Temporary (Burn-down Required)

All other warnings must be fixed or use **per-line `eslint-disable` comments** with justification:

```typescript
// eslint-disable-next-line security/detect-object-injection
// FP: Key is validated against whitelist above
const value = obj[userInput];
```

## Phased Reduction Plan

### Phase 1: Auto-fixable (Week 1)

- `no-useless-escape` - 13 warnings
- `no-case-declarations` - 17 warnings
- `@typescript-eslint/ban-ts-comment` (convert to `@ts-expect-error`) - 13 warnings

**Expected reduction:** ~43 warnings

### Phase 2: Security Rule Review (Week 2-3)

Evaluate each `security/detect-object-injection`, `detect-non-literal-fs-filename`, `detect-unsafe-regex` warning:

- **True positive:** Fix the security issue
- **False positive:** Add inline suppression with justification comment

**Expected reduction:** ~200-400 warnings (depending on false positive rate)

### Phase 3: Type Safety - `no-explicit-any` (Month 2-3)

Target the 1122 `any` usages with priority order:

1. **Security-critical paths** (`src/api/auth.ts`, `src/middleware/`) - Fix immediately
2. **Agent fabric** (`src/lib/agent-fabric/`) - Replace with `unknown` + type guards
3. **Services** - Gradual migration as files are touched
4. **Types** - Already suppressed (external API boundaries)

**Strategy:**

- New code: `any` is forbidden (use `unknown` + validation)
- Legacy code: Fix when file is modified for other reasons
- Track remaining count weekly

### Phase 4: Dead Code Elimination (Month 3)

Target 425 `no-unused-vars` warnings:

- Remove genuinely unused code
- Fix exports that should be used
- Add `_` prefix to intentionally unused destructuring

## Success Metrics

| Milestone        | Target Date | Warning Count | Ceiling |
| ---------------- | ----------- | ------------- | ------- |
| Current          | 2026-03-18  | 2302          | 2400    |
| Phase 1 Complete | 2026-03-25  | ~2260         | 2250    |
| Phase 2 Complete | 2026-04-08  | ~1900         | 1900    |
| Phase 3 Check-in | 2026-05-01  | ~1500         | 1500    |
| Phase 4 Complete | 2026-06-01  | ~1100         | 1100    |
| Target           | 2026-07-01  | <100          | 100     |

## Enforcement

- **CI:** `pnpm run lint` fails if warnings exceed ceiling
- **New code:** PRs should not increase warning count
- **Refactors:** PRs that fix warnings are prioritized for review
- **Dashboard:** Weekly report of warning count by category

## Policy Change Log

### 2026-03-18

- Reverted broad directory-level suppressions for `no-explicit-any` and `no-unused-vars` in `src/services/` and `src/lib/`
- Re-enabled security rules that were disabled to hit artificial target
- Raised ceiling from 1000 → 2400 to reflect actual debt with all rules enabled
- Documented proper suppression policy with narrow overrides only
