# EKS Cluster Provisioning

This document covers the one-time steps to create the production and staging EKS
clusters that the Terraform supporting infrastructure and Kubernetes manifests
depend on. Cluster provisioning is intentionally outside the Terraform root in
`infra/terraform/` — that root manages cloud primitives (networking, RDS, Redis,
IAM, CDN) but assumes the cluster already exists.

**Run these steps once per environment before `terraform apply` or any
`kubectl apply` against that environment.**

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| `aws` CLI | ≥ 2.x | `brew install awscli` / [docs](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) |
| `eksctl` | ≥ 0.180 | `brew install eksctl` / [docs](https://eksctl.io/installation/) |
| `kubectl` | ≥ 1.29 | `brew install kubectl` |
| `helm` | ≥ 3.14 | `brew install helm` |

AWS credentials must have `eks:*`, `ec2:*`, `iam:*`, and `cloudformation:*`
permissions. Use a dedicated provisioning IAM role, not a personal user.

---

## Step 1 — Provision the VPC and networking (Terraform)

The EKS cluster must be placed inside the VPC that Terraform manages. Run the
Terraform networking module first so the subnet IDs are available.

```bash
cd infra/terraform
terraform init
terraform apply -target=module.networking -target=module.security \
  -var="environment=production" \
  -var="domain_name=app.valueos.com"
```

Capture the output values — you will need them in Step 2:

```bash
terraform output -json | jq '{
  vpc_id: .vpc_id.value,
  private_subnet_ids: .private_subnet_ids.value,
  public_subnet_ids: .public_subnet_ids.value
}'
```

---

## Step 2 — Create the EKS cluster

Replace `<VPC_ID>`, `<PRIVATE_SUBNET_1>`, `<PRIVATE_SUBNET_2>`,
`<PRIVATE_SUBNET_3>` with the values from Step 1.

```bash
eksctl create cluster \
  --name valueos-production \
  --region us-east-1 \
  --version 1.29 \
  --vpc-id <VPC_ID> \
  --vpc-private-subnets <PRIVATE_SUBNET_1>,<PRIVATE_SUBNET_2>,<PRIVATE_SUBNET_3> \
  --nodegroup-name standard-workers \
  --node-type m6i.xlarge \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 18 \
  --managed \
  --asg-access \
  --full-ecr-access \
  --alb-ingress-access \
  --with-oidc \
  --tags "Project=ValueOS,Environment=production,ManagedBy=eksctl"
```

For staging, substitute `valueos-staging`, `t3.large`, `--nodes 2`,
`--nodes-max 6`, and `Environment=staging`.

This command takes 15–20 minutes. It creates the cluster, managed node group,
OIDC provider (required for IRSA), and updates your local kubeconfig.

---

## Step 3 — Install cluster prerequisites

These operators must be present before the application manifests can be applied.

### AWS Load Balancer Controller

Required for the ALB ingress in `infra/k8s/base/ingress.yaml`.

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=valueos-production \
  --set serviceAccount.create=true \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<ALB_CONTROLLER_IAM_ROLE_ARN>
```

The IAM role ARN is output by `terraform apply` after the security module runs
(output key: `alb_controller_role_arn`). If it is not yet present, create it
following the [AWS LBC IAM guide](https://kubernetes-sigs.github.io/aws-load-balancer-controller/latest/deploy/installation/#iam-permissions).

### External Secrets Operator

Required for `infra/k8s/base/external-secrets.yaml` to sync secrets from AWS
Secrets Manager / Vault into the cluster.

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \
  -n external-secrets \
  --create-namespace \
  --set installCRDs=true
```

### Metrics Server

Required for HPA CPU/memory metrics.

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Prometheus Operator (kube-prometheus-stack)

Required for `ServiceMonitor` and `PrometheusRule` resources in
`infra/k8s/monitoring/`.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=<GRAFANA_ADMIN_PASSWORD>
```

---

## Step 4 — Store the kubeconfig as a GitHub secret

The deploy workflow authenticates using a base64-encoded kubeconfig stored in
GitHub Actions secrets.

```bash
# Export the kubeconfig for the cluster
aws eks update-kubeconfig --name valueos-production --region us-east-1 \
  --kubeconfig /tmp/valueos-production-kubeconfig

# Base64-encode and copy to clipboard
base64 -i /tmp/valueos-production-kubeconfig | pbcopy   # macOS
base64 -w 0 /tmp/valueos-production-kubeconfig | xclip  # Linux
```

Store the result as the `KUBE_CONFIG_PRODUCTION` GitHub Actions secret
(Settings → Secrets and variables → Actions → New repository secret).

For staging, repeat with `valueos-staging` and store as `KUBE_CONFIG_STAGING`.

---

## Step 5 — Apply the remaining Terraform modules

With the cluster running and subnets known, apply the full Terraform root to
provision RDS, Redis, CDN, and monitoring backends:

```bash
cd infra/terraform
terraform apply \
  -var="environment=production" \
  -var="domain_name=app.valueos.com"
```

---

## Step 6 — Verify cluster readiness

```bash
kubectl get nodes
kubectl get pods -A
kubectl get svc -A
```

All system pods should be `Running`. The cluster is ready for the application
manifests once:

- `aws-load-balancer-controller` pods are `Running` in `kube-system`
- `external-secrets` pods are `Running` in `external-secrets`
- `metrics-server` is `Running` in `kube-system`
- `kube-prometheus-stack` pods are `Running` in `monitoring`

---

## Teardown

```bash
eksctl delete cluster --name valueos-production --region us-east-1
```

This removes the cluster and node groups but does **not** destroy Terraform-managed
resources (VPC, RDS, Redis). Run `terraform destroy` separately if needed.

---

## References

- Active deploy flow: `DEPLOY.md`
- Kubernetes manifests: `infra/k8s/README.md`
- Terraform supporting infrastructure: `infra/terraform/`
- Manifest maturity ledger: `infra/k8s/manifest-maturity-ledger.json`
