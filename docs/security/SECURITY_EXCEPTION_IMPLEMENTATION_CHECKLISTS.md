# Security Exception Implementation Checklists

## SEC-001 — Remove dynamic code execution from formula evaluation paths

**Scope**
- Formula evaluation utilities and callers (ValyntApp formula parsing and execution).

**Owners**
- App Security
- ValyntApp Platform

**Checklist**
- [x] Route formula evaluation through the safe expression evaluator (no eval/new Function).
- [x] Enforce allowlist of operators, functions, and constants in parser.
- [x] Add unit tests to reject prohibited constructs (eval/Function/unsupported ops).
- [x] Update security exception register with evidence and closure date.

**Evidence**
- `apps/ValyntApp/src/lib/safeExpressionEvaluator.ts`
- `apps/ValyntApp/src/utils/formulas.ts`
- `apps/ValyntApp/src/utils/__tests__/formulas.test.ts`

## SEC-002 — Replace in-process code sandbox with isolated worker/service

**Scope**
- Sandboxed execution for agent-driven computation.

**Owners**
- Platform Security
- ValyntApp Services

**Checklist**
- [x] Route sandboxed execution through isolated service (E2B).
- [x] Ensure timeout/memory/cpu limits are configurable.
- [x] Add documentation link and evidence in exception register.

**Evidence**
- `apps/ValyntApp/src/services/SandboxedExecutor.ts`

## SEC-003 — Eliminate or sanitize all innerHTML assignments

**Scope**
- UI rendering paths and sanitization utilities.

**Owners**
- Frontend Platform
- Security Engineering

**Checklist**
- [x] Replace innerHTML usage with textContent/querySelector based assertions.
- [x] Remove innerHTML usage from escape helpers.
- [x] Add component test coverage for sanitized HTML rendering.
- [x] Update security exception register with evidence and closure date.

**Evidence**
- `packages/services/github-code-optimizer/src/safe-html.ts`
- `packages/sdui/src/__tests__/security.test.tsx`
- `apps/ValyntApp/src/views/__tests__/ImpactCascade.test.tsx`
