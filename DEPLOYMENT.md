# ValueCanvas Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [Production Deployment](#production-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Security Configuration](#security-configuration)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Overview

ValueCanvas supports multiple deployment strategies:

- **Local Development**: Docker Compose with hot-reloading
- **Production**: Optimized Docker containers with security hardening
- **Cloud**: AWS, GCP, Azure deployment guides

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │  Nginx  │ (Reverse Proxy, SSL)
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼────┐          ┌────▼────┐
         │  App 1  │          │  App 2  │ (Load Balanced)
         └────┬────┘          └────┬────┘
              │                     │
              └──────────┬──────────┘
                         │
                    ┌────▼────┐
                    │  Redis  │ (Rate Limiting, Cache)
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │Supabase │ (Database, Auth, Storage)
                    └─────────┘
```

---

## Prerequisites

### Required Software

- **Docker**: 24.0+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose**: 2.20+ (included with Docker Desktop)
- **Node.js**: 20+ (for local development without Docker)
- **Git**: Latest version

### Required Accounts

- **Supabase**: [Create account](https://supabase.com)
- **LLM Provider**: Together AI or OpenAI account
- **Cloud Provider** (for production): AWS, GCP, or Azure

### Environment Variables

Create `.env.local` (development) and `.env.production` (production):

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# LLM Provider
VITE_LLM_API_KEY=your-llm-api-key
VITE_LLM_PROVIDER=together  # or 'openai'

# Security (Production)
VITE_ENABLE_CIRCUIT_BREAKER=true
VITE_ENABLE_RATE_LIMITING=true
VITE_ENABLE_AUDIT_LOGGING=true

# Redis (Production)
REDIS_PASSWORD=your-secure-redis-password
```

---

## Local Development

### Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/bmsull560/ValueCanvas.git
cd ValueCanvas

# 2. Copy environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Start development environment
docker-compose -f docker-compose.dev.yml up -d

# 4. View logs
docker-compose -f docker-compose.dev.yml logs -f app

# 5. Open browser
open http://localhost:5173
```

### Development Features

- ✅ **Hot Module Replacement**: Changes reflect instantly
- ✅ **Source Maps**: Full debugging support
- ✅ **Local Database**: Optional PostgreSQL container
- ✅ **Redis**: Optional caching and rate limiting

### Development Commands

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Start only app (no database)
docker-compose -f docker-compose.dev.yml up -d app

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Restart app
docker-compose -f docker-compose.dev.yml restart app

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes
docker-compose -f docker-compose.dev.yml down -v

# Rebuild containers
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

### Without Docker (Native Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:5173
```

---

## Production Deployment

### Build Production Image

```bash
# Build optimized production image
docker build -t valuecanvas:latest .

# Verify image size (should be < 500MB)
docker images valuecanvas:latest

# Test production image locally
docker run -p 5173:5173 \
  -e VITE_SUPABASE_URL=your-url \
  -e VITE_SUPABASE_ANON_KEY=your-key \
  valuecanvas:latest
```

### Production Deployment (Docker Compose)

```bash
# 1. Copy production environment file
cp .env.example .env.production
# Edit .env.production with production credentials

# 2. Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify health
docker-compose -f docker-compose.prod.yml ps
curl http://localhost/health

# 4. View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Production Features

- ✅ **Multi-Stage Build**: Optimized image size
- ✅ **Non-Root User**: Security hardening
- ✅ **Health Checks**: Automatic restart on failure
- ✅ **Resource Limits**: CPU and memory constraints
- ✅ **Nginx Reverse Proxy**: SSL termination and caching
- ✅ **Redis**: Production-ready caching
- ✅ **Logging**: Structured JSON logs

### Production Commands

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Scale application (load balancing)
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Monitor resources
docker stats

# Backup volumes
docker run --rm -v valuecanvas_redis-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup.tar.gz /data

# Update application
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Rollback
docker-compose -f docker-compose.prod.yml down
docker tag valuecanvas:previous valuecanvas:latest
docker-compose -f docker-compose.prod.yml up -d
```

---

## Cloud Deployment

### AWS Deployment (ECS)

#### Prerequisites
- AWS CLI configured
- ECR repository created
- ECS cluster created

#### Steps

```bash
# 1. Build and tag image
docker build -t valuecanvas:latest .

# 2. Tag for ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag valuecanvas:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/valuecanvas:latest

# 3. Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/valuecanvas:latest

# 4. Deploy to ECS
aws ecs update-service \
  --cluster valuecanvas-cluster \
  --service valuecanvas-service \
  --force-new-deployment
```

#### ECS Task Definition

```json
{
  "family": "valuecanvas",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "valuecanvas",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/valuecanvas:latest",
      "portMappings": [
        {
          "containerPort": 5173,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "VITE_SUPABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:valuecanvas/supabase-url"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:5173/ || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/valuecanvas",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### GCP Deployment (Cloud Run)

```bash
# 1. Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/valuecanvas

# 2. Deploy to Cloud Run
gcloud run deploy valuecanvas \
  --image gcr.io/PROJECT_ID/valuecanvas \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets VITE_SUPABASE_URL=supabase-url:latest \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

### Azure Deployment (Container Instances)

```bash
# 1. Build and push to ACR
az acr build --registry valuecanvas --image valuecanvas:latest .

# 2. Deploy to Container Instances
az container create \
  --resource-group valuecanvas-rg \
  --name valuecanvas \
  --image valuecanvas.azurecr.io/valuecanvas:latest \
  --cpu 2 \
  --memory 2 \
  --registry-login-server valuecanvas.azurecr.io \
  --registry-username valuecanvas \
  --registry-password <password> \
  --dns-name-label valuecanvas \
  --ports 5173 \
  --environment-variables \
    NODE_ENV=production \
  --secure-environment-variables \
    VITE_SUPABASE_URL=<url> \
    VITE_SUPABASE_ANON_KEY=<key>
```

### Kubernetes Deployment

See [infrastructure/kubernetes/README.md](./infrastructure/kubernetes/README.md) for Kubernetes manifests.

---

## Security Configuration

### SSL/TLS Setup

#### Using Let's Encrypt (Certbot)

```bash
# 1. Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# 2. Obtain certificate
sudo certbot --nginx -d valuecanvas.com -d www.valuecanvas.com

# 3. Auto-renewal
sudo certbot renew --dry-run
```

#### Using Custom Certificate

```bash
# 1. Copy certificates
mkdir -p infrastructure/nginx/ssl
cp your-cert.crt infrastructure/nginx/ssl/
cp your-key.key infrastructure/nginx/ssl/

# 2. Update nginx.conf
# See infrastructure/nginx/nginx.conf for SSL configuration
```

### Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Security Hardening Checklist

- [x] **Non-root user**: Container runs as user `valuecanvas` (UID 1001)
- [x] **Read-only filesystem**: Container filesystem is read-only
- [x] **No new privileges**: `security_opt: no-new-privileges:true`
- [x] **Resource limits**: CPU and memory limits configured
- [x] **Health checks**: Automatic restart on failure
- [x] **Secrets management**: Environment variables from secrets
- [x] **Network isolation**: Bridge network with subnet
- [x] **Logging**: Structured JSON logs with rotation
- [x] **Rate limiting**: Redis-backed rate limiting
- [x] **Circuit breaker**: Agent execution limits
- [x] **Audit logging**: Immutable audit trail

---

## Monitoring & Maintenance

### Health Checks

```bash
# Application health
curl http://localhost:5173/

# Docker health status
docker ps --filter "name=valuecanvas" --format "table {{.Names}}\t{{.Status}}"

# Detailed health
docker inspect --format='{{json .State.Health}}' valuecanvas-prod | jq
```

### Logging

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# View nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Export logs
docker-compose -f docker-compose.prod.yml logs --no-color > logs.txt
```

### Monitoring Metrics

```bash
# Resource usage
docker stats

# Disk usage
docker system df

# Network usage
docker network inspect valuecanvas-network
```

### Backup & Restore

```bash
# Backup Redis data
docker run --rm \
  -v valuecanvas_redis-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup-$(date +%Y%m%d).tar.gz /data

# Restore Redis data
docker run --rm \
  -v valuecanvas_redis-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/redis-backup-20241122.tar.gz -C /
```

### Updates & Maintenance

```bash
# Update application
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Update base images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -a

# Clean up old volumes
docker volume prune
```

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check environment variables
docker-compose -f docker-compose.prod.yml config

# Verify image
docker images valuecanvas:latest

# Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
```

#### Port Already in Use

```bash
# Find process using port
lsof -i :5173

# Kill process
kill -9 <PID>

# Or use different port
docker-compose -f docker-compose.prod.yml up -d -p 8080:5173
```

#### Out of Memory

```bash
# Check memory usage
docker stats

# Increase memory limit in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 4G
```

#### Slow Performance

```bash
# Check resource usage
docker stats

# Scale horizontally
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Enable Redis caching
# Verify REDIS_PASSWORD is set in .env.production
```

### Debug Mode

```bash
# Run with debug logging
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec app sh

# Inside container
npm run dev  # Run in development mode
```

### Support

- **Documentation**: [docs/](./docs/)
- **Security**: [docs/security/](./docs/security/)
- **Issues**: [GitHub Issues](https://github.com/bmsull560/ValueCanvas/issues)

---

## Performance Optimization

### Production Optimizations

1. **Enable Nginx Caching**
   - Static assets cached for 1 year
   - API responses cached for 5 minutes

2. **Enable Redis Caching**
   - Rate limiting data
   - Session data
   - API response cache

3. **Enable CDN**
   - CloudFlare, AWS CloudFront, or similar
   - Cache static assets globally

4. **Database Optimization**
   - Connection pooling
   - Query optimization
   - Indexes on frequently queried fields

5. **Load Balancing**
   - Scale horizontally with multiple app instances
   - Use nginx upstream for load balancing

### Monitoring Tools

- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **Sentry**: Error tracking
- **DataDog**: APM and monitoring

---

## Compliance & Security

### SOC 2 Compliance

- ✅ Immutable audit logs
- ✅ Access control (RBAC)
- ✅ Data encryption (in transit and at rest)
- ✅ Regular security updates
- ✅ Incident response procedures

### GDPR Compliance

- ✅ PII sanitization in logs
- ✅ Data retention policies
- ✅ Right to be forgotten
- ✅ Data export capabilities
- ✅ Consent management

### Security Audits

```bash
# Run security audit
npm run security:scan

# Check for vulnerabilities
docker scan valuecanvas:latest

# Verify no console.log statements
bash scripts/audit-logs.sh
```

---

## Appendix

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Yes | - | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | - | Supabase anonymous key |
| `VITE_LLM_API_KEY` | Yes | - | LLM provider API key |
| `VITE_LLM_PROVIDER` | No | `together` | LLM provider (together/openai) |
| `VITE_ENABLE_CIRCUIT_BREAKER` | No | `true` | Enable agent circuit breaker |
| `VITE_ENABLE_RATE_LIMITING` | No | `true` | Enable API rate limiting |
| `VITE_ENABLE_AUDIT_LOGGING` | No | `true` | Enable audit logging |
| `REDIS_PASSWORD` | Yes (prod) | - | Redis password |
| `NODE_ENV` | No | `production` | Node environment |

### Port Reference

| Port | Service | Description |
|------|---------|-------------|
| 5173 | App | Application server |
| 24678 | HMR | Hot Module Replacement (dev) |
| 80 | Nginx | HTTP |
| 443 | Nginx | HTTPS |
| 5432 | PostgreSQL | Database (dev) |
| 6379 | Redis | Cache/Rate limiting |

### Resource Requirements

| Environment | CPU | Memory | Disk |
|-------------|-----|--------|------|
| Development | 1 core | 1GB | 5GB |
| Production (single) | 2 cores | 2GB | 10GB |
| Production (scaled) | 4+ cores | 4GB+ | 20GB+ |

---

**Last Updated**: November 2024  
**Version**: 2.0 (Post-Security Sprint)  
**Maintained By**: ValueCanvas Team
