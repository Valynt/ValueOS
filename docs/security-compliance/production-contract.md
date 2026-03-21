# Production Contract — ValueOS

Minimum operational requirements for serving enterprise customers.
Each control maps to SOC2 Type II trust service criteria and points to implementation evidence.

## Service Level Objectives

| SLI | Target | Measurement | Evidence |
|-----|--------|-------------|----------|
| Availability | 99.9% | `1 - (5xx / total)` over 30d rolling | `infra/observability/SLOs.md`, Prometheus rules |
| Latency P95 | ≤ 200ms | `histogram_quantile(0.95, http_request_duration_ms)` | `infra/testing/load-test.k6.js` thresholds |
| Error rate | ≤ 0.1% | `5xx / total` over 5m | Grafana dashboard `mission-control.json` |
| MTTR | ≤ 15 min | Alert-to-resolution | `docs/runbooks/emergency-procedures.md` |

## Recovery Objectives

| Metric | Target | Mechanism | Evidence |
|--------|--------|-----------|----------|
| RPO | 24h | Daily automated backup to S3 | `infra/k8s/cronjobs/database-backup.yaml` |
| RTO | 4h | Restore from S3 + redeploy | `scripts/restore-database.sh`, `docs/runbooks/disaster-recovery.md` |

## SOC2 Trust Service Criteria Mapping

### CC1 — Control Environment

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Code review required | Branch protection on `main` | `.github/CODEOWNERS`, repo settings |
| CI gates before merge | Durable PR aggregates (`pr-fast`, conditional `infra-plan`) with CodeQL advisory by default | `.github/workflows/ci.yml`, `.github/workflows/terraform.yml`, `.github/workflows/codeql.yml`, branch protection settings |
| Dependency updates | Dependabot + Renovate | `.github/dependabot.yml`, `renovate.json` |

### CC2 — Communication and Information

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Incident response plan | Documented runbook | `docs/runbooks/emergency-procedures.md` |
| Change management | PR template, CI gates, environment promotion | `.github/pull_request_template.md`, `.github/workflows/deploy.yml` |

### CC3 — Risk Assessment

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Secret scanning | Gitleaks in CI + pre-commit | `.gitleaks.toml`, `.github/workflows/ci.yml` (`security-gate` job) |
| Dependency vulnerability scanning | `pnpm audit` (high/critical fail), Trivy filesystem + image scan (HIGH/CRITICAL fail), Dependabot alerts | `.github/workflows/ci.yml` (`security-gate`), `.github/dependabot.yml` |
| SAST and code scanning | Semgrep in CI + dedicated CodeQL workflow for JS/TS (advisory unless leadership marks it blocking) | `.github/workflows/ci.yml`, `.github/workflows/codeql.yml` |

### CC5 — Control Activities

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Authentication | Supabase Auth + JWT verification | `packages/backend/src/middleware/auth.ts` |
| Authorization (RBAC) | Permission-based middleware | `packages/backend/src/middleware/rbac.ts` |
| Tenant isolation (RLS) | PostgreSQL RESTRICTIVE policies | `infra/supabase/supabase/migrations/20260212000002_rls.sql` |
| RLS integration tests | CI job against live Supabase | `.github/workflows/ci.yml` (rls-and-compliance job) |
| CSRF protection | Double-submit cookie (server-generated) | `packages/backend/src/middleware/securityMiddleware.ts` |
| Rate limiting | Tiered, fail-closed on auth routes | `packages/backend/src/middleware/rateLimiter.ts` |
| Input validation | Zod schemas + sanitization | `packages/backend/src/middleware/inputValidation.ts` |
| Security headers | CSP, HSTS, X-Frame-Options | `packages/backend/src/middleware/securityHeaders.ts` |

### CC6 — Logical and Physical Access

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Secrets from external provider | Vault/AWS SecretManager + K8s ExternalSecrets | `packages/backend/src/config/secrets/`, `infra/k8s/base/external-secrets.yaml` |
| Secret rotation | Scheduled rotation + volume watcher | `packages/backend/src/config/secrets/SecretRotationScheduler.ts` |
| Least privilege | K8s ServiceAccount, securityContext, drop ALL caps | `infra/k8s/base/backend-deployment.yaml`, `worker-deployment.yaml` |
| Network policies | Namespace-scoped ingress/egress rules | `infra/k8s/base/network-policies.yaml` |

### CC7 — System Operations

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Structured logging | Winston/Pino with correlation IDs | `packages/backend/src/middleware/requestAuditMiddleware.ts` |
| Audit logging with DLQ | In-memory buffer + retry, Sentry on permanent loss | `packages/backend/src/services/SecurityAuditService.ts` |
| Metrics | Prometheus scraping, RED metrics | `infra/observability/prometheus/prometheus.yml` |
| Distributed tracing | OpenTelemetry → Tempo | `infra/observability/otel-collector-config.yaml` |
| Dashboards | Grafana provisioned | `infra/observability/grafana/dashboards/` |
| Health checks | Liveness + readiness probes | `packages/backend/src/api/health/`, K8s deployment manifests |
| Graceful shutdown | SIGTERM handler with connection draining | `packages/backend/src/server.ts` |

### CC8 — Change Management

| Control | Implementation | Evidence |
|---------|---------------|----------|
| Blue-green deployment | K8s service selector swap | `.github/workflows/deploy.yml`, `infra/k8s/base/backend-blue-deployment.yaml` |
| Automated rollback | On deploy failure, revert to blue slot | `.github/workflows/deploy.yml` (rollback job) |
| Staging validation | Smoke test + load test before prod | `.github/workflows/deploy.yml` (deploy-staging job) |
| Database migrations | Versioned SQL, forward-compatible | `infra/supabase/supabase/migrations/` |

### CC9 — Risk Mitigation (Vendor/Third-Party)

| Control | Implementation | Evidence |
|---------|---------------|----------|
| LLM cost governance | Per-tenant throttling + budget caps | `packages/backend/src/services/CostGovernanceService.ts` |
| LLM fallback | Multi-provider with automatic failover | `packages/backend/src/services/LLMFallback.ts` |
| Circuit breaker | Prevents cascading failures to external services | `packages/backend/src/config/secrets/CircuitBreaker.ts` |

### A1 — Availability

| Control | Implementation | Evidence |
|---------|---------------|----------|
| HPA | CPU/memory-based autoscaling | `infra/k8s/base/hpa.yaml` |
| PDB | Pod disruption budgets | `infra/k8s/base/backend-pdb.yaml` |
| Multi-AZ | Terraform configured for multi-AZ | `infra/terraform/main.tf` |
| Automated backups | Daily CronJob with S3 upload + retention | `infra/k8s/cronjobs/database-backup.yaml` |
| Load testing | k6 with SLO thresholds | `infra/testing/load-test.k6.js` |

### P1 — Privacy

| Control | Implementation | Evidence |
|---------|---------------|----------|
| GDPR data export (Art. 15) | DSR API endpoint | `packages/backend/src/api/dataSubjectRequests.ts` |
| GDPR data erasure (Art. 17) | DSR API endpoint with anonymization | `packages/backend/src/api/dataSubjectRequests.ts` |
| Consent management | Request-scoped consent registry + middleware enforcing tenant + canonical data-subject identity + consent type | `packages/backend/src/services/auth/consentRegistry.ts`, `packages/backend/src/middleware/consentMiddleware.ts` |
| PII filtering in logs | Sanitization before logging | `packages/backend/src/lib/piiFilter.ts` (referenced by audit service) |
| DSR compliance tests | Automated test suite | `tests/compliance/dsr-workflow.test.ts` |

## Target Branch-Protection Contract

`main` pull requests should require no more than these checks:

- `pr-fast`
- `infra-plan` *(only when Terraform-owned paths change and the Terraform workflow runs)*

`codeql` should remain advisory by default. If leadership decides CodeQL must block merges, repository settings may add `codeql` as an explicit required check without changing the broader PR contract.

Post-merge and release governance should rely on separate non-PR checks: `main-verify`, `release-readiness`, `deploy-staging`, and `deploy-production`.

## Incident Response

| Phase | Action | Owner | SLA |
|-------|--------|-------|-----|
| Detection | Automated alerts via Prometheus/Grafana | On-call SRE | — |
| Triage | Assess severity, page if P1/P2 | On-call SRE | 5 min |
| Mitigation | Rollback or hotfix | Engineering lead | 15 min |
| Resolution | Root cause fix, deploy | Engineering team | 4h |
| Post-mortem | Blameless review, action items | Engineering lead | 48h |

See `docs/runbooks/emergency-procedures.md` for detailed procedures.

## Key Rotation Schedule

| Secret | Rotation Frequency | Mechanism |
|--------|--------------------|-----------|
| JWT signing key | 90 days | `SecretRotationScheduler` + K8s ExternalSecrets |
| Database password | 90 days | AWS Secrets Manager auto-rotation |
| API keys (Stripe, OpenAI) | On compromise | Manual rotation, audit logged |
| CSRF token salt | Per-request | Generated per response |

## Backup & Restore Validation

| Test | Frequency | Evidence |
|------|-----------|----------|
| Backup creation | Daily (automated) | `infra/k8s/cronjobs/database-backup.yaml` |
| Restore to staging | Quarterly | Manual drill, documented in incident log |
| Backup integrity check | Daily (size validation in CronJob) | Backup script exit code |
