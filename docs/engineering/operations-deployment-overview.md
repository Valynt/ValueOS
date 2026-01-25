# ValueOS Operations & Deployment Documentation Overview

## Executive Summary

This document provides comprehensive operations and deployment documentation for ValueOS, covering deployment workflows, operational procedures, monitoring strategies, testing frameworks, and troubleshooting guides. The platform includes complete operational runbooks for maintaining production systems, deploying updates, and ensuring system reliability across all environments.

## Deployment & Operations Guide

### Overview

This guide covers the complete deployment lifecycle from local development through production operations, including CI/CD pipelines, monitoring, and operational procedures.

### Prerequisites

#### Infrastructure Requirements

- **Kubernetes cluster** (v1.24+) with CSI driver support
- **PostgreSQL database** with Row Level Security (RLS)
- **Redis** for caching and session management
- **Load balancer** (ALB/NLB) for traffic distribution
- **Monitoring stack** (Prometheus + Grafana)
- **Secrets management** (AWS Secrets Manager or HashiCorp Vault)

#### Development Environment

- **Node.js**: v20+ with npm
- **Docker Desktop**: For local development
- **Supabase CLI**: For database management
- **kubectl**: For Kubernetes operations
- **Terraform**: For infrastructure provisioning

### Development Workflow

#### Local Development Setup

1. **Clone and setup**:

```bash
git clone https://github.com/valynt/valueos.git
cd valueos
npm install
```

2. **Environment configuration**:

```bash
cp deploy/envs/.env.example .env.local
pnpm run env:dev  # Configures Supabase keys
```

3. **Start development stack**:

```bash
pnpm run dx  # Full stack with Docker
# OR
./scripts/dev-caddy-start.sh  # With Caddy proxy
```

4. **Access points**:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Supabase Studio: http://localhost:54323
- Health check: http://localhost:3001/health

#### Local Testing Commands

```bash
# Development
npm run dev              # Start frontend dev server
npm run dev:backend      # Start backend only
pnpm run dx               # Full development stack
pnpm run dx:check         # Health verification

# Testing
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:rls         # RLS policy tests
npm run security:scan    # Security scanning

# Database
pnpm run db:reset         # Reset local database
pnpm run db:migrate       # Apply migrations
npm run seed:demo        # Create demo data

# Quality gates
npm run lint             # Code linting
npm run typecheck        # TypeScript validation
npm run build            # Production build
```

## Go-Live Workflow: Local → Staging → Production

### Overview

This workflow covers three distinct stages:

1. **Local Development** - Fast feedback with HMR
2. **Staging Validation** - Simulated production environment
3. **Production Deployment** - Final go-live with audit checks

### Local Development Launch & Debugging

#### Prerequisites Check

```bash
# Run automated setup
pnpm run setup

# Or manual check
node --version    # Should be v20+
npm --version     # Should be v9+
docker --version  # Should be v24+
supabase --version
```

#### Launch Sequence

| Step                    | Command                      | Output / Goal                             |
| ----------------------- | ---------------------------- | ----------------------------------------- |
| 1. Install Dependencies | `npm install`                | Installs all project dependencies         |
| 2. Start Supabase       | `supabase start`             | Starts local Supabase (DB, Auth, Storage) |
| 3. Generate Types       | `pnpm run db:types`           | Generates TypeScript types from DB schema |
| 4. Launch Frontend      | `npm run dev`                | Starts Vite dev server with HMR           |
| 5. Access               | Open `http://localhost:3000` | Application accessible                    |

#### Development Commands

```bash
# Start development
npm run dev

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

#### Debugging Tools

**Hot Module Replacement (HMR):**

- Vite automatically reloads on file changes
- State is preserved during updates
- WebSocket on port 24678

**Console Log Cleanup:**

```bash
# Check for console.log statements
npm run lint:console

# This must pass before staging/production
```

**Health Checks:**

```bash
# Check dev environment health
npm run dev:health

# Diagnose issues
npm run dev:diagnose

# Auto-fix common problems
npm run dev:auto-fix
```

### Staging Validation & Hardening

#### Purpose

Simulate production environment to validate deployment and configuration.

#### Launch Staging

```bash
# Build and start staging environment
npm run staging:start

# Or step-by-step
npm run staging:build
docker-compose -f infra/docker/docker-compose.staging.yml up -d
```

#### Validation Checklist

| Check                  | Command                       | Success Criteria                 |
| ---------------------- | ----------------------------- | -------------------------------- |
| Golden Path Monitoring | `npm run monitor:golden-path` | All critical user flows pass     |
| Security Scan          | `npm run security:scan:all`   | No high-severity vulnerabilities |
| Performance Tests      | `npm run test:perf`           | Meets performance benchmarks     |
| RLS Tests              | `npm run test:rls`            | All RLS policies enforced        |
| Database Validation    | `pnpm run db:validate`         | All fixes validated              |
| SAML Tests             | `npm run test:saml`           | SAML compliance verified         |

#### Staging Commands

```bash
# View logs
npm run staging:logs

# Run tests against staging
npm run staging:test

# Stop staging
npm run staging:stop

# Clean up (removes volumes)
npm run staging:clean
```

### Production Go-Live & Final Audit

#### P0 - Must Complete Priorities (Blockers)

Before production deployment, these **MUST** be completed:

##### 1. Monitoring Dashboards Deployment

```bash
# Deploy Grafana dashboards
kubectl apply -f monitoring/grafana/dashboards/

# Verify dashboards are accessible
curl -f http://grafana.yourdomain.com/api/health
```

**Required Dashboards:**

- Application Performance
- Database Metrics
- Error Rates
- User Activity

##### 2. Backup Restore Drill

```bash
# Create backup
pnpm run db:backup

# Test restore (on staging)
pnpm run db:restore --backup=<backup-file>

# Verify data integrity
pnpm run db:validate
```

**Success Criteria:**

- Backup completes in < 5 minutes
- Restore completes successfully
- All data integrity checks pass

##### 3. Security Audit Fixes

**Critical Security Issues (10 items):**

```bash
# 1. Verify RLS on all tables
npm run test:rls

# 2. Validate tenant isolation
pnpm run db:validate

# 3. Check RBAC enforcement
npm run test:rbac

# 4. Scan for vulnerabilities
npm run security:scan:all

# 5. Check for console.log statements
npm run lint:console
```

**All must pass before production deployment.**

#### Pre-Deployment Checklist

Run the automated checklist:

```bash
bash scripts/pre-deployment-checklist.sh
```

**Manual Verification:**

- [ ] All P0 items completed
- [ ] DevOps Lead sign-off obtained
- [ ] Security audit passed
- [ ] Backup restore drill successful
- [ ] Monitoring dashboards deployed
- [ ] All tests passing in staging
- [ ] Performance benchmarks met
- [ ] No console.log statements
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] DNS configured
- [ ] CDN configured (if applicable)

#### Production Deployment

**Option A: Using Deploy Script**

```bash
# Deploy to production
bash scripts/deploy.sh prod
```

**Option B: CI/CD Pipeline**

```bash
# Merge to main branch triggers deployment
git checkout main
git merge develop
git push origin main
```

**Option C: Manual Deployment**

```bash
# Build Docker image
docker build -t valuecanvas:latest .

# Push to registry
docker push your-registry/valuecanvas:latest

# Deploy to Kubernetes
kubectl apply -f infra/infra/k8s/production/

# Or Docker Compose
docker-compose -f infra/docker/docker-compose.prod.yml up -d --build
```

#### Post-Deployment Verification

```bash
# Run golden path monitors against production
PLAYWRIGHT_BASE_URL=https://yourdomain.com npm run monitor:golden-path

# Check health endpoints
curl -f https://yourdomain.com/health

# Verify monitoring
curl -f https://grafana.yourdomain.com/api/health

# Check logs
kubectl logs -f deployment/valuecanvas-app -n production
```

#### Rollback Procedure

If deployment fails:

```bash
# Quick rollback
kubectl rollout undo deployment/valuecanvas-app -n production

# Or with Docker Compose
docker-compose -f infra/docker/docker-compose.prod.yml down
docker-compose -f infra/docker/docker-compose.prod.yml up -d --no-deps app
```

## Operational Runbooks

### Deployment Procedures by Service

#### Frontend (Vite/React UI)

1. **Pre-flight**: Ensure `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; LLM keys must be configured in the server/edge runtime (e.g., Supabase function `llm-proxy`).
2. **Build**: `npm ci && npm run build` (artifacts emitted to `dist/`).
3. **Smoke test**: `npm run preview -- --host 0.0.0.0 --port 4173` and validate `/documentation` renders.
4. **Deploy**: Upload `dist/` to the CDN/edge host (e.g., Vercel/Netlify) with cache invalidation on `public/public/index.html` and `assets/*`.
5. **Post-deploy**: Run synthetic check hitting `/` and `/documentation` to confirm UI hydration and documentation search bar load.

#### Agent Fabric & Lifecycle Services

1. **Pre-flight**: Confirm Supabase URL/Anon key plus LLM provider credentials are present in the runtime environment.
2. **Migrations**: Apply agent fabric migrations (`supabase db push`), ensuring vector extensions are enabled.
3. **Seed data**: Run the agent seed script to populate `agents`, `agent_tools`, and workflow metadata.
4. **Deploy**: Roll out the Node service bundle or serverless functions with the same version tag as the UI release.
5. **Validation**: Use the command bar (`⌘K`/`Ctrl+K`) to issue a sample value-case request and verify session creation in `agent_sessions`.

#### Orchestration Layer (Workflow/DAG Engine)

1. **Pre-flight**: Validate access to the orchestration database tables (`workflows`, `workflow_executions`, `task_queue`).
2. **Config sync**: Align workflow definitions with Git-managed JSON/DAG specs; run schema diff to prevent drift.
3. **Deploy**: Publish the orchestrator service with feature flags set for staged rollout (`ORCHESTRATOR_ENABLED`, `REFLECTION_ENGINE_ENABLED`).
4. **Health check**: Trigger a dry-run workflow and confirm status transitions from `queued → running → completed` within SLO thresholds.

#### Supabase (Database, RLS, Storage)

1. **Pre-flight**: Backup the database snapshot before schema changes.
2. **Migrations**: Apply the latest migration files in chronological order; monitor for RLS policy conflicts.
3. **Storage assets**: Sync documentation media and component registry assets to Supabase Storage buckets.
4. **Validation**: Run smoke queries against `value_cases`, `doc_pages`, and `agent_metrics` to ensure RLS access works for anon and authenticated roles.

### Troubleshooting Guide (Common Failures)

- **LLM provider failures (401/429)**: Rotate API keys, reduce concurrency in orchestrator config, and fall back to the alternate provider (`VITE_OPENAI_API_KEY`).
- **Supabase connection errors**: Re-issue service role keys, verify IP allowlists, and confirm PostgREST availability.
- **Documentation search returns empty**: Rebuild search indexes by re-saving affected `doc_pages`; confirm analytics tables are writable.
- **Workflow stuck in `queued`**: Inspect `task_queue` for orphaned tasks, restart orchestrator workers, and replay with idempotency keys.
- **Frontend build failures**: Clear `node_modules` and rerun `npm ci`; verify TypeScript config matches `tsconfig.app.json` presets.
- **RLS permission denials**: Check session tokens, validate policy rules in `policy_rules`, and test with a service role to isolate policy errors.

### Rollback Procedures by Epic

- **Epic 1: Value Fabric Data Layer**: Revert to the previous migration snapshot and restore backups of `value_tree_nodes`, `value_tree_links`, and `roi_models`; invalidate cached semantic embeddings if schemas changed.
- **Epic 2: Lifecycle Agents**: Deploy the last known-good agent bundle; clear in-flight `agent_sessions` to prevent mixed-version state; disable new runs via feature flag until validation completes.
- **Epic 3: ROI Engine & Financial Modeling**: Roll back formula interpreter deployment and restore the prior `roi_model_calculations` data snapshot; replay benchmark seed data to rehydrate lookups.
- **Epic 4: Orchestration Layer**: Drain `task_queue`, pause new dispatching, and redeploy the previous orchestrator version; replay workflows from saved checkpoints in `workflow_executions`.
- **Epic 5: Server-Driven UI (SDUI)**: Switch UI registry to the prior schema version, re-publish the earlier component manifest, and invalidate CDN caches serving SDUI payloads.
- **Epic 6: Governance & Compliance**: Restore the last version of policy rules, re-enable baseline guardrails, and re-run the Integrity Agent against recent value cases to confirm compliance.
- **Epic 7: Performance & Reliability**: Revert performance-related flags (caching, batching thresholds) to defaults and roll back observability collectors if they degrade latency.

### On-Call Runbook & Escalation

- **Triage windows**: P0 (immediate, user-visible outage), P1 (degraded path, SLO at risk within 1 hour), P2 (non-urgent defect).
- **First response**: Acknowledge in the incident channel within 5 minutes, capture timeline, and assign an Incident Commander (IC).
- **Stabilization checklist**:
  - Confirm LLM provider health and rotate keys if rate limits occur.
  - Verify Supabase availability and RLS policy integrity.
  - Check orchestrator worker queue depth and restart stuck workers.
  - Run UI smoke checks on `/` and `/documentation`.
- **Escalation paths**:
  - Platform/SRE for database or infra-level issues.
  - Application team for agent orchestration or SDUI regressions.
  - Security/compliance lead for policy or metadata schema incidents.
- **Communication**: Publish incident updates every 15 minutes for P0/P1, including impact, mitigation steps, and ETA.
- **Closure**: Document root cause, corrective actions, and update this runbook if new playbooks emerge.

## Performance Monitoring Guide

### Core Web Vitals

#### Interaction to Next Paint (INP)

**Target:** < 200ms | **Warning:** 300ms | **Critical:** > 500ms

INP measures responsiveness throughout the page lifecycle. It tracks the time from user interaction (click, tap, keystroke) to the next paint.

```typescript
// Automatically tracked when observeWebVitals() is called
performanceMonitor.observeWebVitals();

// View INP metrics
const inpMetrics = performanceMonitor.getMetrics("web-vitals.inp");
```

#### Total Blocking Time (TBT)

**Target:** < 200ms | **Warning:** 400ms | **Critical:** > 600ms

TBT measures the total time the main thread is blocked by long tasks (> 50ms) between First Contentful Paint and Time to Interactive.

#### First Contentful Paint (FCP)

**Target:** < 1.8s | **Warning:** 2.5s | **Critical:** > 3s

FCP measures when the first content appears on screen.

#### Largest Contentful Paint (LCP)

**Target:** < 2.5s | **Warning:** 3.5s | **Critical:** > 4s

LCP measures when the largest content element becomes visible.

#### Cumulative Layout Shift (CLS)

**Target:** ≤ 0.1 | **Warning:** 0.15 | **Critical:** > 0.25

CLS measures visual stability by tracking unexpected layout shifts.

### Custom Metrics

#### Component Performance Measurement

```typescript
// Start measuring
const endMeasure = performanceMonitor.startMeasure("component.load");

// ... perform operation ...

// End measurement and get duration
const duration = endMeasure();
console.log(`Operation took ${duration}ms`);
```

#### Throughput Tracking

```typescript
const actionCount = 100;
const duration = 1000; // ms

performanceMonitor.measureThroughput("button-clicks", actionCount, duration);
// Result: 100 actions/second
```

#### Error Rate Monitoring

```typescript
// Record operations
performanceMonitor.recordOperation("api-call", true, 150); // success
performanceMonitor.recordOperation("api-call", false, 200); // failure

// Calculate error rate (last 60 seconds)
const errorRate = performanceMonitor.calculateErrorRate("api-call", 60000);
console.log(`Error rate: ${errorRate}%`);
```

**Target:** < 1% error rate

#### Animation Frame Rate

```typescript
// Monitor for 1 second
const fps = await performanceMonitor.monitorFrameRate(1000);
console.log(`Animation running at ${fps} FPS`);
```

**Target:** 60 FPS for smooth animations

#### Memory Usage

```typescript
performanceMonitor.trackMemoryUsage();

const memoryMetrics = performanceMonitor.getMetrics("memory.used");
// Value in MB
```

### Performance Reports

```typescript
const report = performanceMonitor.generateReport();

console.log("Summary:", report.summary);
// {
//   'web-vitals.inp': { avg: 180, p50: 150, p95: 250, p99: 300 },
//   'api-call': { avg: 200, p50: 180, p95: 350, p99: 450 }
// }

console.log("Issues:", report.issues);
// [
//   { name: 'settings.panel.load', severity: 'warning', value: 350 }
// ]
```

## Authentication Testing Documentation

### Overview

This directory contains comprehensive testing documentation and implementation for ValueOS's authentication system. The test suite is designed to achieve **100% confidence** that users will experience **zero issues** during account setup and login processes.

### Test Coverage Summary

| Metric                | Value      | Status       |
| --------------------- | ---------- | ------------ |
| **Total Test Cases**  | 306+       | ✅           |
| **Code Coverage**     | 92%        | ✅           |
| **Unit Tests**        | 146        | ✅ 100% Pass |
| **Component Tests**   | 102        | ✅ 100% Pass |
| **Integration Tests** | 18         | ✅ 100% Pass |
| **E2E Tests**         | 32         | 🔄 95% Pass  |
| **Load Tests**        | 8          | ✅ 100% Pass |
| **Security Scans**    | 0 Critical | ✅           |

### Security Testing

All security vulnerabilities tested and mitigated:

- ✅ SQL Injection
- ✅ Cross-Site Scripting (XSS)
- ✅ Cross-Site Request Forgery (CSRF)
- ✅ Password Security
- ✅ Session Security
- ✅ Rate Limiting
- ✅ Brute Force Protection
- ✅ User Enumeration
- ✅ Timing Attacks
- ✅ Token Security

**Security Confidence:** 100% ✅

### Performance Benchmarks

| Operation | Target | Actual | Status |
| --------- | ------ | ------ | ------ |
| Login     | < 1s   | 0.8s   | ✅     |
| Signup    | < 2s   | 1.5s   | ✅     |
| Page Load | < 2s   | 1.2s   | ✅     |
| 100 Users | < 1s   | 0.9s   | ✅     |
| 500 Users | < 2s   | 1.7s   | ✅     |

**Performance Confidence:** 100% ✅

### Accessibility

**WCAG 2.1 Level AA Compliance:** ✅ 100%

- Keyboard navigation
- Screen reader support
- Color contrast
- Focus indicators
- ARIA labels
- Error announcements

### Browser Support

**Tested and Passing:**

- Chrome (Latest, Latest-1) ✅
- Firefox (Latest, Latest-1) ✅
- Safari (Latest, Latest-1) ✅
- Edge (Latest) ✅
- Safari iOS ✅
- Chrome Android ✅

### Running Tests

#### Unit Tests

```bash
# All unit tests
npm test -- src/services/__tests__/Auth --run

# With coverage
npm test -- --coverage --run

# Specific test file
npm test -- src/services/__tests__/AuthService.signup.test.ts --run
```

#### Component Tests

```bash
# All component tests
npm test -- src/views/Auth/__tests__ --run

# Specific component
npm test -- src/views/Auth/__tests__/LoginPage.test.tsx --run
```

#### Integration Tests

```bash
npm test -- src/services/__tests__/auth.integration.test.ts --run
```

#### E2E Tests

```bash
# Install Playwright (first time only)
npx playwright install

# Run E2E tests
npx playwright test tests/e2e/auth-complete-flow.spec.ts

# Run in headed mode (see browser)
npx playwright test tests/e2e/auth-complete-flow.spec.ts --headed

# Run specific test
npx playwright test tests/e2e/auth-complete-flow.spec.ts --grep "E2E-001"
```

#### Security Tests

```bash
# Security-specific tests
npm test -- src/services/__tests__/auth.security.test.ts --run

# OWASP ZAP scan (Docker required)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5173 \
  -r security-report.html
```

#### Load Tests

```bash
# Install k6 (first time only)
# macOS: brew install k6
# Ubuntu: sudo apt install k6

# Run load test
k6 run tests/load/auth-load-test.js

# Custom load
k6 run --vus 100 --duration 5m tests/load/auth-load-test.js
```

## CI/CD Pipeline

### Quality Gates

The CI/CD pipeline enforces these checks:

- **Linting**: ESLint code quality
- **Type checking**: TypeScript validation
- **Testing**: Unit and integration tests
- **Security**: Dependency scanning and secret detection
- **Build**: Production build verification

### Local Quality Gate Verification

```bash
# Run all CI checks locally
pnpm run ci:verify

# Individual checks
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
```

### Pipeline Stages

1. **Lint & Test**: Code quality and unit tests
2. **Build**: Create production artifacts
3. **Security Scan**: Dependency and secret scanning
4. **Deploy Staging**: Automated staging deployment
5. **Integration Tests**: End-to-end testing
6. **Deploy Production**: Manual approval required

## Monitoring & Observability

### Key Metrics

**Application Metrics:**

- Response time (p95 < 200ms)
- Error rate (< 1%)
- Request rate
- Active users

**Infrastructure Metrics:**

- CPU usage (< 70%)
- Memory usage (< 80%)
- Database connections
- Pod restarts

### Dashboards

**Grafana Dashboards:**

- Application Performance
- Database Metrics
- Error Tracking
- User Activity
- Infrastructure Health

**Custom Queries:**

```sql
-- Service role operations
SELECT
  date_trunc('hour', timestamp) as time,
  count(*) as operations,
  service_role
FROM audit.activity_log
WHERE is_service_operation = TRUE
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY time, service_role;

-- RLS policy verification
SELECT * FROM security.verify_rls_enabled();
```

### Alerting

**Critical Alerts:**

- Application down
- High error rate (> 5%)
- Database connection issues
- Security violations

**Response Procedures:**

1. Acknowledge alert within 5 minutes
2. Assess impact and severity
3. Execute mitigation steps
4. Communicate status updates
5. Document root cause and resolution

## Troubleshooting

### Common Issues

**Application Not Starting:**

```bash
# Check logs
kubectl logs -f deployment/valueos-app

# Verify environment variables
kubectl exec -it deployment/valueos-app -- env

# Check database connectivity
kubectl exec -it deployment/valueos-app -- pnpm run db:check
```

**High Latency:**

```bash
# Check resource usage
kubectl top pods

# Review application metrics
curl http://localhost:3000/metrics

# Database performance
pnpm run db:performance-check
```

**Deployment Failures:**

```bash
# Check rollout status
kubectl rollout status deployment/valueos-app

# View deployment events
kubectl describe deployment/valueos-app

# Check pod status
kubectl get pods -l app=valueos
```

### Emergency Contacts

- **On-call SRE**: PagerDuty rotation
- **Security Incidents**: security@company.com
- **Database Issues**: dba@company.com
- **Application Support**: devops@company.com

## Performance Optimization

### Application Performance

- **Caching**: Redis for session and data caching
- **Database Indexing**: Optimized queries and indexes
- **CDN**: Static asset delivery
- **Load Balancing**: Traffic distribution

### Infrastructure Scaling

- **Horizontal Pod Autoscaling**: CPU/memory based scaling
- **Database Read Replicas**: Read query distribution
- **Caching Layers**: Multi-level caching strategy

### Monitoring Performance

- **APM**: Application performance monitoring
- **Log Aggregation**: Centralized logging
- **Metrics Collection**: Prometheus metrics
- **Distributed Tracing**: Request tracing

## Backup & Recovery

### Database Backups

```bash
# Automated backups
pnpm run db:backup  # Daily automated

# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup-20240115.sql
```

### Application Backups

- **Configuration**: Git version control
- **Secrets**: Backup encryption keys
- **User Data**: Database backups
- **File Storage**: S3 bucket versioning

### Disaster Recovery

**Recovery Time Objectives (RTO)**: 4 hours
**Recovery Point Objectives (RPO)**: 1 hour

**Recovery Steps:**

1. Restore from latest backup
2. Rebuild infrastructure with Terraform
3. Deploy application from CI/CD
4. Verify system integrity
5. Route traffic back to primary region

## Compliance & Governance

### Security Compliance

- **OWASP Top 10**: 100% coverage
- **SOC 2**: Audit trail and access controls
- **GDPR**: Data protection and privacy
- **ISO 27001**: Information security management

### Operational Compliance

- **Change Management**: Deployment approvals
- **Incident Response**: 24/7 on-call rotation
- **Documentation**: Runbooks and procedures
- **Training**: Team certification requirements

---

**Documentation Status**: ✅ **Complete**
**Coverage**: 50+ operational files consolidated
**Last Updated**: January 14, 2026
**Version**: 1.0
**Maintained By**: Operations Team
