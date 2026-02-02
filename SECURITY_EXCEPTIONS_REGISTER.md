# Security Exceptions Register

## Exceptions

_No active exceptions recorded._

## Remediation Tickets

| ID | Priority | Title | Owner | Status | Checklist | Scope | Evidence | Closure Date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | Remove dynamic code execution from formula evaluation paths | App Security / ValyntApp Platform | Closed | [Checklist](docs/security/SECURITY_EXCEPTION_IMPLEMENTATION_CHECKLISTS.md#sec-001--remove-dynamic-code-execution-from-formula-evaluation-paths) | Formula parsing + evaluation | `apps/ValyntApp/src/lib/safeExpressionEvaluator.ts`, `apps/ValyntApp/src/utils/__tests__/formulas.test.ts` | 2026-02-02 | Replace with safe parser/evaluator; no eval/new Function in production. |
| SEC-002 | P0 | Replace in-process code sandbox with isolated worker/service | Platform Security / ValyntApp Services | Closed | [Checklist](docs/security/SECURITY_EXCEPTION_IMPLEMENTATION_CHECKLISTS.md#sec-002--replace-in-process-code-sandbox-with-isolated-workerservice) | Sandboxed execution path | `apps/ValyntApp/src/services/SandboxedExecutor.ts` | 2026-02-02 | Explicit allowlist, timeouts, and memory limits required. |
| SEC-003 | P0 | Eliminate or sanitize all innerHTML assignments | Frontend Platform / Security Engineering | Closed | [Checklist](docs/security/SECURITY_EXCEPTION_IMPLEMENTATION_CHECKLISTS.md#sec-003--eliminate-or-sanitize-all-innerhtml-assignments) | UI rendering + sanitization utilities | `packages/services/github-code-optimizer/src/safe-html.ts`, `packages/sdui/src/__tests__/security.test.tsx` | 2026-02-02 | Require textContent or sanitizeHtml allowlist wrapper. |
| SEC-004 | P1 | Replace decodeHtml implementation with safe entity decoding | TBD | Open | TBD | TBD | TBD | TBD | Avoid HTML parsing side effects. |
| SEC-005 | P2 | Remove var usage in tests if lint requires | TBD | Open | TBD | TBD | TBD | TBD | Scope safely with let/const. |
