# ValueCanvas Kubernetes Deployment

Complete Kubernetes deployment configuration for ValueCanvas using Kustomize.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS ALB Ingress                         │
│                   (app.valuecanvas.com)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│   Frontend    │         │    Backend    │
│   (Nginx)     │────────▶│   (Express)   │
│   Port: 80    │         │   Port: 8000  │
└───────────────┘         └───────┬───────┘
                                  │
                     ┌────────────┴────────────┐
                     │                         │
                     ▼                         ▼
              ┌──────────────┐         ┌──────────────┐
              │   Supabase   │         │    Redis     │
              │  (PostgreSQL)│         │   (Cache)    │
              └──────────────┘         └──────────────┘
```

## Directory Structure

```
k8s/
├── base/                    # Base Kubernetes manifests
│   ├── namespace.yaml
│   ├── serviceaccount.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   └── kustomization.yaml
└── overlays/               # Environment-specific overlays
    ├── staging/
    │   ├── kustomization.yaml
    │   └── deployment-patch.yaml
    └── production/
        ├── kustomization.yaml
        └── deployment-patch.yaml
```

## Prerequisites

1. **EKS Cluster** running (created by Terraform)
2. **kubectl** configured to access the cluster
3. **Kustomize** installed
4. **AWS ALB Ingress Controller** installed in cluster
5. **Metrics Server** installed (for HPA)

## Quick Start

### 1. Configure kubectl

```bash
aws eks update-kubeconfig \
  --name valuecanvas-staging-cluster \
  --region us-east-1
```

### 2. Verify cluster access

```bash
kubectl get nodes
kubectl get namespaces
```

### 3. Create secrets

```bash
kubectl create secret generic valuecanvas-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=supabase-url="https://xxx.supabase.co" \
  --from-literal=supabase-anon-key="eyJ..." \
  --from-literal=supabase-service-key="eyJ..." \
  --from-literal=together-api-key="xxx" \
  --from-literal=openai-api-key="sk-xxx" \
  --from-literal=jwt-secret="xxx" \
  --namespace=valuecanvas-staging
```

### 4. Update image references

Edit `k8s/overlays/staging/kustomization.yaml`:

```yaml
images:
  - name: REGISTRY_URL/valuecanvas-backend
    newName: 123456789012.dkr.ecr.us-east-1.amazonaws.com/valuecanvas-backend
    newTag: develop
  - name: REGISTRY_URL/valuecanvas-frontend
    newName: 123456789012.dkr.ecr.us-east-1.amazonaws.com/valuecanvas-frontend
    newTag: develop
```

### 5. Deploy to staging

```bash
cd k8s/overlays/staging
kustomize build . | kubectl apply -f -
```

### 6. Verify deployment

```bash
kubectl get pods -n valuecanvas-staging
kubectl get services -n valuecanvas-staging
kubectl get ingress -n valuecanvas-staging
```

## Deployment Environments

### Staging

**Resources:**
- Backend: 1 replica, 100m CPU, 256Mi memory
- Frontend: 1 replica, 50m CPU, 64Mi memory
- HPA: Disabled

**Configuration:**
- Namespace: `valuecanvas-staging`
- Image tag: `develop`
- Log level: `debug`

**Deploy:**
```bash
kustomize build k8s/overlays/staging | kubectl apply -f -
```

### Production

**Resources:**
- Backend: 3 replicas, 500m CPU, 1Gi memory
- Frontend: 2 replicas, 200m CPU, 256Mi memory
- HPA: Enabled (2-10 replicas for backend)

**Configuration:**
- Namespace: `valuecanvas-production`
- Image tag: `latest`
- Log level: `info`

**Deploy:**
```bash
kustomize build k8s/overlays/production | kubectl apply -f -
```

## Components

### Frontend (Nginx + React)

- **Image:** `valuecanvas-frontend`
- **Port:** 80
- **Resources:** 50-200m CPU, 64-256Mi memory
- **Health Check:** `/health`
- **Replicas:** 1-2 (staging), 2-5 (production)

### Backend (Express API)

- **Image:** `valuecanvas-backend`
- **Port:** 8000
- **Resources:** 100-500m CPU, 256Mi-1Gi memory
- **Health Check:** `/health`
- **Metrics:** `/metrics` (Prometheus)
- **Replicas:** 1 (staging), 3-10 (production)

### Ingress (AWS ALB)

- **Type:** Application Load Balancer
- **SSL:** Automatic (ACM certificate)
- **Paths:**
  - `/` → Frontend
  - `/api` → Backend

## Configuration

### ConfigMap

```yaml
# k8s/base/configmap.yaml
data:
  redis-url: "redis://redis:6379"
  node-env: "production"
  log-level: "info"
  enable-circuit-breaker: "true"
  enable-rate-limiting: "true"
```

### Secrets

Secrets are managed via Kubernetes secrets or AWS Secrets Manager:

```bash
kubectl create secret generic valuecanvas-secrets \
  --from-literal=database-url=<value> \
  --from-literal=supabase-url=<value> \
  --from-literal=supabase-anon-key=<value> \
  --from-literal=supabase-service-key=<value> \
  --from-literal=together-api-key=<value> \
  --from-literal=jwt-secret=<value> \
  --namespace=valuecanvas-staging
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend-staging \
  --replicas=3 \
  -n valuecanvas-staging

# Scale frontend
kubectl scale deployment frontend-staging \
  --replicas=2 \
  -n valuecanvas-staging
```

### Auto-Scaling (HPA)

HPA is configured for production:

```yaml
minReplicas: 2
maxReplicas: 10
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80
```

View HPA status:
```bash
kubectl get hpa -n valuecanvas-production
```

## Monitoring

### Pod Status

```bash
kubectl get pods -n valuecanvas-staging -w
```

### Logs

```bash
# Backend logs
kubectl logs -f deployment/backend-staging -n valuecanvas-staging

# Frontend logs
kubectl logs -f deployment/frontend-staging -n valuecanvas-staging

# All pods
kubectl logs -f -l app=backend -n valuecanvas-staging
```

### Metrics

```bash
# Pod metrics
kubectl top pods -n valuecanvas-staging

# Node metrics
kubectl top nodes
```

### Events

```bash
kubectl get events -n valuecanvas-staging --sort-by='.lastTimestamp'
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n valuecanvas-staging

# Check events
kubectl get events -n valuecanvas-staging

# Check logs
kubectl logs <pod-name> -n valuecanvas-staging
```

### Image pull errors

```bash
# Verify ECR access
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Check image exists
aws ecr describe-images \
  --repository-name valuecanvas-backend \
  --region us-east-1
```

### Ingress not working

```bash
# Check ingress status
kubectl describe ingress valuecanvas-staging -n valuecanvas-staging

# Check ALB controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

### Database connection issues

```bash
# Test from pod
kubectl exec -it deployment/backend-staging -n valuecanvas-staging -- \
  curl -v http://backend:8000/health

# Check secrets
kubectl get secret valuecanvas-secrets -n valuecanvas-staging -o yaml
```

## Rollback

### Rollback deployment

```bash
# View rollout history
kubectl rollout history deployment/backend-staging -n valuecanvas-staging

# Rollback to previous version
kubectl rollout undo deployment/backend-staging -n valuecanvas-staging

# Rollback to specific revision
kubectl rollout undo deployment/backend-staging \
  --to-revision=2 \
  -n valuecanvas-staging
```

## Cleanup

### Delete staging environment

```bash
kubectl delete namespace valuecanvas-staging
```

### Delete production environment

```bash
kubectl delete namespace valuecanvas-production
```

## CI/CD Integration

Deployments are automated via GitHub Actions:

- **Staging:** Auto-deploys on push to `develop`
- **Production:** Manual deployment via workflow dispatch

See `.github/workflows/deploy-to-k8s.yml` for details.

## Security

### Pod Security

- Non-root user
- Read-only root filesystem
- No privilege escalation
- Capabilities dropped
- Seccomp profile enabled

### Network Security

- Private subnets for pods
- Security groups restrict access
- TLS/SSL via ALB
- Network policies (optional)

### Secrets Management

- Kubernetes secrets encrypted at rest
- AWS Secrets Manager integration available
- No secrets in code or images

## Best Practices

1. **Always use specific image tags** - Never use `latest` in production
2. **Set resource limits** - Prevent resource exhaustion
3. **Configure health checks** - Enable automatic recovery
4. **Use HPA** - Handle traffic spikes automatically
5. **Monitor logs and metrics** - Detect issues early
6. **Test in staging first** - Validate changes before production
7. **Use rolling updates** - Zero-downtime deployments
8. **Keep secrets secure** - Use Kubernetes secrets or AWS Secrets Manager

## Support

For issues or questions:
1. Check pod logs
2. Review events
3. Check this documentation
4. Contact DevOps team

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [AWS ALB Ingress Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
