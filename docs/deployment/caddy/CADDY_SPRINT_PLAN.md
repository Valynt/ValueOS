# Caddy Implementation - Sprint Plan

**Timeline:** 6 weeks (3 sprints × 2 weeks)  
**Team:** 2 developers + 1 DevOps  
**Start Date:** Week of 2025-12-09

---

## Sprint 1: Custom Domain Management (Weeks 1-2)

**Goal:** Enable tenants to add and verify custom domains with automatic SSL

### Sprint 1.1 - Backend Foundation (Week 1)

#### Task 1.1.1: Database Schema & Migration
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create `custom_domains` table schema
- [ ] Create `domain_verification_logs` table
- [ ] Add RLS policies for tenant isolation
- [ ] Write migration script
- [ ] Test migration on local database
- [ ] Document schema in README

**Acceptance Criteria:**
- Migration runs without errors
- RLS policies enforce tenant isolation
- Indexes created for performance
- Rollback script tested

**Files to Create:**
- `supabase/migrations/YYYYMMDD_custom_domains.sql`
- `supabase/migrations/YYYYMMDD_domain_verification_logs.sql`

---

#### Task 1.1.2: Domain Validator Service - Core
**Priority:** P0  
**Estimate:** 8 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create service directory structure
- [ ] Implement `/verify` endpoint for Caddy
- [ ] Implement database query logic
- [ ] Add 5-minute caching layer
- [ ] Implement `/health` endpoint
- [ ] Add logging and error handling
- [ ] Write unit tests

**Acceptance Criteria:**
- `/verify?domain=example.com` returns 200 for verified domains
- Returns 404 for unverified domains
- Cache reduces database queries by 90%
- Health check returns service status
- 95%+ test coverage

**Files to Create:**
- `services/domain-validator/server.ts`
- `services/domain-validator/package.json`
- `services/domain-validator/tsconfig.json`
- `services/domain-validator/Dockerfile`
- `services/domain-validator/__tests__/validator.test.ts`

---

#### Task 1.1.3: Domain Management API - Endpoints
**Priority:** P0  
**Estimate:** 8 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create domain routes file
- [ ] Implement POST `/api/v1/domains` (add domain)
- [ ] Implement GET `/api/v1/domains` (list domains)
- [ ] Implement POST `/api/v1/domains/:id/verify` (verify domain)
- [ ] Implement DELETE `/api/v1/domains/:id` (remove domain)
- [ ] Add input validation (Zod schemas)
- [ ] Add authentication middleware
- [ ] Write integration tests

**Acceptance Criteria:**
- All endpoints functional
- Input validation prevents invalid domains
- Authentication required for all endpoints
- Tenant isolation enforced
- OpenAPI spec generated
- 90%+ test coverage

**Files to Create:**
- `src/backend/routes/domains.ts`
- `src/backend/controllers/domainController.ts`
- `src/backend/services/domainService.ts`
- `src/backend/validators/domainValidator.ts`
- `src/backend/__tests__/domains.test.ts`

---

#### Task 1.1.4: DNS Verification Logic
**Priority:** P0  
**Estimate:** 6 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Implement DNS TXT record lookup
- [ ] Generate verification tokens
- [ ] Implement verification workflow
- [ ] Add retry logic for DNS propagation
- [ ] Log verification attempts
- [ ] Handle verification failures
- [ ] Write unit tests

**Acceptance Criteria:**
- DNS TXT records verified correctly
- Tokens are cryptographically secure
- Retry logic handles DNS propagation delays
- Verification logs stored for audit
- Error messages are user-friendly

**Files to Create:**
- `src/backend/services/dnsVerification.ts`
- `src/backend/utils/tokenGenerator.ts`
- `src/backend/__tests__/dnsVerification.test.ts`

---

#### Task 1.1.5: Domain Validator Deployment
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Create Docker Compose service definition
- [ ] Create Kubernetes deployment manifest
- [ ] Create Kubernetes service manifest
- [ ] Configure environment variables
- [ ] Set up health checks
- [ ] Deploy to staging
- [ ] Verify connectivity from Caddy

**Acceptance Criteria:**
- Service runs in Docker Compose
- Service runs in Kubernetes
- Health checks passing
- Caddy can reach validator service
- Logs visible in monitoring

**Files to Create:**
- `infra/infra/docker/compose.domain-validator.yml`
- `infra/infra/k8s/domain-validator/deployment.yaml`
- `infra/infra/k8s/domain-validator/service.yaml`
- `infra/infra/k8s/domain-validator/configmap.yaml`

---

### Sprint 1.2 - Frontend & Integration (Week 2)

#### Task 1.2.1: Caddy Configuration Update
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Add on-demand TLS block to Caddyfile.prod
- [ ] Configure domain validator endpoint
- [ ] Set rate limits for certificate requests
- [ ] Test configuration locally
- [ ] Deploy to staging
- [ ] Verify SSL certificate issuance
- [ ] Document configuration

**Acceptance Criteria:**
- On-demand TLS working
- Caddy queries validator service
- SSL certificates issued automatically
- Rate limits prevent abuse
- Zero downtime during deployment

**Files to Modify:**
- `Caddyfile.prod`
- `Caddyfile.staging`

---

#### Task 1.2.2: Domain Management UI - Components
**Priority:** P0  
**Estimate:** 8 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Create domain management page
- [ ] Create add domain form component
- [ ] Create domain list component
- [ ] Create domain status badge component
- [ ] Create verification instructions component
- [ ] Add loading states
- [ ] Add error handling
- [ ] Write component tests

**Acceptance Criteria:**
- UI matches design mockups
- Forms have proper validation
- Loading states prevent duplicate submissions
- Error messages are user-friendly
- Responsive design works on mobile
- Accessibility standards met (WCAG 2.1)

**Files to Create:**
- `src/pages/settings/DomainsPage.tsx`
- `src/components/domains/AddDomainForm.tsx`
- `src/components/domains/DomainList.tsx`
- `src/components/domains/DomainStatusBadge.tsx`
- `src/components/domains/VerificationInstructions.tsx`
- `src/components/domains/__tests__/AddDomainForm.test.tsx`

---

#### Task 1.2.3: Domain Management UI - API Integration
**Priority:** P0  
**Estimate:** 6 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Create domain API client
- [ ] Implement React Query hooks
- [ ] Add optimistic updates
- [ ] Implement error handling
- [ ] Add success notifications
- [ ] Handle loading states
- [ ] Write integration tests

**Acceptance Criteria:**
- API calls work correctly
- Optimistic updates provide instant feedback
- Errors handled gracefully
- Loading states prevent race conditions
- Cache invalidation works properly

**Files to Create:**
- `src/api/domains.ts`
- `src/hooks/useDomains.ts`
- `src/hooks/useAddDomain.ts`
- `src/hooks/useVerifyDomain.ts`
- `src/hooks/__tests__/useDomains.test.ts`

---

#### Task 1.2.4: E2E Testing - Custom Domain Flow
**Priority:** P1  
**Estimate:** 6 hours  
**Assignee:** QA/Backend Dev

**Subtasks:**
- [ ] Write E2E test for adding domain
- [ ] Write E2E test for DNS verification
- [ ] Write E2E test for SSL certificate issuance
- [ ] Write E2E test for domain deletion
- [ ] Mock DNS responses for testing
- [ ] Set up test domain in staging
- [ ] Document test scenarios

**Acceptance Criteria:**
- All E2E tests pass
- Tests cover happy path and error cases
- Tests run in CI/CD pipeline
- Test data cleanup automated
- Test documentation complete

**Files to Create:**
- `test/e2e/custom-domains.spec.ts`
- `test/e2e/helpers/dnsHelpers.ts`
- `test/e2e/fixtures/domains.json`

---

#### Task 1.2.5: Documentation - Custom Domains
**Priority:** P1  
**Estimate:** 4 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Write user guide for adding custom domains
- [ ] Create DNS verification instructions
- [ ] Document troubleshooting steps
- [ ] Create video tutorial script
- [ ] Write API documentation
- [ ] Update deployment guide
- [ ] Create FAQ section

**Acceptance Criteria:**
- User guide is clear and concise
- DNS instructions include all major providers
- Troubleshooting covers common issues
- API documentation auto-generated from OpenAPI
- Deployment guide updated

**Files to Create:**
- `docs/user-guides/custom-domains.md`
- `docs/user-guides/dns-verification.md`
- `docs/troubleshooting/custom-domains.md`
- `docs/api/domains-api.md`

---

#### Task 1.2.6: Sprint 1 Deployment & Validation
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Deploy database migration to staging
- [ ] Deploy domain validator to staging
- [ ] Deploy backend API to staging
- [ ] Deploy frontend to staging
- [ ] Update Caddy configuration in staging
- [ ] Run smoke tests
- [ ] Validate with test domain
- [ ] Deploy to production (if staging passes)

**Acceptance Criteria:**
- All services deployed successfully
- Smoke tests pass
- Test domain verified successfully
- SSL certificate issued
- No errors in logs
- Rollback plan documented

---

## Sprint 2: Subdomain Multi-Tenancy (Weeks 3-4)

**Goal:** Enable tenant-specific subdomains with wildcard SSL

### Sprint 2.1 - Infrastructure & Routing (Week 3)

#### Task 2.1.1: Wildcard DNS Configuration
**Priority:** P0  
**Estimate:** 2 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Configure wildcard DNS record (*.valuecanvas.com)
- [ ] Verify DNS propagation
- [ ] Test subdomain resolution
- [ ] Document DNS configuration
- [ ] Update Terraform if needed

**Acceptance Criteria:**
- Wildcard DNS resolves correctly
- All subdomains point to Caddy
- DNS propagation complete
- Documentation updated

---

#### Task 2.1.2: Tenant Subdomain Schema
**Priority:** P0  
**Estimate:** 3 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create `tenant_subdomains` table
- [ ] Add subdomain validation constraints
- [ ] Add RLS policies
- [ ] Create migration script
- [ ] Add subdomain to organizations table
- [ ] Write tests

**Acceptance Criteria:**
- Table created with proper constraints
- Subdomain format validated (alphanumeric + hyphens)
- Unique constraint prevents conflicts
- RLS policies enforce tenant isolation

**Files to Create:**
- `supabase/migrations/YYYYMMDD_tenant_subdomains.sql`

---

#### Task 2.1.3: Caddy Wildcard Configuration
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Add wildcard subdomain block to Caddyfile
- [ ] Configure DNS challenge for wildcard SSL
- [ ] Add subdomain extraction logic
- [ ] Configure tenant header injection
- [ ] Test locally with hosts file
- [ ] Deploy to staging
- [ ] Verify wildcard SSL certificate

**Acceptance Criteria:**
- Wildcard SSL certificate issued
- Subdomain extracted correctly
- X-Tenant-ID header set
- Routing works for all subdomains
- Reserved subdomains blocked (www, api, admin)

**Files to Modify:**
- `Caddyfile.prod`
- `Caddyfile.staging`

---

#### Task 2.1.4: Tenant Resolution Middleware
**Priority:** P0  
**Estimate:** 6 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create tenant resolver middleware
- [ ] Implement subdomain lookup
- [ ] Implement custom domain lookup
- [ ] Add caching layer
- [ ] Handle tenant not found errors
- [ ] Add logging
- [ ] Write unit tests

**Acceptance Criteria:**
- Tenant resolved from subdomain
- Tenant resolved from custom domain
- Cache reduces database queries
- 404 returned for invalid tenants
- Middleware works with existing auth

**Files to Create:**
- `src/backend/middleware/tenantResolver.ts`
- `src/backend/services/tenantLookup.ts`
- `src/backend/__tests__/tenantResolver.test.ts`

---

#### Task 2.1.5: Subdomain API Endpoints
**Priority:** P0  
**Estimate:** 6 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create subdomain routes
- [ ] Implement POST `/api/v1/subdomains/check` (availability)
- [ ] Implement POST `/api/v1/subdomains` (claim subdomain)
- [ ] Implement GET `/api/v1/subdomains` (get current)
- [ ] Add validation for subdomain format
- [ ] Write integration tests

**Acceptance Criteria:**
- Subdomain availability checked
- Subdomain claimed successfully
- Conflicts prevented
- Reserved subdomains blocked
- Tests cover edge cases

**Files to Create:**
- `src/backend/routes/subdomains.ts`
- `src/backend/controllers/subdomainController.ts`
- `src/backend/__tests__/subdomains.test.ts`

---

### Sprint 2.2 - Frontend & Testing (Week 4)

#### Task 2.2.1: Subdomain Selection UI
**Priority:** P0  
**Estimate:** 6 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Create subdomain selection component
- [ ] Add availability check with debouncing
- [ ] Add real-time validation
- [ ] Show subdomain preview
- [ ] Add loading states
- [ ] Write component tests

**Acceptance Criteria:**
- Subdomain availability checked in real-time
- Validation prevents invalid subdomains
- Preview shows full URL
- Loading states prevent duplicate checks
- Error messages are helpful

**Files to Create:**
- `src/components/onboarding/SubdomainSelector.tsx`
- `src/components/onboarding/__tests__/SubdomainSelector.test.tsx`

---

#### Task 2.2.2: Subdomain Management UI
**Priority:** P1  
**Estimate:** 4 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Add subdomain display to settings
- [ ] Show current subdomain
- [ ] Add subdomain change workflow (if allowed)
- [ ] Update navigation to use subdomain
- [ ] Write tests

**Acceptance Criteria:**
- Current subdomain displayed
- Change workflow clear
- Navigation uses subdomain URLs
- Tests cover all scenarios

**Files to Create:**
- `src/components/settings/SubdomainSettings.tsx`
- `src/components/settings/__tests__/SubdomainSettings.test.tsx`

---

#### Task 2.2.3: Tenant Context Integration
**Priority:** P0  
**Estimate:** 6 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Update all API routes to use tenant context
- [ ] Add tenant validation to RLS policies
- [ ] Update database queries with tenant filter
- [ ] Test tenant isolation
- [ ] Add tenant context to logs

**Acceptance Criteria:**
- All queries filtered by tenant
- Cross-tenant access prevented
- RLS policies enforced
- Logs include tenant context
- Performance not degraded

**Files to Modify:**
- Multiple route files
- Multiple service files

---

#### Task 2.2.4: E2E Testing - Subdomain Flow
**Priority:** P1  
**Estimate:** 6 hours  
**Assignee:** QA/Backend Dev

**Subtasks:**
- [ ] Write E2E test for subdomain selection
- [ ] Write E2E test for subdomain routing
- [ ] Write E2E test for tenant isolation
- [ ] Write E2E test for wildcard SSL
- [ ] Set up test subdomains
- [ ] Document test scenarios

**Acceptance Criteria:**
- All E2E tests pass
- Tenant isolation verified
- SSL certificates work
- Tests run in CI/CD
- Documentation complete

**Files to Create:**
- `test/e2e/subdomains.spec.ts`
- `test/e2e/tenant-isolation.spec.ts`

---

#### Task 2.2.5: Documentation - Subdomains
**Priority:** P1  
**Estimate:** 3 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Write user guide for subdomains
- [ ] Document subdomain selection process
- [ ] Create troubleshooting guide
- [ ] Update API documentation
- [ ] Update deployment guide

**Acceptance Criteria:**
- User guide is clear
- Troubleshooting covers common issues
- API documentation updated
- Deployment guide includes DNS setup

**Files to Create:**
- `docs/user-guides/subdomains.md`
- `docs/troubleshooting/subdomains.md`

---

#### Task 2.2.6: Sprint 2 Deployment & Validation
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Deploy database migration
- [ ] Update Caddy configuration
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Run smoke tests
- [ ] Validate with test subdomains
- [ ] Monitor for issues

**Acceptance Criteria:**
- All services deployed
- Smoke tests pass
- Test subdomains work
- Wildcard SSL active
- No errors in logs

---

## Sprint 3: Advanced Features (Weeks 5-6)

**Goal:** Per-tenant rate limiting and observability

### Sprint 3.1 - Rate Limiting (Week 5)

#### Task 3.1.1: Caddy Rate Limit Plugin
**Priority:** P1  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Build Caddy with rate-limit plugin
- [ ] Update Dockerfile.caddy
- [ ] Test plugin locally
- [ ] Deploy to staging
- [ ] Verify rate limiting works

**Acceptance Criteria:**
- Plugin compiled successfully
- Rate limiting functional
- No performance degradation
- Staging deployment successful

**Files to Modify:**
- `Dockerfile.caddy`

---

#### Task 3.1.2: Tenant Tier Schema
**Priority:** P1  
**Estimate:** 3 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create `tenant_tiers` table
- [ ] Add tier to organizations table
- [ ] Create default tiers (free, pro, enterprise)
- [ ] Write migration script
- [ ] Add tier management API

**Acceptance Criteria:**
- Tiers table created
- Default tiers seeded
- Organizations linked to tiers
- API endpoints functional

**Files to Create:**
- `supabase/migrations/YYYYMMDD_tenant_tiers.sql`
- `src/backend/routes/tiers.ts`

---

#### Task 3.1.3: Per-Tenant Rate Limit Configuration
**Priority:** P1  
**Estimate:** 6 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Configure per-tenant rate limits in Caddy
- [ ] Implement tier-based limits
- [ ] Add rate limit headers
- [ ] Test with multiple tenants
- [ ] Document configuration

**Acceptance Criteria:**
- Rate limits enforced per tenant
- Tier-based limits working
- Rate limit headers returned
- Different tiers have different limits
- Configuration documented

**Files to Modify:**
- `Caddyfile.prod`

---

#### Task 3.1.4: Rate Limit Monitoring
**Priority:** P2  
**Estimate:** 4 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Log rate limit hits
- [ ] Create rate limit metrics
- [ ] Add rate limit dashboard
- [ ] Set up alerts for excessive hits
- [ ] Document monitoring

**Acceptance Criteria:**
- Rate limit hits logged
- Metrics visible in Grafana
- Alerts configured
- Dashboard shows per-tenant limits

---

### Sprint 3.2 - Observability (Week 6)

#### Task 3.2.1: Prometheus Integration
**Priority:** P1  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Enable Caddy metrics endpoint
- [ ] Configure Prometheus scraping
- [ ] Add custom metrics
- [ ] Test metrics collection
- [ ] Deploy to staging

**Acceptance Criteria:**
- Metrics endpoint exposed
- Prometheus scraping Caddy
- Custom metrics collected
- No performance impact

**Files to Modify:**
- `Caddyfile.prod`
- `infrastructure/prometheus/prometheus.yml`

---

#### Task 3.2.2: Grafana Dashboards
**Priority:** P1  
**Estimate:** 6 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Create Caddy overview dashboard
- [ ] Create per-tenant metrics dashboard
- [ ] Create SSL certificate dashboard
- [ ] Create rate limiting dashboard
- [ ] Import dashboards to Grafana
- [ ] Document dashboards

**Acceptance Criteria:**
- All dashboards functional
- Metrics display correctly
- Dashboards are intuitive
- Documentation complete

**Files to Create:**
- `infrastructure/grafana/dashboards/caddy-overview.json`
- `infrastructure/grafana/dashboards/tenant-metrics.json`
- `infrastructure/grafana/dashboards/ssl-certificates.json`
- `infrastructure/grafana/dashboards/rate-limiting.json`

---

#### Task 3.2.3: Alert Configuration
**Priority:** P1  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Create alert rules for certificate expiration
- [ ] Create alert rules for high error rates
- [ ] Create alert rules for rate limit violations
- [ ] Configure alert routing
- [ ] Test alerts
- [ ] Document alert runbooks

**Acceptance Criteria:**
- All alerts configured
- Alerts fire correctly
- Alert routing works
- Runbooks documented

**Files to Create:**
- `infrastructure/prometheus/alerts/caddy-alerts.yml`
- `docs/runbooks/caddy-alerts.md`

---

#### Task 3.2.4: Usage Analytics API
**Priority:** P2  
**Estimate:** 6 hours  
**Assignee:** Backend Dev

**Subtasks:**
- [ ] Create usage analytics endpoints
- [ ] Implement per-tenant usage tracking
- [ ] Add usage dashboard
- [ ] Write tests
- [ ] Document API

**Acceptance Criteria:**
- Usage tracked per tenant
- API returns accurate data
- Dashboard shows usage trends
- Tests cover all scenarios

**Files to Create:**
- `src/backend/routes/analytics.ts`
- `src/backend/services/usageAnalytics.ts`
- `src/backend/__tests__/analytics.test.ts`

---

#### Task 3.2.5: Final Documentation
**Priority:** P1  
**Estimate:** 4 hours  
**Assignee:** Frontend Dev

**Subtasks:**
- [ ] Update all documentation
- [ ] Create video tutorials
- [ ] Write deployment checklist
- [ ] Create troubleshooting guide
- [ ] Update README files

**Acceptance Criteria:**
- All documentation current
- Video tutorials recorded
- Deployment checklist complete
- Troubleshooting guide comprehensive

---

#### Task 3.2.6: Sprint 3 Deployment & Final Validation
**Priority:** P0  
**Estimate:** 4 hours  
**Assignee:** DevOps

**Subtasks:**
- [ ] Deploy all Sprint 3 changes
- [ ] Run full regression tests
- [ ] Validate all features end-to-end
- [ ] Monitor for 24 hours
- [ ] Create deployment report
- [ ] Plan post-launch monitoring

**Acceptance Criteria:**
- All features deployed
- Regression tests pass
- No critical issues
- Monitoring active
- Deployment report complete

---

## Summary

### Total Tasks: 42

**Sprint 1:** 12 tasks (Custom Domains)  
**Sprint 2:** 12 tasks (Subdomains)  
**Sprint 3:** 18 tasks (Advanced Features)

### Estimated Hours: 240 hours

**Sprint 1:** 80 hours  
**Sprint 2:** 80 hours  
**Sprint 3:** 80 hours

### Team Allocation

**Backend Dev:** ~120 hours  
**Frontend Dev:** ~60 hours  
**DevOps:** ~60 hours

---

## Ready to Execute

All tasks are:
- ✅ Clearly defined
- ✅ Estimated
- ✅ Prioritized
- ✅ Assigned to roles
- ✅ Have acceptance criteria
- ✅ Have file paths specified

**Next Step:** Begin execution with Sprint 1, Task 1.1.1
