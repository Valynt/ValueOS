# Environment Configuration Guide

**Date**: January 5, 2026  
**Purpose**: Database configuration for dev/staging/production  
**Status**: Required for deployment

---

## Overview

The migrations are **self-contained** and will work in any environment, but there are some **optional configurations** and **prerequisites** that should be set up for optimal operation.

---

## ✅ What's Already Handled

### Automatic in Migrations

The migrations automatically handle:

- ✅ **Extension Installation**: `CREATE EXTENSION IF NOT EXISTS pgsodium`
- ✅ **Key Generation**: Creates encryption keys automatically
- ✅ **Function Creation**: All helper functions included
- ✅ **Policy Creation**: All RLS policies included
- ✅ **Index Creation**: All indexes included

**No manual configuration needed** - migrations are fully self-contained!

---

## 🔧 Required Prerequisites

### 1. PostgreSQL Version

**Minimum**: PostgreSQL 15.x  
**Recommended**: PostgreSQL 15.15+

```bash
# Check version
psql $DATABASE_URL -c "SELECT version();"
```

**Why**: pgsodium and modern RLS features require PostgreSQL 15+

---

### 2. Extensions Available

**Required Extensions**:
- `pgsodium` - For encryption (auto-installed by migration)
- `pg_stat_statements` - For query monitoring (optional but recommended)

**Supabase**: These are pre-installed ✅  
**Heroku**: Add `pgsodium` buildpack  
**AWS RDS**: Enable in parameter group  
**Self-hosted**: Install via package manager

#### Heroku Setup

```bash
# Add pgsodium buildpack
heroku buildpacks:add https://github.com/pgsodium/pgsodium-buildpack

# Or use Heroku Postgres extensions
heroku pg:extensions:install pgsodium -a your-app-name
```

#### AWS RDS Setup

```sql
-- Enable pgsodium (requires rds_superuser)
CREATE EXTENSION IF NOT EXISTS pgsodium;
```

#### Self-Hosted Setup

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-15-pgsodium

# macOS
brew install pgsodium

# Then in PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgsodium;
```

---

## ⚙️ Optional Configuration

### 1. Connection Pooling (Recommended for Production)

**Why**: Improves performance and handles connection limits

#### Supabase (Built-in)

Already configured via Supavisor ✅

#### Heroku

```bash
# Use PgBouncer buildpack
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-pgbouncer

# Configure in Procfile
echo "web: bin/start-pgbouncer-stunnel bundle exec puma -C config/puma.rb" > Procfile
```

#### Self-Hosted PgBouncer

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
valueos = host=localhost port=5432 dbname=valueos

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

---

### 2. Query Performance Monitoring

**Enable pg_stat_statements**:

```sql
-- Add to postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

-- Restart PostgreSQL, then:
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

### 3. Statement Timeout (Recommended)

**Prevent runaway queries**:

```sql
-- Set globally (postgresql.conf)
statement_timeout = '30s'

-- Or per-database
ALTER DATABASE valueos SET statement_timeout = '30s';

-- Or per-role
ALTER ROLE app_user SET statement_timeout = '30s';
```

---

### 4. Work Memory (For Large Queries)

**Improve sort/hash performance**:

```sql
-- Set globally (postgresql.conf)
work_mem = '256MB'

-- Or per-database
ALTER DATABASE valueos SET work_mem = '256MB';
```

---

## 🔐 Security Configuration

### 1. SSL/TLS (Production Required)

**Supabase**: Enabled by default ✅

**Heroku**:
```bash
# Force SSL in connection string
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
```

**Self-Hosted**:
```ini
# postgresql.conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
ssl_ca_file = '/path/to/root.crt'
```

---

### 2. Row Level Security (Already Enabled)

The migrations enable RLS on all tables ✅

**Verify**:
```sql
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
```

Expected: 0 rows (all tables have RLS)

---

### 3. Audit Logging

**Enable query logging** (optional):

```sql
-- postgresql.conf
log_statement = 'mod'  -- Log all modifications
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

---

## 🌍 Environment-Specific Settings

### Development

```bash
# .env.development
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NODE_ENV=development
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=your-local-service-key

# Optional
SEED_ADMIN_PASSWORD=DevAdmin123!
SEED_USER_PASSWORD=DevUser456!
```

**Config**:
- Connection pooling: Not needed
- Statement timeout: 60s (longer for debugging)
- SSL: Not required
- Query logging: Enabled

---

### Staging

```bash
# .env.staging
DATABASE_URL=postgresql://user:pass@staging-db.example.com:5432/valueos?sslmode=require
NODE_ENV=staging
SUPABASE_URL=https://staging.supabase.co
SUPABASE_SERVICE_KEY=your-staging-service-key

# No seed passwords (don't seed staging)
```

**Config**:
- Connection pooling: Recommended
- Statement timeout: 30s
- SSL: Required
- Query logging: Moderate (mod)

---

### Production

```bash
# .env.production
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/valueos?sslmode=require
NODE_ENV=production
SUPABASE_URL=https://prod.supabase.co
SUPABASE_SERVICE_KEY=your-prod-service-key

# Never set seed passwords in production
```

**Config**:
- Connection pooling: Required
- Statement timeout: 30s
- SSL: Required
- Query logging: Errors only
- Monitoring: Full monitoring enabled

---

## 📋 Pre-Deployment Checklist

### All Environments

- [ ] PostgreSQL 15+ installed
- [ ] pgsodium extension available
- [ ] Database created
- [ ] User has CREATE EXTENSION privilege
- [ ] Backup system configured

### Development

- [ ] Local Supabase running
- [ ] Seed scripts tested
- [ ] Migrations applied successfully

### Staging

- [ ] SSL enabled
- [ ] Connection pooling configured
- [ ] Monitoring enabled
- [ ] Backup verified
- [ ] Migrations tested

### Production

- [ ] SSL enforced
- [ ] Connection pooling active
- [ ] Statement timeout set
- [ ] Query monitoring enabled
- [ ] Backup automated
- [ ] Disaster recovery tested
- [ ] Team trained on rollback

---

## 🧪 Verification Commands

### Check Extensions

```sql
SELECT 
  extname,
  extversion
FROM pg_extension
WHERE extname IN ('pgsodium', 'pg_stat_statements');
```

Expected:
```
 extname            | extversion
--------------------+------------
 pgsodium           | 3.1.8
 pg_stat_statements | 1.10
```

---

### Check Configuration

```sql
-- Check statement timeout
SHOW statement_timeout;

-- Check work memory
SHOW work_mem;

-- Check SSL
SHOW ssl;

-- Check connection limit
SHOW max_connections;
```

---

### Check Encryption

```sql
-- Verify encryption key exists
SELECT id, name, status, key_type 
FROM pgsodium.key 
WHERE name = 'integration_credentials_key';

-- Test encryption
SELECT encrypt_credentials('test_data');

-- Should return bytea (encrypted data)
```

---

### Check RLS

```sql
-- All tables should have RLS
SELECT 
  COUNT(*) FILTER (WHERE rowsecurity = true) as with_rls,
  COUNT(*) FILTER (WHERE rowsecurity = false) as without_rls
FROM pg_tables
WHERE schemaname = 'public';

-- Expected: with_rls = 98, without_rls = 0
```

---

## 🚨 Common Issues

### Issue: pgsodium extension not found

**Cause**: Extension not installed on database server

**Solution**:
```bash
# Heroku
heroku pg:extensions:install pgsodium

# AWS RDS
# Enable in parameter group, then:
CREATE EXTENSION pgsodium;

# Self-hosted
sudo apt-get install postgresql-15-pgsodium
```

---

### Issue: Permission denied for extension

**Cause**: User lacks CREATE EXTENSION privilege

**Solution**:
```sql
-- Grant privilege (as superuser)
ALTER USER your_user WITH SUPERUSER;

-- Or grant specific extension privilege
GRANT CREATE ON DATABASE valueos TO your_user;
```

---

### Issue: Connection pool exhausted

**Cause**: Too many connections, no pooling

**Solution**:
```bash
# Enable connection pooling (see above)
# Or increase max_connections
ALTER SYSTEM SET max_connections = 200;
# Restart PostgreSQL
```

---

### Issue: Slow RLS queries

**Cause**: Missing indexes on RLS columns

**Solution**:
```sql
-- Already fixed by migration 20260105000003
-- Verify indexes exist:
SELECT * FROM pg_indexes 
WHERE tablename IN ('user_tenants', 'user_organizations')
AND indexname LIKE '%active%';
```

---

## 📊 Monitoring Queries

### Connection Usage

```sql
SELECT 
  count(*) as connections,
  state,
  application_name
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, application_name
ORDER BY connections DESC;
```

---

### Query Performance

```sql
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

### Table Sizes

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

---

### Index Usage

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 🔄 Migration Deployment

### Development

```bash
# Apply migrations
supabase db push

# Or manually
psql $DATABASE_URL -f supabase/migrations/20260105000001_fix_missing_rls.sql
# ... (all migrations)
```

---

### Staging/Production

```bash
# 1. Backup first!
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Apply migrations
for migration in supabase/migrations/202601050000*.sql; do
  echo "Applying $migration..."
  psql $DATABASE_URL -f $migration
done

# 3. Migrate credentials
psql $DATABASE_URL -c "SELECT * FROM migrate_credentials_to_encrypted();"

# 4. Verify
psql $DATABASE_URL -f scripts/test-credential-encryption.sql
```

---

## 📚 Platform-Specific Guides

### Supabase

**Setup**: Automatic ✅  
**Extensions**: Pre-installed ✅  
**Pooling**: Built-in (Supavisor) ✅  
**SSL**: Enabled by default ✅

**Deploy**:
```bash
supabase db push
```

---

### Heroku Postgres

**Setup**:
```bash
# Add pgsodium
heroku pg:extensions:install pgsodium -a your-app

# Add PgBouncer
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-pgbouncer
```

**Deploy**:
```bash
heroku pg:psql -a your-app < supabase/migrations/20260105000001_fix_missing_rls.sql
# ... (all migrations)
```

---

### AWS RDS

**Setup**:
```sql
-- Enable extensions (as rds_superuser)
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Deploy**:
```bash
psql $RDS_DATABASE_URL -f supabase/migrations/20260105000001_fix_missing_rls.sql
# ... (all migrations)
```

---

### Google Cloud SQL

**Setup**:
```bash
# Enable extensions via Cloud Console or:
gcloud sql instances patch INSTANCE_NAME \
  --database-flags=cloudsql.enable_pgsodium=on
```

**Deploy**:
```bash
psql $CLOUD_SQL_URL -f supabase/migrations/20260105000001_fix_missing_rls.sql
# ... (all migrations)
```

---

## ✅ Summary

### Required

- ✅ PostgreSQL 15+
- ✅ pgsodium extension
- ✅ CREATE EXTENSION privilege

### Recommended

- ⚡ Connection pooling
- ⚡ Statement timeout (30s)
- ⚡ SSL/TLS enabled
- ⚡ Query monitoring

### Optional

- 📊 pg_stat_statements
- 📊 Query logging
- 📊 Performance monitoring

### Not Required

- ❌ No manual configuration in migrations
- ❌ No environment variables in SQL
- ❌ No hardcoded values
- ❌ No platform-specific code

**The migrations are fully self-contained and portable!** 🎉

---

**Last Updated**: January 5, 2026  
**Status**: Complete  
**Next**: Deploy to your environment
