# Production Deployment Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase project configured
- Domain and SSL certificate
- CDN configured (optional but recommended)

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Copy `.env.production.template` to `.env.production`
- [ ] Fill in all required environment variables
- [ ] Configure OAuth providers in Supabase dashboard
- [ ] Set up custom domain and SSL certificate
- [ ] Configure CDN (CloudFlare, Vercel, etc.)

### 2. Code Quality

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Run `npm run lint:fix` - Fix all linting errors
- [ ] Run `npm run test` - All tests passing
- [ ] Review and merge all pending PRs

### 3. Database

- [ ] Apply all pending migrations: `supabase db push`
- [ ] Verify RLS policies are enabled
- [ ] Create database backup
- [ ] Test database connectivity from production environment

### 4. OAuth Configuration

Follow the guide in `docs/oauth-setup.md`:

- [ ] Google OAuth configured
- [ ] Apple Sign In configured (if needed)
- [ ] GitHub OAuth configured
- [ ] Test OAuth flows in staging

### 5. Performance Optimization

- [ ] Run `npm run build` successfully
- [ ] Verify bundle sizes are acceptable (<500KB gzipped)
- [ ] Test lazy loading works correctly
- [ ] Run Lighthouse audit (target score >90)

## Deployment Steps

### Step 1: Build Production Bundle

```bash
# Clean previous builds
rm -rf dist

# Build for production
npm run build

# Verify build output
ls -lh dist/
```

### Step 2: Test Production Build Locally

```bash
# Preview production build
npm run preview

# Open http://localhost:4173
# Test all critical user flows
```

### Step 3: Deploy to Hosting Platform

#### Option A: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Option B: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

#### Option C: AWS S3 + CloudFront

```bash
# Sync to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

#### Option D: Docker

```bash
# Build Docker image
docker build -t valynt-app:latest .

# Run container
docker run -p 80:80 valynt-app:latest
```

### Step 4: Configure DNS

```
# Add DNS records
A     @           <your-server-ip>
CNAME www         your-domain.com
```

### Step 5: Enable HTTPS

```bash
# Using Let's Encrypt (Certbot)
sudo certbot --nginx -d valynt.xyz -d www.valynt.xyz
```

### Step 6: Configure Security Headers

Add to your web server configuration (nginx example):

```nginx
# /etc/nginx/sites-available/valynt.xyz

server {
    listen 443 ssl http2;
    server_name valynt.xyz www.valynt.xyz;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/valynt.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/valynt.xyz/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # CSP Header
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co;" always;

    # Root directory
    root /var/www/valynt.xyz/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

## Post-Deployment Verification

### 1. Smoke Tests

- [ ] Homepage loads correctly
- [ ] Login/Signup works
- [ ] OAuth providers work
- [ ] Protected routes require authentication
- [ ] 404 page displays for invalid routes
- [ ] Error boundary catches errors gracefully

### 2. Performance Tests

```bash
# Run Lighthouse audit
npx lighthouse https://valynt.xyz --view

# Target metrics:
# - Performance: >90
# - Accessibility: >90
# - Best Practices: >90
# - SEO: >90
```

### 3. Security Tests

- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] No console errors or warnings
- [ ] No exposed API keys in source
- [ ] OAuth redirects work correctly

### 4. Monitoring Setup

- [ ] Configure error tracking (Sentry)
- [ ] Set up analytics (Google Analytics)
- [ ] Configure uptime monitoring
- [ ] Set up performance monitoring
- [ ] Create alerts for critical errors

## Rollback Procedure

If issues are detected after deployment:

```bash
# Option 1: Revert to previous deployment (Vercel/Netlify)
vercel rollback
# or
netlify rollback

# Option 2: Deploy previous git commit
git checkout <previous-commit-hash>
npm run build
# Deploy as normal

# Option 3: Restore from backup
# Restore database backup if needed
# Deploy previous build artifacts
```

## Monitoring & Maintenance

### Daily Checks

- [ ] Check error rates in Sentry
- [ ] Review analytics for unusual patterns
- [ ] Monitor server resources

### Weekly Checks

- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Review user feedback

### Monthly Checks

- [ ] Update dependencies: `npm update`
- [ ] Run security audit: `npm audit`
- [ ] Review and optimize bundle sizes
- [ ] Database maintenance and optimization

## Troubleshooting

### Issue: White screen after deployment

**Solution:**

1. Check browser console for errors
2. Verify all environment variables are set
3. Check that base URL is correct in vite.config.ts
4. Verify all assets are loading (check Network tab)

### Issue: OAuth not working

**Solution:**

1. Verify redirect URLs in OAuth provider settings
2. Check Supabase Auth settings
3. Verify environment variables are correct
4. Test in incognito mode (clear cookies)

### Issue: 404 on refresh

**Solution:**

1. Configure server to serve index.html for all routes
2. Add proper SPA routing configuration
3. Verify nginx/Apache configuration

### Issue: Slow initial load

**Solution:**

1. Enable gzip compression
2. Configure CDN caching
3. Optimize images and assets
4. Review bundle sizes and code splitting

## Support

For deployment issues:

- Check documentation: `docs/`
- Review logs: Server logs, browser console
- Contact DevOps team
- Create issue on GitHub

---

**Last Updated**: 2025-12-26
**Version**: 1.0.0
