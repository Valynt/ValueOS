---
title: Supabase Migration Automation Guide
owner: team-operations
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Supabase Migration Automation Guide

Complete guide for automated database migration management in the ValueOS development environment.

---

## 📦 Available Scripts

## Environment Provisioning Templates

Before running migration scripts for managed environments, create an environment file from the templates in `ops/env/` and then populate real secret values:

```bash
# Staging
cp ops/env/.env.staging.template .env.staging

# Production
cp ops/env/.env.production.template .env.production
```

At minimum, set `DATABASE_URL`. If your migration or validation flow uses Supabase runtime/API operations, also set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

---

### 1. **supabase-migrate-all.sh** - Master Migration Script

Complete end-to-end migration automation with initialization, migrations, authentication, and validation.

#### Features
- ✅ Environment validation and connection testing
- ✅ Automatic initialization (roles, shadow DB, tracking)
- ✅ Sequential migration application with checksums
- ✅ Authentication setup (Supabase Auth + JWT)
- ✅ Post-migration validation
- ✅ Optional seed data application
- ✅ Comprehensive logging and error handling
- ✅ Dry-run mode for testing
- ✅ Force mode for re-applying migrations

#### Basic Usage

```bash
# Standard migration (full process)
./infra/scripts/supabase-migrate-all.sh

# Dry run (preview without executing)
./infra/scripts/supabase-migrate-all.sh --dry-run

# Skip initialization (if already done)
./infra/scripts/supabase-migrate-all.sh --skip-init

# Apply with seed data
./infra/scripts/supabase-migrate-all.sh --with-seeds

# Verbose output
./infra/scripts/supabase-migrate-all.sh --verbose

# Force re-apply all migrations
./infra/scripts/supabase-migrate-all.sh --force
```

#### Advanced Options

```bash
# Use custom environment file
./infra/scripts/supabase-migrate-all.sh --env .env.production

# Skip authentication setup
./infra/scripts/supabase-migrate-all.sh --skip-auth

# Validate only (no changes)
./infra/scripts/supabase-migrate-all.sh --validate-only

# Combination of options
./infra/scripts/supabase-migrate-all.sh --skip-init --with-seeds --verbose
```

#### Exit Codes

- `0` - Success
- `1` - General error
- `2` - Environment validation failed
- `3` - Initialization failed
- `4` - Migration failed
- `5` - Authentication setup failed
- `6` - Validation failed

---

### 2. **validate-migrations.sh** - Validation Utility

Comprehensive validation tool for database health, security, and performance.

#### Features
- ✅ Migration status and integrity check
- ✅ RLS policy validation
- ✅ Tenant isolation verification
- ✅ Index health analysis
- ✅ Table statistics and size
- ✅ Foreign key constraints
- ✅ Extension verification
- ✅ Security audit
- ✅ Detailed HTML/text reports

#### Usage

```bash
# Generate validation report
./infra/scripts/validate-migrations.sh

# Save to custom location
./infra/scripts/validate-migrations.sh /path/to/report.txt

# With automatic fixes (if available)
./infra/scripts/validate-migrations.sh --fix
```

#### Report Sections

1. **Migration Status** - Applied migrations and history
2. **RLS Policies** - Row-level security coverage
3. **Tenant Isolation** - Multi-tenancy validation
4. **Index Health** - Performance and missing indexes
5. **Table Statistics** - Size and row counts
6. **Referential Integrity** - Foreign key constraints
7. **Extensions** - Required PostgreSQL extensions
8. **Security Audit** - Roles and permissions
9. **Migration Integrity** - Checksum validation
10. **Summary** - Overall health status

---

### 3. **rollback-migration.sh** - Rollback Utility

Safe rollback with automatic backup and restore capabilities.

#### Features
- ✅ List applied migrations
- ✅ Create database backups
- ✅ Restore from backup
- ✅ Safe rollback with confirmation
- ✅ Automatic backup before rollback

#### Usage

```bash
# List all applied migrations
./infra/scripts/rollback-migration.sh --list

# Create backup
./infra/scripts/rollback-migration.sh --backup

# Restore from backup
./infra/scripts/rollback-migration.sh --restore /path/to/backup.sql

# Rollback to specific migration (creates backup first)
./infra/scripts/rollback-migration.sh 20260208_rls_enforcement
```

#### Backup Location

Backups are stored in: `backups/migrations/backup_YYYYMMDD_HHMMSS.sql`

---

### 4. **migration-status.sh** - Status Dashboard

Quick status checker with optional watch mode.

#### Features
- ✅ Real-time connection status
- ✅ Migration count
- ✅ RLS policy count
- ✅ Table and index statistics
- ✅ Recent migrations list
- ✅ Database size
- ✅ Watch mode (auto-refresh)

#### Usage

```bash
# Single status check
./infra/scripts/migration-status.sh

# Watch mode (refresh every 5 seconds)
./infra/scripts/migration-status.sh --watch
```

---

## 🚀 Quick Start Guide

### First-Time Setup

```bash
# 1. Navigate to project root
cd /path/to/valueos

# 2. Configure environment
cp .env.template .env
# Edit .env with your database credentials

# 3. Run complete migration
./infra/scripts/supabase-migrate-all.sh --verbose

# 4. Validate
./infra/scripts/validate-migrations.sh

# 5. Check status
./infra/scripts/migration-status.sh
```

### Daily Development Workflow

```bash
# Check current status
./infra/scripts/migration-status.sh

# Apply new migrations (skip init if already done)
./infra/scripts/supabase-migrate-all.sh --skip-init

# Validate after changes
./infra/scripts/validate-migrations.sh
```

### Production Deployment

```bash
# 1. Create backup
./infra/scripts/rollback-migration.sh --backup

# 2. Dry run first
./infra/scripts/supabase-migrate-all.sh --dry-run --env .env.production

# 3. Apply migrations
./infra/scripts/supabase-migrate-all.sh --env .env.production --verbose

# 4. Validate
./infra/scripts/validate-migrations.sh /var/log/migration_validation.txt

# 5. Monitor
./infra/scripts/migration-status.sh --watch
```

---

## 🔧 Configuration

### Environment Variables

Required in `.env` file:

```bash
# Database Connection
POSTGRES_HOST=localhost
POSTGRES_PORT=54323
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# Optional: Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Directory Structure

```
valueos/
├── .devcontainer/
│   └── init-scripts/          # Initialization scripts
│       ├── 00-create-supabase-roles.sh
│       ├── 01-create-shadow-db.sh
│       └── 02-create-migrations-table.sh
├── infra/
│   ├── postgres/
│   │   └── migrations/        # SQL migration files
│   │       ├── 20231101000000_initial_schema.sql
│   │       ├── 20260208_rls_enforcement.sql
│   │       └── ...
│   ├── supabase/
│   │   └── init-auth.sql      # Authentication setup
│   └── scripts/               # Automation scripts
│       ├── supabase-migrate-all.sh
│       ├── validate-migrations.sh
│       ├── rollback-migration.sh
│       └── migration-status.sh
├── scripts/
│   └── seeds/                 # Seed data (optional)
│       └── create_dummy_user.sql
├── logs/
│   └── migrations/            # Migration logs
└── backups/
    └── migrations/            # Database backups
```

---

## 📊 Logging

### Log Files

All migration operations are logged to:

```
logs/migrations/migration_YYYYMMDD_HHMMSS.log
```

### Log Levels

- `[INFO]` - Informational messages
- `[SUCCESS]` - Successful operations
- `[WARNING]` - Non-critical issues
- `[ERROR]` - Critical failures

### Viewing Logs

```bash
# View latest log
tail -f logs/migrations/migration_*.log | tail -1

# Search for errors
grep ERROR logs/migrations/migration_*.log

# View specific migration
grep "20260208_rls_enforcement" logs/migrations/migration_*.log
```

---

## 🔒 Security Best Practices

### 1. **Always Backup Before Migrations**

```bash
./infra/scripts/rollback-migration.sh --backup
```

### 2. **Use Dry Run in Production**

```bash
./infra/scripts/supabase-migrate-all.sh --dry-run --env .env.production
```

### 3. **Validate After Every Migration**

```bash
./infra/scripts/validate-migrations.sh
```

### 4. **Monitor RLS Policies**

```bash
# Check RLS coverage
./infra/scripts/validate-migrations.sh | grep "RLS"
```

### 5. **Test in Shadow Database First**

The initialization scripts automatically create a shadow database for testing.

---

## 🐛 Troubleshooting

### Connection Refused

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection manually
psql -h localhost -p 54323 -U postgres -d postgres
```

### Migration Already Applied

```bash
# Force re-apply
./infra/scripts/supabase-migrate-all.sh --force

# Or skip specific migrations
# Edit schema_migrations table manually (not recommended)
```

### RLS Policy Errors

```bash
# Validate RLS policies
./infra/scripts/validate-migrations.sh | grep -A 20 "RLS POLICIES"

# Check tenant isolation
psql -c "SELECT * FROM pg_policies WHERE policyname LIKE '%tenant%';"
```

### Performance Issues

```bash
# Check missing indexes
./infra/scripts/validate-migrations.sh | grep -A 10 "Missing indexes"

# Analyze query performance
psql -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"
```

---

## 📚 Additional Resources

### Migration File Naming Convention

```
YYYYMMDDHHMMSS_description.sql

Example:
20260208000000_add_tenant_indexes.sql
```

### Writing Migrations

```sql
-- migrations/20260208000000_example.sql

-- Always use IF EXISTS / IF NOT EXISTS
CREATE TABLE IF NOT EXISTS example_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_example_tenant 
ON example_table(tenant_id);

-- Enable RLS
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY tenant_isolation_policy ON example_table
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Testing Migrations

```bash
# 1. Create test migration
echo "SELECT 1;" > infra/postgres/migrations/99999999999999_test.sql

# 2. Dry run
./infra/scripts/supabase-migrate-all.sh --dry-run

# 3. Apply to shadow DB first
POSTGRES_DB=shadow_db ./infra/scripts/supabase-migrate-all.sh

# 4. Validate
./infra/scripts/validate-migrations.sh

# 5. Remove test migration
rm infra/postgres/migrations/99999999999999_test.sql
```

---

## 🎯 Common Workflows

### Adding a New Migration

```bash
# 1. Create migration file
cat > infra/postgres/migrations/20260208120000_add_new_feature.sql << 'EOF'
CREATE TABLE IF NOT EXISTS new_feature (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_new_feature_tenant ON new_feature(tenant_id);
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON new_feature
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
EOF

# 2. Test in shadow DB
POSTGRES_DB=shadow_db ./infra/scripts/supabase-migrate-all.sh --skip-init

# 3. Apply to main DB
./infra/scripts/supabase-migrate-all.sh --skip-init

# 4. Validate
./infra/scripts/validate-migrations.sh
```

### Emergency Rollback

```bash
# 1. Create immediate backup
./infra/scripts/rollback-migration.sh --backup

# 2. Identify last good migration
./infra/scripts/rollback-migration.sh --list

# 3. Restore from backup
./infra/scripts/rollback-migration.sh --restore backups/migrations/backup_YYYYMMDD_HHMMSS.sql

# 4. Verify
./infra/scripts/migration-status.sh
```

---

## 📞 Support

For issues or questions:

1. Check logs: `logs/migrations/`
2. Run validation: `./infra/scripts/validate-migrations.sh`
3. Review this guide
4. Contact DevOps team

---

**Last Updated**: 2026-02-08  
**Version**: 1.0.0  
**Maintainer**: ValueOS DevOps Team
