# Spec: Observability & Detection Gaps

**Status:** Draft  
**Scope:** Two production observability blind spots that impair incident detection and post-incident reconstruction.  
**Production promotion is blocked until all acceptance criteria in §3 are met.**

---

## 1. Problem Statement

### 1.1 — Shared logger silently drops info and warn in production

`packages/shared/src/lib/logger.ts` is used by 87+ backend files including auth, tenant, subscription, and audit-critical middleware. In production it has two compounding suppressions:

1. **`shouldLog()` filters out `info`** — the constructor hard-codes `this.minLevel = "warn"` when `NODE_ENV === "production"`, so `info` calls never reach listeners or console output.
2. **`consoleOutput()` only writes `error`** — even `warn` entries that pass `shouldLog()` are silently dropped from console because the production branch is `if (isProduction() && level === "error")`.

`setupMonitoring()` is a no-op placeholder; no listeners are registered. The net result: **in production, only `error` logs are emitted**. `warn` and `info` are silently discarded.

The K8s base manifests (`infra/k8s/base/backend-deployment.yaml`, `backend-blue-deployment.yaml`, `backend-green-deployment.yaml`) already set `LOG_LEVEL=info`, but the shared logger ignores `LOG_LEVEL` entirely — it reads only `NODE_ENV`.

Audit-critical `info` calls that are silently dropped in production include:
- `logger.info("User login successful", ...)` — `packages/backend/src/api/auth.ts`
- `logger.info("User signup successful", ...)` — `packages/backend/src/api/auth.ts`
- `logger.info("Password updated successfully", ...)` — `packages/backend/src/api/auth.ts`
- `logger.warn("Password reset audit lookup failed", ...)` — `packages/backend/src/api/auth.ts`
- All `info`/`warn` calls in `requestAuditMiddleware.ts`, `tenantContext.ts`, `authorization.middleware.ts`, `auth.ts`, `subscriptions.ts`, `TenantDeletionService.ts`, `TokenRotationService.ts`

`packages/backend/src/lib/logger.ts` (used by workers, repositories, agents) does not have this problem — it writes `info`/`warn`/`error` unconditionally. The fix is scoped to the shared logger.

### 1.2 — Alert fatigue from known-failing cronjobs and runbook-less alerts

`packages/shared/src/lib/health/alerts.ts` defines an `AlertManager` with rules that fire at `CRITICAL` severity. No runbook links exist on any alert rule. When a known-failing cronjob fires repeatedly, operators receive undifferentiated `CRITICAL` noise with no triage guidance, leading to alert desensitisation.

### What this spec explicitly excludes

- `packages/backend/src/lib/logger.ts` — already correct for production `info`/`warn`/`error` output.
- Log transport targets (Datadog, CloudWatch, OpenTelemetry exporters) — out of scope.
- New alert conditions or SLO definitions — covered by `specs/production-readiness-gap-closure.md`.
- The `packages/shared/src/lib/health/alerts.ts` `AlertManager` class itself — the fix is adding runbook links to `AlertRule` definitions, not restructuring the class.

---

## 2. Requirements

### R1 — Shared logger must honour `LOG_LEVEL` and emit `info`/`warn` in production

The shared logger (`packages/shared/src/lib/logger.ts`) must:

1. Read `process.env.LOG_LEVEL` in the constructor and use it to set `minLevel`, falling back to environment-based defaults when unset.
2. Default to `"info"` in production when `LOG_LEVEL` is not set (not `"warn"`).
3. Emit `info`, `warn`, and `error` to console in production (not only `error`). The `consoleOutput()` production branch must write all entries that pass `shouldLog()`.
4. Preserve the existing `setMinLevel()` method so tests can override the level.

The `LOG_LEVEL` precedence order:
- `process.env.LOG_LEVEL` if set and a valid level (`debug | info | warn | error`)
- `"info"` in production
- `"error"` in test
- `"debug"` in development

### R2 — CI gate: shared logger production level must not suppress `info`

A new CI job `log-level-production-gate` must:

1. Verify that `LOG_LEVEL` is set to `info` or a more verbose level (`debug`) in all K8s base manifests that set it (`infra/k8s/base/backend-deployment.yaml`, `backend-blue-deployment.yaml`, `backend-green-deployment.yaml`, `frontend-blue-deployment.yaml`).
2. Fail if any of those manifests set `LOG_LEVEL` to `warn`, `error`, or omit it entirely.
3. Run on every PR and on every push to `main`.

The gate is implemented as an inline shell step in `pr-fast.yml` and `main-verify.yml`, following the same pattern as `mfa-production-config-gate`.

### R3 — `AlertRule` must carry a `runbookUrl`

Every `AlertRule` registered with `AlertManager` must include a `runbookUrl: string` field pointing to the relevant section of `docs/runbooks/alert-runbooks.md`.

1. Add `runbookUrl: string` to the `AlertRule` interface in `packages/shared/src/lib/health/alerts.ts`.
2. Populate `runbookUrl` on all three default rules (`high_failure_rate`, `critical_failure`, `high_latency`), pointing to new sections in `docs/runbooks/alert-runbooks.md`.
3. When `AlertManager` emits a new alert (inside `evaluateRules()`), include `runbookUrl` in the returned `Alert` object so callers can surface it in notifications.

### R4 — Runbook entries for `AlertManager` default rules

`docs/runbooks/alert-runbooks.md` must gain sections for the three `AlertManager` default rules. Each section must include:
- Trigger meaning (what condition fired and why it matters)
- Triage commands
- Common causes
- Remediation steps
- Escalation path
- Ownership

---

## 3. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | `packages/shared/src/lib/logger.ts` constructor reads `process.env.LOG_LEVEL`; production default when unset is `"info"` |
| AC-2 | `consoleOutput()` in production writes all entries that pass `shouldLog()`, not only `error` |
| AC-3 | Unit test: shared logger with `NODE_ENV=production` and `LOG_LEVEL` unset emits `info` and `warn` to console |
| AC-4 | Unit test: shared logger with `NODE_ENV=production` and `LOG_LEVEL=warn` suppresses `info` but emits `warn` |
| AC-5 | Unit test: shared logger with `NODE_ENV=production` and `LOG_LEVEL=debug` emits `debug` |
| AC-6 | `log-level-production-gate` CI job passes when all K8s base manifests set `LOG_LEVEL=info` |
| AC-7 | `log-level-production-gate` CI job fails when a K8s base manifest sets `LOG_LEVEL=warn` (verified by test or inline assertion) |
| AC-8 | `log-level-production-gate` is listed in `scripts/ci/release-gate-manifest.json` |
| AC-9 | `AlertRule` interface has `runbookUrl: string` field |
| AC-10 | All three default `AlertManager` rules have non-empty `runbookUrl` values |
| AC-11 | `Alert` objects returned by `evaluateRules()` include `runbookUrl` |
| AC-12 | `docs/runbooks/alert-runbooks.md` has sections for `high_failure_rate`, `critical_failure`, and `high_latency` |

---

## 4. Implementation Approach

### Step 1 — Fix shared logger constructor (R1)

In `packages/shared/src/lib/logger.ts`, replace the constructor body:

```typescript
// Before
constructor() {
  if (isProduction()) {
    this.minLevel = "warn";
  } else if (isTest()) {
    this.minLevel = "error";
  } else {
    this.minLevel = "debug";
  }
}
```

```typescript
// After
constructor() {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const validLevels: LogLevel[] = ["debug", "info", "warn", "error"];
  if (envLevel && validLevels.includes(envLevel)) {
    this.minLevel = envLevel;
  } else if (isProduction()) {
    this.minLevel = "info";
  } else if (isTest()) {
    this.minLevel = "error";
  } else {
    this.minLevel = "debug";
  }
}
```

### Step 2 — Fix `consoleOutput()` production branch (R1)

Replace the production-only-errors guard:

```typescript
// Before
if (isProduction() && level === "error") {
  this.consoleOutput(entry);
}
```

```typescript
// After
if (isProduction()) {
  this.consoleOutput(entry);
}
```

The `shouldLog()` filter already enforces the minimum level; `consoleOutput()` does not need a second level gate.

### Step 3 — Add unit tests for shared logger (AC-3, AC-4, AC-5)

Create `packages/shared/src/lib/__tests__/logger.production.test.ts`. Tests must:
- Temporarily set `process.env.NODE_ENV = "production"` and `process.env.LOG_LEVEL` to various values.
- Spy on `console.log`, `console.warn`, `console.error`.
- Instantiate a fresh `Logger` (or call `resetConfig()` if needed) to pick up the env vars.
- Assert the correct console methods are called for each level.

### Step 4 — Add `log-level-production-gate` CI job (R2)

Add an inline job to `.github/workflows/pr-fast.yml` after `mfa-production-config-gate`, following the same structure:

```yaml
log-level-production-gate:
  name: log-level-production-gate
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Check LOG_LEVEL is not warn/error in K8s base manifests
      run: |
        set -euo pipefail
        FAIL=0
        MANIFESTS=(
          "infra/k8s/base/backend-deployment.yaml"
          "infra/k8s/base/backend-blue-deployment.yaml"
          "infra/k8s/base/backend-green-deployment.yaml"
          "infra/k8s/base/frontend-blue-deployment.yaml"
        )
        for f in "${MANIFESTS[@]}"; do
          if [ -f "$f" ]; then
            level=$(grep -A1 'name: LOG_LEVEL' "$f" | grep 'value:' | sed 's/.*value: *"\?\([^"]*\)"\?.*/\1/' | tr -d ' ')
            if [ -z "$level" ]; then
              echo "FAIL: $f does not set LOG_LEVEL"
              FAIL=1
            elif [ "$level" = "warn" ] || [ "$level" = "error" ] || [ "$level" = "fatal" ]; then
              echo "FAIL: $f sets LOG_LEVEL=$level — info or debug required for audit trail visibility"
              FAIL=1
            fi
          fi
        done
        if [ "$FAIL" -eq 1 ]; then
          echo "log-level-production-gate: FAIL"
          exit 1
        fi
        echo "log-level-production-gate: PASS"
```

Add the same job to `.github/workflows/main-verify.yml`.

Wire `log-level-production-gate` into the `pr-fast` aggregate job's `needs` list and enforce it as a hard blocker (same pattern as `mfa-production-config-gate`).

### Step 5 — Register gate in release manifest (AC-8)

Add to `scripts/ci/release-gate-manifest.json` under `releaseBlockingGates`:

```json
{
  "id": "log-level-production-gate",
  "description": "Fails if any K8s base manifest sets LOG_LEVEL to warn/error/fatal, which would suppress info-level audit trail logs in production.",
  "workflow": ".github/workflows/pr-fast.yml",
  "jobId": "log-level-production-gate",
  "coverage": [
    "K8s base manifests set LOG_LEVEL to info or debug",
    "shared logger audit trail visibility in production"
  ]
}
```

### Step 6 — Add `runbookUrl` to `AlertRule` and `Alert` (R3)

In `packages/shared/src/lib/health/alerts.ts`:

1. Add `runbookUrl: string` to the `AlertRule` interface.
2. Add `runbookUrl?: string` to the `Alert` interface (optional on `Alert` since alerts created before the rule lookup may not have it).
3. In `evaluateRules()`, when creating or updating an `Alert`, copy `runbookUrl` from the matching rule.
4. Populate `runbookUrl` on all three default rules pointing to `docs/runbooks/alert-runbooks.md#<anchor>`.

### Step 7 — Add runbook sections (R4)

Append to `docs/runbooks/alert-runbooks.md` sections for:
- `## high_failure_rate` (service success rate <80% over ≥10 requests)
- `## critical_failure` (service success rate <50% over ≥5 requests)
- `## high_latency` (service P95 latency >2000ms)

Each section follows the existing format in that file (trigger meaning, triage commands, common causes, remediation, escalation, ownership).
