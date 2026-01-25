# Security Exceptions Register

## Exceptions

_No active exceptions recorded._

## Remediation Tickets

| ID | Priority | Title | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | Remove dynamic code execution from formula evaluation paths | TBD | Open | Replace with safe parser/evaluator; no eval/new Function in production. |
| SEC-002 | P0 | Replace in-process code sandbox with isolated worker/service | TBD | Open | Explicit allowlist, timeouts, and memory limits required. |
| SEC-003 | P0 | Eliminate or sanitize all innerHTML assignments | TBD | Open | Require textContent or sanitizeHtml allowlist wrapper. |
| SEC-004 | P1 | Replace decodeHtml implementation with safe entity decoding | TBD | Open | Avoid HTML parsing side effects. |
| SEC-005 | P2 | Remove var usage in tests if lint requires | TBD | Open | Scope safely with let/const. |
