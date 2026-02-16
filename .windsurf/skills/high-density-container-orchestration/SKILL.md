---
name: high-density-container-orchestration
description: Manages multi-stage Docker builds and Kubernetes resource quotas for efficient container orchestration of 18 agent types
---

# High-Density Container Orchestration

This skill provides advanced container orchestration techniques optimized for managing 18 distinct agent types in a high-density Kubernetes environment, focusing on efficient resource utilization and preventing resource contention.

## When to Run

Run this skill when:
- Designing container images for multiple agent types
- Configuring Kubernetes resource management
- Optimizing container density in production clusters
- Preventing resource starvation among agents
- Scaling containerized agent deployments
- Troubleshooting resource allocation issues

## Multi-Stage Docker Builds

### Base Image Selection Strategy

#### Alpine Linux for Minimal Footprints
```dockerfile
# Stage 1: Builder stage with full Node.js
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime with minimal Alpine
FROM alpine:3.18

# Install only runtime dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

USER nextjs

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

#### Distroless Images for Maximum Security
```dockerfile
# Stage 1: Build application
FROM golang:1.21-alpine AS builder

WORKDIR /go/src/app
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Distroless runtime
FROM gcr.io/distroless/static-debian11

COPY --from=builder /go/src/app/main /

EXPOSE 8080
CMD ["/main"]
```

### Agent-Specific Build Optimization

#### Shared Base Images for Agent Families
```dockerfile
# Base image for all ML agents
FROM python:3.11-slim AS base-ml

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install common ML dependencies
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements-base.txt

# Specific agent builds
FROM base-ml AS sentiment-agent
COPY sentiment-requirements.txt .
RUN pip install --no-cache-dir -r sentiment-requirements.txt
COPY sentiment-agent.py .
CMD ["python", "sentiment-agent.py"]

FROM base-ml AS classification-agent
COPY classification-requirements.txt .
RUN pip install --no-cache-dir -r classification-requirements.txt
COPY classification-agent.py .
CMD ["python", "classification-agent.py"]
```

#### Build Context Optimization
```dockerfile
# Use .dockerignore to minimize context
# .dockerignore
node_modules
.git
*.log
coverage/
.nyc_output/
dist/
.next/
out/

# Multi-stage for efficient layer caching
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

## Kubernetes Resource Management

### Resource Requests vs Limits

#### Understanding Resource Allocation
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: valueos-agent
spec:
  containers:
  - name: agent
    image: valueos/agent:latest
    resources:
      requests:
        memory: "128Mi"    # Guaranteed allocation
        cpu: "100m"        # Guaranteed CPU time
      limits:
        memory: "512Mi"    # Maximum allowed
        cpu: "500m"        # Maximum CPU usage
```

#### Agent-Specific Resource Profiles
```yaml
# Lightweight agents (communication, routing)
apiVersion: v1
kind: Pod
metadata:
  name: comms-agent
spec:
  containers:
  - name: agent
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "200m"

---
# Heavy ML agents
apiVersion: v1
kind: Pod
metadata:
  name: ml-agent
spec:
  containers:
  - name: agent
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
      limits:
        memory: "4Gi"
        cpu: "2000m"
```

### Resource Quotas and Limit Ranges

#### Namespace-Level Resource Quotas
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: valueos-agents-quota
  namespace: valueos-agents
spec:
  hard:
    requests.cpu: "10"        # Total CPU requests
    requests.memory: 20Gi     # Total memory requests
    limits.cpu: "20"          # Total CPU limits
    limits.memory: 40Gi       # Total memory limits
    pods: "50"                # Maximum pods
    services: "20"            # Maximum services
    persistentvolumeclaims: "10"
```

#### Limit Ranges for Consistency
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: valueos-agent-limits
  namespace: valueos-agents
spec:
  limits:
  - type: Pod
    max:
      cpu: "2"
      memory: 8Gi
    min:
      cpu: 50m
      memory: 32Mi
    default:
      cpu: 200m
      memory: 256Mi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
  - type: Container
    max:
      cpu: "2"
      memory: 8Gi
    min:
      cpu: 50m
      memory: 32Mi
    default:
      cpu: 200m
      memory: 256Mi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
```

### Preventing Noisy Neighbor Syndrome

#### Pod Disruption Budgets
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: valueos-agent-pdb
spec:
  minAvailable: 70%  # Keep 70% of agents running
  selector:
    matchLabels:
      app: valueos-agent
```

#### Priority Classes for Agent Types
```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: critical-agents
value: 1000000
globalDefault: false
description: "Critical agents like orchestration and communication"

---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: standard-agents
value: 100000
globalDefault: false
description: "Standard processing agents"

---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: background-agents
value: 10000
globalDefault: false
description: "Background processing and cleanup agents"
```

#### QoS Classes Management
```yaml
# Guaranteed QoS (requests == limits)
apiVersion: v1
kind: Pod
metadata:
  name: guaranteed-agent
spec:
  containers:
  - name: agent
    resources:
      requests:
        memory: "1Gi"
        cpu: "1"
      limits:
        memory: "1Gi"
        cpu: "1"

---
# Burstable QoS (requests < limits)
apiVersion: v1
kind: Pod
metadata:
  name: burstable-agent
spec:
  containers:
  - name: agent
    resources:
      requests:
        memory: "512Mi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "2"

---
# BestEffort QoS (no requests/limits)
apiVersion: v1
kind: Pod
metadata:
  name: best-effort-agent
spec:
  containers:
  - name: agent
    # No resource specifications
```

## Horizontal Pod Autoscaling

### CPU/Memory-Based Scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: valueos-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: valueos-agent
  minReplicas: 3
  maxReplicas: 20
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

### Custom Metrics-Based Scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-queue-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: processing-agent
  minReplicas: 2
  maxReplicas: 50
  metrics:
  - type: Pods
    pods:
      metric:
        name: agent_queue_depth
      target:
        type: AverageValue
        averageValue: 100  # Scale up when avg queue depth > 100
```

## Node Affinity and Taints

### Agent Type Affinity
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-agent-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ml-agent
  template:
    metadata:
      labels:
        app: ml-agent
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/os
                operator: In
                values:
                - linux
              - key: accelerator
                operator: In
                values:
                - nvidia-tesla-k80
                - nvidia-tesla-p100
      containers:
      - name: ml-agent
        image: valueos/ml-agent:latest
        resources:
          requests:
            nvidia.com/gpu: 1
```

### Resource Optimization Strategies

#### Vertical Pod Autoscaling Recommendations
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: agent-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: valueos-agent
  updatePolicy:
    updateMode: "Auto"  # or "Off" for recommendations only
```

#### Cluster Autoscaling Integration
```yaml
apiVersion: autoscaling/v1
kind: ClusterAutoscaler
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  scaleDownDelayAfterAdd: 10m
  scaleDownDelayAfterDelete: 10m
  scaleDownDelayAfterFailure: 3m
  scaleDownUnneededTime: 10m
  scaleDownUtilizationThreshold: 0.5
  scanInterval: 10s
  skipNodesWithLocalStorage: true
  skipNodesWithSystemPods: true
```

## Monitoring and Alerting

### Resource Usage Monitoring
```yaml
# Prometheus rules for resource alerts
groups:
- name: agent-resource-alerts
  rules:
  - alert: HighMemoryUsage
    expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Agent memory usage is high"
      description: "Agent {{ $labels.pod }} in namespace {{ $labels.namespace }} has high memory usage"

  - alert: HighCPUUsage
    expr: (rate(container_cpu_usage_seconds_total[5m]) / container_spec_cpu_limit_cores) > 0.8
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Agent CPU usage is high"
      description: "Agent {{ $labels.pod }} in namespace {{ $labels.namespace }} has high CPU usage"
```

### Performance Optimization Validation

#### Image Size Analysis
```bash
# Compare image sizes
docker images valueos/*-agent --format "table {{.Repository}}\t{{.Size}}"

# Analyze image layers
docker history valueos/ml-agent:latest

# Multi-arch support check
docker buildx imagetools inspect valueos/agent:latest
```

#### Resource Efficiency Metrics
```bash
# Calculate resource efficiency
kubectl top pods -n valueos-agents --sort-by=cpu

# Check for resource waste
kubectl get pods -n valueos-agents -o jsonpath='{.items[*].spec.containers[*].resources}' | jq .

# Monitor OOM events
kubectl get events -n valueos-agents --field-selector reason=Failed,OOMKilled
```

## Troubleshooting Resource Issues

### Common Problems and Solutions

#### Resource Starvation
```bash
# Check resource quotas
kubectl get resourcequota -n valueos-agents

# Check limit ranges
kubectl get limitrange -n valueos-agents

# Identify pods with high resource usage
kubectl top pods --sort-by=memory -n valueos-agents
```

#### Scheduling Failures
```bash
# Check pod scheduling events
kubectl describe pod <pod-name> | grep -A 10 Events

# Check node resource availability
kubectl describe nodes | grep -A 10 "Allocated resources"

# Check pending pods
kubectl get pods -n valueos-agents --field-selector=status.phase=Pending
```

#### Performance Degradation
```bash
# Check container resource limits
kubectl get pods -n valueos-agents -o jsonpath='{.items[*].spec.containers[*].resources.limits}'

# Monitor container restarts
kubectl get pods -n valueos-agents --sort-by='.status.containerStatuses[0].restartCount'

# Check for throttling
kubectl top pods -n valueos-agents --containers
```

This comprehensive approach ensures efficient container orchestration for all 18 ValueOS agent types while maintaining optimal resource utilization and preventing service degradation.
