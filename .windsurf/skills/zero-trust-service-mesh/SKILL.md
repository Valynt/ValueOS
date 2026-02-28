---
name: zero-trust-service-mesh
description: Implements mTLS and service mesh configuration for secure service-to-service communication among 18 agent types
---

# Zero-Trust Service Mesh

This skill provides comprehensive zero-trust networking and authentication for ValueOS agent communication, implementing mutual TLS (mTLS) and service mesh patterns to secure inter-agent communication without manual API keys.

## When to Run

Run this skill when:
- Configuring secure service-to-service communication
- Implementing zero-trust networking principles
- Setting up mTLS for agent authentication
- Optimizing service mesh performance for 18 agents
- Troubleshooting authentication or networking issues
- Adding new agent types to the mesh

## mTLS Implementation

### Certificate Authority Setup

#### Istio Certificate Management
```yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: valueos-istio-issuer
  namespace: istio-system
spec:
  ca:
    secretName: valueos-ca-key-pair

---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: valueos-istio-ca
  namespace: istio-system
spec:
  secretName: valueos-ca-key-pair
  issuerRef:
    name: valueos-istio-issuer
    kind: Issuer
  commonName: valueos-ca
  dnsNames:
  - valueos-ca.istio-system.svc.cluster.local
```

#### Self-Signed Root CA (Development)
```bash
# Generate root CA
openssl req -x509 -sha256 -days 3650 -nodes \
  -newkey rsa:4096 \
  -subj "/CN=ValueOS Root CA" \
  -keyout ca-key.pem \
  -out ca-cert.pem

# Create Kubernetes secret
kubectl create secret generic valueos-ca-certs \
  --from-file=ca-cert.pem \
  --from-file=ca-key.pem \
  -n istio-system
```

### Peer Authentication Policies

#### Strict mTLS for All Services
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: valueos-agents
spec:
  mtls:
    mode: STRICT
```

#### Service-Specific Policies
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: agent-communication-policy
  namespace: valueos-agents
spec:
  selector:
    matchLabels:
      app: valueos-agent
  mtls:
    mode: STRICT
  portLevelMtls:
    8080:
      mode: STRICT
```

#### PERMISSIVE Mode for Gradual Adoption
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: gradual-mtls-adoption
  namespace: valueos-agents
spec:
  mtls:
    mode: PERMISSIVE
```

## Service Mesh Configuration

### Istio Service Mesh Setup

#### Istio Installation
```bash
# Install Istio CLI
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Install Istio with minimal profile
istioctl install --set profile=minimal -y

# Enable injection in agent namespace
kubectl label namespace valueos-agents istio-injection=enabled
```

#### Gateway Configuration
```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: valueos-agent-gateway
  namespace: valueos-agents
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: valueos-agent-tls
    hosts:
    - "*.valueos-agents.svc.cluster.local"
```

### Virtual Services and Routing

#### Agent Communication Routing
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: agent-router
  namespace: valueos-agents
spec:
  hosts:
  - agent-router.valueos-agents.svc.cluster.local
  http:
  - match:
    - uri:
        prefix: "/sentiment"
    route:
    - destination:
        host: sentiment-agent.valueos-agents.svc.cluster.local
        subset: v1
  - match:
    - uri:
        prefix: "/classification"
    route:
    - destination:
        host: classification-agent.valueos-agents.svc.cluster.local
        subset: v1
  - match:
    - uri:
        prefix: "/orchestration"
    route:
    - destination:
        host: orchestration-agent.valueos-agents.svc.cluster.local
```

#### Traffic Shifting for Deployments
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: agent-canary
  namespace: valueos-agents
spec:
  hosts:
  - ml-agent.valueos-agents.svc.cluster.local
  http:
  - route:
    - destination:
        host: ml-agent.valueos-agents.svc.cluster.local
        subset: v1
      weight: 90
    - destination:
        host: ml-agent.valueos-agents.svc.cluster.local
        subset: v2
      weight: 10
```

### Destination Rules

#### Subset Definitions
```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: agent-subsets
  namespace: valueos-agents
spec:
  host: "*.valueos-agents.svc.cluster.local"
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: canary
    labels:
      version: canary
```

#### Load Balancing Policies
```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: agent-load-balancing
  namespace: valueos-agents
spec:
  host: "*.valueos-agents.svc.cluster.local"
  trafficPolicy:
    loadBalancer:
      simple: ROUND_ROBIN
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutiveErrors: 5
      interval: 10s
      baseEjectionTime: 30s
```

## Authorization Policies

### Service-to-Service Authorization
```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: agent-to-agent-communication
  namespace: valueos-agents
spec:
  selector:
    matchLabels:
      app: valueos-agent
  action: ALLOW
  rules:
  - from:
    - source:
        principals:
        - cluster.local/ns/valueos-agents/sa/*-agent
    to:
    - operation:
        methods: ["POST", "GET"]
        paths: ["/api/v1/*"]
```

### Request Authentication
```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: agent-jwt-validation
  namespace: valueos-agents
spec:
  selector:
    matchLabels:
      app: valueos-agent
  jwtRules:
  - issuer: "valueos-issuer"
    jwksUri: "https://valueos-issuer/.well-known/jwks.json"
    forwardOriginalToken: true
```

## Sidecar Optimization

### Resource Allocation for Sidecars
```yaml
apiVersion: networking.istio.io/v1beta1
kind: Sidecar
metadata:
  name: agent-sidecar-config
  namespace: valueos-agents
spec:
  workloadSelector:
    labels:
      app: valueos-agent
  ingress:
  - port:
      number: 8080
      protocol: HTTP
      name: http
  egress:
  - hosts:
    - "./*"  # Allow communication within namespace
    - "istio-system/*"  # Allow Istio components
  outboundTrafficPolicy:
    mode: REGISTRY_ONLY
```

### Performance Tuning
```yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  namespace: istio-system
  name: valueos-istio-tuning
spec:
  meshConfig:
    defaultConfig:
      proxyMetadata:
        ISTIO_META_DNS_CAPTURE: "true"
        ISTIO_META_DNS_AUTO_ALLOCATE: "true"
      concurrency: 2
      holdApplicationUntilProxyStarts: true
    accessLogFile: "/dev/stdout"
    enableTracing: true
    tracing:
      sampling: 1.0
      zipkin:
        address: "zipkin.istio-system:9411"
```

## Traffic Management

### Circuit Breakers
```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: agent-circuit-breaker
  namespace: valueos-agents
spec:
  host: "*.valueos-agents.svc.cluster.local"
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 30s
      http:
        http2MaxRequests: 1000
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutiveLocalOriginFailures: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

### Fault Injection for Testing
```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: agent-fault-injection
  namespace: valueos-agents
spec:
  hosts:
  - test-agent.valueos-agents.svc.cluster.local
  http:
  - fault:
      delay:
        percentage:
          value: 10.0
        fixedDelay: 5s
      abort:
        percentage:
          value: 5.0
        httpStatus: 500
    route:
    - destination:
        host: test-agent.valueos-agents.svc.cluster.local
```

## Monitoring and Observability

### mTLS Metrics
```yaml
# Prometheus metrics for mTLS
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istio-mtls-metrics
  namespace: valueos-agents
spec:
  selector:
    matchLabels:
      security.istio.io/tlsMode: istio
  endpoints:
  - port: http-envoy-prom
    path: /stats/prometheus
    interval: 30s
```

### Service Mesh Dashboards
```yaml
# Grafana dashboard configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: istio-dashboard
  namespace: valueos-agents
  labels:
    grafana_dashboard: "1"
data:
  istio-service-mesh.json: |
    {
      "dashboard": {
        "title": "Istio Service Mesh",
        "panels": [
          {
            "title": "mTLS Certificate Expiry",
            "type": "table",
            "targets": [
              {
                "expr": "istio_agent_go_cert_expiry_seconds / 86400",
                "legendFormat": "{{pod}}"
              }
            ]
          }
        ]
      }
    }
```

## Alternative Service Mesh Options

### Linkerd Implementation
```bash
# Install Linkerd CLI
curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh

# Install Linkerd control plane
linkerd install | kubectl apply -f -

# Install Linkerd viz extension
linkerd viz install | kubectl apply -f -

# Inject agents with Linkerd proxy
kubectl get deploy -n valueos-agents -o yaml | linkerd inject - | kubectl apply -f -
```

### Linkerd Authorization Policies
```yaml
apiVersion: policy.linkerd.io/v1beta1
kind: Server
metadata:
  name: agent-server
  namespace: valueos-agents
spec:
  podSelector:
    matchLabels:
      app: valueos-agent
  port: 8080
  proxyProtocol: HTTP

---
apiVersion: policy.linkerd.io/v1beta1
kind: ServerAuthorization
metadata:
  name: agent-authz
  namespace: valueos-agents
spec:
  server:
    name: agent-server
  client:
    meshTLS:
      serviceAccounts:
      - name: orchestration-agent
      - name: sentiment-agent
```

## Troubleshooting mTLS Issues

### Certificate Validation
```bash
# Check certificate status
istioctl proxy-status

# View certificate details
istioctl proxy-config secret deploy/sentiment-agent -n valueos-agents

# Renew certificates
kubectl delete secret istio.default -n valueos-agents
```

### Connectivity Issues
```bash
# Check service mesh configuration
istioctl proxy-config routes deploy/sentiment-agent.valueos-agents

# View Envoy configuration
kubectl exec -it deploy/sentiment-agent -n valueos-agents -c istio-proxy -- pilot-agent request GET config_dump

# Test mTLS connectivity
kubectl run test-pod --image=curlimages/curl --rm -it --restart=Never -- curl -v https://sentiment-agent.valueos-agents.svc.cluster.local/api/health
```

### Performance Issues
```bash
# Monitor sidecar resource usage
kubectl top pods -n valueos-agents --containers

# Check circuit breaker metrics
kubectl exec -it deploy/prometheus -n istio-system -- promtool query instant http://localhost:9090 'istio_requests_total{destination_service_name="sentiment-agent"}'

# Adjust sidecar resource limits
kubectl patch deployment sentiment-agent -n valueos-agents --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/1/resources/limits/cpu", "value": "200m"}]'
```

## Security Best Practices

### Principle of Least Privilege
- Limit service-to-service communication to necessary endpoints
- Use namespace isolation for different agent types
- Implement fine-grained authorization policies

### Certificate Lifecycle Management
- Automate certificate rotation before expiry
- Use short-lived certificates (hours to days)
- Monitor certificate expiry alerts

### Network Segmentation
- Implement zero-trust network policies
- Use network policies to restrict pod-to-pod communication
- Segment sensitive agents from general-purpose agents

This zero-trust service mesh implementation ensures secure, authenticated communication among all 18 ValueOS agent types while maintaining optimal performance and observability.
