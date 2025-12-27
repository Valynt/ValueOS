# Observability Stack Dependencies

## Required Dependencies

Install the following packages for full observability support:

```bash
npm install --save @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-prometheus \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/sdk-metrics \
  @opentelemetry/api \
  winston
```

## Development Dependencies

For testing:

```bash
npm install --save-dev vitest \
  @vitest/ui \
  axios
```

## Package Versions

Ensure you're using compatible versions:

- `@opentelemetry/sdk-node`: ^0.45.0 or later
- `@opentelemetry/auto-instrumentations-node`: ^0.40.0 or later
- `@opentelemetry/exporter-trace-otlp-http`: ^0.45.0 or later
- `@opentelemetry/exporter-prometheus`: ^0.45.0 or later
- `winston`: ^3.11.0 or later
- `vitest`: ^1.0.0 or later
- `axios`: ^1.6.0 or later

## Additional Integrations

### For Express.js

Already included in `auto-instrumentations-node`.

### For Loki Transport (Production)

```bash
npm install winston-loki
```

### For Database Instrumentation

Specific database instrumentations (optional):

```bash
# PostgreSQL
npm install @opentelemetry/instrumentation-pg

# MongoDB
npm install @opentelemetry/instrumentation-mongodb

# Redis
npm install @opentelemetry/instrumentation-redis
```

## Verification

After installing, verify with:

```bash
npm list @opentelemetry/sdk-node
npm list winston
```

## Notes

- All OpenTelemetry packages should use the same version to avoid compatibility issues
- The `auto-instrumentations-node` package includes instrumentation for common libraries (HTTP, Express, etc.)
- Winston is used for structured logging with trace context injection
