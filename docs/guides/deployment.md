# Deployment Guide

This guide covers deployment strategies and procedures for ValueOS environments.

## Environment Management

ValueOS supports multiple deployment environments with dedicated configurations:

```bash
# Environment switching
npm run env:staging       # Switch to staging environment
npm run env:production    # Switch to production environment
npm run env:status        # Check current environment
```

## Staging Deployment

### Build Process

```bash
# Build for staging
npm run staging:build     # Build with staging configuration
npm run staging:dev       # Start staging dev server
npm run staging:preview   # Preview staging build
```

### Container Deployment

```bash
# Start staging stack
npm run staging:start      # Start staging containers
npm run staging:stop       # Stop staging containers
npm run staging:logs       # View staging logs
npm run staging:clean      # Clean staging environment
```

### Database Operations

```bash
# Staging database management
npm run db:push:staging    # Push schema to staging
```

### Testing in Staging

```bash
# Staging-specific tests
npm run staging:test       # Run tests in staging mode
npm run test:staging       # Test against staging URL
```

## Production Deployment

### Build Process

Production builds are optimized and include:

- Code minification
- Tree shaking
- Asset optimization
- Production environment variables

```bash
# Production build
npm run build              # Standard production build
npm run build:backend      # Backend build
npm run build:bare         # Minimal build
```

### Container Deployment

```bash
# Docker operations
npm run docker:build       # Build all containers
npm run docker:up          # Start development containers
npm run docker:prod:build  # Build production containers
npm run docker:prod:up     # Start production containers
npm run docker:prod:down   # Stop production containers
npm run docker:prod:logs   # View production logs
```

### Database Operations

```bash
# Production database (CAUTION)
npm run db:push:prod       # Push schema to production
npm run db:backup          # Create database backup
npm run db:restore         # Restore from backup
```

### Deployment Validation

```bash
# Pre-deployment checks
npm run deploy:validate    # Validate deployment readiness
npm run deploy:pre-check   # Run pre-deployment checklist
npm run health             # Health check script
```

## Infrastructure Components

### Caddy Web Server

Production deployments use Caddy for:

- Automatic HTTPS certificates
- Load balancing
- Security headers
- Rate limiting
- Request routing

```bash
# Caddy management
npm run dx:caddy:start     # Start Caddy (dev)
npm run dx:caddy:stop      # Stop Caddy (dev)
npm run dx:caddy:logs      # View Caddy logs
npm run dx:caddy:validate  # Validate Caddy config
npm run dx:caddy:reload    # Reload Caddy config
```

### Database Infrastructure

- PostgreSQL with PostGIS extensions
- Redis for caching and sessions
- Connection pooling and health checks

### Monitoring and Observability

- Structured JSON logging
- Health check endpoints (`/healthz`)
- Metrics collection (Prometheus)
- Distributed tracing

## Deployment Strategies

### Blue-Green Deployment

ValueOS supports blue-green deployments through Docker Compose:

1. Deploy new version alongside current
2. Switch traffic to new version
3. Rollback if issues detected

### Rolling Updates

For Kubernetes deployments:

- Zero-downtime updates
- Health check validation
- Automatic rollback on failure

### Database Migrations

Safe database migrations with:

- Schema versioning
- Rollback capabilities
- Data integrity checks
- Audit logging

```bash
# Migration operations
npm run db:push            # Apply migrations
npm run db:pull            # Pull remote schema
npm run db:reset           # Reset database (dev only)
npm run migration:safety   # Safety checks
npm run migration:validate # Validate migrations
```

## Security Considerations

### Environment Variables

- Never commit secrets to version control
- Use CI/CD secrets management
- Validate configuration at startup
- Separate environments completely

### Network Security

- Caddy handles SSL termination
- Rate limiting protects against abuse
- Security headers prevent common attacks
- Network isolation between services

### Access Control

- Row-level security (RLS) in database
- JWT token validation
- Multi-tenant data isolation
- Audit logging for all operations

## Troubleshooting Deployments

### Common Issues

**Container Startup Failures**

```bash
# Check container status
npm run docker:ps
npm run docker:logs [container-name]

# Validate configuration
npm run env:validate
npm run config:validate
```

**Database Connection Issues**

```bash
# Test database connectivity
npm run db:test

# Check database logs
npm run docker:logs postgres
```

**SSL Certificate Problems**

```bash
# Validate Caddy configuration
npm run dx:caddy:validate

# Check certificate status
npm run dx:caddy:logs
```

### Health Checks

```bash
# Comprehensive health check
npm run dx:check

# Individual service health
curl http://localhost:3001/health
curl http://localhost:54321/health
```

### Logs and Monitoring

```bash
# View all logs
npm run dx:logs

# Service-specific logs
npm run docker:logs [service-name]

# Structured log analysis
npm run analyze:logs
```

## Rollback Procedures

### Container Rollback

```bash
# Stop current deployment
npm run docker:prod:down

# Start previous version
npm run docker:prod:up -- --scale app=0 (adjust as needed)
```

### Database Rollback

```bash
# Restore from backup
npm run db:restore [backup-file]

# Revert migrations
npm run migration:rollback [version]
```

## Performance Optimization

### Container Optimization

- Multi-stage Docker builds
- Minimal base images
- Layer caching
- Resource limits

### Application Optimization

- Code splitting
- Asset optimization
- Caching strategies
- Database query optimization

### Infrastructure Scaling

- Horizontal pod scaling
- Load balancer configuration
- Database read replicas
- CDN integration
