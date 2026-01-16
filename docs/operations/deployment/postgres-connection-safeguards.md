# Postgres Connection Safeguards (Pooling, Timeouts, Retries, Circuit Breakers)

## Environment Configuration (Defaults)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Max pooled connections per process. |
| `DATABASE_POOL_MIN` | `0` | Min idle connections to keep warm. |
| `DATABASE_POOL_IDLE_TIMEOUT_SECONDS` | `20` | Close idle connections after N seconds. |
| `DATABASE_CONNECT_TIMEOUT_SECONDS` | `10` | TCP/handshake timeout for new connections. |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `30000` | Server-side statement timeout applied per connection. |
| `DATABASE_REQUEST_TIMEOUT_MS` | `15000` | App-level timeout for each request. |
| `DATABASE_RETRY_MAX_ATTEMPTS` | `3` | Max attempts for transient failures. |
| `DATABASE_RETRY_BASE_DELAY_MS` | `100` | Base delay for exponential backoff. |
| `DATABASE_RETRY_MAX_DELAY_MS` | `2000` | Upper bound for retry backoff. |
| `DATABASE_RETRY_JITTER_MS` | `100` | Added random jitter to spread retries. |
| `DATABASE_CIRCUIT_BREAKER_ENABLED` | `true` | Enables circuit breaker protection. |
| `DATABASE_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5` | Failures to open circuit. |
| `DATABASE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | `30000` | Wait time before half-open probes. |
| `DATABASE_CIRCUIT_BREAKER_HALF_OPEN_MAX` | `2` | Max in-flight probes when half-open. |

## Retry and Idempotency Policy

- Retries are **only** allowed on transient Postgres errors (serialization failures, connection blips, etc.).
- **Never retry non-idempotent writes** unless an idempotency key is present.
- Reads and idempotent writes can retry with exponential backoff + jitter.

## Circuit Breaker + Bulkhead Guidance

- Circuit breaker protects the database during sustained failures by stopping retries and rejecting new traffic.
- For bulkheads, isolate read/write pools (or per-tenant pools) and cap per-request concurrency, especially for background jobs.
- Consider separate pool sizes for request traffic vs. async workers to avoid head-of-line blocking.

## Deployment Notes

### Containers / Long-lived Servers

- Keep a **moderate pool** (5-20 connections per instance) and use `DATABASE_POOL_MIN` > 0 to reduce cold-start latency.
- Tune `DATABASE_STATEMENT_TIMEOUT_MS` for your SLOs and protect against runaway queries.
- Enable circuit breaker to reduce cascading failures under partial outages.

### Serverless / Short-lived Runtimes

- Keep pools **small** (`DATABASE_POOL_MAX=1-3`, `DATABASE_POOL_MIN=0`) to avoid exhausting shared DB limits.
- Prefer a PgBouncer or managed pooling layer if the platform spins up many instances.
- Set lower request timeouts (e.g., 5-10s) to align with runtime execution limits.
