# Caddy Implementation Guide

**Status:** ✅ Production Ready  
**Date:** 2025-12-06

---

## Overview

Caddy has been fully implemented across all ValueCanvas environments (development, staging, production) to provide:

- **Automatic HTTPS** with Let's Encrypt
- **Enhanced security** with modern headers and TLS configuration
- **Simplified configuration** compared to nginx
- **Built-in rate limiting** and health checks
- **Zero-downtime reloads**

---

## Files Created/Modified

### Caddyfiles

| File | Environment | Port | Domain |
|------|-------------|------|--------|
| `Caddyfile` | Development | 80 | localhost |
| `Caddyfile.staging` | Staging | 8080/8443 | staging.valuecanvas.com |
| `Caddyfile.production` | Production | 80/443 | app.valuecanvas.com |

### Docker Configurations

| File | Purpose | Caddy Service |
|------|---------|---------------|
| `docker-compose.caddy.yml` | Development with Caddy | ✅ Yes |
| `docker-compose.dev.yml` | Development (original) | ❌ No |
| `docker-compose.stage.yml` | Staging | ✅ Yes (replaced nginx) |
| `docker-compose.prod.yml` | Production | ✅ Yes (updated) |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/docker-caddy-setup.sh` | Development setup with Caddy |
| `scripts/deploy-production-caddy.sh` | Production deployment |

### Documentation

| File | Purpose |
|------|---------|
| `docs/CADDY_DEPLOYMENT_SUMMARY.md` | Complete implementation summary |
| `docs/DOCKER_PORT_FORWARDING_FIX.md` | Troubleshooting Docker/WSL2 issues |
| `DOCKER_QUICK_FIX.md` | Quick reference card |
| `docs/CADDY_IMPLEMENTATION_GUIDE.md` | This file |

### Dockerfile

| File | Purpose |
|------|---------|
| `Dockerfile.caddy` | Caddy container with health checks |

---

## Environment Configurations

### Development

**File:** `Caddyfile`

**Features:**
- HTTP only (no HTTPS for localhost)
- Port 80
- CORS enabled for development
- Rate limiting: 100 req/min
- Admin API on port 2019
- Detailed logging (INFO level)

**Usage:**
```bash
# Start with Caddy
bash scripts/docker-caddy-setup.sh

# Or manually
docker-compose -f docker-compose.caddy.yml up -d

# Access
http://localhost
http://localhost:3000  # Direct to app
http://localhost/health
```

### Staging

**File:** `Caddyfile.staging`

**Features:**
- Automatic HTTPS via Let's Encrypt
- Domain: staging.valuecanvas.com
- Ports: 8080 (HTTP), 8443 (HTTPS)
- Rate limiting: 100 req/min
- Admin API enabled (debugging)
- HSTS with short duration (1 day)
- More permissive CSP for testing

**Usage:**
```bash
# Deploy staging
docker-compose -f docker-compose.stage.yml up -d

# Access
https://staging.valuecanvas.com
http://localhost:8080/health
```

**DNS Required:**
```
staging.valuecanvas.com → <server-ip>
```

### Production

**File:** `Caddyfile.production`

**Features:**
- Automatic HTTPS via Let's Encrypt
- Domains: app.valuecanvas.com, api.valuecanvas.com
- Ports: 80 (HTTP redirect), 443 (HTTPS)
- Rate limiting: 60 req/min (app), 30 req/min (API)
- Admin API disabled (security)
- HSTS with 2-year duration
- Strict CSP and security headers
- TLS 1.2+ with strong ciphers only

**Usage:**
```bash
# Deploy production
bash scripts/deploy-production-caddy.sh

# Or manually
docker-compose -f docker-compose.prod.yml up -d

# Access
https://app.valuecanvas.com
https://api.valuecanvas.com
http://localhost/health
```

**DNS Required:**
```
app.valuecanvas.com → <server-ip>
api.valuecanvas.com → <server-ip>
```

---

## Security Features

### TLS/SSL

**Development:**
- HTTP only (localhost)

**Staging:**
- TLS 1.2, 1.3
- Let's Encrypt certificates
- HSTS (1 day)

**Production:**
- TLS 1.2, 1.3 only
- Strong cipher suites
- Let's Encrypt certificates (auto-renewal)
- HSTS (2 years, preload ready)
- HTTP to HTTPS redirect

### Security Headers

All environments include:
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricted)
- `-Server` (header removed)

Production adds:
- `Strict-Transport-Security` with preload
- `Cross-Origin-*` policies
- Stricter CSP

### Rate Limiting

| Environment | Rate | Window |
|-------------|------|--------|
| Development | 100 req | 1 min |
| Staging | 100 req | 1 min |
| Production (app) | 60 req | 1 min |
| Production (API) | 30 req | 1 min |

### Resource Limits

**Caddy Container:**
- Development: 128MB-512MB
- Staging: 128MB-256MB
- Production: 128MB-512MB

**Request Limits:**
- Max header size: 1MB
- Max body size: 50MB
- Connection timeouts: 10-120s

---

## Health Checks

All environments provide:

**Container Health:**
```bash
docker-compose -f docker-compose.<env>.yml ps
```

**HTTP Health Endpoint:**
```bash
curl http://localhost/health
# Returns: healthy
```

**Caddy Health Check:**
- Interval: 30s
- Timeout: 10s
- Retries: 3
- Start period: 10s

**App Health Check:**
- Interval: 30s
- Timeout: 10s
- Retries: 3
- Start period: 40s

---

## Certificate Management

### Automatic Certificate Issuance

Caddy automatically:
1. Requests certificates from Let's Encrypt
2. Validates domain ownership (HTTP-01 or TLS-ALPN-01)
3. Installs certificates
4. Renews before expiration (30 days before)

### Check Certificates

```bash
# List certificates
docker exec valuecanvas-caddy-prod caddy list-certificates

# View certificate details
docker exec valuecanvas-caddy-prod caddy list-certificates --json
```

### Manual Certificate Renewal

```bash
# Reload Caddy (triggers renewal check)
docker exec valuecanvas-caddy-prod caddy reload --config /etc/caddy/Caddyfile
```

### Certificate Storage

Certificates are stored in Docker volumes:
- `caddy-data` - Contains certificates and keys
- `caddy-config` - Contains Caddy configuration

**Backup certificates:**
```bash
docker run --rm -v valuecanvas_caddy-data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/caddy-certs.tar.gz -C /data .
```

---

## Configuration Updates

### Reload Caddy Configuration

**Without downtime:**
```bash
# Development
docker exec valuecanvas-caddy caddy reload --config /etc/caddy/Caddyfile

# Staging
docker exec valuecanvas-caddy-stage caddy reload --config /etc/caddy/Caddyfile

# Production
docker exec valuecanvas-caddy-prod caddy reload --config /etc/caddy/Caddyfile
```

### Validate Configuration

```bash
# Validate before applying
docker exec valuecanvas-caddy-prod caddy validate --config /etc/caddy/Caddyfile
```

### Update Caddyfile

1. Edit the appropriate Caddyfile
2. Validate: `caddy validate --config Caddyfile`
3. Reload: `docker exec ... caddy reload ...`

**Or restart container:**
```bash
docker-compose -f docker-compose.prod.yml restart caddy
```

---

## Monitoring

### Logs

**View logs:**
```bash
# Development
docker-compose -f docker-compose.caddy.yml logs -f caddy

# Staging
docker-compose -f docker-compose.stage.yml logs -f caddy

# Production
docker-compose -f docker-compose.prod.yml logs -f caddy
```

**Log format:** JSON

**Log levels:**
- Development: INFO
- Staging: INFO
- Production: WARN

### Metrics

**Admin API (dev/staging only):**
```bash
# Check admin API
curl http://localhost:2019/config/

# Metrics endpoint
curl http://localhost:2019/metrics
```

### Resource Usage

```bash
# Container stats
docker stats valuecanvas-caddy-prod

# Disk usage
docker system df
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs valuecanvas-caddy-prod

# Common issues:
# 1. Port 80/443 already in use
sudo lsof -i :80
sudo lsof -i :443

# 2. Invalid Caddyfile syntax
docker exec valuecanvas-caddy-prod caddy validate --config /etc/caddy/Caddyfile

# 3. Missing volumes
docker volume ls | grep caddy
```

### SSL Certificate Issues

```bash
# Check certificate status
docker exec valuecanvas-caddy-prod caddy list-certificates

# Common issues:
# 1. DNS not pointing to server
dig app.valuecanvas.com

# 2. Port 80/443 not accessible
curl http://app.valuecanvas.com/health

# 3. Let's Encrypt rate limit
# Wait 1 hour or use staging environment for testing
```

### Health Check Failing

```bash
# Test health endpoint
curl -v http://localhost/health

# Check app is running
docker ps | grep app

# Check Caddy can reach app
docker exec valuecanvas-caddy-prod wget -O- http://app:5173
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Increase memory limit in docker-compose
resources:
  limits:
    memory: 1G

# Enable HTTP/2 (default in Caddy)
# Check with:
curl -I --http2 https://app.valuecanvas.com
```

---

## Migration from nginx

If you previously used nginx:

### 1. Stop nginx container

```bash
docker-compose down nginx
```

### 2. Update docker-compose

Replace nginx service with Caddy (already done in staging/production configs)

### 3. Create Caddyfile

Use the appropriate environment Caddyfile

### 4. Start Caddy

```bash
docker-compose up -d caddy
```

### 5. Verify

```bash
curl https://your-domain.com/health
```

**No application code changes needed!**

---

## Best Practices

### Development

1. Use `docker-compose.caddy.yml` for development with Caddy
2. Keep `auto_https off` for localhost
3. Use admin API for debugging (port 2019)
4. Enable CORS for frontend development

### Staging

1. Use actual domain (staging.valuecanvas.com)
2. Test HTTPS and certificate issuance
3. Validate all production features
4. Keep admin API enabled for debugging

### Production

1. Disable admin API (`admin off`)
2. Use production Caddyfile
3. Set strict security headers
4. Monitor certificate renewal
5. Keep Caddyfile in version control
6. Backup caddy-data volume
7. Test configuration before deploying

### Security

1. Always use HTTPS in production
2. Keep Caddy updated
3. Use strong cipher suites
4. Enable HSTS with preload
5. Set strict CSP
6. Implement rate limiting
7. Monitor logs for anomalies

---

## Deployment Checklist

### Pre-deployment

- [ ] DNS records configured
- [ ] Environment variables set
- [ ] Caddyfile validated
- [ ] Firewall rules configured (80, 443)
- [ ] Backup existing deployment
- [ ] Test staging environment

### Deployment

- [ ] Pull latest images
- [ ] Build custom images
- [ ] Stop old containers
- [ ] Start new containers
- [ ] Wait for health checks
- [ ] Verify certificate issuance
- [ ] Test application access
- [ ] Check logs for errors

### Post-deployment

- [ ] Monitor resource usage
- [ ] Verify HTTPS working
- [ ] Test rate limiting
- [ ] Check security headers
- [ ] Monitor logs for 24h
- [ ] Document any issues
- [ ] Update runbook

---

## Support

### Documentation

- [Caddy Official Docs](https://caddyserver.com/docs/)
- [Caddyfile Tutorial](https://caddyserver.com/docs/caddyfile-tutorial)
- [Docker Compose Docs](https://docs.docker.com/compose/)

### Internal Documentation

- `docs/CADDY_DEPLOYMENT_SUMMARY.md` - Implementation summary
- `docs/DOCKER_PORT_FORWARDING_FIX.md` - Docker/WSL2 troubleshooting
- `DOCKER_QUICK_FIX.md` - Quick reference

### Getting Help

1. Check logs: `docker-compose logs caddy`
2. Validate config: `caddy validate`
3. Review documentation
4. Check GitHub issues
5. Contact DevOps team

---

**Last Updated:** 2025-12-06  
**Version:** 1.0.0  
**Status:** Production Ready
