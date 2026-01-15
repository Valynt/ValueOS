# Infrastructure

This directory contains deployment and operational infrastructure for the ValueOS platform.

## Directory Structure

### Core Infrastructure
- **`caddy/`** - Caddy web server configuration and reverse proxy setup
- **`docker/`** - Docker Compose configurations for development and production environments
- **`k8s/`** - Kubernetes manifests for production deployment
- **`terraform/`** - Infrastructure as Code for cloud resources
- **`supabase/`** - Supabase configuration and database setup scripts

### Observability & Monitoring
- **`grafana/`** - Grafana dashboards and configuration
- **`prometheus/`** - Prometheus monitoring configuration
- **`observability/`** - Additional observability tools and configs
- **`prometheus.yml`** - Main Prometheus configuration

### Security & Networking
- **`gateway/`** - API gateway configurations
- **`istio/`** - Service mesh configuration
- **`tls/`** - TLS certificates and configuration
- **`traefik/`** - Traefik reverse proxy configuration

### Development & Testing
- **`environments/`** - Environment-specific configurations
- **`testing/`** - Testing infrastructure and mocks
- **`scripts/`** - Infrastructure automation scripts

### Business Logic
- **`billing/`** - Billing and payment infrastructure
- **`backups/`** - Database backup configurations

## Key Files

- **`docker-compose.mtls.yml`** - Mutual TLS Docker Compose setup
- **`docker-compose.observability.yml`** - Observability stack configuration
- **`AUTH_RATE_LIMITING_COMPLETE.md`** - Authentication rate limiting documentation
- **`DEPLOYMENT_GUIDE.md`** - Complete deployment instructions

## Usage

This infrastructure supports multiple deployment targets:
- **Development**: Docker Compose with hot reload
- **Staging**: Kubernetes with Istio service mesh
- **Production**: Kubernetes with full observability stack

See `DEPLOYMENT_GUIDE.md` for detailed deployment instructions.
