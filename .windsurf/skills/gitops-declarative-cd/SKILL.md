---
name: gitops-declarative-cd
description: Manages GitOps workflows with Helm/Kustomize templating and ArgoCD sync policies for declarative continuous deployment
---

# GitOps & Declarative CD

This skill implements GitOps principles for ValueOS agent deployment, using declarative configuration management with Helm and Kustomize to template manifests for all 18 agent types, and ArgoCD for automated synchronization and drift correction.

## When to Run

Run this skill when:
- Setting up or modifying agent deployment pipelines
- Creating reusable templates for multiple agent types
- Configuring automated deployment synchronization
- Implementing drift detection and correction
- Managing declarative infrastructure changes
- Troubleshooting deployment inconsistencies

## GitOps Principles

### Declarative Configuration
- All infrastructure and application configuration stored in Git
- Changes reviewed through pull requests
- Automated deployment from approved changes
- No manual configuration changes allowed

### Immutable Deployments
- Deployments are versioned and immutable
- Rollbacks achieved by reverting to previous versions
- No in-place modifications of running systems
- All changes tracked through Git history

### Observability and Monitoring
- All deployment states observable
- Automated drift detection and correction
- Comprehensive audit trails
- Real-time status visibility

## Helm Templating for Agent Deployment

### Base Agent Chart Structure
```
valueos-agent-chart/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── _helpers.tpl
└── charts/
    └── dependencies/
```

#### Chart.yaml
```yaml
apiVersion: v2
name: valueos-agent
description: Generic ValueOS agent deployment chart
type: application
version: 0.1.0
appVersion: "1.0.0"

dependencies:
  - name: common
    version: "1.0.0"
    repository: "https://charts.bitnami.com/bitnami"
```

#### values.yaml (Base Configuration)
```yaml
# Global agent configuration
global:
  imageRegistry: "valueos"
  imagePullSecrets: []
  env: "production"

# Agent-specific configuration
agent:
  name: "generic-agent"
  type: "processing"
  image:
    repository: "{{ .Values.global.imageRegistry }}/{{ .Values.agent.name }}"
    tag: "latest"
    pullPolicy: IfNotPresent

  replicas: 1
  resources:
    requests:
      memory: "128Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"

  env:
    - name: AGENT_TYPE
      value: "{{ .Values.agent.type }}"
    - name: LOG_LEVEL
      value: "info"
    - name: METRICS_PORT
      value: "9090"

  config:
    database:
      host: "postgresql.valueos-db.svc.cluster.local"
      port: 5432
    redis:
      host: "redis.valueos-cache.svc.cluster.local"
      port: 6379
    queue:
      url: "amqp://rabbitmq.valueos-queue.svc.cluster.local:5672"

  secrets:
    databasePassword:
      secretName: "{{ .Values.agent.name }}-db-secret"
      secretKey: "password"
    apiKey:
      secretName: "{{ .Values.agent.name }}-api-secret"
      secretKey: "key"
```

### Deployment Template
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "valueos-agent.fullname" . }}
  labels:
    {{- include "valueos-agent.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.agent.replicas }}
  selector:
    matchLabels:
      {{- include "valueos-agent.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "valueos-agent.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.global.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.agent.image.repository }}:{{ .Values.agent.image.tag }}"
          imagePullPolicy: {{ .Values.agent.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
            - name: metrics
              containerPort: 9090
              protocol: TCP
          env:
            {{- toYaml .Values.agent.env | nindent 12 }}
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
          envFrom:
            - secretRef:
                name: {{ include "valueos-agent.fullname" . }}-secrets
          resources:
            {{- toYaml .Values.agent.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: {{ include "valueos-agent.fullname" . }}-config
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

### Agent-Specific Value Overrides
```yaml
# sentiment-agent-values.yaml
agent:
  name: "sentiment-agent"
  type: "ml-processing"
  replicas: 3
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
      nvidia.com/gpu: 1
    limits:
      memory: "4Gi"
      cpu: "2000m"
      nvidia.com/gpu: 1

  env:
    - name: MODEL_PATH
      value: "/models/sentiment-v2"
    - name: BATCH_SIZE
      value: "32"
    - name: GPU_MEMORY_FRACTION
      value: "0.8"

  config:
    model:
      cache: "/tmp/model-cache"
      warmup: true
    queue:
      prefetch: 10
      ack: true
```

## Kustomize for Environment Management

### Base Configuration
```
kustomize/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patches/
    │       ├── deployment-patch.yaml
    │       └── configmap-patch.yaml
    └── production/
        ├── kustomization.yaml
        └── patches/
            ├── deployment-patch.yaml
            └── configmap-patch.yaml
```

#### Base Kustomization
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: valueos-agent-base

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

commonLabels:
  app.kubernetes.io/name: valueos-agent
  app.kubernetes.io/component: agent

images:
  - name: valueos/agent
    newTag: latest

configMapGenerator:
  - name: agent-config
    literals:
      - AGENT_TYPE=generic
      - LOG_LEVEL=info

secretGenerator:
  - name: agent-secrets
    literals:
      - DATABASE_URL=postgresql://user:pass@db:5432/valueos
```

#### Environment-Specific Overlays
```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

patchesStrategicMerge:
  - deployment-patch.yaml
  - configmap-patch.yaml

images:
  - name: valueos/agent
    newTag: v1.2.3

configMapGenerator:
  - name: agent-config
    behavior: replace
    literals:
      - AGENT_TYPE=production-agent
      - LOG_LEVEL=warn
      - METRICS_ENABLED=true

replicas:
  - name: valueos-agent
    count: 5
```

## ArgoCD Application Management

### Application Definition
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: valueos-agents
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: valueos
  source:
    repoURL: https://github.com/Valynt/ValueOS
    path: kustomize/overlays/production
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: valueos-agents
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### Sync Policies and Options

#### Automated Sync Configuration
```yaml
syncPolicy:
  automated:
    # Automatically sync when Git changes
    prune: true  # Remove resources no longer in Git
    selfHeal: true  # Correct drift automatically
    allowEmpty: false  # Don't allow empty applications
  syncOptions:
    - CreateNamespace=true  # Create namespaces if needed
    - PrunePropagationPolicy=foreground  # Wait for dependents
    - PruneLast=true  # Prune resources last
    - RespectIgnoreDifferences=true  # Ignore immutable fields
  retry:
    limit: 5  # Retry failed syncs
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

#### Selective Sync for Agent Types
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sentiment-agent
spec:
  source:
    repoURL: https://github.com/Valynt/ValueOS
    path: helm
    helm:
      valueFiles:
        - values/sentiment-agent.yaml
  syncPolicy:
    automated:
      prune: false  # Don't prune individual agents
      selfHeal: true
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # Allow HPA to manage replicas
```

### App of Apps Pattern
```yaml
# Parent application that manages all agents
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: valueos-agent-suite
spec:
  source:
    repoURL: https://github.com/Valynt/ValueOS
    path: argocd/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
```

## Drift Detection and Correction

### ArgoCD Drift Monitoring
```bash
# Check application sync status
argocd app get valueos-agents

# View sync differences
argocd app diff valueos-agents

# Force sync to correct drift
argocd app sync valueos-agents

# Check application health
argocd app list
```

### Automated Drift Correction
```yaml
# ArgoCD notification for drift detection
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: valueos-agents
  annotations:
    notifications.argoproj.io/subscribe.on-sync-succeeded.slack: valueos-alerts
    notifications.argoproj.io/subscribe.on-sync-failed.slack: valueos-alerts
    notifications.argoproj.io/subscribe.on-sync-status-unknown.slack: valueos-alerts
spec:
  syncPolicy:
    automated:
      selfHeal: true  # Automatically correct drift
```

## CI/CD Integration

### GitHub Actions with ArgoCD
```yaml
name: Deploy to Staging
on:
  push:
    branches: [develop]
    paths:
      - 'kustomize/**'
      - 'helm/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup ArgoCD CLI
        uses: argoproj/argo-cd/cli-installer@main

      - name: Login to ArgoCD
        run: argocd login ${{ secrets.ARGOCD_SERVER }} --username ${{ secrets.ARGOCD_USERNAME }} --password ${{ secrets.ARGOCD_PASSWORD }}

      - name: Sync Staging Application
        run: argocd app sync valueos-agents-staging --force

      - name: Wait for Sync
        run: argocd app wait valueos-agents-staging --timeout 600
```

### Pull Request Validation
```yaml
name: Validate Agent Configuration
on:
  pull_request:
    paths:
      - 'kustomize/**'
      - 'helm/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Helm
        uses: azure/setup-helm@v3

      - name: Validate Helm Charts
        run: |
          helm template test ./helm --values helm/values/test.yaml --dry-run

      - name: Validate Kustomize
        run: |
          kubectl kustomize kustomize/overlays/test

      - name: Check YAML Syntax
        run: |
          yamllint kustomize/ helm/
```

## Monitoring and Observability

### ArgoCD Metrics
```yaml
# Prometheus metrics for ArgoCD
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: argocd-metrics
  namespace: argocd
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-metrics
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
```

### GitOps Dashboard
```yaml
# Grafana dashboard for GitOps metrics
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitops-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  gitops.json: |
    {
      "dashboard": {
        "title": "GitOps Operations",
        "panels": [
          {
            "title": "ArgoCD Sync Status",
            "type": "stat",
            "targets": [
              {
                "expr": "argocd_app_sync_total{phase=\"Synced\"} / argocd_app_sync_total",
                "legendFormat": "Sync Success Rate"
              }
            ]
          }
        ]
      }
    }
```

## Troubleshooting GitOps Issues

### Sync Failures
```bash
# Check application status
argocd app get valueos-agents

# View detailed sync logs
argocd app logs valueos-agents

# Check resource status
kubectl get all -n valueos-agents

# Validate manifests
kubectl apply --dry-run=client -f kustomize/overlays/production/
```

### Configuration Drift
```bash
# Detect drift
argocd app diff valueos-agents

# View current cluster state
kubectl get deployment valueos-agent -n valueos-agents -o yaml

# Compare with Git state
kubectl diff -f kustomize/overlays/production/
```

### Performance Issues
```bash
# Check ArgoCD controller performance
kubectl top pods -n argocd

# Monitor sync duration
argocd app list --output json | jq '.[] | {name: .metadata.name, sync_duration: .status.operationState.finishedAt}'

# Adjust sync intervals
kubectl patch application valueos-agents -n argocd --type merge -p '{"spec":{"syncPolicy":{"syncOptions":["SyncFrequency=30s"]}}}'
```

## Security Considerations

### Git Repository Security
- Use signed commits for all changes
- Implement branch protection rules
- Require pull request reviews
- Scan for secrets before commits

### RBAC for ArgoCD
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: argocd-agent-manager
rules:
- apiGroups: ["argoproj.io"]
  resources: ["applications"]
  verbs: ["get", "list", "watch", "update", "patch"]
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list", "watch"]
```

### Audit Trails
- All changes tracked in Git history
- ArgoCD operation logs retained
- Kubernetes audit logs enabled
- Regular security scans of manifests

This GitOps implementation ensures declarative, automated deployment management for all 18 ValueOS agent types with robust drift detection and correction capabilities.
