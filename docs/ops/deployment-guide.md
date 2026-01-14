# Deployment & Operations Guide

Complete guide for deploying and operating ValueOS in production environments.

## Overview

This guide covers the complete deployment lifecycle from local development through production operations, including CI/CD pipelines, monitoring, and operational procedures.

## Prerequisites

### Infrastructure Requirements

- **Kubernetes cluster** (v1.24+) with CSI driver support
- **PostgreSQL database** with Row Level Security (RLS)
- **Redis** for caching and session management
- **Load balancer** (ALB/NLB) for traffic distribution
- **Monitoring stack** (Prometheus + Grafana)
- **Secrets management** (AWS Secrets Manager or HashiCorp Vault)

### Development Environment

- **Node.js**: v20+ with npm
- **Docker Desktop**: For local development
- **Supabase CLI**: For database management
- **kubectl**: For Kubernetes operations
- **Terraform**: For infrastructure provisioning

## Development Workflow

### Local Development Setup

1. **Clone and setup**:

   ```bash
   git clone https://github.com/valynt/valueos.git
   cd valueos
   npm install
   ```

2. **Environment configuration**:

   ```bash
   cp deploy/envs/.env.example .env.local
   npm run env:dev  # Configures Supabase keys
   ```

3. **Start development stack**:

   ```bash
   npm run dx  # Full stack with Docker
   # OR
   ./scripts/dev-caddy-start.sh  # With Caddy proxy
   ```

4. **Access points**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Supabase Studio: http://localhost:54323
   - Health check: http://localhost:3001/health

### Local Testing Commands

```bash
# Development
npm run dev              # Start frontend dev server
npm run dev:backend      # Start backend only
npm run dx               # Full development stack
npm run dx:check         # Health verification

# Testing
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:rls         # RLS policy tests
npm run security:scan    # Security scanning

# Database
npm run db:reset         # Reset local database
npm run db:migrate       # Apply migrations
npm run seed:demo        # Create demo data

# Quality gates
npm run lint             # Code linting
npm run typecheck        # TypeScript validation
npm run build            # Production build
```

## Staging Deployment

### Purpose

Simulate production environment to validate deployment and configuration before production release.

### Deployment Steps

1. **Build and prepare**:

   ```bash
   npm run build
   docker build -t valueos:staging .
   ```

2. **Deploy to staging**:

   ```bash
   npm run staging:start
   # OR manual deployment
   kubectl apply -f infra/k8s/staging/
   ```

3. **Run validation tests**:

   ```bash
   npm run staging:test
   npm run monitor:golden-path
   npm run security:scan:all
   ```

4. **Verify monitoring**:
   ```bash
   # Check Grafana dashboards
   # Verify Prometheus metrics
   # Test alerting rules
   ```

### Staging Access

- Frontend: https://staging.valueos.com
- API: https://api.staging.valueos.com
- Monitoring: https://grafana.staging.valueos.com

## Production Deployment

### Pre-Deployment Checklist

- [ ] All staging tests passing
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring dashboards configured
- [ ] Incident response plan ready

### Deployment Process

#### 1. Build Artifacts

```bash
# Clean build
rm -rf dist node_modules/.vite
npm ci
npm run build

# Verify build
ls -lh dist/
```

#### 2. Database Preparation

```bash
# Backup production database
npm run db:backup

# Apply migrations
npm run db:migrate

# Verify RLS policies
npm run test:rls
```

#### 3. Deploy Application

**Option A: CI/CD Pipeline**

```bash
# Merge to main triggers deployment
git checkout main
git merge develop
git push origin main
```

**Option B: Manual Deployment**

```bash
# Build and push image
docker build -t valueos:latest .
docker push your-registry/valueos:latest

# Deploy to Kubernetes
kubectl apply -f infra/k8s/production/
kubectl rollout status deployment/valueos-app
```

#### 4. Post-Deployment Verification

```bash
# Health checks
curl -f https://api.valueos.com/health

# Golden path testing
npm run monitor:golden-path

# Database connectivity
npm run db:validate

# Monitoring verification
curl -f https://grafana.valueos.com/api/health
```

### Rollback Procedures

#### Application Rollback

```bash
# Quick rollback
kubectl rollout undo deployment/valueos-app

# Specific revision
kubectl rollout undo deployment/valueos-app --to-revision=2
```

#### Database Rollback

```bash
# Restore from backup
npm run db:restore --backup=backup-2024-01-15.sql

# Rollback migrations
npm run db:rollback --steps=1
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
npm run ci:verify

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

**Application Metrics**:

- Response time (p95 < 200ms)
- Error rate (< 1%)
- Request rate
- Active users

**Infrastructure Metrics**:

- CPU usage (< 70%)
- Memory usage (< 80%)
- Database connections
- Pod restarts

### Dashboards

**Grafana Dashboards**:

- Application Performance
- Database Metrics
- Error Tracking
- User Activity
- Infrastructure Health

**Custom Queries**:

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

**Critical Alerts**:

- Application down
- High error rate (> 5%)
- Database connection issues
- Security violations

**Response Procedures**:

1. Acknowledge alert within 5 minutes
2. Assess impact and severity
3. Execute mitigation steps
4. Communicate status updates
5. Document root cause and resolution

## Security & Compliance

### Authentication & Authorization

- **JWT Tokens**: Custom claims with organization_id
- **RLS Policies**: Row-level security on all tables
- **Service Roles**: Separate credentials for background operations

### Secret Management

- **Environment Variables**: For configuration
- **AWS Secrets Manager**: For production secrets
- **HashiCorp Vault**: Alternative secret storage

### Audit Logging

```sql
-- Enable audit logging
SELECT * FROM security.enable_audit_logging();

-- Query audit trail
SELECT * FROM audit.activity_log
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

## Troubleshooting

### Common Issues

**Application Not Starting**:

```bash
# Check logs
kubectl logs -f deployment/valueos-app

# Verify environment variables
kubectl exec -it deployment/valueos-app -- env

# Check database connectivity
kubectl exec -it deployment/valueos-app -- npm run db:check
```

**High Latency**:

```bash
# Check resource usage
kubectl top pods

# Review application metrics
curl http://localhost:3000/metrics

# Database performance
npm run db:performance-check
```

**Deployment Failures**:

```bash
# Check rollout status
kubectl rollout status deployment/valueos-app

# View deployment events
kubectl describe deployment valueos-app

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
npm run db:backup  # Daily automated

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

**Recovery Steps**:

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

## Next Steps

### Immediate Actions

1. Review and customize this guide for your environment
2. Set up monitoring and alerting
3. Configure backup procedures
4. Train operations team on procedures

### Ongoing Maintenance

- Regular security updates
- Performance monitoring and optimization
- Documentation updates
- Team training and certification

### Advanced Topics

- Multi-region deployment
- Blue-green deployments
- Canary releases
- Chaos engineering
- Cost optimization

---

**Last Updated**: January 14, 2026
**Version**: 1.0
**Status**: Production Ready
