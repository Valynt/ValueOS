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
npm run dx:clean
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
npm --version

# Use correct version with nvm
nvm use

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Database Issues

### PostgreSQL Connection Failures

**Symptoms:** Database operations fail

**Solutions:**

```bash
# Check database container
npm run dx:ps

# View database logs
npm run docker:logs postgres

# Test connection
npm run db:test

# Reset database
npm run db:reset
```

### Migration Failures

**Symptoms:** `db:push` fails with schema errors

**Solutions:**

```bash
# Check migration status
npm run db:validate

# Pull remote schema
npm run db:pull

# Repair migrations
npm run db:repair

# Manual migration repair
npm run migration:validate
```

## Application Issues

### Build Failures

**Symptoms:** `npm run build` fails

**Solutions:**

```bash
# Clear build cache
rm -rf dist node_modules/.vite

# Type check first
npm run typecheck

# Clean install
npm run dx:clean
npm install

# Check for TypeScript errors
npm run build:backend
```

### Runtime Errors

**Symptoms:** Application crashes or behaves unexpectedly

**Solutions:**

```bash
# Check application logs
npm run dx:logs

# Health check
npm run health

# Environment validation
npm run env:validate

# Restart services
npm run dx:down
npm run dx
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
npm run dev

# Check browser console for errors
```

## Testing Issues

### Test Failures

**Symptoms:** `npm run test` fails

**Solutions:**

```bash
# Run tests with verbose output
npm run test -- --verbose

# Check test environment
npm run test:docker

# Clear test cache
npm run test -- --clearCache

# Run specific test
npm run test -- [test-file]
```

### Integration Test Issues

**Symptoms:** Integration tests fail with connection errors

**Solutions:**

```bash
# Ensure test containers are running
npm run test:docker:integration

# Check test database
npm run db:test:setup

# View test logs
npm run docker:logs test-db
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
npm run env:validate

# Check required variables
echo $DATABASE_URL
echo $SUPABASE_URL

# Compare environments
npm run config:diff
```

### SSL/Certificate Issues

**Symptoms:** HTTPS connections fail

**Solutions:**

```bash
# Validate Caddy configuration
npm run dx:caddy:validate

# Check certificate status
npm run dx:caddy:logs

# Renew certificates
npm run dx:caddy:reload
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
npm run health
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
npm run analyze:deps
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
npm run dx:down
npm run dx
```

### External API Failures

**Symptoms:** External service calls fail

**Solutions:**

```bash
# Check network connectivity
ping api.supabase.co

# Validate API keys
npm run env:validate

# Check rate limits
# Review external service dashboards
```

## Logging and Monitoring

### Log Analysis

```bash
# View all logs
npm run dx:logs

# Service-specific logs
npm run docker:logs backend

# Search logs
npm run dx:logs | grep "ERROR"

# Structured log analysis
npm run analyze:logs
```

### Health Monitoring

```bash
# Comprehensive health check
npm run dx:check

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
npm run dx:clean

# Reinitialize everything
npm install
npm run env:dev
npm run dx
npm run db:reset
npm run seed:demo
```

### Database Recovery

```bash
# Create backup
npm run db:backup

# Restore from backup
npm run db:restore [backup-file]

# Manual data repair
npm run db:repair
```

### Rollback Deployment

```bash
# Stop current deployment
npm run docker:prod:down

# Start previous version
docker run -d --name valueos-rollback valueos:previous

# Verify rollback
npm run health
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
