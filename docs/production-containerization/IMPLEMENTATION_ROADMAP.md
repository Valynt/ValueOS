# Production Containerization Implementation Roadmap

**Objective:** Transition from monolithic development container to granular, agent-based production environment with zero-trust posture and pragmatic reproducibility.

**Last Updated:** 2026-02-08
**Status:** Implementation Complete

---

## Executive Summary

This roadmap outlines the strategy for containerizing ValueOS agents and services following the "Pragmatic Reproducibility" approach. The goal is to ensure development containers are identical to production, enabling "Build Once, Promote Anywhere" CI/CD workflows.

### Key Principles

1. **Multi-Stage Build-Once Architecture** - Separate heavy build environments from lean production runtimes
2. **Zero-Trust Posture** - Non-root execution, strict network segmentation, minimal attack surface
3. **Persistent Agent State** - Stateless agents with lifecycle states persisted to specialized execution store
4. **Tenant Isolation** - Every container enforces organization_id/tenant_id boundaries

---

## Current State Assessment

### Existing Infrastructure

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Dev Container | `.devcontainer/Dockerfile.dev` | ✅ Active | Monolithic TypeScript/Node dev environment |
| Agent Template | `packages/agents/base/Dockerfile.template` | ✅ Ready | Standardized multi-stage template with BuildKit |
| Frontend Prod | `Dockerfile.optimized.frontend` | ✅ Active | Nginx-based, hardened |
| Agent Prod | `Dockerfile.optimized.agent` | ✅ Active | Alpine-based, non-root |
| Production Compose | `infra/docker/docker-compose.prod.yml` | ✅ Active | Caddy + Backend + Redis + Kafka |

### Agent Inventory

**Lifecycle Agents** (in `apps/ValyntApp/src/lib/agent-fabric/agents/`):
- `OpportunityAgent` - Discovery phase
- `TargetAgent` - Definition phase
- `RealizationAgent` - Realization phase
- `ExpansionAgent` - Expansion phase
- `IntegrityAgent` - Governance phase
- `CoordinatorAgent` - Orchestration

**Cross-Cutting Agents**:
- `CommunicatorAgent` - Messaging
- `CompanyIntelligenceAgent` - Intelligence gathering
- `SystemMapperAgent` - System mapping
- `InterventionDesignerAgent` - Intervention design

**Standalone Agents** (in `packages/agents/`):
- `groundtruth` - Ground truth validation
- `opportunity`, `target`, `integrity` - Individual packages

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Standardize Agent Dockerfile Generation

**Goal:** Automate per-agent Dockerfile generation from template to prevent drift.

**Tasks:**
- [ ] Enhance `packages/agents/base/generate-dockerfiles.py` to support all agents
- [ ] Add CI validation to ensure Dockerfiles match template
- [ ] Create agent manifest JSON for tracking all agents

**Implementation:**

```bash
# Generate Dockerfiles for all agents
python packages/agents/base/generate-dockerfiles.py --all

# Validate no drift
python packages/agents/base/generate-dockerfiles.py --validate
```

### 1.2 Create Agent Build Matrix

**Goal:** Define build configuration for each agent with proper dependencies.

**File:** `pragmatic-reproducibility/agent-build-matrix.json`

```json
{
  "agents": {
    "opportunity": {
      "source": "apps/ValyntApp/src/lib/agent-fabric/agents/OpportunityAgent.ts",
      "package": "@valueos/opportunity-agent",
      "dependencies": ["@valueos/agent-base", "@valueos/memory"],
      "expose_port": 8081,
      "lifecycle_stage": "discovery",
      "risk_category": "discovery",
      "confidence_threshold": { "low": 0.5, "high": 0.8 }
    },
    "target": {
      "source": "apps/ValyntApp/src/lib/agent-fabric/agents/TargetAgent.ts",
      "package": "@valueos/target-agent",
      "dependencies": ["@valueos/agent-base", "@valueos/memory"],
      "expose_port": 8082,
      "lifecycle_stage": "definition",
      "risk_category": "commitment",
      "confidence_threshold": { "low": 0.6, "high": 0.85 }
    }
  }
}
```

### 1.3 Implement BuildKit Cache Strategy

**Goal:** 5x faster builds with proper cache layering.

**File:** `pragmatic-reproducibility/scripts/build-agents.sh`

```bash
#!/bin/bash
# Build all agents with BuildKit cache optimization

export DOCKER_BUILDKIT=1
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

AGENTS=("opportunity" "target" "realization" "expansion" "integrity" "coordinator")

for agent in "${AGENTS[@]}"; do
  docker buildx build \
    --cache-from type=registry,ref=ghcr.io/valynt/valueos/${agent}-cache \
    --cache-to type=registry,ref=ghcr.io/valynt/valueos/${agent}-cache,mode=max \
    --tag ghcr.io/valynt/valueos/${agent}:latest \
    --tag ghcr.io/valynt/valueos/${agent}:${GITHUB_SHA} \
    --build-arg AGENT_NAME=${agent} \
    --build-arg NODE_VERSION=20.19.0 \
    --build-arg PNPM_VERSION=9.15.0 \
    -f packages/agents/${agent}/Dockerfile \
    --push \
    .
done
```

---

## Phase 2: Production Hardening (Week 3-4)

### 2.1 Zero-Trust Container Configuration

**Goal:** All containers run as non-root with minimal capabilities.

**Template Enhancement:** `packages/agents/base/Dockerfile.template`

Add to final stage:
```dockerfile
# Security hardening
RUN apk add --no-cache dumb-init && \
    find /app -type d -exec chmod 755 {} \; && \
    find /app -type f -exec chmod 644 {} \;

# Drop all capabilities, add only what's needed
USER agent
STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "node packages/agents/${AGENT_NAME}/dist/index.js"]
```

### 2.2 Network Segmentation

**Goal:** Agents can only communicate via MessageBus, not directly.

**File:** `infra/docker/docker-compose.agents.yml`

```yaml
version: "3.9"

services:
  opportunity-agent:
    build:
      context: ../..
      dockerfile: packages/agents/opportunity/Dockerfile
      args:
        AGENT_NAME: opportunity
    container_name: valueos-opportunity-agent
    user: agent
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=64m
    networks:
      - agent-network
    environment:
      NODE_ENV: production
      AGENT_NAME: opportunity
      MESSAGE_BUS_URL: nats://nats:4222
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
    depends_on:
      nats:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M

  target-agent:
    # Similar configuration...
```

### 2.3 Secret Management

**Goal:** No secrets in environment variables, use mounted secrets.

**Implementation:**
```yaml
secrets:
  supabase_service_key:
    file: ./secrets/supabase_service_key.txt
  openai_api_key:
    file: ./secrets/openai_api_key.txt

services:
  opportunity-agent:
    secrets:
      - supabase_service_key
      - openai_api_key
    environment:
      SUPABASE_SERVICE_KEY_FILE: /run/secrets/supabase_service_key
      OPENAI_API_KEY_FILE: /run/secrets/openai_api_key
```

---

## Phase 3: Observability & Resilience (Week 5-6)

### 3.1 Sidecar Observability Stack

**Goal:** Every agent deploys with logging, metrics, and tracing sidecars.

**File:** `infra/docker/docker-compose.observability-sidecars.yml`

```yaml
version: "3.9"

services:
  opportunity-agent:
    # ... agent config ...

  opportunity-logs:
    image: grafana/promtail:latest
    container_name: opportunity-logs
    volumes:
      - /var/log:/var/log:ro
      - ./promtail/config.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - observability-network

  opportunity-metrics:
    image: prom/node-exporter:latest
    container_name: opportunity-metrics
    networks:
      - observability-network
```

### 3.2 Chaos Testing Framework

**Goal:** Verify agent resilience through automated failure injection.

**File:** `scripts/chaos/agent-killer.sh`

```bash
#!/bin/bash
# Randomly terminate agent pods to verify orchestrator resilience

AGENTS=("opportunity" "target" "realization" "expansion" "integrity")
MAX_KILLS=2

for i in $(seq 1 $MAX_KILLS); do
  agent=${AGENTS[$RANDOM % ${#AGENTS[@]}]}

  echo "Terminating $agent agent..."
  docker kill valueos-${agent}-agent

  # Verify orchestrator handles failure
  sleep 10

  # Check if task was reassigned
  if ! curl -f http://localhost:3001/health/agents/${agent} > /dev/null 2>&1; then
    echo "FAIL: Orchestrator did not reassign ${agent} tasks"
    exit 1
  fi

  echo "PASS: ${agent} tasks reassigned successfully"
done
```

### 3.3 Fault Injection Testing

**File:** `scripts/chaos/network-partition.sh`

```bash
#!/bin/bash
# Simulate network partition between agents and Supabase

echo "Injecting network partition..."
iptables -A INPUT -s supabase-db -j DROP
iptables -A OUTPUT -d supabase-db -j DROP

# Verify agents handle gracefully
sleep 30

# Check circuit breaker opened
if ! curl -f http://localhost:3001/metrics | grep "circuit_breaker_open.*1" > /dev/null; then
  echo "FAIL: Circuit breaker did not open"
  exit 1
fi

# Restore network
iptables -D INPUT -s supabase-db -j DROP
iptables -D OUTPUT -d supabase-db -j DROP

echo "PASS: Agents handled network partition gracefully"
```

---

## Phase 4: CI/CD Pipeline Hardening (Week 7-8)

### 4.1 Artifact Signing with Cosign

**File:** `.github/workflows/build-agents.yml`

```yaml
name: Build and Sign Agent Containers

on:
  push:
    branches: [main]
    paths:
      - 'packages/agents/**'
      - 'apps/ValyntApp/src/lib/agent-fabric/**'

jobs:
  build-agents:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: [opportunity, target, realization, expansion, integrity, coordinator]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push ${{ matrix.agent }} agent
        uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/agents/${{ matrix.agent }}/Dockerfile
          build-args: |
            AGENT_NAME=${{ matrix.agent }}
            NODE_VERSION=20.19.0
          tags: |
            ghcr.io/valynt/valueos/${{ matrix.agent }}:latest
            ghcr.io/valynt/valueos/${{ matrix.agent }}:${{ github.sha }}
          push: true
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign container image
        env:
          COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
        run: |
          cosign sign --key env://COSIGN_PRIVATE_KEY \
            ghcr.io/valynt/valueos/${{ matrix.agent }}@${{ steps.build.outputs.digest }}
```

### 4.2 Drift Detection

**File:** `scripts/check-drift.sh`

```bash
#!/bin/bash
# Verify container configurations match IaC definitions

set -euo pipefail

echo "Checking for configuration drift..."

# Compare running containers with docker-compose definitions
for agent in opportunity target realization expansion integrity coordinator; do
  running=$(docker inspect valueos-${agent}-agent --format '{{.Config.Image}}' 2>/dev/null || echo "not-running")
  defined=$(grep "image:" infra/docker/docker-compose.agents.yml | grep ${agent} | awk '{print $2}')

  if [ "$running" != "$defined" ] && [ "$running" != "not-running" ]; then
    echo "DRIFT DETECTED: ${agent} running ${running} but defined as ${defined}"
    exit 1
  fi
done

echo "No drift detected"
```

### 4.3 Unified Deployment Pipeline

**File:** `.github/workflows/unified-deployment-pipeline.yml`

```yaml
name: Unified Deployment Pipeline

on:
  push:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH

  build-sign-deploy:
    needs: security-scan
    runs-on: ubuntu-latest
    steps:
      - name: Build, sign, and deploy
        # ... implementation

      - name: Verify signatures
        run: |
          cosign verify --key cosign.pub ghcr.io/valynt/valueos/opportunity:latest

      - name: Check drift
        run: ./scripts/check-drift.sh

      - name: Run chaos tests
        run: bash scripts/chaos/agent-killer.sh
```

---

## Phase 5: Production Deployment (Week 9-10)

### 5.1 Kubernetes Deployment Manifests

**File:** `infra/k8s/agents/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: opportunity-agent
  namespace: valueos
spec:
  replicas: 2
  selector:
    matchLabels:
      app: opportunity-agent
  template:
    metadata:
      labels:
        app: opportunity-agent
        version: v1
    spec:
      serviceAccountName: agent-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: opportunity-agent
        image: ghcr.io/valynt/valueos/opportunity:latest
        imagePullPolicy: Always
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        env:
        - name: NODE_ENV
          value: production
        - name: MESSAGE_BUS_URL
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: message-bus-url
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8081
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir:
          sizeLimit: 64Mi
```

### 5.2 Horizontal Pod Autoscaling

**File:** `infra/k8s/agents/hpa.yaml`

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: opportunity-agent-hpa
  namespace: valueos
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: opportunity-agent
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Success Criteria

### Security Gates
- [ ] All containers run as non-root (uid 1001)
- [ ] No secrets in environment variables
- [ ] All images signed with Cosign
- [ ] Trivy scan shows no CRITICAL/HIGH vulnerabilities
- [ ] Network policies enforce agent-to-messagebus-only communication

### Performance Gates
- [ ] Agent cold start < 5 seconds
- [ ] Build time < 3 minutes with BuildKit cache
- [ ] Memory footprint < 512MB per agent
- [ ] CPU utilization < 70% under normal load

### Resilience Gates
- [ ] Agent pod termination triggers automatic task reassignment
- [ ] Network partition activates circuit breaker
- [ ] HPA scales agents based on load
- [ ] Zero data loss during pod restarts (state persisted to execution store)

### Compliance Gates
- [ ] All database queries include organization_id filter
- [ ] Memory queries include tenant_id metadata filter
- [ ] Audit logs capture all agent actions
- [ ] RLS policies validated with `pnpm run test:rls`

---

## Rollout Plan

### Week 1-2: Foundation
1. Generate Dockerfiles for all agents
2. Set up BuildKit cache infrastructure
3. Create agent build matrix

### Week 3-4: Hardening
1. Implement zero-trust container config
2. Set up network segmentation
3. Configure secret management

### Week 5-6: Observability
1. Deploy sidecar observability stack
2. Implement chaos testing framework
3. Create fault injection tests

### Week 7-8: CI/CD
1. Set up artifact signing pipeline
2. Implement drift detection
3. Create unified deployment pipeline

### Week 9-10: Production
1. Deploy to staging environment
2. Run full chaos test suite
3. Gradual production rollout (10% → 50% → 100%)

---

## Monitoring & Alerting

### Key Metrics
- Agent container restart count
- Circuit breaker open/close events
- MessageBus queue depth
- Agent task completion latency
- Tenant isolation violations (should be 0)

### Alerts
- Agent container restart > 3 in 5 minutes
- Circuit breaker open > 5 minutes
- MessageBus queue depth > 1000
- Task completion latency > 30 seconds
- Any tenant isolation violation

---

## References

- [Pragmatic Reproducibility README](../../pragmatic-reproducibility/README.md)
- [Agent Fabric Architecture](../../AGENTS.md)
- [Security Audit Report](../../SECURITY_AUDIT_REPORT.md)
- [DX Architecture](../dx-architecture.md)
- [Environment Setup](../ENVIRONMENT.md)
