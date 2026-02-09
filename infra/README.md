# Infrastructure

This directory contains deployment and operational infrastructure for the ValueOS platform.

## Canonical inventory (entry points)

Use this inventory as the source of truth for where to run Compose, Kubernetes, and Terraform targets.

### Docker Compose targets

| Target | Path | Owner | Purpose | Status |
| --- | --- | --- | --- | --- |
| Dev stack | `infra/docker/docker-compose.dev.yml` | Platform / DevOps | Full local stack (frontend, backend, postgres, redis, etc.) for development. | Active |
| Dev + Caddy | `infra/docker/docker-compose.caddy.yml` | Platform / DevOps | Dev stack with Caddy reverse proxy for same-origin routing. | Active |
| Staging | `infra/docker/docker-compose.staging.yml` | Platform / DevOps | Staging-like stack with TLS-aware routing and build outputs. | Active |
| Production | `infra/docker/docker-compose.prod.yml` | Platform / DevOps | Production compose bundle with TLS and hardened settings. | Active |
| High availability | `infra/docker/docker-compose.ha.yml` | Platform / DevOps | HA variant for redundancy and scaling experiments. | Active |
| Test | `infra/docker/docker-compose.test.yml` | Platform / DevOps | Compose stack for integration and CI tests. | Active |
| Base compose | `infra/docker/docker-compose.yml` | Platform / DevOps | Shared base services referenced by overlays and docs. | Active |
| mTLS overlay | `infra/docker-compose.mtls.yml` | Platform / Security | mTLS overlay that layers on top of the dev stack. | Active |
| Observability (PGLT) | `infra/docker/docker-compose.observability.yml` | Platform / DevOps | PGLT (Prometheus, Grafana, Loki, Tempo) + OTel Collector, Promtail, node-exporter. | Active |
| Dependency services | `docker-compose.deps.yml` | Developer Experience | Minimal postgres/redis dependencies for app dev. | Active |
| Scripts helper stack | `scripts/docker-compose.yml` | Platform / DevOps | Helper stack used by automation scripts. | Active |
| GitHub code optimizer | `packages/services/github-code-optimizer/docker-compose.yml` | Integrations | Service-local compose for the GitHub optimizer. | Active |
| Blueprint sample | `docs/engineering/blueprint/infra/docker-compose.yml` | Platform / Docs | Reference compose used by the engineering blueprint. | Reference |

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

- **Observability compose files** overlap in purpose. Use `infra/docker/docker-compose.observability.yml` for LGTM going forward and treat `infra/docker-compose.observability.yml` as deprecated. The legacy file is retained for backward reference only.

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
