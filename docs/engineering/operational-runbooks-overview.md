# ValueOS Operational Runbooks Overview

## Executive Summary

This document provides comprehensive operational runbooks for ValueOS platform operations, covering backup and restore procedures, development setup checklists, and operational procedures. These runbooks ensure reliable platform operations, disaster recovery, and consistent development environment setup.

## Backup and Restore Runbook

### Overview

This runbook outlines procedures for backing up and restoring critical ValueCanvas platform components to ensure data durability and disaster recovery capabilities.

### Components Requiring Backup

The platform consists of the following stateful components that require regular backup:

1. **Database (Supabase/PostgreSQL)**: Application data, user profiles, and configuration
2. **Object Storage (Supabase Storage)**: Uploaded documents, generated artifacts, and images
3. **Secrets**: Managed via Vault or AWS Secrets Manager

### Database Backup and Restore

#### Backup Strategy

- **Point-in-Time Recovery (PITR)**: Supabase Pro plan provides automatic PITR - ensure this feature is enabled
- **Daily Backups**: Automated daily backups performed by Supabase infrastructure
- **Manual Backups**: Trigger manual backups before major migrations or releases

#### Manual Backup Procedure

1. Log in to the Supabase Dashboard
2. Navigate to **Database** > **Backups**
3. Click **Backup Now** (if available) or use the CLI

**Using Supabase CLI:**

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f backup_$(date +%Y%m%d).sql
```

#### Database Restore Procedure

**Disaster Recovery (Full Restore):**

1. **Stop Traffic**: Enable maintenance mode or stop API containers to prevent new writes
2. **Restore via Dashboard**:
   - Navigate to **Database** > **Backups**
   - Select the desired backup point
   - Click **Restore**
   - **Warning: This will overwrite the current database**
3. **Restore via CLI**:

```bash
psql "$SUPABASE_DB_URL" < backup_20230101.sql
```

4. **Verify**: Check critical tables (`users`, `organizations`, `tenants`) for data integrity
5. **Resume Traffic**: Restart API containers

### Object Storage Backup and Restore

#### Backup Strategy

- **Bucket Replication**: Ensure buckets are replicated when using enterprise features
- **Scripted Sync**: Use scheduled jobs to sync buckets to external S3-compatible storage for off-site backup

#### Manual Backup (Sync)

```bash
# Example using AWS CLI to sync Supabase S3-compatible storage to AWS S3 backup bucket
aws s3 sync s3://valuecanvas-prod-assets s3://valuecanvas-backups/assets --endpoint-url https://<project>.supabase.co/storage/v1/s3
```

#### Object Storage Restore Procedure

1. Identify missing or corrupted files
2. Copy files from the backup bucket back to the production bucket

```bash
aws s3 cp s3://valuecanvas-backups/assets/file.pdf s3://valuecanvas-prod-assets/file.pdf --endpoint-url https://<project>.supabase.co/storage/v1/s3
```

### Secrets Backup and Restore

#### Backup Strategy

- **Versioned Secrets**: Use Vault or AWS Secrets Manager versioning capabilities
- **Infrastructure as Code**: Keep secret configuration (not values) in code
- **Manual Export**: Securely export secrets to encrypted vault (e.g., 1Password) periodically

#### Secrets Restore Procedure

1. Update the secret in the secret manager (Vault/AWS)
2. Restart application pods/containers to pick up new secret values (via `SecretVolumeWatcher`)

### Post-Restore Verification

After any restore operation, run health checks and smoke tests:

```bash
# Run smoke tests
npm run test:smoke

# Check health endpoint
curl https://api.valuecanvas.com/health
```

---

## Development Setup Runbook

### Setup Checklist and Verification

#### Files Created and Verified

- [x] **Caddyfile.dev** - Development Caddy configuration
- [x] **infra/docker/docker-compose.caddy.yml** - Complete dev stack
- [x] **.env.dev.example** - Environment template
- [x] **scripts/dev-caddy-start.sh** - Startup automation
- [x] **scripts/dev-caddy-stop.sh** - Shutdown script
- [x] **DEV_CADDY_SETUP.md** - Complete documentation
- [x] **README_DEV_QUICK_START.md** - 2-minute guide
- [x] **CADDY_SETUP_COMPLETE.md** - Summary & reference

#### Quick File Verification

```bash
# Check all files exist
ls -lh Caddyfile.dev
ls -lh infra/docker/docker-compose.caddy.yml
ls -lh .env.dev.example
ls -lh scripts/dev-caddy-start.sh
ls -lh scripts/dev-caddy-stop.sh
ls -lh DEV_CADDY_SETUP.md
ls -lh README_DEV_QUICK_START.md
ls -lh CADDY_SETUP_COMPLETE.md

# Verify scripts are executable
ls -l scripts/dev-caddy-*.sh | grep rwx
```

### Development Environment Startup

#### 1. Environment Configuration

```bash
cp .env.dev.example .env.dev
```

#### 2. Edit Configuration (Optional)

```bash
# Edit .env.dev and set required values:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_LLM_API_KEY
nano .env.dev
```

#### 3. Start All Services

```bash
./scripts/dev-caddy-start.sh
```

#### 4. Verification Checklist

- [ ] Open http://localhost
- [ ] Check http://localhost/caddy-health
- [ ] Check http://localhost:3000
- [ ] Edit a file in ./src/ and verify HMR works

### Services and Features

#### Services Running

- [x] Caddy reverse proxy (port 80)
- [x] Vite dev server (port 3000)
- [x] PostgreSQL database (port 5432)
- [x] Redis cache (port 6379)
- [x] Static file server (port 8080)
- [x] Caddy admin API (port 2019)

#### Features Enabled

- [x] Hot Module Replacement (HMR)
- [x] Auto-reload on file changes
- [x] Debug logging
- [x] Health checks
- [x] Request tracing
- [x] CORS support
- [x] WebSocket support
- [x] Compression

### Documentation Reference Guide

| Document                      | Purpose        | When to Use        |
| ----------------------------- | -------------- | ------------------ |
| **README_DEV_QUICK_START.md** | 2-minute setup | First time setup   |
| **DEV_CADDY_SETUP.md**        | Complete guide | Detailed reference |
| **CADDY_SETUP_COMPLETE.md**   | Summary        | Quick lookup       |
| **SETUP_CHECKLIST.md**        | This file      | Verification       |

### Common Operational Commands

```bash
# Start development
./scripts/dev-caddy-start.sh

# Stop development
./scripts/dev-caddy-stop.sh

# View logs
docker-compose -f infra/docker/docker-compose.caddy.yml logs -f

# Restart a service
docker-compose -f infra/docker/docker-compose.caddy.yml restart <service>

# Check status
docker-compose -f infra/docker/docker-compose.caddy.yml ps

# Rebuild
docker-compose -f infra/docker/docker-compose.caddy.yml up -d --build
```

### Troubleshooting Runbook

#### Port 80 Conflicts

- [ ] Check: `lsof -i :80`
- [ ] Stop conflicting service
- [ ] Or change port in docker-compose file

#### Caddy Startup Issues

- [ ] Validate: `caddy validate --config Caddyfile.dev`
- [ ] Check logs: `docker logs valuecanvas-caddy-dev`
- [ ] Restart: `docker-compose -f infra/docker/docker-compose.caddy.yml restart caddy`

#### HMR Not Working

- [ ] Check Vite: `curl http://localhost:3000`
- [ ] Check WebSocket: `curl http://localhost:24678`
- [ ] Hard refresh browser
- [ ] Restart app service

#### Database Connection Issues

- [ ] Check: `docker exec valuecanvas-postgres-dev pg_isready`
- [ ] View logs: `docker-compose -f infra/docker/docker-compose.caddy.yml logs postgres`
- [ ] Check .env.dev credentials

### Next Steps After Setup

1. Configure API keys in `.env.dev`
2. Run database migrations
3. Start development
4. Read `TESTING.md` for test setup
5. Check production deployment docs when ready

---

## Operational Procedures Summary

### Backup Operations

- **Frequency**: Daily automated, manual before major changes
- **Components**: Database, object storage, secrets
- **Verification**: Health checks and smoke tests post-restore

### Development Environment

- **Setup Time**: 2 minutes with prepared scripts
- **Services**: Caddy, Vite, PostgreSQL, Redis
- **Features**: HMR, auto-reload, health checks, tracing

### Disaster Recovery

- **RTO**: Hours (database restore) to days (full rebuild)
- **RPO**: Minutes (PITR) to hours (daily backups)
- **Verification**: Automated health checks and manual validation

### Monitoring and Alerts

- **Health Endpoints**: `/health` for service status
- **Smoke Tests**: Automated verification of critical paths
- **Logs**: Centralized logging with correlation IDs

---

**Setup Status**: Complete ✅
**Backup Status**: Configured and tested
**Documentation**: Consolidated and verified

Ready for operations! Start development with: `./scripts/dev-caddy-start.sh`
