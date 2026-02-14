# Infrastructure

This directory contains deployment and operational infrastructure for the ValueOS platform.

## Canonical inventory (entry points)

Use this inventory as the source of truth for where to run Compose, Kubernetes, and Terraform targets.

### Docker Compose targets

| Target | Path | Owner | Purpose | Status |
| --- | --- | --- | --- | --- |
| Canonical base | `ops/compose/compose.yml` | Platform / DevOps | Single runtime base for local infrastructure (postgres/redis/nats). | Active |
| Studio profile | `ops/compose/profiles/studio.yml` | Platform / DevOps | Optional Supabase/Studio stack (auth/rest/realtime/storage/kong/studio). | Active |
| Devcontainer profile | `ops/compose/profiles/devcontainer.yml` | Developer Experience | Optional devcontainer services and agent placeholders. | Active |
| Observability profile | `ops/compose/profiles/observability.yml` | Platform / DevOps | Optional observability and streaming tooling. | Active |
| Runtime docker profile | `ops/compose/profiles/runtime-docker.yml` | Platform / DevOps | Optional full containerized runtime for DX docker mode. | Active |
| Legacy `infra/docker/docker-compose*.yml` files | `infra/docker/*.yml` | Platform / DevOps | Compatibility include shims only; no service definitions allowed. | Deprecated |

### Kubernetes targets

| Target | Path | Owner | Purpose | Status |
| --- | --- | --- | --- | --- |
| Core manifests | `infra/k8s/base/` | Platform / DevOps | Base services (backend, frontend, workers, databases). | Active |
| Observability | `infra/k8s/observability/` | Platform / DevOps | LGTM stack deployment manifests and helper scripts. | Active |
| Security / mesh | `infra/k8s/security/` | Platform / Security | Network policies, Istio mesh config, zero-trust policies. | Active |
| Cronjobs | `infra/k8s/cronjobs/` | Platform / DevOps | Scheduled jobs (e.g., webhook retries). | Active |
| K8s docs | `infra/k8s/README.md` | Platform / DevOps | Operational guidance for K8s usage. | Active |

### Terraform targets

| Target | Path | Owner | Purpose | Status |
| --- | --- | --- | --- | --- |
| Shared Terraform | `infra/terraform/` | DevOps | Core cloud resources (baseline modules, shared state). | Active |
| Terraform (next) | `infra/terraform-new/` | DevOps | Newer iteration of the core Terraform stack. | Active |
| Dev environment | `infra/environments/dev/terraform/` | DevOps | Dev environment infrastructure with outputs and variables. | Active |
| Staging environment | `infra/environments/staging/terraform/` | DevOps | Staging environment infrastructure. | Active |
| Production environment | `infra/environments/prod/terraform/` | DevOps | Production environment infrastructure. | Active |

## Duplicates & deprecations

- Compose service definitions now belong only under `ops/compose/`.
- Any `docker-compose*.yml` outside `ops/compose/` should be a thin `include:` compatibility shim.

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
- **`docker/docker-compose.observability.yml`** - LGTM observability stack configuration
- **`AUTH_RATE_LIMITING_COMPLETE.md`** - Authentication rate limiting documentation
- **`DEPLOYMENT_GUIDE.md`** - Complete deployment instructions

## Usage

This infrastructure supports multiple deployment targets:
- **Development**: Docker Compose with hot reload
- **Staging**: Kubernetes with Istio service mesh
- **Production**: Kubernetes with full observability stack

See `DEPLOYMENT_GUIDE.md` for detailed deployment instructions.
