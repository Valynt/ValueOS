# Deployment Checklists

**Last Updated:** 2024-11-29

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] ESLint clean (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No console.log statements (`npm run lint:console`)
- [ ] Code reviewed and approved
- [ ] CHANGELOG.md updated

### Security
- [ ] Security audit passed (`npm audit`)
- [ ] Dependencies up to date
- [ ] Environment variables configured
- [ ] API keys rotated if needed
- [ ] RLS policies verified
- [ ] CSRF protection enabled

### Database
- [ ] Migrations tested in staging
- [ ] Rollback scripts prepared
- [ ] Backup completed
- [ ] RLS policies applied
- [ ] Indexes optimized

### Performance
- [ ] Bundle size acceptable (<1MB)
- [ ] Lighthouse score >90
- [ ] Load testing completed
- [ ] CDN configured
- [ ] Caching strategy verified

---

## Phase 1: Authentication Deployment

**Target:** Backend API + Auth System  
**Updated:** 2024-11-20

### Prerequisites
- [ ] Supabase project created
- [ ] Environment variables set
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Redis instance running
- [ ] Port 3001 available

### Deployment Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.auth.example .env
   # Edit .env with your values
   ```

3. **Build Application**
   ```bash
   npm run build
   ```

4. **Start Backend**
   ```bash
   npm run backend:start
   ```

5. **Verify Health**
   ```bash
   curl http://localhost:3001/health
   ```

### Verification
- [ ] Login page accessible
- [ ] Signup flow works
- [ ] Password reset functional
- [ ] Protected routes enforce auth
- [ ] Session timeout working
- [ ] Rate limiting active

### Rollback Plan
```bash
# Stop backend
pkill -f "backend/server"

# Revert to previous version
git checkout <previous-tag>
npm install
npm run build
npm run backend:start
```

---

## Phase 2: Billing System Deployment

**Target:** Stripe Integration + Usage Metering  
**Updated:** 2024-11-18

### Prerequisites
- [ ] Stripe account created
- [ ] Products configured in Stripe
- [ ] Webhook endpoint configured
- [ ] Environment variables set
  - `STRIPE_SECRET_KEY`
  - `VITE_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`

### Deployment Steps

1. **Setup Stripe Products**
   ```bash
   npm run billing:setup-stripe
   ```

2. **Verify Configuration**
   ```bash
   npm run billing:test-flow
   ```

3. **Deploy Webhook Handler**
   - Configure webhook URL in Stripe dashboard
   - Test webhook delivery

4. **Enable Plan Enforcement**
   - Verify middleware active on all routes
   - Test quota limits

### Verification
- [ ] Subscription creation works
- [ ] Usage metering recording
- [ ] Webhooks processing
- [ ] Plan limits enforced
- [ ] Billing dashboard accessible
- [ ] Invoice generation working

### Rollback Plan
```bash
# Disable plan enforcement
# Edit src/middleware/planEnforcementMiddleware.ts
# Set BILLING_ENABLED=false in .env

# Restart services
npm run backend:start
```

---

## Phase 3: Security Hardening Deployment

**Target:** RLS Policies + Sandboxing + Memory  
**Updated:** 2024-11-29

### Prerequisites
- [ ] Database backup completed
- [ ] Staging environment tested
- [ ] RLS policies reviewed
- [ ] Team notified of deployment

### Deployment Steps

1. **Apply RLS Policies**
   ```bash
   cd supabase/migrations
   supabase db push
   ```

2. **Verify RLS**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

3. **Deploy Application Updates**
   ```bash
   npm run build
   # Deploy to hosting platform
   ```

4. **Monitor Security Audit Log**
   ```sql
   SELECT * FROM security_audit_log 
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

### Verification
- [ ] RLS policies active on all tables
- [ ] Cross-tenant access blocked
- [ ] Code sandboxing working
- [ ] Agent memory persisting
- [ ] No security audit violations
- [ ] Console logging clean

### Rollback Plan
```bash
# Rollback RLS policies
cd supabase/migrations/rollback
psql < 20241129_strict_rls_policies_rollback.sql

# Verify rollback
psql -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';"
```

**⚠️ WARNING:** Rollback removes database-level security!

---

## Post-Deployment Checklist

### Immediate (0-30 minutes)
- [ ] Health checks passing
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] No 500 errors in logs
- [ ] Monitoring alerts configured

### Short Term (30min - 4 hours)
- [ ] User flows tested
- [ ] Payment processing verified
- [ ] Email notifications working
- [ ] Background jobs running
- [ ] Cache warming complete

### Long Term (4-24 hours)
- [ ] Performance metrics stable
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] CDN hit rate acceptable
- [ ] User feedback collected

---

## Monitoring

### Key Metrics to Watch

**Application:**
- Error rate < 0.1%
- Response time < 200ms (p95)
- Availability > 99.9%

**Database:**
- Query time < 100ms (p95)
- Connection pool < 80% utilized
- No long-running queries

**Security:**
- Zero RLS violations
- Rate limit rejections < 1%
- No failed auth attempts spike

### Alerting

Configure alerts for:
- Error rate > 1%
- Response time > 500ms
- Database connections > 90%
- Disk space < 20%
- Memory usage > 85%

---

## Emergency Procedures

### Critical Failure
1. Enable maintenance mode
2. Notify team via Slack
3. Investigate root cause
4. Execute rollback if needed
5. Post-mortem after resolution

### Partial Outage
1. Identify affected component
2. Check health endpoints
3. Review recent changes
4. Apply targeted fix or rollback
5. Verify resolution

### Security Incident
1. **DO NOT PANIC**
2. Isolate affected systems
3. Notify security team immediately
4. Preserve logs for investigation
5. Follow incident response plan

---

## Contacts

### On-Call
- **Primary:** DevOps Team
- **Secondary:** Engineering Lead
- **Security:** Security Team

### Escalation
1. On-Call Engineer (immediate)
2. Team Lead (15 minutes)
3. CTO (30 minutes if critical)

---

##Dependencies

### Required Services
- Supabase (database + auth)
- Redis (caching + rate limiting)
- Stripe (billing)
- CDN (static assets)

### Optional Services
- Sentry (error tracking)
- DataDog (monitoring)
- Slack (notifications)

---

**For environment-specific deployment guides, see the respective deployment documentation files.**

**Last Review:** 2024-11-29  
**Next Review:** 2024-12-06
