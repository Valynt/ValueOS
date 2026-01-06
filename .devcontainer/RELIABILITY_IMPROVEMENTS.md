# Dev Container Reliability Improvements

## Overview

This document provides recommendations to improve the reliability, resilience, and operational stability of the ValueOS dev container environment. These improvements complement the security enhancements and focus on ensuring consistent, predictable development experiences.

---

## 1. Resource Management

### Current State
- ❌ No CPU limits configured (`CpuShares: 0`, `NanoCpus: 0`)
- ❌ No memory limits configured (`Memory: 0`)
- ❌ No PID limits configured (`PidsLimit: null`)
- ⚠️ Container using 1.5GB / 7.6GB memory (20%)
- ⚠️ No swap configured (`MemorySwap: 0`)

### Issues
- Unlimited resource usage can cause host system instability
- No protection against memory leaks or runaway processes
- Difficult to predict performance characteristics
- No resource isolation between containers

### Recommendations

**Priority: HIGH**

#### 1.1 Add Resource Limits to devcontainer.json

```json
{
  "runArgs": [
    "--name=valuecanvas-dev-optimized",
    "--shm-size=2gb",
    // CPU limits (4 cores max, 2 cores guaranteed)
    "--cpus=4",
    "--cpu-shares=2048",
    // Memory limits (6GB max, 4GB guaranteed)
    "--memory=6g",
    "--memory-reservation=4g",
    "--memory-swap=8g",
    // PID limits (prevent fork bombs)
    "--pids-limit=4096",
    // OOM handling
    "--oom-kill-disable=false",
    "--oom-score-adj=500",
    // Labels
    "--label=project=valuecanvas",
    "--label=environment=development"
  ]
}
```

#### 1.2 Add Resource Monitoring Script

Create `.devcontainer/scripts/monitor-resources.sh`:

```bash
#!/bin/bash
# Monitor container resource usage and alert on thresholds

CONTAINER_NAME="valuecanvas-dev-optimized"
CPU_THRESHOLD=80
MEM_THRESHOLD=85

while true; do
    stats=$(docker stats $CONTAINER_NAME --no-stream --format "{{.CPUPerc}},{{.MemPerc}}")
    cpu=$(echo $stats | cut -d',' -f1 | sed 's/%//')
    mem=$(echo $stats | cut -d',' -f2 | sed 's/%//')
    
    if (( $(echo "$cpu > $CPU_THRESHOLD" | bc -l) )); then
        echo "⚠️  WARNING: CPU usage at ${cpu}% (threshold: ${CPU_THRESHOLD}%)"
    fi
    
    if (( $(echo "$mem > $MEM_THRESHOLD" | bc -l) )); then
        echo "⚠️  WARNING: Memory usage at ${mem}% (threshold: ${MEM_THRESHOLD}%)"
    fi
    
    sleep 60
done
```

**Trade-offs:**
- Limits may need adjustment based on workload
- May impact performance for resource-intensive tasks
- Requires monitoring to tune appropriately

---

## 2. Health Checks and Monitoring

### Current State
- ✅ Basic healthcheck.sh script exists
- ❌ No Docker HEALTHCHECK directive
- ❌ No service-level health checks
- ❌ No automated recovery mechanisms
- ❌ No performance metrics collection

### Issues
- Cannot detect container degradation automatically
- No visibility into service health
- Manual intervention required for failures
- No historical performance data

### Recommendations

**Priority: HIGH**

#### 2.1 Add Docker HEALTHCHECK to Dockerfile

```dockerfile
# Add to Dockerfile.optimized after CMD
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/healthcheck || exit 1
```

#### 2.2 Enhance healthcheck.sh Script

```bash
#!/bin/bash
###############################################################################
# Enhanced Dev Container Health Check
###############################################################################

set -e

EXIT_SUCCESS=0
EXIT_FAILURE=1
EXIT_WARNING=2

# Check critical services
check_node() {
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found"
        return $EXIT_FAILURE
    fi
    
    node_version=$(node --version)
    echo "✓ Node.js: $node_version"
    return $EXIT_SUCCESS
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "⚠️  Docker CLI not found"
        return $EXIT_WARNING
    fi
    
    if ! docker ps &> /dev/null; then
        echo "❌ Docker daemon not accessible"
        return $EXIT_FAILURE
    fi
    
    echo "✓ Docker: accessible"
    return $EXIT_SUCCESS
}

check_disk_space() {
    usage=$(df /workspace | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 90 ]; then
        echo "❌ Disk usage critical: ${usage}%"
        return $EXIT_FAILURE
    elif [ "$usage" -gt 80 ]; then
        echo "⚠️  Disk usage high: ${usage}%"
        return $EXIT_WARNING
    fi
    
    echo "✓ Disk space: ${usage}% used"
    return $EXIT_SUCCESS
}

check_memory() {
    mem_available=$(free | grep Mem | awk '{print int($7/$2 * 100)}')
    if [ "$mem_available" -lt 10 ]; then
        echo "❌ Memory critical: ${mem_available}% available"
        return $EXIT_FAILURE
    elif [ "$mem_available" -lt 20 ]; then
        echo "⚠️  Memory low: ${mem_available}% available"
        return $EXIT_WARNING
    fi
    
    echo "✓ Memory: ${mem_available}% available"
    return $EXIT_SUCCESS
}

# Run all checks
exit_code=$EXIT_SUCCESS

check_node || exit_code=$?
check_docker || [ $? -eq $EXIT_WARNING ] && exit_code=$EXIT_WARNING
check_disk_space || exit_code=$?
check_memory || exit_code=$?

if [ $exit_code -eq $EXIT_SUCCESS ]; then
    echo "✅ All health checks passed"
elif [ $exit_code -eq $EXIT_WARNING ]; then
    echo "⚠️  Health check completed with warnings"
fi

exit $exit_code
```

#### 2.3 Add Service Health Monitoring

Create `.devcontainer/scripts/check-services.sh`:

```bash
#!/bin/bash
# Check health of development services

check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-5}
    
    if curl -sf --max-time $timeout "$url" > /dev/null 2>&1; then
        echo "✓ $name: healthy"
        return 0
    else
        echo "❌ $name: unhealthy"
        return 1
    fi
}

# Check services defined in devcontainer.json
check_service "Frontend" "http://localhost:3000" 5
check_service "Backend API" "http://localhost:8000/health" 5
check_service "PostgreSQL" "http://localhost:5432" 2
check_service "Supabase Studio" "http://localhost:54323" 5
```

**Trade-offs:**
- Health checks add overhead
- May cause false positives during startup
- Requires tuning intervals and thresholds

---

## 3. Backup and Recovery

### Current State
- ❌ No automated backup strategy
- ❌ No database backup configuration
- ❌ No configuration backup
- ⚠️ Data in Docker volumes (persistent but not backed up)

### Issues
- Risk of data loss on volume corruption
- No point-in-time recovery
- Manual recovery process
- No disaster recovery plan

### Recommendations

**Priority: MEDIUM**

#### 3.1 Add Automated Backup Script

Create `.devcontainer/scripts/backup.sh`:

```bash
#!/bin/bash
###############################################################################
# Automated Backup Script for Dev Container
###############################################################################

set -e

BACKUP_DIR="${HOME}/.devcontainer-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL database
backup_database() {
    echo "Backing up PostgreSQL database..."
    
    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
        echo "✓ Database backup: db_${TIMESTAMP}.sql.gz"
    else
        echo "⚠️  DATABASE_URL not set, skipping database backup"
    fi
}

# Backup Docker volumes
backup_volumes() {
    echo "Backing up Docker volumes..."
    
    volumes=(
        "valuecanvas-node-modules"
        "valuecanvas-npm-cache"
        "valuecanvas-build-cache"
    )
    
    for volume in "${volumes[@]}"; do
        if docker volume inspect "$volume" &> /dev/null; then
            docker run --rm \
                -v "$volume:/data" \
                -v "$BACKUP_DIR:/backup" \
                alpine tar czf "/backup/${volume}_${TIMESTAMP}.tar.gz" -C /data .
            echo "✓ Volume backup: ${volume}_${TIMESTAMP}.tar.gz"
        fi
    done
}

# Backup configuration files
backup_config() {
    echo "Backing up configuration files..."
    
    config_files=(
        ".env"
        ".devcontainer/devcontainer.json"
        "package.json"
        "package-lock.json"
        "tsconfig.json"
    )
    
    tar czf "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz" \
        -C /workspace \
        "${config_files[@]}" 2>/dev/null || true
    
    echo "✓ Config backup: config_${TIMESTAMP}.tar.gz"
}

# Clean old backups
cleanup_old_backups() {
    echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
    find "$BACKUP_DIR" -type f -mtime +${RETENTION_DAYS} -delete
    echo "✓ Cleanup complete"
}

# Run backups
backup_database
backup_volumes
backup_config
cleanup_old_backups

echo "✅ Backup completed: $BACKUP_DIR"
```

#### 3.2 Add Backup Automation to postStartCommand

Update `.devcontainer/devcontainer.json`:

```json
{
  "postStartCommand": "bash .devcontainer/scripts/post-start.sh && bash .devcontainer/scripts/backup.sh &"
}
```

#### 3.3 Add Recovery Script

Create `.devcontainer/scripts/restore.sh`:

```bash
#!/bin/bash
###############################################################################
# Restore from Backup
###############################################################################

set -e

BACKUP_DIR="${HOME}/.devcontainer-backups"

list_backups() {
    echo "Available backups:"
    ls -lh "$BACKUP_DIR" | grep -E "\.sql\.gz|\.tar\.gz"
}

restore_database() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        echo "❌ Backup file not found: $backup_file"
        exit 1
    fi
    
    echo "Restoring database from $backup_file..."
    gunzip -c "$backup_file" | psql "$DATABASE_URL"
    echo "✓ Database restored"
}

restore_volume() {
    local backup_file=$1
    local volume_name=$2
    
    if [ ! -f "$backup_file" ]; then
        echo "❌ Backup file not found: $backup_file"
        exit 1
    fi
    
    echo "Restoring volume $volume_name from $backup_file..."
    docker run --rm \
        -v "$volume_name:/data" \
        -v "$BACKUP_DIR:/backup" \
        alpine sh -c "cd /data && tar xzf /backup/$(basename $backup_file)"
    echo "✓ Volume restored"
}

# Show usage
if [ $# -eq 0 ]; then
    list_backups
    echo ""
    echo "Usage:"
    echo "  $0 database <backup_file>"
    echo "  $0 volume <backup_file> <volume_name>"
    exit 0
fi

case "$1" in
    database)
        restore_database "$2"
        ;;
    volume)
        restore_volume "$2" "$3"
        ;;
    *)
        echo "Unknown command: $1"
        exit 1
        ;;
esac
```

**Trade-offs:**
- Backups consume disk space
- Backup process may impact performance
- Requires regular testing of restore procedures

---

## 4. Error Handling and Recovery

### Current State
- ❌ No automatic restart policies
- ❌ No graceful degradation
- ❌ No circuit breakers for external services
- ⚠️ Basic error logging only

### Issues
- Manual intervention required for failures
- No resilience to transient errors
- Cascading failures possible
- Poor error visibility

### Recommendations

**Priority: MEDIUM**

#### 4.1 Add Restart Policy

Update `.devcontainer/devcontainer.json`:

```json
{
  "runArgs": [
    "--name=valuecanvas-dev-optimized",
    "--restart=unless-stopped",
    // ... other args
  ]
}
```

#### 4.2 Add Service Retry Logic

Create `.devcontainer/scripts/start-with-retry.sh`:

```bash
#!/bin/bash
# Start services with retry logic

MAX_RETRIES=3
RETRY_DELAY=5

start_service() {
    local service=$1
    local command=$2
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        echo "Starting $service (attempt $((retries + 1))/$MAX_RETRIES)..."
        
        if eval "$command"; then
            echo "✓ $service started successfully"
            return 0
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            echo "⚠️  $service failed, retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done
    
    echo "❌ $service failed after $MAX_RETRIES attempts"
    return 1
}

# Example usage
start_service "PostgreSQL" "docker-compose up -d postgres"
start_service "Redis" "docker-compose up -d redis"
```

#### 4.3 Add Error Logging

Create `.devcontainer/scripts/log-error.sh`:

```bash
#!/bin/bash
# Centralized error logging

LOG_DIR="${HOME}/.devcontainer-logs"
LOG_FILE="${LOG_DIR}/errors.log"

mkdir -p "$LOG_DIR"

log_error() {
    local timestamp=$(date -Iseconds)
    local message="$1"
    local context="${2:-unknown}"
    
    echo "[$timestamp] [$context] ERROR: $message" | tee -a "$LOG_FILE"
    
    # Rotate logs if too large (>10MB)
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt 10485760 ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        gzip "${LOG_FILE}.old"
    fi
}

# Usage: log_error "message" "context"
log_error "$@"
```

**Trade-offs:**
- Automatic restarts may mask underlying issues
- Retry logic adds complexity
- Logs require rotation and management

---

## 5. Performance Optimization

### Current State
- ✅ Volume caching for node_modules, npm cache, build artifacts
- ✅ Shared memory configured (2GB)
- ⚠️ No build caching optimization
- ⚠️ No layer caching strategy

### Issues
- Slow rebuild times
- Inefficient layer caching
- No build artifact reuse

### Recommendations

**Priority: LOW**

#### 5.1 Optimize Dockerfile Layer Caching

Update `Dockerfile.optimized`:

```dockerfile
# Install dependencies first (changes less frequently)
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code (changes more frequently)
COPY . .

# Build application
RUN npm run build
```

#### 5.2 Add BuildKit Cache Mounts

```dockerfile
# Use BuildKit cache mounts for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

RUN --mount=type=cache,target=/workspace/.cache \
    npm run build
```

#### 5.3 Enable Docker BuildKit

Update `.devcontainer/devcontainer.json`:

```json
{
  "containerEnv": {
    "DOCKER_BUILDKIT": "1",
    "COMPOSE_DOCKER_CLI_BUILD": "1",
    "BUILDKIT_PROGRESS": "plain"
  }
}
```

**Trade-offs:**
- BuildKit requires Docker 18.09+
- Cache mounts require understanding of build process
- May increase disk usage

---

## 6. Observability and Debugging

### Current State
- ❌ No structured logging
- ❌ No metrics collection
- ❌ No distributed tracing
- ⚠️ Basic console logging only

### Issues
- Difficult to diagnose issues
- No performance insights
- No historical data
- Poor debugging experience

### Recommendations

**Priority: LOW**

#### 6.1 Add Structured Logging

Create `.devcontainer/scripts/logger.sh`:

```bash
#!/bin/bash
# Structured logging utility

LOG_LEVEL=${LOG_LEVEL:-INFO}
LOG_FORMAT=${LOG_FORMAT:-json}

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date -Iseconds)
    
    if [ "$LOG_FORMAT" = "json" ]; then
        echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"message\":\"$message\"}"
    else
        echo "[$timestamp] [$level] $message"
    fi
}

log_debug() { [ "$LOG_LEVEL" = "DEBUG" ] && log "DEBUG" "$@"; }
log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
```

#### 6.2 Add Performance Metrics Collection

Create `.devcontainer/scripts/collect-metrics.sh`:

```bash
#!/bin/bash
# Collect performance metrics

METRICS_DIR="${HOME}/.devcontainer-metrics"
METRICS_FILE="${METRICS_DIR}/metrics_$(date +%Y%m%d).jsonl"

mkdir -p "$METRICS_DIR"

collect_metrics() {
    local timestamp=$(date -Iseconds)
    
    # Container stats
    stats=$(docker stats valuecanvas-dev-optimized --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}")
    
    # System stats
    load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    
    # Disk stats
    disk=$(df /workspace | tail -1 | awk '{print $5}' | sed 's/%//')
    
    # Output as JSON
    echo "{\"timestamp\":\"$timestamp\",\"cpu\":\"$(echo $stats | cut -d',' -f1)\",\"memory\":\"$(echo $stats | cut -d',' -f2)\",\"load\":\"$load\",\"disk\":\"$disk\"}" >> "$METRICS_FILE"
}

# Run continuously
while true; do
    collect_metrics
    sleep 60
done
```

**Trade-offs:**
- Metrics collection adds overhead
- Requires storage and analysis tools
- May need aggregation for large datasets

---

## 7. High Availability Considerations

### Current State
- ❌ Single container instance
- ❌ No load balancing
- ❌ No failover mechanism
- ⚠️ Development environment only

### Issues
- Single point of failure
- No redundancy
- Downtime during updates

### Recommendations

**Priority: LOW** (Development environment)

#### 7.1 Document Production HA Strategy

Create `.devcontainer/HA_STRATEGY.md`:

```markdown
# High Availability Strategy

## Development Environment
- Single container instance (acceptable for dev)
- Manual recovery procedures
- Regular backups

## Production Environment
- Multi-instance deployment
- Load balancer (nginx/HAProxy)
- Database replication
- Health checks and auto-recovery
- Blue-green deployments
```

#### 7.2 Add Multi-Instance Support (Optional)

For testing HA scenarios:

```yaml
# docker-compose.ha.yml
version: '3.8'

services:
  app1:
    build: .devcontainer
    container_name: valuecanvas-dev-1
    # ... config
    
  app2:
    build: .devcontainer
    container_name: valuecanvas-dev-2
    # ... config
    
  loadbalancer:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app1
      - app2
```

**Trade-offs:**
- Adds complexity for development
- Resource intensive
- May not reflect production architecture

---

## 8. Testing and Validation

### Current State
- ⚠️ Basic healthcheck script
- ❌ No automated testing of container setup
- ❌ No validation of lifecycle scripts
- ❌ No integration tests

### Issues
- Cannot verify container reliability
- Manual testing required
- No regression detection

### Recommendations

**Priority: MEDIUM**

#### 8.1 Add Container Validation Tests

Create `.devcontainer/scripts/validate-container.sh`:

```bash
#!/bin/bash
###############################################################################
# Container Validation Tests
###############################################################################

set -e

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "Running: $test_name"
    
    if eval "$test_command" &> /dev/null; then
        echo "  ✓ PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  ❌ FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test suite
run_test "Node.js installed" "command -v node"
run_test "npm installed" "command -v npm"
run_test "Docker CLI installed" "command -v docker"
run_test "Docker daemon accessible" "docker ps"
run_test "Git installed" "command -v git"
run_test "PostgreSQL client installed" "command -v psql"
run_test "Trivy installed" "command -v trivy"
run_test "TruffleHog installed" "command -v trufflehog"
run_test "kubectl installed" "command -v kubectl"
run_test "Helm installed" "command -v helm"
run_test "Terraform installed" "command -v terraform"
run_test "Workspace directory exists" "test -d /workspace"
run_test "Volume mounts working" "test -d /workspace/node_modules"
run_test "Environment variables set" "test -n \$NODE_ENV"
run_test "User is vscode" "test \$(whoami) = 'vscode'"
run_test "Docker group membership" "groups | grep -q docker"

# Summary
echo ""
echo "========================================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo "========================================="

if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi

echo "✅ All validation tests passed"
exit 0
```

#### 8.2 Add to onCreate Command

Update `.devcontainer/devcontainer.json`:

```json
{
  "onCreateCommand": "bash .devcontainer/scripts/on-create.sh && bash .devcontainer/scripts/validate-container.sh"
}
```

**Trade-offs:**
- Adds time to container creation
- May fail on edge cases
- Requires maintenance as tools change

---

## Implementation Roadmap

### Phase 1: Critical Reliability (Week 1)
1. Add resource limits (CPU, memory, PID)
2. Implement enhanced health checks
3. Add Docker HEALTHCHECK directive
4. Create validation test suite

### Phase 2: Operational Resilience (Week 2)
1. Implement backup automation
2. Add restore procedures
3. Create error logging system
4. Add service retry logic

### Phase 3: Performance and Monitoring (Week 3)
1. Optimize Dockerfile layer caching
2. Enable BuildKit cache mounts
3. Add metrics collection
4. Implement structured logging

### Phase 4: Documentation and Testing (Week 4)
1. Document HA strategy
2. Create runbooks for common issues
3. Add integration tests
4. Conduct disaster recovery drill

---

## Monitoring and Maintenance

### Daily
- Review error logs
- Check resource usage
- Verify backup completion

### Weekly
- Test restore procedures
- Review metrics trends
- Update dependencies

### Monthly
- Conduct disaster recovery drill
- Review and update documentation
- Optimize resource limits based on usage

---

## Success Metrics

### Reliability
- Container uptime > 99.9%
- Mean time to recovery (MTTR) < 5 minutes
- Zero data loss incidents

### Performance
- Container start time < 2 minutes
- Build time < 5 minutes
- Resource usage within limits

### Operational
- Backup success rate > 99%
- Health check pass rate > 95%
- Automated recovery success rate > 90%

---

## Related Documents

- [SECURITY_IMPROVEMENTS.md](.devcontainer/SECURITY_IMPROVEMENTS.md) - Security enhancements
- [devcontainer.json](.devcontainer/devcontainer.json) - Container configuration
- [Dockerfile.optimized](.devcontainer/Dockerfile.optimized) - Container image definition

---

**Last Updated:** 2026-01-04
**Version:** 1.0.0
**Status:** Draft
