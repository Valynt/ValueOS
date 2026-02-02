# Retry and Circuit Breaker Strategy

## Overview

ValueOS implements retry logic and circuit breaker patterns to handle flaky operations gracefully, preventing cascading failures and improving system resilience.

## Components

### 1. Build Script with Retry (`scripts/build-with-retry.sh`)

**Purpose**: Wraps `pnpm build` or Docker-based hermetic builds with retry and circuit breaker logic to handle transient build failures.

**Configuration**:

- `RETRY_COUNT`: Number of retry attempts (default: 3)
- `RETRY_DELAY`: Delay between retries in seconds (default: 15)
- `CIRCUIT_BREAKER_THRESHOLD`: Number of consecutive failures before circuit breaker triggers (default: 2)
- `USE_DOCKER`: Whether to use Docker hermetic builds (default: false)

**Usage**:

```bash
# Default local build with retry
pnpm run build:retry

# Docker hermetic build with retry
USE_DOCKER=true pnpm run build:retry

# Custom configuration
RETRY_COUNT=5 RETRY_DELAY=10 CIRCUIT_BREAKER_THRESHOLD=3 pnpm run build:retry
```

### 1.1 Hermetic Docker Builds (`scripts/build-docker.sh`)

**Purpose**: Runs builds inside Docker containers for environment consistency using Docker BuildKit for faster, parallel builds.

**Features**:

- **Hermetic builds**: Same source produces identical artifacts across environments
- **BuildKit optimization**: Parallel builds with cache mounts for pnpm, node_modules, and Turbo cache
- **Multi-stage builds**: Separate stages for dependencies, building, and artifact export
- **Cache efficiency**: Persistent caches for dependencies and build outputs

**Usage**:

```bash
# Run hermetic build
pnpm run build:docker

# Custom output directory
OUTPUT_DIR=./custom-dist pnpm run build:docker

# Custom Docker image tag
IMAGE_TAG=my-build:latest pnpm run build:docker
```

### 2. Database Migration Resilience (`infra/scripts/apply_migrations.sh`)

**Purpose**: Applies database migrations with retry logic for all database operations.

**Configuration**:

- `DB_RETRY_COUNT`: Retries for database connections (default: 5)
- `DB_RETRY_DELAY`: Delay between connection retries (default: 2)
- `MIGRATION_RETRY_COUNT`: Retries for applying migration files (default: 3)
- `MIGRATION_RETRY_DELAY`: Delay between migration retries (default: 5)
- `MIGRATION_TRACKING_RETRY_COUNT`: Retries for tracking applied migrations (default: 3)
- `MIGRATION_TRACKING_RETRY_DELAY`: Delay between tracking retries (default: 2)

**Usage**:

```bash
# Default configuration
pnpm run db:sync

# Custom configuration for slower databases
DB_RETRY_COUNT=10 DB_RETRY_DELAY=5 pnpm run db:sync

# Help
pnpm run db:sync -- --help
```

## Design Decisions

### Retry Limits

- **Build retries (3)**: Builds can fail due to network issues, dependency conflicts, or temporary resource constraints
- **Database connections (5)**: Database startup and connection issues are common in containerized environments
- **Migration application (3)**: Migration files should be idempotent, but network issues can interrupt execution
- **Migration tracking (3)**: Recording applied migrations is critical for state consistency

### Circuit Breaker Thresholds

- **Build circuit breaker (2)**: If builds fail consistently, likely indicates a code issue rather than transient problem
- **Migration circuit breaker**: Not implemented for migrations as they use simple retry logic

### Delay Values

- **Build delay (15s)**: Allows time for dependency resolution and cache invalidation
- **Database delays (2-5s)**: Balances responsiveness with allowing service startup time

## Monitoring and Alerting

### Circuit Breaker Events

When circuit breakers trigger, they should be logged and potentially trigger alerts:

```bash
# Example: Log circuit breaker events
echo "Circuit breaker triggered for build after 2 failures" | tee -a /var/log/valueos/circuit_breaker.log
```

### Integration with Monitoring Tools

- **Sentry**: Capture circuit breaker exceptions
- **Datadog**: Custom metrics for retry attempts and circuit breaker triggers
- **Prometheus**: Expose retry counters and circuit breaker states

## CI/CD Integration

### Pipeline Configuration

```yaml
# Example GitHub Actions
- name: Build with retry
  run: |
    RETRY_COUNT=5 CIRCUIT_BREAKER_THRESHOLD=3 pnpm run build:retry
  env:
    RETRY_COUNT: 5
    CIRCUIT_BREAKER_THRESHOLD: 3

- name: Run migrations with retry
  run: |
    DB_RETRY_COUNT=10 pnpm run db:sync
```

### Notifications

```yaml
# Example: Slack notification on circuit breaker
- name: Notify on build failure
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"Build circuit breaker triggered in CI"}' \
      $SLACK_WEBHOOK_URL
```

## Testing Failure Scenarios

### Unit Tests

```bash
# Test retry logic
npm test -- --grep "retry"

# Test circuit breaker
npm test -- --grep "circuit breaker"
```

### Integration Tests

- Simulate database downtime during migrations
- Network interruption during builds
- Dependency unavailability scenarios

## Environment-Specific Configuration

### Development

```bash
# More aggressive retries for development
export RETRY_COUNT=5
export DB_RETRY_COUNT=10
```

### Staging

```bash
# Balanced configuration
export RETRY_COUNT=3
export CIRCUIT_BREAKER_THRESHOLD=2
```

### Production

```bash
# Conservative configuration
export RETRY_COUNT=2
export CIRCUIT_BREAKER_THRESHOLD=1
```

## Troubleshooting

### Common Issues

1. **Circuit breaker triggers too frequently**
   - Check underlying service health
   - Review retry thresholds
   - Monitor resource utilization

2. **Retries exhaust without success**
   - Increase retry counts or delays
   - Investigate root cause of failures
   - Consider circuit breaker threshold adjustments

3. **Performance impact**
   - Monitor retry delays in production
   - Adjust delays based on service response times
   - Consider exponential backoff for long-running operations

### Debugging

```bash
# Enable verbose logging
DEBUG=1 RETRY_COUNT=1 pnpm run build:retry

# Test specific retry scenarios
RETRY_COUNT=0 pnpm run build:retry  # Test immediate failure
```

## Future Enhancements

- Exponential backoff for delays
- Jitter to prevent thundering herd
- Metrics collection for retry patterns
- Dynamic threshold adjustment based on system load
- Integration with service mesh circuit breakers
