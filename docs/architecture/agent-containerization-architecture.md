# Agent Containerization Architecture Design

## Overview

The ValueOS system currently has 18 distinct agent types that are invoked via HTTP calls from the backend AgentAPI service. To enhance scalability, fault isolation, resource management, and deployment flexibility, each agent type will be containerized and deployed as an independent microservice in Kubernetes.

## Current Architecture

- Agents are invoked synchronously via HTTP by the backend
- Agent types are defined in `packages/backend/src/services/agent-types.ts`
- Current infrastructure includes Kubernetes manifests in `infra/k8s/`
- Existing example: opportunity-agent deployment

## Agent Types

The following 18 agent types will each have their own container:

1. opportunity
2. target
3. realization
4. expansion
5. integrity
6. company-intelligence
7. financial-modeling
8. value-mapping
9. system-mapper
10. intervention-designer
11. outcome-engineer
12. coordinator
13. value-eval
14. communicator
15. research
16. benchmark
17. narrative
18. groundtruth

## Containerization Strategy

### Image Design

- **Base Image**: Node.js 20 Alpine for consistency with existing backend
- **Port Configuration**:
  - 8080: HTTP API endpoint
  - 9090: Prometheus metrics endpoint
- **Image Naming**: `${ECR_REGISTRY}/valuecanvas-{agent-type}:${IMAGE_TAG}`
- **Build Process**: Separate Dockerfile per agent type in dedicated directories

### Application Structure

Each agent container will:

- Implement the agent-specific logic
- Expose REST API endpoints for queries
- Include health check endpoint (`/health`)
- Provide metrics endpoint (`/metrics`)
- Handle graceful shutdown
- Log to stdout/stderr for centralized collection

## Kubernetes Architecture

### Namespace

All agent deployments will reside in the `valuecanvas-agents` namespace for logical separation.

### Per-Agent Resources

For each agent type, create:

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {agent-type}-agent
  labels:
    app: {agent-type}-agent
    component: agent
    tier: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {agent-type}-agent
  template:
    metadata:
      labels:
        app: {agent-type}-agent
        component: agent
        tier: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: valuecanvas-agent
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: {agent-type}-agent
        image: ${ECR_REGISTRY}/valuecanvas-{agent-type}:${IMAGE_TAG}
        ports:
        - name: http
          containerPort: 8080
        - name: metrics
          containerPort: 9090
        env:
        - name: PORT
          value: "8080"
        - name: AGENT_TYPE
          value: "{agent-type}"
        # Additional env vars from ConfigMap/Secret
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {agent-type}-agent
  labels:
    app: {agent-type}-agent
    component: agent
spec:
  selector:
    app: {agent-type}-agent
  ports:
  - name: http
    port: 8080
    targetPort: 8080
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  type: ClusterIP
```

#### HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {agent-type}-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {agent-type}-agent
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

#### PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {agent-type}-agent-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: {agent-type}-agent
```

### Shared Resources

#### ConfigMap

Shared configuration for all agents:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
data:
  environment: "production"
  log_level: "info"
  # Other shared configs
```

#### Secret

Agent-specific secrets managed via external-secrets operator.

#### ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: valuecanvas-agent
  namespace: valuecanvas-agents
```

#### NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-network-policy
  namespace: valuecanvas-agents
spec:
  podSelector:
    matchLabels:
      component: agent
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: valuecanvas-backend
      ports:
        - protocol: TCP
          port: 8080
    - from:
        - namespaceSelector:
            matchLabels:
              name: valuecanvas-monitoring
      ports:
        - protocol: TCP
          port: 9090
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: valuecanvas-database
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS resolution
    - to: []
      ports:
        - protocol: UDP
          port: 53
```

## Networking and Service Discovery

- **Internal Communication**: Backend discovers agents via Kubernetes DNS (`{agent-type}-agent.valuecanvas-agents.svc.cluster.local:8080`)
- **Inter-Agent Communication**: Agents can call each other using service names if needed
- **External Dependencies**: Agents access databases, external APIs via service mesh or direct connections
- **Load Balancing**: Kubernetes service provides load balancing across replicas

## Scaling and High Availability

- **Replica Count**: Minimum 2 replicas for HA
- **HPA**: Scales based on CPU/memory utilization
- **Pod Distribution**: Anti-affinity rules to spread across nodes
- **Rolling Updates**: Zero-downtime deployments with maxUnavailable: 25%

## Security Considerations

- **Container Security**: Non-root execution, minimal base image
- **RBAC**: Service accounts with least-privilege access
- **Secrets Management**: External-secrets operator for API keys, credentials
- **Network Isolation**: Network policies restrict traffic
- **Image Security**: Vulnerability scanning in CI/CD pipeline

## Observability

- **Metrics**: Prometheus exposition format on `/metrics`
- **Logs**: Structured JSON logs to stdout
- **Tracing**: OpenTelemetry integration if needed
- **Health Checks**: Liveness and readiness probes
- **Dashboards**: Grafana dashboards for agent performance

## CI/CD Integration

- **Build Pipelines**: Separate GitHub Actions workflows per agent
- **Image Tagging**: Use git commit SHA for immutable deployments
- **Deployment Strategy**: Blue/green or canary deployments for critical agents
- **Rollback**: Automated rollback on health check failures

## Migration Strategy

1. Containerize agents one by one
2. Deploy alongside existing monolithic agent service
3. Update backend AgentAPI to route to new services
4. Gradually increase traffic to containerized agents
5. Remove old agent service once all agents are migrated

## Benefits

- **Isolation**: Agent failures don't affect others
- **Scalability**: Scale individual agents based on load
- **Resource Efficiency**: Allocate resources per agent needs
- **Deployment Flexibility**: Update agents independently
- **Monitoring**: Granular visibility into each agent
- **Security**: Isolate agent-specific secrets and permissions

## Risks and Mitigations

- **Complexity**: Increased operational complexity
  - Mitigation: Use GitOps with ArgoCD for declarative deployments
- **Cost**: More resources for separate containers
  - Mitigation: Right-size resource requests/limits
- **Networking Latency**: Internal service calls
  - Mitigation: Optimize service mesh configuration
- **Development Overhead**: Maintain 18 separate codebases
  - Mitigation: Shared libraries for common functionality
