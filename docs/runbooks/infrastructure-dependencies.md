# Infrastructure Dependencies

Covers Redis, NATS, Kafka, and logging configuration across environments.

---

## Redis

### Required vs optional by environment

| Environment | Required | Notes |
|-------------|----------|-------|
| development | No | In-memory fallback active; `CacheService` logs a warning |
| test | No | In-memory fallback active |
| staging | **Yes** | `REDIS_URL` must be set; `localhost` is rejected; TLS required |
| production | **Yes** | Same as staging |

### Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Full Redis connection URL | `rediss://user:pass@redis.example.com:6380` |

TLS is enforced in staging/production: the URL scheme must be `rediss://` (not `redis://`).

### Health check

```bash
redis-cli -u "$REDIS_URL" ping
# Expected: PONG
```

For managed Redis (AWS ElastiCache, Upstash, etc.), use the provider's health dashboard or:

```bash
redis-cli -u "$REDIS_URL" --tls info server | grep redis_version
```

### Fail-fast enforcement

In `NODE_ENV=production`, `CacheService` throws at construction time if `REDIS_URL` is absent. The server startup sequence (`validateInfrastructureConnectivity()` in `server.ts`) also pings Redis before accepting traffic. The service will not start without a reachable Redis instance in production.

### Failure modes

| Symptom | Likely cause | Impact |
|---------|-------------|--------|
| `CacheService` logs `[CacheService] Redis unavailable, using in-memory fallback` | `REDIS_URL` unset or unreachable (non-production) | Cache is process-local; no cross-instance sharing |
| `UsageMeteringService` logs `Redis unavailable for rate limiting` | Same | Rate limiting fails open; usage is not metered |
| Startup error: `REDIS_URL is required in production` | Missing env var in production | Service refuses to start |
| Startup error: `Redis connectivity check failed` | Redis unreachable at startup | Service refuses to start |
| Startup error: `REDIS_URL must not point to localhost` | Localhost URL in staging/production | Service refuses to start |

### Recovery

1. Verify `REDIS_URL` is set and reachable from the pod/container.
2. Check Redis instance health via provider dashboard.
3. If Redis is temporarily unavailable in production, the service degrades gracefully (in-memory fallback) but rate limiting and distributed caching are disabled. Restart the service once Redis is restored to re-establish the connection.
4. For persistent connection failures, check network policies and security group rules between the backend and Redis.

### Local development

Redis is included as a core service in `ops/compose/compose.yml` and starts automatically with `docker compose up`. No profile flag needed.

```bash
docker compose up redis          # start Redis only
docker compose up                # start all core services including Redis
```

Set in your `.env.local`:

```
REDIS_URL=redis://localhost:6379
```

---

## NATS JetStream

### Required vs optional by environment

| Environment | Required | Notes |
|-------------|----------|-------|
| development | No | Backend skips NATS connectivity check when `NATS_URL` is unset |
| test | No | Same |
| staging | **Yes** | `NATS_URL` must be set; startup validation pings NATS before accepting traffic |
| production | **Yes** | Same as staging |

NATS is used for metering event streaming via `MeteringQueue`. Without it, usage events cannot be published and metering is silently degraded.

### Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NATS_URL` | NATS server URL | `nats://nats.internal:4222` |

### Health check

```bash
# Using the NATS CLI
nats server ping --server "$NATS_URL"

# Or via the monitoring endpoint (if enabled)
curl http://nats.internal:8222/healthz
```

### Fail-fast enforcement

`validateInfrastructureConnectivity()` in `server.ts` attempts a NATS connection before the HTTP server begins accepting requests. If NATS is unreachable in production, the process exits with a non-zero code rather than starting in a degraded state.

### Failure modes

| Symptom | Likely cause | Impact |
|---------|-------------|--------|
| Startup error: `NATS connectivity check failed` | `NATS_URL` unreachable at startup | Service refuses to start in production |
| `MeteringQueue` publish errors | NATS connection dropped after startup | Usage events lost; metering gaps |
| No usage events in Stripe | NATS down for extended period | Billing undercharges until reconciliation runs |

### Recovery

1. Verify `NATS_URL` is set and the NATS pod/service is healthy (`kubectl get pods -l app=nats`).
2. Check JetStream stream status: `nats stream ls --server "$NATS_URL"`.
3. If NATS was down briefly, usage events may have been buffered in `UsageEmitter`'s in-memory buffer. Restart the backend to flush the buffer once NATS is restored.
4. For extended outages, run the `StripeReconciliationWorker` manually to backfill any missed events.

### Local development

NATS JetStream is defined in `infra/k8s/base/nats-jetstream.yaml`. For local development, it runs as a Docker service. Set in your `.env.local`:

```
NATS_URL=nats://localhost:4222
```

---

## Kafka

### Required vs optional by environment

| Environment | Required | Notes |
|-------------|----------|-------|
| development | No | `KAFKA_ENABLED` defaults to `false`; backend skips Kafka when disabled |
| test | No | Same |
| staging | Conditional | Required when `KAFKA_ENABLED=true` |
| production | Conditional | Required when `KAFKA_ENABLED=true` |

### Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `KAFKA_ENABLED` | Enable Kafka event streaming | `true` |
| `KAFKA_BROKERS` | Comma-separated broker list | `kafka.example.com:9092` |
| `KAFKA_CLUSTER_ID` | KRaft cluster ID (local dev only) | `valueos-local-kraft-001` |

### Health check

```bash
kafka-broker-api-versions --bootstrap-server "$KAFKA_BROKERS"
# Expected: lists supported API versions for broker ID 1
```

For managed Kafka (Confluent Cloud, MSK, etc.), use the provider's health dashboard.

### Failure modes

| Symptom | Likely cause | Impact |
|---------|-------------|--------|
| Backend logs Kafka connection errors | `KAFKA_BROKERS` unreachable | Event streaming disabled; operations that depend on Kafka events may be delayed or dropped |
| Startup error: `KAFKA_BROKERS is required when KAFKA_ENABLED=true` | Missing env var in staging/production | Service refuses to start |

### Recovery

1. Verify `KAFKA_BROKERS` is set and reachable.
2. Check broker health via provider dashboard.
3. If Kafka is temporarily unavailable, set `KAFKA_ENABLED=false` and restart the service to disable event streaming until the broker is restored.
4. For persistent failures, check network policies and SASL/TLS configuration.

### Local development

Kafka is available as an opt-in service under the `infra` profile in `ops/compose/profiles/infra.yml`. It runs in KRaft mode (no Zookeeper).

```bash
# Start Kafka alongside core services
docker compose -f docker-compose.yml -f ops/compose/profiles/infra.yml --profile infra up

# Or using COMPOSE_PROFILES in .env.local:
# COMPOSE_PROFILES=infra
docker compose up
```

Set in your `.env.local`:

```
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
```

Kafka data is persisted in the `kafka_data` Docker volume. To reset:

```bash
docker compose --profile infra down -v
```

---

## Logging

### LOG_LEVEL

Controls the minimum severity level emitted by the logger. Levels follow the standard hierarchy: `debug < info < warn < error`.

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Minimum log level | `info` |

### Allowed values per environment

| Environment | Allowed values | Notes |
|-------------|---------------|-------|
| development | `debug`, `info`, `warn`, `error` | All levels permitted |
| test | `debug`, `info`, `warn`, `error` | All levels permitted |
| staging | `info`, `warn`, `error` | `debug` rejected at startup |
| production | `info`, `warn`, `error` | `debug` rejected at startup |

Invalid values (anything outside `debug | info | warn | error`) are rejected at startup in all environments.

### Behavior

- `logger.debug(...)` emits only when `LOG_LEVEL=debug`.
- `logger.info(...)` emits when `LOG_LEVEL` is `debug` or `info`.
- `logger.warn(...)` emits when `LOG_LEVEL` is `debug`, `info`, or `warn`.
- `logger.error(...)` always emits regardless of `LOG_LEVEL`.

### Failure modes

| Symptom | Likely cause |
|---------|-------------|
| Startup error: `LOG_LEVEL=debug is not permitted in production` | `debug` set in staging/production |
| Startup error: `Invalid LOG_LEVEL` | Value outside allowed set |
| No `info` logs visible | `LOG_LEVEL=warn` or `LOG_LEVEL=error` is set |
