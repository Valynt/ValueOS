# 🚀 Quick Start: Jaeger UI & Observability Stack

## ✅ Good News: Nothing is Lost!

All your Jaeger UI work is **still there** and ready to use. It's just not running yet.

---

## 📍 What Exists

### 1. Jaeger Configuration ✅
- **Kubernetes:** `infra/k8s/observability/jaeger/jaeger-all-in-one.yaml`
- **Docker Compose:** `infra/docker-compose.observability.yml`
- **Status:** Configured and ready to start

### 2. Complete Observability Stack ✅
- **Jaeger** - Distributed tracing with UI
- **Prometheus** - Metrics collection
- **Grafana** - Visualization dashboards
- **OpenTelemetry Collector** - Trace/metric collection

### 3. Application Instrumentation ✅
- **Code:** `src/lib/telemetry.ts`
- **Status:** OpenTelemetry SDK configured and ready
- **Exports:** OTLP traces to Jaeger, Prometheus metrics

---

## 🚀 Start Jaeger UI (30 seconds)

### Option 1: Start Full Observability Stack (Recommended)

```bash
# Navigate to infra directory
cd /workspaces/ValueOS/infra

# Start all observability services
docker-compose -f docker-compose.observability.yml up -d

# Verify services are running
docker ps | grep -E "jaeger|grafana|prometheus"
```

**Access URLs:**
- **Jaeger UI:** http://localhost:16686
- **Grafana:** http://localhost:3001 (admin/admin)
- **Prometheus:** http://localhost:9090

---

### Option 2: Start Only Jaeger (Minimal)

```bash
cd /workspaces/ValueOS/infra

# Start only Jaeger
docker-compose -f docker-compose.observability.yml up -d jaeger

# Verify Jaeger is running
docker ps | grep jaeger
```

**Access:**
- **Jaeger UI:** http://localhost:16686

---

## 🔍 Verify It's Working

### 1. Check Jaeger UI
```bash
# Open in browser
http://localhost:16686

# You should see:
✅ Jaeger UI interface
✅ Service dropdown (empty initially)
✅ Search interface
```

### 2. Generate Test Traces
```bash
# Make some API requests to generate traces
curl http://localhost:5173/api/health
curl http://localhost:3000/api/agents

# Wait a few seconds, then refresh Jaeger UI
# You should see traces appear
```

### 3. Check Application is Exporting
```bash
# Check if OTLP endpoint is accessible
curl http://localhost:4318/v1/traces

# Check Prometheus metrics from app
curl http://localhost:9464/metrics
```

---

## 📊 What Each Service Does

### Jaeger (Port 16686)
- **Purpose:** Distributed tracing UI
- **Shows:** Request flows, latency, errors
- **Use for:** Debugging performance issues, understanding service dependencies

### Grafana (Port 3001)
- **Purpose:** Visualization dashboards
- **Shows:** Metrics, logs, traces in one place
- **Use for:** Monitoring, alerting, analysis

### Prometheus (Port 9090)
- **Purpose:** Metrics collection and storage
- **Shows:** Time-series metrics, queries
- **Use for:** Performance monitoring, alerting

---

## 🛠️ Troubleshooting

### Issue: "Network valuecanvas-network not found"

**Solution:**
```bash
# Create the network
docker network create valuecanvas-network

# Then start observability stack
cd /workspaces/ValueOS/infra
docker-compose -f docker-compose.observability.yml up -d
```

---

### Issue: "Port already in use"

**Solution:**
```bash
# Check what's using the port
lsof -i :16686  # Jaeger UI
lsof -i :3001   # Grafana
lsof -i :9090   # Prometheus

# Stop conflicting service or change port in docker-compose.observability.yml
```

---

### Issue: "No traces appearing in Jaeger"

**Checklist:**
1. ✅ Jaeger is running: `docker ps | grep jaeger`
2. ✅ App is configured to export: Check `src/lib/telemetry.ts`
3. ✅ OTLP endpoint is correct: Should be `http://localhost:4318`
4. ✅ Generate traffic: Make API requests
5. ✅ Wait a few seconds: Traces are batched

**Debug:**
```bash
# Check Jaeger logs
docker logs valuecanvas-jaeger

# Check if app is exporting
curl http://localhost:4318/v1/traces
```

---

## 🎯 Quick Commands Reference

```bash
# Start all observability services
docker-compose -f infra/docker-compose.observability.yml up -d

# Stop all observability services
docker-compose -f infra/docker-compose.observability.yml down

# View logs
docker-compose -f infra/docker-compose.observability.yml logs -f

# Restart a specific service
docker-compose -f infra/docker-compose.observability.yml restart jaeger

# Check status
docker-compose -f infra/docker-compose.observability.yml ps
```

---

## 📝 Add to npm Scripts (Optional)

Add these to `package.json` for easier access:

```json
{
  "scripts": {
    "observability:start": "docker-compose -f infra/docker-compose.observability.yml up -d",
    "observability:stop": "docker-compose -f infra/docker-compose.observability.yml down",
    "observability:logs": "docker-compose -f infra/docker-compose.observability.yml logs -f",
    "observability:restart": "docker-compose -f infra/docker-compose.observability.yml restart",
    "jaeger": "docker-compose -f infra/docker-compose.observability.yml up -d jaeger && echo 'Jaeger UI: http://localhost:16686'"
  }
}
```

Then use:
```bash
npm run observability:start
npm run jaeger
```

---

## 🎓 Next Steps

### 1. Configure Grafana Datasources
```bash
# Open Grafana
http://localhost:3001

# Login: admin/admin

# Add datasources:
1. Prometheus: http://prometheus:9090
2. Jaeger: http://jaeger:16686
```

### 2. Import Dashboards
- Go to Dashboards → Import
- Use dashboard ID: 13639 (Jaeger)
- Use dashboard ID: 1860 (Node Exporter)

### 3. Set Up Alerts
- Configure Prometheus alert rules
- Set up Grafana notifications (Slack, email)

---

## 📚 Documentation

**Full Documentation:**
- `infra/k8s/observability/README.md` - Complete observability guide
- `OBSERVABILITY_REVIEW.md` - Detailed review of the stack
- `OBSERVABILITY_REALITY_CHECK.md` - Current status

**OpenTelemetry:**
- `src/lib/telemetry.ts` - Application instrumentation
- `src/config/telemetry.ts` - Configuration

---

## ✅ Summary

**Your Jaeger work is NOT lost!** It's all there and ready to use.

**To start right now:**
```bash
cd /workspaces/ValueOS/infra
docker-compose -f docker-compose.observability.yml up -d
```

**Then open:** http://localhost:16686

**That's it!** 🎉

---

**Created:** 2026-01-06
**Status:** ✅ Ready to Start
**Time to Launch:** 30 seconds
