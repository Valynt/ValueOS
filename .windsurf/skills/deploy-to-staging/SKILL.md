---
name: deploy-to-staging
description: Guides the deployment process to a staging environment with safety checks and rollback steps
---

# Deploy to Staging

This skill guides the deployment process to a staging environment with comprehensive safety checks and rollback procedures.

## When to Run

Run this skill when:
- Deploying a new release candidate to staging for testing
- Validating production readiness before production deployment
- Testing database migrations in a safe environment
- Performing integration testing with external services

## Prerequisites

- All tests pass in CI/CD pipeline
- Code is reviewed and approved
- Database backup is current (within 24 hours)
- Staging environment is healthy

## Pre-Deployment Safety Checks

### 1. Environment Validation
- Verify staging database connectivity
- Check environment variables are set correctly
- Validate service dependencies (Redis, external APIs, etc.)
- Confirm infrastructure resources are available

### 2. Code Quality Gates
- Linting passes without errors
- Unit tests pass with >90% coverage
- Integration tests pass
- Security scans complete without critical issues

### 3. Database Readiness
- Backup staging database before deployment
- Verify migration scripts are backward-compatible
- Check for long-running queries that might conflict
- Validate RLS policies and permissions

## Deployment Steps

### 1. Preparation
```bash
# Tag the release candidate
git tag -a v1.2.3-staging -m "Staging release candidate v1.2.3"
git push origin v1.2.3-staging

# Run pre-deployment checklist
./scripts/pre-deployment-checklist.sh staging
```

### 2. Database Migration
```bash
# Apply backward-compatible migrations first
supabase db push --file supabase/migrations/2024*-add-columns.sql

# Verify schema changes
supabase db diff --file current-schema.sql
```

### 3. Application Deployment
```bash
# Deploy using blue-green strategy for safety
./scripts/blue-green-deploy.sh staging

# Monitor rollout status
kubectl rollout status deploy/staging-api --timeout=5m
kubectl rollout status deploy/staging-web --timeout=5m
```

### 4. Post-Deployment Validation
```bash
# Run smoke tests
npm run test:smoke -- --env staging

# Check application health
curl https://staging-api.valueos.com/health

# Validate database schema
supabase db diff --file expected-schema.sql
```

## Rollback Procedures

### Quick Rollback (Application Only)
If application issues are detected:
```bash
# Rollback to previous version
kubectl rollout undo deploy/staging-api
kubectl rollout undo deploy/staging-web

# Verify rollback completion
kubectl rollout status deploy/staging-api
```

### Full Rollback (Database + Application)
If database migration issues occur:
```bash
# Restore database from backup
./scripts/restore-database.sh staging

# Rollback application
kubectl rollout undo deploy/staging-api
kubectl rollout undo deploy/staging-web
```

## Monitoring and Alerts

### Key Metrics to Monitor
- Application response times (<500ms P95)
- Error rates (<1%)
- Database connection pool utilization (<80%)
- Queue depths and processing rates

### Alert Conditions
- Any 5xx errors in staging
- Database connection failures
- Service unavailability >5 minutes
- Migration failures

## Communication Templates

### Deployment Start
"Deploying v{version} to staging. Expected duration: 15 minutes. Monitoring alerts enabled."

### Deployment Success
"v{version} successfully deployed to staging. Smoke tests passed. Ready for QA validation."

### Rollback Required
"Rolling back staging deployment of v{version} due to {reason}. ETA to restore: 10 minutes."

## Testing Checklist

- [ ] API endpoints return expected responses
- [ ] User authentication flows work
- [ ] Database queries perform within acceptable limits
- [ ] External service integrations function correctly
- [ ] Error handling and logging work as expected
- [ ] Performance benchmarks meet requirements

## Risk Assessment

### Low Risk Changes
- Static content updates
- Non-breaking API additions
- Configuration changes
- Documentation updates

### Medium Risk Changes
- Database schema additions (backward-compatible)
- New feature flags (disabled by default)
- Minor UI/UX changes

### High Risk Changes
- Breaking API changes
- Database schema modifications (breaking)
- Authentication/permission changes
- Infrastructure modifications

For high-risk changes, consider:
- Extended testing period in staging
- Gradual rollout with feature flags
- Additional monitoring and alerting
- On-call engineer presence during deployment
