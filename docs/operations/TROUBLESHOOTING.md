# LGTM Observability Stack - Troubleshooting Guide

## 🔍 Common Issues & Solutions

### Services Won't Start

#### Problem: Docker Compose fails to start services

**Symptoms:**

```
Error response from daemon: Ports are not available
```

**Solutions:**

1. **Check if ports are already in use:**

```bash
# Check all required ports
lsof -i :3000  # Grafana
lsof -i :3100  # Loki
lsof -i :3200  # Tempo
lsof -i :4317  # Tempo OTLP gRPC
lsof -i :4318  # Tempo OTLP HTTP
lsof -i :9090  # Prometheus
```

2. **Kill conflicting processes:**

```bash
# Replace PID with the actual process ID from lsof
kill -9 <PID>
```

3. **Use different ports:**
   Edit `infra/docker/docker-compose.observability.yml` and change port mappings:

```yaml
ports:
  - "3001:3000" # Map to different external port
```

#### Problem: Services start but aren't healthy

**Symptoms:**

```
Health check failed
```

**Solutions:**

1. **Increase startup wait time:**

```bash
# Wait longer for services to initialize
docker compose -f infra/docker/docker-compose.observability.yml up -d
sleep 60
```

2. **Check service logs:**

```bash
make -f Makefile.observability obs-logs-loki
make -f Makefile.observability obs-logs-tempo
make -f Makefile.observability obs-logs-prometheus
make -f Makefile.observability obs-logs-grafana
```

3. **Verify Docker has enough resources:**

```bash
docker stats
```

Ensure at least 4GB RAM is available.

---

### Loki Issues

#### Problem: Logs not appearing in Loki

**Symptoms:**

- Push request succeeds but query returns no results
- Logs don't show up in Grafana

**Solutions:**

1. **Check Loki ingestion:**

```bash
# Check Loki logs for errors
docker compose -f infra/docker/docker-compose.observability.yml logs loki

# Verify Loki is receiving data
curl http://localhost:3100/metrics | grep loki_ingester_
```

2. **Wait for indexing:**
   Loki indexes logs asynchronously. Wait 5-10 seconds after pushing logs.

3. **Verify label format:**
   Labels must be valid:

```typescript
// ✅ Good
{ job: "my-app", level: "info" }

// ❌ Bad (contains special characters)
{ "my-job": "app/service", "level.type": "info" }
```

4. **Check time range:**
   Ensure query time range includes when logs were pushed:

```typescript
const start = new Date(Date.now() - 3600000); // 1 hour ago
await lokiClient.query('{job="test"}', start);
```

#### Problem: "too many outstanding requests"

**Symptoms:**

```
429 Too Many Requests
```

**Solution:**
Increase ingestion limits in `observability/loki/loki-config.yaml`:

```yaml
limits_config:
  ingestion_rate_mb: 20 # Increase from 10
  ingestion_burst_size_mb: 40 # Increase from 20
```

Restart Loki:

```bash
docker compose -f infra/docker/docker-compose.observability.yml restart loki
```

---

### Tempo Issues

#### Problem: Traces not appearing in Tempo

**Symptoms:**

- Traces sent but not queryable
- 404 when searching for trace ID

**Solutions:**

1. **Verify OTLP endpoint:**
   Ensure you're sending to the correct endpoint:

```typescript
// ✅ Correct
url: "http://localhost:4318/v1/traces"; // HTTP
url: "http://localhost:4317"; // gRPC

// ❌ Wrong
url: "http://localhost:3200/v1/traces"; // Wrong port
```

2. **Wait for trace processing:**
   Tempo has eventual consistency. Wait 10-20 seconds:

```typescript
await tempoClient.waitForTrace(traceId, 20000);
```

3. **Check trace format:**
   Ensure you're using OTLP format correctly:

```bash
# Check Tempo logs for parsing errors
docker compose -f infra/docker/docker-compose.observability.yml logs tempo | grep error
```

4. **Force flush:**
   Ensure spans are flushed:

```typescript
await tracerProvider.forceFlush();
```

#### Problem: "trace not found" after long wait

**Symptoms:**

- Trace was sent but never appears
- No errors in logs

**Solution:**
Check Tempo storage:

```bash
# Verify traces are being written
docker exec valueos-tempo ls -la /tmp/tempo/blocks/

# Check ingestion metrics
curl http://localhost:3200/metrics | grep tempo_ingester_
```

---

### Prometheus Issues

#### Problem: Metrics not being scraped

**Symptoms:**

- Targets show as "down" in Prometheus
- No metrics available for application

**Solutions:**

1. **Verify target configuration:**

```bash
# Check targets in Prometheus UI
open http://localhost:9090/targets
```

2. **Check application metrics endpoint:**

```bash
# Ensure your app is exposing metrics
curl http://localhost:8080/metrics
```

3. **Update scrape config:**
   If running app in Docker, use `host.docker.internal`:

```yaml
# observability/prometheus/prometheus.yml
scrape_configs:
  - job_name: "valueos-app"
    static_configs:
      - targets: ["host.docker.internal:8080"]
```

4. **Check firewall:**
   Ensure Docker containers can reach your application:

```bash
# Test from inside Prometheus container
docker exec valueos-prometheus wget -O- http://host.docker.internal:8080/metrics
```

#### Problem: High cardinality warning

**Symptoms:**

```
Prometheus has too many time series
```

**Solution:**
Reduce label cardinality:

```typescript
// ❌ Bad (high cardinality)
Metrics.httpRequestsTotal.add(1, {
  user_id: userId, // Don't use unique IDs!
  request_id: requestId,
});

// ✅ Good (low cardinality)
Metrics.httpRequestsTotal.add(1, {
  method: "GET",
  status: "200",
  route: "/api/users",
});
```

---

### Grafana Issues

#### Problem: Datasources not provisioned

**Symptoms:**

- Datasources don't appear in Grafana
- "No datasources found"

**Solutions:**

1. **Verify provisioning file:**

```bash
# Check if file exists and is mounted correctly
docker exec valueos-grafana cat /etc/grafana/provisioning/datasources/datasources.yml
```

2. **Check Grafana logs:**

```bash
make -f Makefile.observability obs-logs-grafana | grep provision
```

3. **Manually add datasource:**
   - Go to Configuration → Data Sources
   - Add data source manually
   - Use container names: `http://loki:3100`, `http://tempo:3200`, `http://prometheus:9090`

#### Problem: "Origin not allowed"

**Symptoms:**

```
CORS error when accessing Grafana
```

**Solution:**
Add allowed origins in `infra/docker/docker-compose.observability.yml`:

```yaml
environment:
  - GF_SERVER_ROOT_URL=http://localhost:3000
  - GF_SECURITY_ALLOW_EMBEDDING=true
```

---

### Test Issues

#### Problem: Tests fail with "connection refused"

**Symptoms:**

```
Error: connect ECONNREFUSED 127.0.0.1:3100
```

**Solutions:**

1. **Ensure stack is running:**

```bash
make -f Makefile.observability obs-status
```

2. **Wait for services to be ready:**

```bash
make -f Makefile.observability verify
```

3. **Check if tests use correct URLs:**
   Tests should use `localhost` not `127.0.0.1` on some systems.

#### Problem: Tests timeout

**Symptoms:**

```
Test exceeded timeout of 10000ms
```

**Solutions:**

1. **Increase test timeouts:**

```typescript
// In test file
it("should wait for trace", async () => {
  // ...
}, 30000); // Increase timeout
```

2. **Reduce wait intervals:**

```typescript
await tempoClient.waitForTrace(traceId, 20000, 1000);
//                                      ^^^^^ ^^^^
//                                      timeout  interval
```

---

### Performance Issues

#### Problem: High memory usage

**Symptoms:**

- Docker containers consuming lots of RAM
- System becomes slow

**Solutions:**

1. **Reduce retention periods:**

```yaml
# loki-config.yaml
compactor:
  retention_enabled: true
  retention_delete_delay: 2h

# tempo-config.yaml
compactor:
  compaction:
    block_retention: 24h  # Reduce from 48h
```

2. **Limit ingestion rates:**
   See Loki and Tempo sections above.

3. **Restart Docker:**

```bash
docker system prune -a
docker compose -f infra/docker/docker-compose.observability.yml restart
```

---

## 🔧 Debug Mode

Enable debug logging for more detailed information:

### Loki Debug Logs

```yaml
# loki-config.yaml
server:
  log_level: debug
```

### Tempo Debug Logs

```yaml
# tempo-config.yaml
server:
  log_level: debug
```

### Application Debug Logs

```typescript
process.env.LOG_LEVEL = "debug";
```

---

## 📊 Health Check Commands

```bash
# Quick health check all services
curl http://localhost:3100/ready && echo "Loki OK" || echo "Loki FAIL"
curl http://localhost:3200/ready && echo "Tempo OK" || echo "Tempo FAIL"
curl http://localhost:9090/-/ready && echo "Prometheus OK" || echo "Prometheus FAIL"
curl http://localhost:3000/api/health && echo "Grafana OK" || echo "Grafana FAIL"
```

---

## 🆘 Getting Help

If you're still stuck:

1. **Collect diagnostic information:**

```bash
# Service versions
docker compose -f infra/docker/docker-compose.observability.yml ps

# Resource usage
docker stats --no-stream

# Recent logs
make -f Makefile.observability obs-logs > observability-logs.txt
```

2. **Check configuration:**

```bash
# Verify all config files are valid YAML
yamllint observability/**/*.yaml
```

3. **Reset everything:**

```bash
# Nuclear option: clean start
make -f Makefile.observability clean
make -f Makefile.observability obs-up
```

4. **Open an issue** with:
   - Error messages
   - Service logs
   - Docker stats output
   - OS and Docker version

---

## 📚 Additional Resources

- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
