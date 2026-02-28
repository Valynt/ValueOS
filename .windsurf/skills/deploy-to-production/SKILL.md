---
name: deploy-to-production
description: Orchestrates production deployment including pre-deploy tests, environment validation, and notifications
---

# Deploy to Production

This skill orchestrates production deployment with comprehensive pre-deployment validation, environment checks, and communication protocols.

## When to Run

Run this skill when:
- Ready to promote a validated staging release to production
- Executing scheduled production releases
- Performing emergency hotfixes to production
- Rolling back production issues

## Prerequisites

- Staging deployment validated and tested
- Feature freeze completed
- All stakeholders notified and approved
- On-call SRE and Release Captain assigned
- Backup completed within 24 hours

## Roles & Responsibilities

### Release Captain
- Owns deployment decision and timeline
- Coordinates communication with stakeholders
- Triggers deployment pipelines
- Approves rollbacks if needed

### On-Call SRE
- Monitors infrastructure health and alerts
- Executes infrastructure commands
- Validates system stability
- Leads rollback procedures if required

### Feature Owners
- Validate functionality for their features
- Provide sign-off on risky changes
- Monitor feature-specific metrics post-deployment

## Pre-Flight Checklist

### 1. Release Readiness
- [ ] Feature freeze announced in #releases channel
- [ ] CI/CD pipeline green on main branch
- [ ] Changelog and migration list reviewed with Feature Owners
- [ ] Recent backup confirmed (<24 hours old)
- [ ] Secrets and runtime config validated: `./scripts/verify-env.sh production`

### 2. Environment Validation
- [ ] Production infrastructure health checked
- [ ] Database connectivity and replication verified
- [ ] External service dependencies confirmed
- [ ] Monitoring and alerting systems operational
- [ ] Rollback procedures tested and documented

### 3. Deployment Validation
- [ ] Staging deployment successful and tested
- [ ] Performance benchmarks met in staging
- [ ] Security scans passed without critical issues
- [ ] Migration scripts tested in staging environment

## Deployment Execution

### Phase 1: Preparation (15 minutes)
```bash
# Create and push production release tag
git tag -a v1.2.3 -m "Production release v1.2.3"
git push origin v1.2.3

# Announce deployment start
# Slack: "🚀 Deploying v1.2.3 to production. Expected duration: 30 minutes. Release Captain: @username"

# Final environment validation
./scripts/pre-deployment-validation.sh production
```

### Phase 2: Database Migration (10 minutes)
```bash
# Apply backward-compatible migrations first
supabase db push --file supabase/migrations/2024*-add-columns.sql

# Verify schema versions
supabase db inspect schema_versions

# Wait for read replicas to catch up
./scripts/verify-replication.sh production
```

### Phase 3: Application Rollout (15 minutes)
```bash
# Trigger production deployment workflow
# GitHub Actions: Deploy to Production
# https://github.com/ValueCanvas/ValueCanvas/actions/workflows/deploy-production.yml

# Monitor rollout status
kubectl rollout status deploy/api --timeout=5m
kubectl rollout status deploy/web --timeout=5m
kubectl rollout status deploy/worker --timeout=5m

# Verify image digest matches release tag
kubectl describe deploy/api | grep Image
```

### Phase 4: Post-Deploy Validation (10 minutes)
```bash
# Execute smoke tests
npm run test:smoke -- --env production

# Health check validation
curl -f https://api.valueos.com/health
curl -f https://app.valueos.com/health

# Policy checks
npm run lint:policies

# Performance validation
./scripts/validate-performance.sh production
```

## Monitoring & Observability

### Key Metrics Dashboard
- Grafana: `00-Prod Overview` dashboard
- Error rates (<1% target)
- Response latency (<500ms P95)
- Queue depths and processing rates
- Database connection pool utilization

### Alert Monitoring
- Enable production alerts for deployment duration
- Monitor for P1/P2 incidents
- Database RLS error patterns
- Service availability and performance

## Rollback Procedures

### Application Rollback (5 minutes)
```bash
# Immediate rollback for application issues
kubectl rollout undo deploy/api
kubectl rollout undo deploy/web
kubectl rollout undo deploy/worker

# Verify rollback completion
kubectl rollout status deploy/api
```

### Database Rollback (15-30 minutes)
For migration-related issues:
```bash
# Restore from backup
./scripts/rollback-production.sh

# Rollback application to previous version
kubectl rollout undo deploy/api
kubectl rollout undo deploy/web
```

### Emergency Rollback Criteria
- Customer-facing outages (P1)
- Security vulnerabilities
- Data corruption or loss
- Critical functionality broken
- Performance degradation >50%

## Communication Protocol

### Deployment Timeline
- **T-30min**: Pre-flight checklist completion announced
- **T-15min**: "Deployment starting in 15 minutes"
- **T-0**: "🚀 Deployment started"
- **T+15min**: "Core deployment complete, validating..."
- **T+30min**: "✅ Deployment successful" or "❌ Rollback initiated"

### Notification Channels
- **Slack**: #releases (real-time updates), #incident-response (issues)
- **PagerDuty**: SRE on-call notification for alerts
- **Email**: Feature owners for sign-off requests
- **Status Page**: Customer-facing updates for incidents

## Success Criteria

### Technical Validation
- All smoke tests pass
- Application health endpoints return 200
- Database connections healthy
- External integrations functional
- Performance within acceptable ranges

### Business Validation
- Feature owners provide sign-off
- No critical alerts triggered
- User-facing functionality verified
- Monitoring dashboards show normal operation

## Risk Mitigation

### Deployment Strategies
- **Blue-Green**: Default for major releases (zero-downtime)
- **Canary**: For high-risk changes (gradual rollout)
- **Feature Flags**: For complex features (controlled enablement)

### Contingency Planning
- Backup rollback procedures documented
- Emergency contacts and escalation paths defined
- Alternative deployment methods available
- Communication templates prepared

## Post-Deployment Activities

### Monitoring Period (24 hours)
- Extended monitoring for 24 hours post-deployment
- Feature owners monitor their areas
- SRE monitors infrastructure health
- Performance regression checks

### Documentation Updates
- Update deployment runbook with lessons learned
- Document any issues encountered and resolutions
- Update rollback procedures if modified

### Retrospective (Within 48 hours)
- Schedule post-mortem meeting for any issues
- Document improvements for future deployments
- Update monitoring and alerting based on findings
