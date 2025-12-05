# Near-Term Platform Improvements (1–3 Months)

## Architecture Decision Records (ADRs) and C4 Diagrams
- Establish ADR template and repository under `docs/adr/` with numbering and status conventions.
- Produce C4 diagrams (Context, Container, Component) covering:
  - Core data model and service boundaries.
  - Multi-tenancy isolation approach (logical vs. schema, RBAC/ABAC overlays).
  - Deployment topology including ingress (NGINX), app services, Redis, database, and external dependencies.
- Add update cadence: review ADRs quarterly and align diagrams with any schema/service changes.

## IaC Security Baselines
- Define Terraform security policies (e.g., mandatory encryption at rest, least-privilege IAM, network segmentation) using OPA/Conftest in CI.
- Add Kubernetes admission/baseline policies (Pod Security, image provenance, required resource requests/limits, seccomp/AppArmor profiles).
- Integrate container image scanning (e.g., Trivy/Grype) into CI and release pipelines with severity thresholds and allowlists.

## Observability Stack
- Standardize structured logging (JSON) across services with correlation IDs.
- Metrics and tracing via OpenTelemetry exporters; cover app-level KPIs, Redis health/latency, and NGINX access/error rates.
- Provision dashboards and SLOs (availability, latency) in Grafana; define alert routes for error budgets and saturation signals.

## Dependency Automation and Quality Gates
- Enable dependency update automation (Dependabot or Renovate) for app, IaC, and container bases with batching and schedule windows.
- Set code coverage thresholds in CI with fail-on-regression behavior; report coverage trend in PRs.
- Add vulnerability and license policy checks to CI to block high-risk dependencies.
