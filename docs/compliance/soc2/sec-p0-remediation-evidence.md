# SEC P0 Remediation Evidence (SEC-001 to SEC-003)

## Purpose
This artifact captures remediation evidence for the P0 security exceptions tracked in `SECURITY_EXCEPTIONS_REGISTER.md` to support SOC2 audit readiness.

## Exception Closure Summary

| ID | Risk | Remediation Implemented | Evidence |
| --- | --- | --- | --- |
| SEC-001 | Dynamic code execution in formula paths | Formula evaluation uses `createSafeEvaluator` with denylist checks for dangerous patterns; no `eval`/`new Function` in production formula evaluator. | `apps/ValyntApp/src/utils/formulas.ts` |
| SEC-002 | In-process sandbox execution | `CodeSandbox.execute()` fails closed and rejects dynamic execution; guidance requires isolated out-of-process worker/service with capabilities, timeouts, and limits. | `packages/backend/src/services/CodeSandbox.ts`, `apps/ValyntApp/src/services/CodeSandbox.ts` |
| SEC-003 | DOM XSS via raw HTML sinks | Replaced direct `innerHTML` assignment in runtime scripts with `textContent` / DOM node creation patterns. | `scripts/casual/explorer/src/counter.js`, `scripts/plain-test.js` |

## Validation Commands Run

```bash
rg -n "new Function|\\beval\\s*\\(" apps/ValyntApp/src/utils/formulas.ts packages/backend/src/services/CodeSandbox.ts apps/ValyntApp/src/services/CodeSandbox.ts
rg -n "innerHTML\\s*=|outerHTML\\s*=|insertAdjacentHTML\\s*\\(" scripts/casual/explorer/src/counter.js scripts/plain-test.js
```

## Auditor Notes
- SEC-001 and SEC-002 are implemented as fail-closed controls to prevent unsafe execution paths.
- SEC-003 remediation in executable scripts removes direct HTML injection primitives; retained usage in tests/docs is non-production and outside runtime threat model.
- This document, together with version-controlled diffs and CI/test logs, provides traceable change evidence for SOC2 controls (secure coding, change management, and vulnerability remediation).
