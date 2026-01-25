# Troubleshooting Guide

This guide provides solutions for common issues encountered during ValueOS development and deployment.

## Development Environment Issues

### Docker Desktop Not Starting

**Symptoms:** `docker` commands fail with connection errors

**Solutions:**

```bash
# Check Docker Desktop is running
docker --version

# Restart Docker Desktop
# On Windows: Services -> Docker Desktop Service -> Restart

# Check Docker daemon
docker info

# Reset Docker environment
pnpm run dx:clean
```

### Port Conflicts

**Symptoms:** Services fail to start with "port already in use" errors

**Solutions:**

```bash
# Check port usage
netstat -ano | findstr :5432  # Windows
lsof -i :5432                 # Linux/Mac

# Kill conflicting process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                # Linux/Mac

# Change default ports in .env.ports
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### Node.js Version Issues

**Symptoms:** Build failures or runtime errors

**Solutions:**

```bash
# Check Node version
node --version
pnpm --version

# Use correct version with nvm
nvm use

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Database Issues

### PostgreSQL Connection Failures

**Symptoms:** Database operations fail

**Solutions:**

```bash
# Check database container
pnpm run dx:ps

# View database logs
pnpm run docker:logs postgres

# Test connection
pnpm run db:test

# Reset database
pnpm run db:reset
```

### Migration Failures

**Symptoms:** `db:push` fails with schema errors

**Solutions:**

```bash
# Check migration status
pnpm run db:validate

# Pull remote schema
pnpm run db:pull

# Repair migrations
pnpm run db:repair

# Manual migration repair
pnpm run migration:validate
```

## Application Issues

### Build Failures

**Symptoms:** `pnpm run build` fails

**Solutions:**

```bash
# Clear build cache
rm -rf dist node_modules/.vite

# Type check first
pnpm run typecheck

# Clean install
pnpm run dx:clean
pnpm install

# Check for TypeScript errors
pnpm run build:backend
```

### Runtime Errors

**Symptoms:** Application crashes or behaves unexpectedly

**Solutions:**

```bash
# Check application logs
pnpm run dx:logs

# Health check
pnpm run health

# Environment validation
pnpm run env:validate

# Restart services
pnpm run dx:down
pnpm run dx
```

### Frontend Development Issues

**Symptoms:** Vite dev server fails to start or hot reload not working

**Solutions:**

```bash
# Check port availability
lsof -i :5173

# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
pnpm run dev

# Check browser console for errors
```

## Testing Issues

### Test Failures

**Symptoms:** `pnpm run test` fails

**Solutions:**

```bash
# Run tests with verbose output
pnpm run test -- --verbose

# Check test environment
pnpm run test:docker

# Clear test cache
pnpm run test -- --clearCache

# Run specific test
pnpm run test -- [test-file]
```

### Integration Test Issues

**Symptoms:** Integration tests fail with connection errors

**Solutions:**

```bash
# Ensure test containers are running
pnpm run test:docker:integration

# Check test database
pnpm run db:test:setup

# View test logs
pnpm run docker:logs test-db
```

## Deployment Issues

### Container Build Failures

**Symptoms:** `docker build` fails

**Solutions:**

```bash
# Build with no cache
docker build --no-cache -t valueos .

# Check Docker build logs
docker build -t valueos . 2>&1 | tee build.log

# Validate Dockerfile
docker build --dry-run -t valueos .
```

### Environment Configuration Issues

**Symptoms:** Application fails to start with config errors

**Solutions:**

```bash
# Validate environment
pnpm run env:validate

# Check required variables
echo $DATABASE_URL
echo $SUPABASE_URL

# Compare environments
pnpm run config:diff
```

### SSL/Certificate Issues

**Symptoms:** HTTPS connections fail

**Solutions:**

```bash
# Validate Caddy configuration
pnpm run dx:caddy:validate

# Check certificate status
pnpm run dx:caddy:logs

# Renew certificates
pnpm run dx:caddy:reload
```

## Performance Issues

### Slow Application Startup

**Symptoms:** Services take too long to start

**Solutions:**

```bash
# Check resource usage
docker stats

# Optimize Docker settings
# Increase memory allocation in Docker Desktop

# Health check timing
pnpm run health
```

### Memory Issues

**Symptoms:** Out of memory errors

**Solutions:**

```bash
# Check memory usage
docker stats

# Increase container limits
# Edit docker-compose.yml memory settings

# Optimize application
pnpm run analyze:deps
```

## Networking Issues

### Service Communication Failures

**Symptoms:** Services can't communicate with each other

**Solutions:**

```bash
# Check network connectivity
docker network ls
docker network inspect valueos-network

# Test service connectivity
curl http://backend:3001/health

# Restart network
pnpm run dx:down
pnpm run dx
```

### External API Failures

**Symptoms:** External service calls fail

**Solutions:**

```bash
# Check network connectivity
ping api.supabase.co

# Validate API keys
pnpm run env:validate

# Check rate limits
# Review external service dashboards
```

## Logging and Monitoring

### Log Analysis

```bash
# View all logs
pnpm run dx:logs

# Service-specific logs
pnpm run docker:logs backend

# Search logs
pnpm run dx:logs | grep "ERROR"

# Structured log analysis
pnpm run analyze:logs
```

### Health Monitoring

```bash
# Comprehensive health check
pnpm run dx:check

# Individual health endpoints
curl http://localhost:3001/health
curl http://localhost:54321/health

# Resource monitoring
docker stats
```

## Emergency Procedures

### Complete Environment Reset

```bash
# Nuclear option - complete cleanup
pnpm run dx:clean

# Reinitialize everything
pnpm install
pnpm run dx:env -- --mode local --force
pnpm run dx
pnpm run db:reset
pnpm run seed:demo
```

### Database Recovery

```bash
# Create backup
pnpm run db:backup

# Restore from backup
pnpm run db:restore [backup-file]

# Manual data repair
pnpm run db:repair
```

### Rollback Deployment

```bash
# Stop current deployment
pnpm run docker:prod:down

# Start previous version
docker run -d --name valueos-rollback valueos:previous

# Verify rollback
pnpm run health
```

## Getting Help

### Documentation Resources

- [Setup Guide](setup.md)
- [Deployment Guide](deployment.md)
- [Architecture Decisions](../architecture/active-architectural-decisions.md)
- [API Documentation](../../openapi.yaml)

### Community Support

- Check existing issues on GitHub
- Review audit reports in `audit/` directory
- Consult team documentation in `docs/`

### Escalation

If issues persist:

1. Gather diagnostic information
2. Document reproduction steps
3. Escalate to development team
4. Provide logs and environment details
