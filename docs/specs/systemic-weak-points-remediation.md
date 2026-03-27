# Spec: Systemic Weak Points Remediation

## Problem Statement

Three systemic weak points undermine production correctness and operational confidence:

1. **In-memory state in a distributed system** — `CacheService.get/set` only ever touch a process-local `Map`; Redis is never used for reads or writes. `UsageMeteringService` uses a `static Map` for per-tenant rate limiting. Both break silently in multi-pod Kubernetes: cache is not shared, rate limits are per-process, and billing throttling is not coordinated across instances.

2. **Infrastructure as an afterthought** — Redis has a `localhost` fallback and Kafka is feature-flagged off by default. The system starts and runs without them in any environment, including production, with no signal that required dependencies are absent. There is no local developer path that mirrors the production dependency set.

3. **Silent production logging** — The production K8s overlay correctly sets `LOG_LEVEL=info`, but the logger only gates `debug` on `LOG_LEVEL`; `info` always emits regardless. The finding that "production is set to warn" is a spec/audit mismatch, not a code defect. The real gap is: the logger does not respect `LOG_LEVEL` for `info`/`warn`/`error`, there is no startup assertion that rejects invalid log levels, and allowed levels per environment are undocumented.

---

## Priority Order

1. **Issue 2 — In-memory state** (correctness risk, affects billing integrity and rate limiting across pods)
2. **Issue 1 — Infrastructure hardening** (enforcement + local dev path)
3. **Issue 3 — Logging** (spec correction + validation tightening)

---

## Issue 2: In-Memory State — Requirements

### CacheService

**Current behavior:**
- `get` and `set` only touch `this.store` (a `Map<string, unknown>`).
- Redis client is initialized if `REDIS_URL` is set, but only used in `delete`.
- In a multi-pod deployment, each pod has its own isolated cache — no shared state.

**Required behavior:**
- `get`, `set`, `delete`, `clear`, `deleteMany`, and `invalidatePattern` all route through Redis when `REDIS_URL` is set.
- In-memory `Map` is retained as a dev-only fallback when `REDIS_URL` is absent, with an explicit log warning at construction time.
- TTL is enforced via Redis `EX` option on `set`.
- Tenant key namespacing (`tenant:{tid}:{namespace}:{key}`) is preserved.
- Serialization: values are JSON-serialized before writing to Redis and deserialized on read.

**Acceptance criteria:**
- `CacheService.get` returns a value written by a different `CacheService` instance (simulating a second pod) when Redis is available.
- `CacheService.set` with a TTL causes the key to expire in Redis after the specified duration.
- `CacheService.clear` removes only keys matching the current tenant prefix in Redis.
- `CacheService.invalidatePattern` removes matching keys from Redis.
- When `REDIS_URL` is absent, all operations fall back to the in-memory `Map` and a warning is logged at construction.
- Existing tenant-isolation tests (`CacheService.tenant.test.ts`) continue to pass.

### UsageMeteringService

**Current behavior:**
- `private static tenantQueryCosts: Map<string, ...>` — process-local, reset on restart, not shared across pods.
- Comment acknowledges: "in-memory, for demo; use Redis in prod."

**Required behavior:**
- Replace the static `Map` with a Redis-backed sliding window rate limiter.
- Key space: `rate:tenant:{tenantId}:query-cost` with a TTL matching `QUERY_WINDOW_MS` (60s).
- Use Redis `INCRBY` + `EXPIRE` (or a Lua script for atomicity) to increment and check in a single round-trip.
- If Redis is unavailable, fail open with a warning log (do not block billing submissions due to rate limiter unavailability).
- `MAX_COST_PER_WINDOW` and `QUERY_WINDOW_MS` remain configurable as class constants.

**Acceptance criteria:**
- Two concurrent callers for the same tenant share the same cost window (simulated via two `UsageMeteringService` instances against the same Redis).
- A tenant that exceeds `MAX_COST_PER_WINDOW` in one instance is also throttled in a second instance.
- Window resets after `QUERY_WINDOW_MS` elapses (TTL expiry).
- When Redis is unavailable, `checkAndIncrementTenantCost` logs a warning and returns without throwing.
- Existing `UsageMeteringService.test.ts` continues to pass.

### Tests to add

- `CacheService.distributed.test.ts` — multi-instance correctness: write in instance A, read in instance B.
- `CacheService.ttl.test.ts` — TTL expiry behavior via Redis.
- `UsageMeteringService.redis-rate-limit.test.ts` — concurrent callers, window reset, Redis-unavailable fallback.

---

## Issue 1: Infrastructure Hardening — Requirements

### Startup validation

**Current behavior:**
- `REDIS_URL` is optional in `env-validation.ts`; falls back to `redis://localhost:6379`.
- `KAFKA_ENABLED` defaults to `false`; Kafka is never required.
- No startup assertion distinguishes dev from staging/production dependency requirements.

**Required behavior:**
- In `staging` and `production` (`NODE_ENV`):
  - `REDIS_URL` must be set and must use `rediss://` (TLS). Startup fails if absent.
  - If `KAFKA_ENABLED=true`, `KAFKA_BROKERS` must be set. Startup fails if absent.
  - `localhost` Redis URL is rejected in staging/production.
- In `development` / `test`:
  - `REDIS_URL` is optional; `redis://localhost:6379` fallback is allowed.
  - `KAFKA_ENABLED=false` is allowed.
- Validation runs in `validateEnv()` (already called at startup) — extend existing checks, do not add a new validation path.

**Acceptance criteria:**
- Starting the backend in `NODE_ENV=production` without `REDIS_URL` throws a validation error and exits.
- Starting with `REDIS_URL=redis://localhost:6379` in production throws a validation error (non-TLS).
- Starting with `KAFKA_ENABLED=true` and no `KAFKA_BROKERS` in production throws a validation error.
- Starting in `NODE_ENV=development` without `REDIS_URL` succeeds with a warning log.
- Existing `env-validation` tests continue to pass; new tests cover the production-required cases.

### Docker Compose local stack

**Current behavior:**
- No Redis or Kafka service in the local Docker Compose stack.
- Developers rely on `redis://localhost:6379` fallback or install Redis/Kafka manually.

**Required behavior:**
- Add `redis` and `kafka` (+ `zookeeper` or KRaft) services to `infra/docker/docker-compose.yml` (or the primary local compose file).
- Redis: `redis:7-alpine`, port `6379`, no auth (dev only).
- Kafka: `confluentinc/cp-kafka` or `bitnami/kafka` with KRaft mode (no Zookeeper dependency preferred), port `9092`.
- Services are opt-in via a `--profile infra` flag so existing `docker compose up` behavior is unchanged.
- `.env.local.example` updated with `REDIS_URL=redis://localhost:6379` and `KAFKA_BROKERS=localhost:9092`.

**Acceptance criteria:**
- `docker compose --profile infra up` starts Redis and Kafka locally.
- Backend connects to local Redis and Kafka when `REDIS_URL` and `KAFKA_BROKERS` are set from `.env.local.example`.
- Existing `docker compose up` (without `--profile infra`) is unchanged.

### Runbook / documentation

- Add `docs/runbooks/infrastructure-dependencies.md` documenting:
  - Required vs optional dependencies by environment (dev / staging / production).
  - Expected env vars, health check endpoints, and failure modes for Redis and Kafka.
  - Recovery steps when Redis or Kafka is unavailable.
  - Local development setup using `docker compose --profile infra`.

---

## Issue 3: Logging — Requirements

**Finding correction:**
- The claim "production log level is set to warn" is incorrect. The production K8s overlay sets `LOG_LEVEL=info`. No code change is needed to fix a non-existent warn-only mode.

**Actual gaps to address:**

1. **Logger does not respect `LOG_LEVEL` for `info`/`warn`/`error`** — only `debug` is gated. `info` always emits even if `LOG_LEVEL=warn` or `LOG_LEVEL=error` is set.

2. **No startup validation of `LOG_LEVEL`** — an invalid or overly restrictive value (e.g. `LOG_LEVEL=silent`) is silently accepted.

3. **Allowed levels per environment are undocumented.**

**Required behavior:**
- Logger respects `LOG_LEVEL` for all levels: `debug < info < warn < error`.
- If `LOG_LEVEL` is unset, default to `info`.
- In `staging`/`production`, `LOG_LEVEL=debug` is rejected at startup (too verbose for production).
- Invalid `LOG_LEVEL` values (anything not in `debug | info | warn | error`) are rejected at startup.
- Document allowed `LOG_LEVEL` values per environment in `docs/runbooks/infrastructure-dependencies.md` (same doc as Issue 1 runbook).

**Acceptance criteria:**
- `logger.info(...)` does not emit when `LOG_LEVEL=warn`.
- `logger.warn(...)` does not emit when `LOG_LEVEL=error`.
- `logger.error(...)` always emits regardless of `LOG_LEVEL`.
- Starting with `LOG_LEVEL=debug` in `NODE_ENV=production` throws a validation error.
- Starting with `LOG_LEVEL=verbose` (invalid) throws a validation error.
- Existing logger tests pass; new tests cover level-gating behavior.

---

## Implementation Order

### Phase 1 — In-memory state (Issue 2)

1. Rewrite `CacheService.get` to read from Redis when client is available; fall back to `Map` with a warning log if Redis is absent.
2. Rewrite `CacheService.set` to write to Redis with `EX` TTL support; mirror to `Map` only in fallback mode.
3. Rewrite `CacheService.clear` and `invalidatePattern` to operate on Redis keys using `SCAN` + `DEL`.
4. Rewrite `CacheService.deleteMany` to use Redis `DEL` when client is available.
5. Add construction-time warning log when falling back to in-memory mode.
6. Replace `UsageMeteringService` static `Map` with Redis `INCRBY`/`EXPIRE` sliding window; add fail-open behavior when Redis is unavailable.
7. Add `CacheService.distributed.test.ts` and `CacheService.ttl.test.ts`.
8. Add `UsageMeteringService.redis-rate-limit.test.ts`.
9. Verify existing `CacheService.tenant.test.ts` and `UsageMeteringService.test.ts` pass.

### Phase 2 — Infrastructure hardening (Issue 1)

10. Extend `validateEnv()` in `packages/backend/src/config/env-validation.ts`:
    - Require `REDIS_URL` (TLS) in staging/production.
    - Reject `localhost` Redis URL in staging/production.
    - Require `KAFKA_BROKERS` when `KAFKA_ENABLED=true` in staging/production.
11. Add tests for new validation rules.
12. Add `redis` and `kafka` services to local Docker Compose with `--profile infra`.
13. Update `.env.local.example` with local Redis/Kafka vars.
14. Add `docs/runbooks/infrastructure-dependencies.md`.

### Phase 3 — Logging (Issue 3)

15. Update `logger.ts` to gate `info`, `warn`, and `error` on `LOG_LEVEL`.
16. Add startup validation in `validateEnv()` rejecting `debug` in production and invalid level values.
17. Add logger level-gating tests.
18. Document allowed `LOG_LEVEL` values per environment in the runbook from step 14.
