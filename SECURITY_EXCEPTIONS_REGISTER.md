# Security Exceptions Register

## Exceptions

_No active exceptions recorded._

## Remediation Tickets

| ID | Priority | Title | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | Remove dynamic code execution from formula evaluation paths | AppSec | Closed | Safe evaluator enforced in formula path; evidence: `docs/compliance/soc2/sec-p0-remediation-evidence.md`. |
| SEC-002 | P0 | Replace in-process code sandbox with isolated worker/service | AppSec | Closed | In-process execution disabled (fail-closed) pending isolated worker rollout; evidence: `docs/compliance/soc2/sec-p0-remediation-evidence.md`. |
| SEC-003 | P0 | Eliminate or sanitize all innerHTML assignments | AppSec | Closed | Runtime scripts moved to safe DOM APIs (`textContent`/node creation); evidence: `docs/compliance/soc2/sec-p0-remediation-evidence.md`. |
| SEC-004 | P1 | Replace decodeHtml implementation with safe entity decoding | TBD | Open | Avoid HTML parsing side effects. |
| SEC-005 | P2 | Remove var usage in tests if lint requires | TBD | Open | Scope safely with let/const. |
