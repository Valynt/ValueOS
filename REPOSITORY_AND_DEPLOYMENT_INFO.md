# Repository and Deployment Information

**Date**: 2025-12-31
**Current Branch**: ONA

---

## Repository Details

### GitHub Repository
- **Owner**: Valynt
- **Repository**: ValueOS
- **Full URL**: https://github.com/Valynt/ValueOS.git
- **Project Name**: valuecanvas (from package.json)
- **Version**: 0.1.0

### Remote Configuration
```bash
origin  https://github.com/Valynt/ValueOS.git (fetch)
origin  https://github.com/Valynt/ValueOS.git (push)
```

---

## Branch Information

### Current Branch: ONA
- **Status**: Local development branch
- **Latest Commit**: e577001 - "chore: normalize test files and document typescript fix"
- **Tracking**: Not tracking any remote branch
- **Purpose**: Development/feature branch

### Main Branch
- **Latest Local Commit**: 5b6d45d - "security: Implement comprehensive LLM security wrapper and fix 11 direct gateway calls"
- **Remote Status**: Ahead 1 commit from origin/main
- **Latest Remote Commit**: 1198302 - "feat: Update billing services and types, and enhance authentication context and security middleware."

### Branch Relationship
```
* e577001 (HEAD -> ONA) chore: normalize test files and document typescript fix
* 5b6d45d (main) security: Implement comprehensive LLM security wrapper and fix 11 direct gateway calls
* 1198302 (origin/main, origin/HEAD) feat: Update billing services and types...
```

---

## Deployment Configuration

### Production Deployment Target

#### Infrastructure
- **Platform**: AWS (Amazon Web Services)
- **Region**: us-east-1 (US East - N. Virginia)
- **Container Registry**: AWS ECR (Elastic Container Registry)
- **Orchestration**: AWS EKS (Elastic Kubernetes Service)
- **Cluster Name**: valuecanvas-production-cluster

#### Deployment Trigger
- **Branch**: `main` branch only
- **Method**: Automatic on push to main
- **Manual**: Can be triggered via workflow_dispatch

#### CI/CD Pipeline
- **Platform**: GitHub Actions
- **Workflow File**: `.github/workflows/deploy-production.yml`
- **Steps**:
  1. Run tests (unit tests, linting)
  2. Security scan
  3. Build production bundle
  4. Detect changed services
  5. Build Docker images
  6. Push to ECR
  7. Deploy to EKS cluster

### Staging Deployment
- **Workflow**: `.github/workflows/terraform-deploy-staging.yml`
- **Infrastructure**: Separate staging environment
- **Purpose**: Pre-production testing

### Additional Deployment Options

#### Option A: Vercel
- **Domain**: valynt.xyz (mentioned in DEPLOYMENT.md)
- **Command**: `vercel --prod`

#### Option B: Netlify
- **Command**: `netlify deploy --prod --dir=dist`

#### Option C: AWS S3 + CloudFront
- **Static hosting**: S3 bucket
- **CDN**: CloudFront distribution

#### Option D: Docker
- **Image**: valynt-app:latest
- **Port**: 80

---

## Domain Configuration

### Primary Domain
- **Domain**: valynt.xyz
- **WWW**: www.valynt.xyz
- **SSL**: Let's Encrypt (Certbot)
- **Web Server**: nginx

### DNS Records
```
A     @           <server-ip>
CNAME www         valynt.xyz
```

---

## Deployment Status

### Current Branch (ONA)
- ✅ **NOT deployed** - This is a local development branch
- ⚠️ **Not tracking remote** - Changes are local only
- 📝 **Contains**: TypeScript fixes and test normalization

### Main Branch
- ⚠️ **Ahead of origin/main by 1 commit**
- 📦 **Contains**: Security sprint work (LLM security wrapper)
- 🚀 **Ready to deploy**: After pushing to origin/main

### Origin/Main Branch
- ✅ **Currently deployed** to production
- 📍 **Commit**: 1198302 - Billing and authentication updates
- 🌐 **Live at**: Production EKS cluster (valuecanvas-production-cluster)

---

## Deployment Workflow

### To Deploy Current Work

#### Step 1: Merge ONA branch to main
```bash
# Switch to main
git checkout main

# Merge ONA branch
git merge ONA

# Or rebase
git rebase ONA
```

#### Step 2: Push to origin/main
```bash
# Push main branch
git push origin main
```

#### Step 3: Automatic Deployment
- GitHub Actions will automatically trigger
- Workflow: `.github/workflows/deploy-production.yml`
- Target: AWS EKS cluster in us-east-1
- Domain: valynt.xyz

### Manual Deployment
```bash
# Trigger workflow manually
gh workflow run deploy-production.yml
```

---

## Service Architecture

### Microservices (Deployed to EKS)
1. **Opportunity Service** - `blueprint/infra/backend/services/opportunity/`
2. **Target Service** - `blueprint/infra/backend/services/target/`
3. **Realization Service** - `blueprint/infra/backend/services/realization/`
4. **Expansion Service** - `blueprint/infra/backend/services/expansion/`
5. **Integrity Service** - `blueprint/infra/backend/services/integrity/`
6. **Orchestrator Service** - `blueprint/infra/backend/services/orchestrator/`

### Frontend
- **Source**: `src/`, `public/`
- **Build**: Vite
- **Output**: `dist/`
- **Deployment**: Static files or containerized

### Observability Stack
- **Prometheus** - Metrics collection
- **Loki** - Log aggregation
- **Grafana** - Visualization
- **Tempo** - Distributed tracing

---

## Environment Variables

### Production Configuration
- **File**: `.env.production` (not committed to git)
- **Template**: `.env.production.template`
- **Supabase URL**: https://bxaiabnqalurloblfwua.supabase.co
- **Secrets**: Stored in AWS Secrets Manager or GitHub Secrets

### Required Secrets (GitHub Actions)
- `ECR_REGISTRY` - AWS ECR registry URL
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `SUPABASE_SERVICE_KEY` - Supabase service role key

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security scan clean
- [ ] TypeScript compilation successful
- [ ] Linting passed
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] RLS policies verified

### Deployment
- [ ] Merge to main branch
- [ ] Push to origin/main
- [ ] Monitor GitHub Actions workflow
- [ ] Verify deployment to EKS
- [ ] Check application health

### Post-Deployment
- [ ] Verify application is accessible at valynt.xyz
- [ ] Check logs for errors
- [ ] Monitor metrics in Grafana
- [ ] Test critical user flows
- [ ] Verify database connectivity

---

## Rollback Procedure

### Quick Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or rollback to specific commit
git reset --hard <previous-commit-sha>
git push origin main --force
```

### Kubernetes Rollback
```bash
# Rollback deployment
kubectl rollout undo deployment/valuecanvas-frontend -n production

# Check rollout status
kubectl rollout status deployment/valuecanvas-frontend -n production
```

---

## Monitoring and Logs

### Application Logs
- **Platform**: AWS CloudWatch
- **EKS Logs**: kubectl logs
- **Aggregation**: Loki

### Metrics
- **Collection**: Prometheus
- **Visualization**: Grafana
- **Alerts**: Configured in Prometheus

### Health Checks
- **Endpoint**: `/health` or `/api/health`
- **Kubernetes**: Liveness and readiness probes

---

## Support and Documentation

### Key Documentation Files
- `DEPLOYMENT.md` - Detailed deployment guide
- `README.md` - Project overview
- `SECURITY_SPRINT_COMPLETE.md` - Recent security improvements
- `.github/workflows/` - CI/CD configuration

### Contact
- **Repository Owner**: Valynt
- **GitHub**: https://github.com/Valynt/ValueOS

---

## Summary

**Current Status**:
- 📍 **You are on**: ONA branch (local development)
- 🌐 **Production is running**: origin/main (commit 1198302)
- 🚀 **Deployment target**: AWS EKS cluster (valuecanvas-production-cluster)
- 🌍 **Live domain**: valynt.xyz
- 📦 **To deploy your work**: Merge ONA → main → push to origin/main

**Deployment Flow**:
```
ONA branch (local) 
  → main branch (local)
    → origin/main (GitHub)
      → GitHub Actions
        → AWS ECR (Docker images)
          → AWS EKS (Kubernetes cluster)
            → valynt.xyz (production)
```

---

**Generated**: 2025-12-31 20:28 UTC
**Branch**: ONA
**Repository**: https://github.com/Valynt/ValueOS.git

