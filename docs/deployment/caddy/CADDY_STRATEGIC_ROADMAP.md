# Caddy Strategic Roadmap for ValueCanvas

**Status:** Caddy is production-ready - Focus on strategic gaps  
**Date:** 2025-12-08  
**Purpose:** Complete multi-tenancy and custom domain features

---

## Current State Analysis

### ✅ What's Already Implemented

ValueCanvas has a **production-ready Caddy deployment** with:

- Automatic HTTPS (Let's Encrypt)
- Multi-environment configs (dev/staging/prod)
- Kubernetes deployment with HPA (3 replicas)
- Security headers (CSP, HSTS, X-Frame-Options)
- Rate limiting (60 req/min production)
- HTTP/2 and compression (gzip/zstd)
- Health checks and zero-downtime reloads
- Docker Compose for all environments

**Files:**
- `Caddyfile`, `Caddyfile.prod`, `Caddyfile.staging`
- `docker-compose.dev-caddy.yml`, `docker-compose.staging.yml`, `docker-compose.prod.yml`
- `k8s/caddy/` - Complete Kubernetes deployment
- `Dockerfile.caddy` - Container build

**Architecture:**
```
Internet → Caddy (80/443) → App (3000) → PostgreSQL/Redis
                                        ↓
                                   Supabase
```

---

## Strategic Gaps (What's Missing)

### 1. Custom Domain Management 🔴 **CRITICAL**

**Problem:** Tenants cannot add custom domains (e.g., `app.acme.com`)

**Business Impact:**
- Blocks premium tier features
- Reduces enterprise adoption
- Competitive disadvantage

**Technical Requirements:**
- Domain verification (DNS TXT records)
- Automatic SSL certificate provisioning
- Domain-to-tenant mapping
- Management UI/API

**Implementation:** See Phase 1 below

---

### 2. Subdomain Multi-Tenancy 🟡 **HIGH**

**Problem:** No subdomain routing (e.g., `acme.valuecanvas.com`)

**Business Impact:**
- Tenant branding limited
- URL structure not scalable
- Multi-tenant architecture incomplete

**Technical Requirements:**
- Wildcard DNS (`*.valuecanvas.com`)
- Subdomain extraction and routing
- Tenant resolution middleware
- Wildcard SSL certificates

**Implementation:** See Phase 2 below

---

### 3. Per-Tenant Rate Limiting 🟢 **MEDIUM**

**Problem:** Global rate limits, no tenant-specific controls

**Business Impact:**
- Cannot enforce tier-based limits
- One tenant can impact others
- No usage-based pricing

**Technical Requirements:**
- Caddy rate-limit plugin
- Tier-based limit configuration
- Per-tenant metrics

**Implementation:** See Phase 3 below

---

## Implementation Roadmap

### Phase 1: Custom Domain Foundation (2 weeks)

**Goal:** Enable tenants to add and verify custom domains

#### Tasks

**Week 1: Backend Infrastructure**

1. **Database Schema**
   ```sql
   CREATE TABLE custom_domains (
       id UUID PRIMARY KEY,
       tenant_id UUID REFERENCES organizations(id),
       domain TEXT UNIQUE NOT NULL,
       verified BOOLEAN DEFAULT FALSE,
       verification_token TEXT NOT NULL,
       ssl_status TEXT CHECK (ssl_status IN ('pending', 'active', 'failed')),
       created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Domain Validator Service**
   - HTTP endpoint for Caddy: `/verify?domain=example.com`
   - Query `custom_domains` table
   - 5-minute cache for performance
   - Health check endpoint

3. **API Endpoints**
   ```
   POST   /api/v1/domains          # Add domain
   POST   /api/v1/domains/:id/verify  # Verify domain
   GET    /api/v1/domains          # List domains
   DELETE /api/v1/domains/:id      # Remove domain
   ```

**Week 2: Integration & UI**

4. **Caddy Configuration**
   ```caddyfile
   :443 {
       tls {
           on_demand
       }
       on_demand_tls {
           ask http://domain-validator:3000/verify
           interval 5m
           burst 10
       }
       reverse_proxy app:5173 {
           header_up X-Custom-Domain {host}
       }
   }
   ```

5. **Frontend UI**
   - Domain management page
   - Add domain form
   - Verification instructions (DNS TXT)
   - Domain status display
   - Delete domain option

6. **Testing**
   - Unit tests for validator service
   - Integration tests for API
   - E2E test for complete flow
   - Load testing (100 domains)

#### Success Criteria

- ✅ Tenant can add custom domain via UI
- ✅ DNS verification works automatically
- ✅ SSL certificate issued within 2 minutes
- ✅ Custom domain routes to correct tenant
- ✅ 95%+ verification success rate

#### Deliverables

- Database migration script
- Domain validator service (Docker + K8s)
- API endpoints with OpenAPI spec
- Updated Caddyfile.prod
- Frontend UI components
- Test suite
- Documentation (setup guide, troubleshooting)

---

### Phase 2: Subdomain Multi-Tenancy (2 weeks)

**Goal:** Enable tenant-specific subdomains

#### Tasks

**Week 3: DNS & Routing**

1. **DNS Configuration**
   ```
   *.valuecanvas.com → Caddy Load Balancer IP
   ```

2. **Caddy Wildcard Config**
   ```caddyfile
   *.valuecanvas.com {
       tls {
           dns cloudflare {env.CLOUDFLARE_API_TOKEN}
       }
       
       @tenant expression {labels.2} != "www" && {labels.2} != "app"
       
       handle @tenant {
           header X-Tenant-ID {labels.2}
           reverse_proxy app:5173 {
               header_up X-Tenant-ID {labels.2}
           }
       }
   }
   ```

3. **Tenant Subdomain Mapping**
   ```sql
   CREATE TABLE tenant_subdomains (
       id UUID PRIMARY KEY,
       tenant_id UUID REFERENCES organizations(id),
       subdomain TEXT UNIQUE NOT NULL,
       CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
   );
   ```

**Week 4: Backend & UI**

4. **Tenant Resolution Middleware**
   ```typescript
   export function resolveTenant(req, res, next) {
       const tenantId = req.headers['x-tenant-id'];
       const customDomain = req.headers['x-custom-domain'];
       
       if (customDomain) {
           req.tenant = await getTenantByDomain(customDomain);
       } else if (tenantId) {
           req.tenant = await getTenantBySubdomain(tenantId);
       }
       
       next();
   }
   ```

5. **Subdomain Management UI**
   - Subdomain selection during onboarding
   - Subdomain availability check
   - Subdomain change workflow
   - Conflict prevention

6. **Testing**
   - Subdomain routing tests
   - Tenant isolation tests
   - Wildcard SSL verification
   - Performance testing

#### Success Criteria

- ✅ Tenants accessible via subdomain
- ✅ Wildcard SSL certificate issued
- ✅ Tenant context resolved correctly
- ✅ No subdomain conflicts
- ✅ < 50ms routing overhead

#### Deliverables

- DNS configuration guide
- Updated Caddyfile with wildcard
- Tenant resolver middleware
- Subdomain management UI
- Integration tests
- Documentation

---

### Phase 3: Advanced Features (2 weeks)

**Goal:** Per-tenant rate limiting and observability

#### Tasks

**Week 5: Rate Limiting**

1. **Caddy Rate Limit Plugin**
   ```dockerfile
   FROM caddy:2-builder AS builder
   RUN xcaddy build \
       --with github.com/mholt/caddy-ratelimit
   ```

2. **Per-Tenant Configuration**
   ```caddyfile
   *.valuecanvas.com {
       rate_limit {
           zone tenant_{labels.2} {
               key {labels.2}
               events 100
               window 1m
           }
       }
   }
   ```

3. **Tier-Based Limits**
   ```sql
   CREATE TABLE tenant_tiers (
       id UUID PRIMARY KEY,
       name TEXT UNIQUE NOT NULL,
       rate_limit_per_minute INTEGER NOT NULL,
       max_custom_domains INTEGER NOT NULL
   );
   
   ALTER TABLE organizations
   ADD COLUMN tier_id UUID REFERENCES tenant_tiers(id);
   ```

**Week 6: Observability**

4. **Prometheus Integration**
   ```caddyfile
   :8080 {
       metrics /metrics
   }
   ```

5. **Grafana Dashboards**
   - Request rate by tenant
   - Response time percentiles
   - Error rate by tenant
   - SSL certificate expiration
   - Rate limit hits

6. **Alerting**
   ```yaml
   - alert: CaddyCertificateExpiringSoon
     expr: caddy_certificate_expiry_seconds < 2592000
   ```

#### Success Criteria

- ✅ Rate limits enforced per tenant
- ✅ Tier-based limits working
- ✅ Metrics visible in Grafana
- ✅ Alerts configured
- ✅ Usage analytics available

#### Deliverables

- Caddy with rate-limit plugin
- Tier configuration system
- Prometheus scrape config
- Grafana dashboards
- Alert rules
- Usage analytics API

---

## Technical Architecture

### Custom Domain Flow

```
1. Tenant adds domain → API creates record with verification token
2. Tenant adds DNS TXT record → _valuecanvas-verify.example.com
3. Tenant clicks "Verify" → API checks DNS, marks verified
4. Caddy receives request → Queries domain-validator service
5. Domain validator checks DB → Returns 200 if verified
6. Caddy issues SSL cert → Let's Encrypt via ACME
7. Request routed to app → X-Custom-Domain header set
```

### Subdomain Flow

```
1. Tenant registers → Chooses subdomain (acme.valuecanvas.com)
2. DNS wildcard → *.valuecanvas.com points to Caddy
3. Request arrives → Caddy extracts subdomain from {labels.2}
4. Caddy sets header → X-Tenant-ID: acme
5. App resolves tenant → Middleware looks up tenant by subdomain
6. RLS enforced → PostgreSQL filters by tenant_id
```

### Domain Validator Service

```typescript
// services/domain-validator/server.ts
app.get('/verify', async (req, res) => {
    const domain = req.query.domain;
    
    // Check cache
    if (cache.has(domain)) {
        return res.status(200).send('OK');
    }
    
    // Query database
    const { data } = await supabase
        .from('custom_domains')
        .select('verified')
        .eq('domain', domain)
        .eq('verified', true)
        .single();
    
    if (data) {
        cache.set(domain, true, 300); // 5 min TTL
        return res.status(200).send('OK');
    }
    
    return res.status(404).send('Not verified');
});
```

---

## Security Considerations

### Domain Verification

**Prevent Hijacking:**
- Require DNS TXT record verification
- Rate limit verification attempts (5/hour)
- Expire tokens after 7 days
- Log all verification attempts

### SSL Certificates

**Protect Storage:**
- Persistent volumes with encryption
- Regular backups of `/data/caddy`
- Monitor expiration (30-day warning)
- Backup CA (ZeroSSL) configured

### Tenant Isolation

**Enforce Boundaries:**
- Validate tenant ownership before routing
- RLS policies at database level
- Audit all tenant context switches
- Log custom domain changes

---

## Monitoring & Alerts

### Key Metrics

**Domain Health:**
- Custom domains added/removed (rate)
- Verification success rate (target: >95%)
- SSL issuance failures
- Certificate expiration warnings

**Performance:**
- Request latency by tenant (p50, p95, p99)
- Rate limit hits by tenant
- Error rate by tenant
- Caddy resource usage

**Security:**
- Failed verifications
- Suspicious domain patterns
- Rate limit violations
- Certificate errors

### Alert Rules

```yaml
groups:
  - name: caddy
    rules:
      - alert: CertificateExpiringSoon
        expr: caddy_certificate_expiry_seconds < 2592000
        
      - alert: HighErrorRate
        expr: rate(caddy_http_errors_total[5m]) > 0.05
        
      - alert: DomainVerificationFailures
        expr: rate(domain_verification_failures[1h]) > 10
```

---

## Cost Analysis

### Let's Encrypt Limits

**Rate Limits:**
- 50 certificates per domain per week
- 5 duplicate certificates per week

**Mitigation:**
- Use wildcard for subdomains (1 cert for all)
- Cache certificates aggressively
- Monitor issuance rate
- Backup CA configured

### Resource Usage

**Caddy:**
- CPU: 0.25-1 core per replica
- Memory: 128-512MB per replica
- Storage: 10GB for certificates

**Domain Validator:**
- CPU: 0.1 core
- Memory: 128MB
- Minimal storage

**Estimated Monthly Cost (AWS):**
- Caddy (3 replicas): ~$50
- Domain Validator: ~$10
- Storage: ~$5
- **Total: ~$65/month**

---

## Testing Strategy

### Unit Tests

```typescript
describe('Domain Validator', () => {
    it('verifies valid domain', async () => {
        const result = await checkDomain('app.acme.com');
        expect(result).toBe(true);
    });
    
    it('rejects unverified domain', async () => {
        const result = await checkDomain('fake.com');
        expect(result).toBe(false);
    });
    
    it('caches results', async () => {
        await checkDomain('app.acme.com');
        const cached = cache.get('app.acme.com');
        expect(cached).toBe(true);
    });
});
```

### Integration Tests

```typescript
describe('Custom Domain API', () => {
    it('adds custom domain', async () => {
        const res = await request(app)
            .post('/api/v1/domains')
            .send({ domain: 'app.acme.com' });
        
        expect(res.status).toBe(201);
        expect(res.body.verification_token).toBeDefined();
    });
    
    it('verifies domain with valid DNS', async () => {
        // Mock DNS lookup
        mockDNS('_valuecanvas-verify.app.acme.com', 'TXT', token);
        
        const res = await request(app)
            .post(`/api/v1/domains/${domainId}/verify`);
        
        expect(res.status).toBe(200);
        expect(res.body.verified).toBe(true);
    });
});
```

### E2E Tests

```typescript
test('complete custom domain flow', async ({ page }) => {
    // Navigate to domains page
    await page.goto('/settings/domains');
    
    // Add domain
    await page.fill('[name="domain"]', 'app.acme.com');
    await page.click('button:has-text("Add Domain")');
    
    // Verify instructions shown
    await expect(page.locator('.verification-token')).toBeVisible();
    
    // Simulate DNS verification
    await addDNSRecord('app.acme.com', 'TXT', verificationToken);
    
    // Trigger verification
    await page.click('button:has-text("Verify")');
    
    // Wait for success
    await expect(page.locator('.domain-verified')).toBeVisible();
    
    // Test custom domain access
    const response = await page.goto('https://app.acme.com');
    expect(response.status()).toBe(200);
});
```

---

## Migration Plan

### Deployment Strategy

**Zero-Downtime Deployment:**

1. Deploy domain validator service (new)
2. Run database migration (custom_domains table)
3. Update Caddy configuration (add on-demand TLS)
4. Deploy API endpoints (new routes)
5. Deploy frontend UI (new pages)
6. Test with staging domain
7. Roll out to production

**Rollback Plan:**

1. Remove on-demand TLS block from Caddyfile
2. Scale down domain validator
3. Revert database migration (if needed)
4. Remove API routes
5. Hide UI components

**No Breaking Changes:**
- Existing functionality continues working
- New features are additive
- Backward compatible

---

## Success Metrics

### Technical KPIs

- **Domain Verification Success Rate:** > 95%
- **SSL Certificate Issuance Time:** < 2 minutes
- **Custom Domain Latency Overhead:** < 50ms
- **Uptime:** 99.9% SLA maintained
- **Error Rate:** < 1%

### Business KPIs

- **Custom Domain Adoption:** % of tenants using custom domains
- **Premium Tier Conversions:** Track upgrades for custom domains
- **Support Tickets:** Reduce domain-related tickets by 80%
- **Tenant Satisfaction:** Survey score > 4.5/5
- **Revenue Impact:** Track ARR from custom domain feature

---

## Documentation Requirements

### Developer Docs

- [ ] Custom domain API reference
- [ ] Domain validator service README
- [ ] Tenant resolution middleware guide
- [ ] Testing guide for multi-tenancy
- [ ] Troubleshooting guide

### DevOps Docs

- [ ] Caddy deployment guide
- [ ] DNS configuration instructions
- [ ] Certificate management runbook
- [ ] Monitoring setup guide
- [ ] Incident response playbook

### End User Docs

- [ ] Custom domain setup guide
- [ ] DNS verification instructions
- [ ] Troubleshooting common issues
- [ ] SSL certificate FAQ
- [ ] Video tutorial

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Let's Encrypt rate limits | High | Low | Use wildcard certs, monitor issuance |
| Domain verification failures | Medium | Medium | Clear instructions, support automation |
| SSL certificate issues | High | Low | Backup CA, monitoring, alerts |
| Performance degradation | Medium | Low | Load testing, caching, HPA |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low adoption | High | Medium | User research, clear value prop |
| Support burden | Medium | Medium | Self-service tools, documentation |
| Security incidents | High | Low | Verification, monitoring, audits |
| Cost overruns | Low | Low | Cost monitoring, budget alerts |

---

## Next Steps

### Immediate Actions (This Week)

1. **Review & Approve** this roadmap with team
2. **Prioritize** Phase 1 (Custom Domains)
3. **Create** detailed technical specs
4. **Assign** tasks to team members
5. **Set up** project tracking (Jira/Linear)

### Phase 1 Kickoff (Next Week)

1. **Database Design Review** - Finalize schema
2. **API Contract** - Define OpenAPI spec
3. **UI Mockups** - Design domain management page
4. **Infrastructure** - Provision domain validator service
5. **Sprint Planning** - Break down into 2-week sprints

---

## Conclusion

ValueCanvas has a **solid Caddy foundation**. The strategic focus is on:

1. **Custom Domain Management** - Highest business value
2. **Subdomain Multi-Tenancy** - Core architecture requirement
3. **Observability** - Operational excellence

**Key Principle: Build on what works. Don't reimplement.**

**Timeline:** 6 weeks to full implementation  
**Risk:** Low (incremental, no breaking changes)  
**ROI:** High (enables premium pricing, improves UX)

---

**Prepared by:** Ona  
**Date:** 2025-12-08  
**Version:** 1.0  
**Status:** Ready for Review
