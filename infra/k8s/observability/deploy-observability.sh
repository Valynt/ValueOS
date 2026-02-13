#!/bin/bash
# Deploy Observability Stack to Kubernetes
# Deploys Prometheus, Grafana, Tempo, Loki, and Fluent Bit

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ValueCanvas Observability Stack Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Create namespace
echo -e "\n${YELLOW}Creating observability namespace...${NC}"
kubectl apply -f namespace.yaml

# Deploy Prometheus
echo -e "\n${YELLOW}Deploying Prometheus...${NC}"
kubectl apply -f prometheus/prometheus-config.yaml
kubectl apply -f prometheus/alert-rules.yaml
kubectl apply -f prometheus/prometheus-deployment.yaml

# Wait for Prometheus
echo -e "${YELLOW}Waiting for Prometheus to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n observability

# Deploy Grafana
echo -e "\n${YELLOW}Deploying Grafana...${NC}"
kubectl apply -f grafana/grafana-datasources.yaml
kubectl apply -f grafana/dashboards-config.yaml
kubectl apply -f grafana/grafana-deployment.yaml

# Wait for Grafana
echo -e "${YELLOW}Waiting for Grafana to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/grafana -n observability

# Deploy Tempo
echo -e "\n${YELLOW}Deploying Tempo...${NC}"
kubectl apply -f tempo/tempo-deployment.yaml

# Wait for Tempo
echo -e "${YELLOW}Waiting for Tempo to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/tempo -n observability

# Deploy Loki
echo -e "\n${YELLOW}Deploying Loki...${NC}"
kubectl apply -f loki/loki-deployment.yaml

# Wait for Loki
echo -e "${YELLOW}Waiting for Loki to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/loki -n observability

# Deploy Fluent Bit
echo -e "\n${YELLOW}Deploying Fluent Bit...${NC}"
kubectl apply -f fluent-bit/fluent-bit-daemonset.yaml

# Wait for Fluent Bit
echo -e "${YELLOW}Waiting for Fluent Bit to be ready...${NC}"
sleep 10
kubectl rollout status daemonset/fluent-bit -n observability --timeout=300s

# Display status
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Observability Stack Status:${NC}"
kubectl get pods -n observability

echo -e "\n${YELLOW}Services:${NC}"
kubectl get services -n observability

echo -e "\n${GREEN}Access URLs:${NC}"
echo -e "Prometheus: kubectl port-forward -n observability svc/prometheus 9090:9090"
echo -e "Grafana: kubectl port-forward -n observability svc/grafana 3000:3000"
echo -e "Tempo: kubectl port-forward -n observability svc/tempo 3200:3200"

echo -e "\n${YELLOW}Grafana Credentials:${NC}"
echo -e "Username: admin"
echo -e "Password: (check secret) kubectl get secret grafana-secrets -n observability -o jsonpath='{.data.admin-password}' | base64 -d"

echo -e "\n${GREEN}Next Steps:${NC}"
echo -e "1. Access Grafana and explore pre-built dashboards"
echo -e "2. Configure alert notification channels"
echo -e "3. Customize dashboards for your needs"
echo -e "4. Set up external access via Ingress"
