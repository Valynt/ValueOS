# ValueCanvas Deployment Guide

**Version:** 1.0.0  
**Last Updated:** December 5, 2025

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Supabase Deployment](#supabase-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Production Checklist](#production-checklist)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Accounts

- **Supabase** (Cloud or self-hosted)
- **Together.ai** (LLM API)
- **Vercel/Netlify/Cloudflare Pages** (Frontend hosting)
- **Sentry** (Error tracking, optional)
- **Posthog** (Analytics, optional)

### Required Tools

```bash
Node.js >= 18.0.0
npm >= 9.0.0
Supabase CLI >= 1.100.0
Docker >= 20.10 (for local testing)
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/valuecanvas.git
cd valuecanvas
npm install
```

### 2. Environment Variables

Create `.env.production`:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# LLM Provider
VITE_TOGETHER_API_KEY=your-together-api-key
VITE_LLM_PROVIDER=together

# App Config
VITE_APP_URL=https://app.valuecanvas.com
VITE_APP_ENV=production

# Optional: Analytics
VITE_SENTRY_DSN=your-sentry-dsn
VITE_POSTHOG_KEY=your-posthog-key
VITE_POSTHOG_HOST=https://app.posthog.com

# Optional: Feature Flags
VITE_ENABLE_DEMO_MODE=false
VITE_ENABLE_BETA_FEATURES=false
```

---

## Supabase Deployment

### Option A: Supabase Cloud (Recommended)

1. **Create Project**
   ```bash
   # Via Supabase Dashboard
   https://app.supabase.com/projects
   ```

2. **Link Local to Remote**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Push Database Schema**
   ```bash
   supabase db push
   ```

4. **Deploy Edge Functions**
   ```bash
   supabase functions deploy
   ```

5. **Set Secrets**
   ```bash
   supabase secrets set TOGETHER_API_KEY=your-key
   supabase secrets set OPENAI_API_KEY=your-key
   ```

### Option B: Self-Hosted Supabase

See `docs/SUPABASE_SELF_HOSTED.md` for detailed instructions.

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Configure Project**
   ```bash
   vercel link
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add VITE_SUPABASE_URL production
   vercel env add VITE_SUPABASE_ANON_KEY production
   vercel env add VITE_TOGETHER_API_KEY production
   ```

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm i -g netlify-cli
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod --dir=dist
   ```

### Option 3: Cloudflare Pages

1. **Connect Repository**
   - Go to Cloudflare Dashboard > Pages
   - Connect your Git repository

2. **Build Settings**
   ```
   Build command: npm run build
   Build output: dist
   Node version: 18
   ```

3. **Environment Variables**
   - Add all VITE_* variables in Cloudflare dashboard

---

## Production Checklist

### Security

- [ ] All secrets stored in secure vault (not in .env files)
- [ ] Supabase RLS policies enabled and tested
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled on API routes
- [ ] Content Security Policy (CSP) headers configured
- [ ] HTTPS enforced (HSTS headers)
- [ ] API keys rotated from development

### Performance

- [ ] Build optimized (`npm run build`)
- [ ] Bundle size analyzed (`npm run build -- --analyze`)
- [ ] Images optimized and served via CDN
- [ ] Lazy loading implemented for routes
- [ ] Service worker enabled for offline support
- [ ] Database indexes created for hot queries
- [ ] Supabase connection pooling configured

### Monitoring

- [ ] Sentry error tracking configured
- [ ] Posthog analytics tracking events
- [ ] Uptime monitoring configured (e.g., Pingdom)
- [ ] Log aggregation setup (e.g., Datadog, LogRocket)
- [ ] Database query performance monitoring
- [ ] Alert thresholds configured

### Testing

- [ ] All tests passing (`npm test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Load tests executed (`npm run test:load`)
- [ ] Smoke tests passing on staging
- [ ] User acceptance testing complete

### Documentation

- [ ] README updated with deployment info
- [ ] CHANGELOG updated with release notes
- [ ] API documentation generated
- [ ] Runbook created for on-call

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Application Health**
   - Uptime (target: 99.9%)
   - Response time P95 (target: < 500ms)
   - Error rate (target: < 0.1%)

2. **Database**
   - Query performance
   - Connection pool usage
   - Disk usage
   - Replication lag (if applicable)

3. **LLM API**
   - API latency P95 (target: < 5s)
   - Token usage
   - Cost per request
   - Rate limit headroom

4. **User Metrics**
   - Daily active users (DAU)
   - Session duration
   - Feature adoption rates
   - Error encounters

### Alert Configuration

**Critical Alerts** (PagerDuty/Opsgenie):
- Uptime < 99%
- Error rate > 1%
- Database connection failures
- Payment processing failures

**Warning Alerts** (Slack/Email):
- Response time P95 > 1s
- Disk usage > 80%
- LLM API costs spike > 150% of baseline
- Failed background jobs

---

## Rollback Procedures

### Frontend Rollback

**Vercel:**
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

**Netlify:**
```bash
# Via Netlify Dashboard
# Go to Deploys > Click previous deployment > Publish
```

### Database Rollback

```bash
# Rollback last migration
supabase db reset --version <previous-version>

# Or restore from backup
supabase db restore --backup-id <backup-id>
```

### Edge Functions Rollback

```bash
# Redeploy previous version
git checkout <previous-commit>
supabase functions deploy
git checkout main
```

---

## Disaster Recovery

### Database Backups

**Supabase Cloud:**
- Automatic daily backups (retained for 7 days on Pro plan)
- Point-in-time recovery available
- Manual backup: `supabase db dump > backup.sql`

**Self-Hosted:**
```bash
# Automated daily backup via cron
0 2 * * * pg_dump -h localhost -U postgres valuecanvas > /backups/valuecanvas-$(date +\%Y\%m\%d).sql
```

### Application State

- Canvas state: Stored in Supabase (backed up with DB)
- User sessions: Stored in Supabase Auth (ephemeral, acceptable loss)
- Analytics: Replicated to Posthog (external)

---

## Performance Optimization

### Frontend

1. **Code Splitting**
   ```typescript
   const LazyComponent = React.lazy(() => import('./Component'));
   ```

2. **Image Optimization**
   - Use WebP format
   - Implement responsive images
   - Lazy load images below fold

3. **Bundle Optimization**
   ```bash
   npm run build -- --analyze
   # Review bundle size report
   # Eliminate duplicate dependencies
   ```

### Backend

1. **Database Indexes**
   ```sql
   CREATE INDEX idx_value_cases_user_id ON value_cases(user_id);
   CREATE INDEX idx_agent_memory_user_agent ON agent_memory(user_id, agent_id);
   ```

2. **Query Optimization**
   - Use `.select()` to specify exact columns
   - Avoid N+1 queries with `.join()`
   - Implement pagination for large result sets

3. **Caching**
   - Enable Supabase connection pooling
   - Cache static assets via CDN
   - Implement Redis for session cache (if needed)

---

## Security Hardening

### Headers

Configure in `vercel.json` or hosting platform:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

### Rate Limiting

Implement in Supabase Edge Functions:

```typescript
import { createClient } from '@supabase/supabase-js';

const rateLimit = async (userId: string, limit: number, window: number) => {
  const key = `rate_limit:${userId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, window);
  }
  
  if (count > limit) {
    throw new Error('Rate limit exceeded');
  }
};
```

---

## Troubleshooting

### Common Issues

**Issue: Slow page loads**
- Check bundle size: `npm run build -- --analyze`
- Review network waterfall in DevTools
- Verify CDN is serving static assets

**Issue: Database connection errors**
- Check connection pool settings
- Verify Supabase RLS policies
- Review database logs in Supabase dashboard

**Issue: LLM API timeouts**
- Implement request timeout: 30s
- Add retry logic with exponential backoff
- Monitor Together.ai status page

---

## Support & Escalation

**L1 Support:** Check runbook, restart services  
**L2 Support:** Review logs, database queries, rollback if needed  
**L3 Support:** Deep debugging, contact Supabase/Together.ai support

**On-Call Rotation:** PagerDuty schedule  
**Incident Response:** Follow incident.md playbook

---

**Maintained by:** ValueCanvas DevOps Team  
**Last Review:** December 5, 2025
