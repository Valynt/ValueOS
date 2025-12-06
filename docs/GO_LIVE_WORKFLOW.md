# Go-Live Workflow: Local → Staging → Production

**Complete workflow to launch your frontend and debug until it's "actually live"**

---

## 📋 Overview

This workflow covers three distinct stages:
1. **Local Development** - Fast feedback with HMR
2. **Staging Validation** - Simulated production environment
3. **Production Deployment** - Final go-live with audit checks

---

## 1️⃣ Local Development Launch & Debugging 🛠️

### Prerequisites Check

```bash
# Run automated setup
bash scripts/dev-setup.sh

# Or manual check
node --version    # Should be v20+
npm --version     # Should be v9+
docker --version  # Should be v24+
supabase --version
```

### Launch Sequence

| Step | Command | Output / Goal |
|------|---------|---------------|
| **1. Install Dependencies** | `npm install` | Installs all project dependencies |
| **2. Start Supabase** | `supabase start` | Starts local Supabase (DB, Auth, Storage) |
| **3. Generate Types** | `npm run db:types` | Generates TypeScript types from DB schema |
| **4. Launch Frontend** | `npm run dev` | Starts Vite dev server with HMR |
| **5. Access** | Open `http://localhost:3000` | Application accessible |

### Development Commands

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

### Debugging Tools

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

---

## 2️⃣ Staging Validation & Hardening 🧪

### Purpose
Simulate production environment to validate deployment and configuration.

### Launch Staging

```bash
# Build and start staging environment
npm run staging:start

# Or step-by-step
npm run staging:build
docker-compose -f infrastructure/docker/compose.stage.yml up -d
```

### Validation Checklist

| Check | Command | Success Criteria |
|-------|---------|------------------|
| **Golden Path Monitoring** | `npm run monitor:golden-path` | All critical user flows pass |
| **Security Scan** | `npm run security:scan:all` | No high-severity vulnerabilities |
| **Performance Tests** | `npm run test:perf` | Meets performance benchmarks |
| **RLS Tests** | `npm run test:rls` | All RLS policies enforced |
| **Database Validation** | `npm run db:validate` | All fixes validated |
| **SAML Tests** | `npm run test:saml` | SAML compliance verified |

### Staging Commands

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

### Staging Access

- **Frontend:** http://localhost:3000 (or configured port)
- **Backend API:** http://localhost:8000
- **Grafana:** http://localhost:3001
- **Jaeger:** http://localhost:16686

---

## 3️⃣ Production Go-Live & Final Audit ✅

### P0 - Must Complete Priorities (Blockers)

Before production deployment, these **MUST** be completed:

#### 1. Monitoring Dashboards Deployment

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

#### 2. Backup Restore Drill

```bash
# Create backup
npm run db:backup

# Test restore (on staging)
npm run db:restore --backup=<backup-file>

# Verify data integrity
npm run db:validate
```

**Success Criteria:**
- Backup completes in < 5 minutes
- Restore completes successfully
- All data integrity checks pass

#### 3. Security Audit Fixes

**Critical Security Issues (10 items):**

```bash
# 1. Verify RLS on all tables
npm run test:rls

# 2. Validate tenant isolation
npm run db:validate

# 3. Check RBAC enforcement
npm run test:rbac

# 4. Scan for vulnerabilities
npm run security:scan:all

# 5. Check for console.log statements
npm run lint:console
```

**All must pass before production deployment.**

### Pre-Deployment Checklist

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

### Production Deployment

#### Step 1: Final Build

```bash
# Clean build
rm -rf dist node_modules/.vite
npm ci
npm run build

# Verify build
ls -lh dist/
```

#### Step 2: Deploy

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
kubectl apply -f k8s/production/

# Or Docker Compose
docker-compose -f docker/prod/docker-compose.yml up -d --build
```

#### Step 3: Post-Deployment Verification

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

### Rollback Procedure

If deployment fails:

```bash
# Quick rollback
kubectl rollout undo deployment/valuecanvas-app -n production

# Or with Docker Compose
docker-compose -f docker/prod/docker-compose.yml down
docker-compose -f docker/prod/docker-compose.yml up -d --no-deps app
```

---

## 🔍 Monitoring & Validation

### Post-Deployment Monitoring (First 24 Hours)

**Immediate (0-1 hour):**
- [ ] Application accessible
- [ ] Health checks passing
- [ ] No errors in logs
- [ ] Monitoring dashboards showing data
- [ ] SSL certificate valid

**Short-term (1-24 hours):**
- [ ] Performance metrics normal
- [ ] Error rate < 1%
- [ ] Response time < 200ms (p95)
- [ ] No memory leaks
- [ ] Database connections stable

**Alerts to Monitor:**
- Application errors
- High response times
- Database connection issues
- Memory/CPU usage
- Failed health checks

### Golden Path Monitoring

**Critical User Flows:**
1. User registration
2. User login
3. Create canvas
4. Save canvas
5. Share canvas
6. Export canvas

**Run monitors:**
```bash
# Against production
PLAYWRIGHT_BASE_URL=https://yourdomain.com npm run monitor:golden-path

# Schedule in cron (every 5 minutes)
*/5 * * * * cd /app && npm run monitor:golden-path
```

---

## 🚨 Troubleshooting

### Issue: Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
npm ci
npm run build
```

### Issue: Tests Fail in Staging

```bash
# Check logs
npm run staging:logs

# Run specific test
npm run test:rls
npm run test:perf

# Restart staging
npm run staging:clean
npm run staging:start
```

### Issue: Production Deployment Fails

```bash
# Check deployment logs
kubectl logs -f deployment/valuecanvas-app -n production

# Check pod status
kubectl get pods -n production

# Describe pod for events
kubectl describe pod <pod-name> -n production

# Rollback
kubectl rollout undo deployment/valuecanvas-app -n production
```

### Issue: Monitoring Not Working

```bash
# Check Prometheus
curl http://prometheus:9090/-/healthy

# Check Grafana
curl http://grafana:3000/api/health

# Restart monitoring stack
kubectl rollout restart deployment/prometheus -n monitoring
kubectl rollout restart deployment/grafana -n monitoring
```

---

## 📊 Success Metrics

### Deployment Success Criteria

- ✅ All tests passing
- ✅ Zero downtime deployment
- ✅ Health checks passing
- ✅ Monitoring operational
- ✅ Error rate < 1%
- ✅ Response time < 200ms (p95)
- ✅ No critical alerts

### Business Metrics

- User registration rate
- Canvas creation rate
- Active users
- Session duration
- Feature adoption

---

## 📚 Related Documentation

- [Pre-Deployment Checklist](PRE_DEPLOYMENT_CHECKLIST.md)
- [Monitoring Setup](../monitoring/README.md)
- [Security Audit](SECURITY_AUDIT.md)
- [Disaster Recovery](DISASTER_RECOVERY.md)
- [Rollback Procedures](ROLLBACK_PROCEDURES.md)

---

## 🎯 Quick Reference

### Local Development
```bash
npm install
supabase start
npm run dev
# Access: http://localhost:3000
```

### Staging
```bash
npm run staging:start
npm run monitor:golden-path
npm run security:scan:all
npm run staging:stop
```

### Production
```bash
bash scripts/pre-deployment-checklist.sh
bash scripts/deploy.sh prod
npm run monitor:golden-path
```

---

**Last Updated:** 2025-12-06  
**Version:** 1.0.0  
**Status:** Production Ready
