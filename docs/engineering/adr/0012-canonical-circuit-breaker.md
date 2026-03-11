# ADR-0012 — Canonical Circuit Breaker

**Status:** Accepted  
**Date:** 2026-06-10  
**Deciders:** Engineering

---

## Context

Five independent `CircuitBreaker` class definitions existed:

| File | LOC | Used by |
|---|---|---|
| `lib/resilience/CircuitBreaker.ts` | canonical | BaseAgent, ExecutionRuntime, AgentAPI |
| `lib/resilience.ts` | private class | `withRetry` helper only |
| `config/secrets/CircuitBreaker.ts` | 165 | AWSSecretProvider, VaultSecretProvider |
| `services/RedisCircuitBreaker.ts` | 419 | RateLimitMetricsService, llmRateLimiter |
| `services/CircuitBreakerManager.categorized.ts` | reimplemented inline | EnhancedParallelExecutor |

Each had incompatible `CircuitBreakerConfig` interfaces (`resetTimeout` vs `recoveryTimeout`, `failureThreshold` vs `failure_threshold`). Two legacy type shim files (`CircuitBreaker.types.ts`, `CircuitBreakerManager.types.ts`) added further confusion.

---

## Decision

**`lib/resilience/CircuitBreaker.ts` is the single canonical implementation.**

Changes made:
1. `CircuitBreakerConfig` extended with optional `recoveryTimeout` (alias for `resetTimeout`), `monitoringPeriod`, and `successThreshold` fields to cover Redis and secrets use cases without breaking existing callers.
2. `config/secrets/CircuitBreaker.ts` deleted. `AWSSecretProvider` and `VaultSecretProvider` now import from `lib/resilience/CircuitBreaker.ts`.
3. `services/RedisCircuitBreaker.ts` refactored to use canonical `CircuitBreaker` per named operation (multi-circuit manager pattern preserved, state machine delegated).
4. `services/CircuitBreakerManager.categorized.ts` refactored to delegate to canonical `CircuitBreaker` instances with category-specific defaults.
5. `services/CircuitBreaker.types.ts` and `services/CircuitBreakerManager.types.ts` deleted; types merged into canonical.
6. The private `CircuitBreaker` class in `lib/resilience.ts` remains private — it is only used within that file's `withRetry` helper.

---

## Config Extension Pattern

When a subsystem needs domain-specific config fields, add them as optional fields to `CircuitBreakerConfig` with clear documentation. Do not create a new `CircuitBreakerConfig` interface.

```typescript
// ✅ Extend canonical config
const breaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 30_000,  // alias for resetTimeout
  monitoringPeriod: 120_000, // informational
});

// ❌ New independent implementation
export class MyCircuitBreaker { ... }
```

---

## Consequences

- One circuit breaker to understand, test, and tune.
- `services/CircuitBreaker.ts` and `services/CircuitBreakerManager.ts` remain as thin re-export barrels for backward compatibility.
- `RedisCircuitBreaker` retains its multi-circuit, per-operation API (`execute({ operation, fallback, operationName })`) — callers do not need to change.
- `CategorizedCircuitBreakerManager` retains its category-aware API — callers do not need to change.
