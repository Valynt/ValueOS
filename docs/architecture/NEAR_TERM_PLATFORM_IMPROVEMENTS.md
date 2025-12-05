# Near-Term Platform Improvements (1–3 Months)

This plan covers architecture governance, security baselines, observability, and dependency quality gates for the next quarter.

## ADRs and C4 Diagrams
- **Repository & template**: Store ADRs in `docs/adr/` using sequential numbering (`0005` next) and statuses (Proposed, Accepted, Deprecated, Superseded) per `docs/adr/README.md` and `docs/adr/template.md`.
- **Update cadence**: Run a quarterly review to confirm ADRs are current; refresh C4 diagrams whenever schemas/services change.
- **C4 diagrams to produce**:
  - **Context**: End users, tenant admins, integration partners, observability stack, and external risk/ML services.
  - **Container**: NGINX ingress, app services (API/UI), worker processes, Redis, Postgres, object storage, external identity/ML providers.
  - **Component**: Core domains (Opportunity, Integrity/Compliance, Reflection/Orchestration), multi-tenancy enforcement layers, and data access pathways.
- **Multi-tenancy isolation**: Capture logical isolation (tenant_id scoping, RLS) vs. optional per-tenant schema overlays; include RBAC/ABAC overlays and audit logging in component views.
- **Deployment topology**: Diagram ingress (NGINX), app pods, workers, Redis, Postgres, object storage, CI runners, and external dependencies with network zones (public, services, data) and HA expectations.

## IaC Security Baselines
- **Terraform + OPA/Conftest**: Add CI jobs that run Conftest policies enforcing encryption at rest (DB, buckets, disks), private networking, and least-privilege IAM roles.
- **Kubernetes admission**: Enforce Pod Security standards, mandatory resource requests/limits, approved base images, seccomp/AppArmor profiles, and image provenance checks.
- **Container scanning**: Integrate Trivy or Grype in CI and release pipelines with severity thresholds (fail on High/Critical) and allowlists for vetted CVEs.

## Observability Stack
- **Structured logging**: Standardize JSON logs with correlation/request IDs across services, including NGINX access/error logs.
- **Metrics and tracing**: Use OpenTelemetry exporters for app KPIs, Redis health/latency, Postgres query timings, and NGINX request/response metrics.
- **Dashboards and SLOs**: Provision Grafana dashboards with availability/latency SLOs and alert routes for error budgets, saturation (CPU/memory/queue depth), and ingress anomalies.

## Dependency Automation and Quality Gates
- **Automated updates**: Enable Dependabot or Renovate for app code, IaC modules, and container base images with batched updates during maintenance windows.
- **Coverage enforcement**: Set CI coverage thresholds with fail-on-regression behavior and PR comments showing trend deltas.
- **Vulnerability and license policies**: Block merges on high-risk CVEs or disallowed licenses; surface reports in CI and release notes.
