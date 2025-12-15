# Deployment Guide
## Database Migrations, Red-Team Tests, and Scheduled Jobs

**Date**: December 14, 2024  
**Status**: Production Ready  
**Priority**: P0 / Deployment Critical

---

## Overview

This guide covers deploying database migrations to staging, running canary token red-team tests, and setting up the MemoryGarbageCollector scheduled job for production.

---

## 1. Deploy Database Migrations to Staging

### Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Access to staging database
- `STAGING_DATABASE_URL` environment variable set

### New Migrations

The following migrations will be deployed:

1. **20251214000000_add_confidence_calibration.sql**
   - Adds confidence calibration tables
   - Implements Platt scaling for agent confidence scores
   - Creates retraining queue

2. **20260111000000_add_memory_gc_and_provenance.sql**
   - Adds memory garbage collection function
   - Creates provenance tracking tables
   - Implements cleanup procedures

3. **20260111000000_add_tenant_isolation_to_match_memory.sql**
   - Enhances tenant isolation for memory tables
   - Adds organization_id columns

4. **20260112000000_add_org_filter_to_search_semantic_memory.sql**
   - Adds organization filtering to semantic memory search
   - Improves query performance

5. **20260113000000_create_memory_provenance.sql**
   - Creates memory provenance audit tables
   - Tracks memory lifecycle

6. **20260114000000_add_org_to_semantic_memory.sql**
   - Adds organization context to semantic memory
   - Ensures proper tenant isolation

### Deployment Steps

```bash
# 1. Set environment variable
export STAGING_DATABASE_URL="postgresql://..."

# 2. Run deployment script
./scripts/deploy-migrations-staging.sh

# 3. Verify deployment
./scripts/verify-deployment.sh
```

### Manual Deployment (if script fails)

```bash
# Push migrations to staging
supabase db push --db-url "$STAGING_DATABASE_URL"

# Verify tables created
psql "$STAGING_DATABASE_URL" -c "
  SELECT tablename 
  FROM pg_tables 
  WHERE tablename LIKE 'agent_calibration%' 
     OR tablename LIKE '%provenance%';
"

# Verify functions created
psql "$STAGING_DATABASE_URL" -c "
  SELECT proname 
  FROM pg_proc 
  WHERE proname IN ('cleanup_old_memories', 'get_calibrated_confidence');
"
```

### Rollback Procedure

If deployment fails:

```bash
# List applied migrations
supabase migration list --db-url "$STAGING_DATABASE_URL"

# Rollback to previous version
supabase db reset --db-url "$STAGING_DATABASE_URL"

# Or manually drop tables
psql "$STAGING_DATABASE_URL" -c "
  DROP TABLE IF EXISTS agent_calibration_models CASCADE;
  DROP TABLE IF EXISTS agent_retraining_queue CASCADE;
  DROP TABLE IF EXISTS agent_calibration_history CASCADE;
"
```

---

## 2. Run Canary Token Red-Team Tests

### Purpose

Canary token tests verify that secret detection and redaction is working properly by attempting to leak fake secrets through various attack vectors.

### Test Scenarios

1. **Direct Logging** - Attempt to log API keys directly
2. **Error Messages** - Secrets in error messages
3. **Database Queries** - Secrets in database inserts
4. **Agent Output** - Secrets in agent responses
5. **SDUI Schemas** - Secrets in UI schemas
6. **Connection Strings** - Database credentials
7. **JWT Tokens** - Authentication tokens
8. **AWS Credentials** - Cloud provider keys

### Running Tests

```bash
# Run red-team tests
npx tsx scripts/red-team-canary-tokens.ts

# Expected output:
# ✅ SUCCESS: All canary tokens were properly redacted
```

### Test Results

All tests should pass with:
- ✅ Passed: Yes
- ✅ Leaked: No
- ✅ Redacted: Yes

If any test shows "Leaked: Yes", **DO NOT DEPLOY TO PRODUCTION**.

### Interpreting Results

```
┌─────────────────────────────────┬────────┬─────────┬───────────┐
│ Test Name                       │ Passed │ Leaked  │ Redacted  │
├─────────────────────────────────┼────────┼─────────┼───────────┤
│ Direct Logging                  │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ Error Message Leakage           │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ Database Query Leakage          │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ Agent Output Leakage            │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ SDUI Schema Leakage             │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ Connection String Leakage       │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ JWT Token Leakage               │ ✅ Yes │ ✅ No  │ ✅ Yes    │
│ AWS Credentials Leakage         │ ✅ Yes │ ✅ No  │ ✅ Yes    │
└─────────────────────────────────┴────────┴─────────┴───────────┘
```

---

## 3. Memory Garbage Collector Scheduled Job

### Purpose

The MemoryGarbageCollector runs every 6 hours to clean up old agent memories and maintain database health.

### GitHub Actions Workflow

**File**: `.github/workflows/memory-gc-scheduled.yml`

**Schedule**: Every 6 hours (`0 */6 * * *`)

**Configuration**:
```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  REDIS_URL: ${{ secrets.REDIS_URL }}
  RETENTION_DAYS: 30
  DRY_RUN: false
```

### Manual Execution

```bash
# Run locally (dry run)
DRY_RUN=true RETENTION_DAYS=30 npx tsx scripts/run-memory-gc.ts

# Run locally (actual cleanup)
RETENTION_DAYS=30 npx tsx scripts/run-memory-gc.ts

# Run via GitHub Actions
gh workflow run memory-gc-scheduled.yml \
  -f retention_days=30 \
  -f dry_run=false
```

### Monitoring

**Metrics to Track**:
- Memories deleted per run
- Bytes freed
- Execution duration
- Failure rate

**Logs**:
```bash
# View workflow logs
gh run list --workflow=memory-gc-scheduled.yml

# View specific run
gh run view <run-id> --log
```

**Alerts**:
- Memory GC failures
- Execution time > 5 minutes
- Deletion rate anomalies

### Configuration

**Environment Variables**:
- `RETENTION_DAYS` - How long to keep memories (default: 30)
- `GC_BATCH_SIZE` - Batch size for deletion (default: 1000)
- `DRY_RUN` - Test mode without actual deletion (default: false)

**Secrets Required**:
- `DATABASE_URL` - Production database connection
- `REDIS_URL` - Redis connection (optional)
- `SLACK_WEBHOOK` - Notification webhook (optional)

---

## 4. Verification Checklist

### Pre-Deployment

- [ ] All migrations tested locally
- [ ] Red-team tests passing
- [ ] Memory GC tested in dry-run mode
- [ ] Rollback procedure documented
- [ ] Team notified of deployment

### Post-Deployment (Staging)

- [ ] Migrations applied successfully
- [ ] Tables created and indexed
- [ ] Functions working correctly
- [ ] Red-team tests passing
- [ ] Memory GC scheduled job configured
- [ ] Monitoring alerts configured

### Monitoring (24 hours)

- [ ] No migration errors in logs
- [ ] Confidence calibration working
- [ ] Memory GC running successfully
- [ ] No secret leakage detected
- [ ] Performance metrics normal

### Production Deployment

- [ ] Staging stable for 24+ hours
- [ ] All tests passing
- [ ] Rollback plan ready
- [ ] Team on standby
- [ ] Deploy during low-traffic window

---

## 5. Troubleshooting

### Migration Failures

**Issue**: Migration fails with "relation already exists"

**Solution**:
```bash
# Check existing tables
psql "$DATABASE_URL" -c "\dt"

# Drop conflicting tables
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS <table_name> CASCADE;"

# Retry migration
supabase db push --db-url "$DATABASE_URL"
```

### Red-Team Test Failures

**Issue**: Canary tokens leaked

**Solution**:
1. Check logger configuration
2. Verify secret redaction patterns
3. Update redaction rules in `src/lib/logger.ts`
4. Re-run tests

### Memory GC Failures

**Issue**: Memory GC job fails

**Solution**:
```bash
# Check logs
gh run view <run-id> --log

# Test locally
DRY_RUN=true npx tsx scripts/run-memory-gc.ts

# Check database function
psql "$DATABASE_URL" -c "SELECT cleanup_old_memories(30, true);"
```

---

## 6. Rollback Procedures

### Database Rollback

```bash
# Option 1: Reset to previous migration
supabase db reset --db-url "$DATABASE_URL"

# Option 2: Manual rollback
psql "$DATABASE_URL" -f scripts/rollback-migrations.sql
```

### Disable Memory GC

```bash
# Disable workflow
gh workflow disable memory-gc-scheduled.yml

# Or set to dry-run mode
gh workflow run memory-gc-scheduled.yml -f dry_run=true
```

---

## 7. Production Deployment Timeline

### Day 1: Staging Deployment
- 09:00 - Deploy migrations to staging
- 10:00 - Run red-team tests
- 11:00 - Configure memory GC job
- 12:00 - Begin 24-hour monitoring

### Day 2: Verification
- 09:00 - Review staging metrics
- 10:00 - Verify memory GC ran successfully
- 11:00 - Re-run red-team tests
- 12:00 - Go/No-Go decision

### Day 2: Production Deployment (if approved)
- 14:00 - Deploy migrations to production
- 15:00 - Run red-team tests on production
- 16:00 - Enable memory GC scheduled job
- 17:00 - Monitor for 4 hours
- 21:00 - End of deployment window

---

## 8. Success Criteria

### Migrations
- ✅ All tables created successfully
- ✅ All functions working correctly
- ✅ No performance degradation
- ✅ Indexes created properly

### Red-Team Tests
- ✅ 100% pass rate (8/8 tests)
- ✅ Zero canary tokens leaked
- ✅ All secrets properly redacted

### Memory GC
- ✅ Job runs every 6 hours
- ✅ Deletes old memories successfully
- ✅ Execution time < 5 minutes
- ✅ No errors in logs

---

## 9. Contact Information

**On-Call Engineer**: [Your Team]  
**Slack Channel**: #deployments  
**Incident Response**: [Runbook Link]

---

## 10. References

- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [GitHub Actions Scheduled Workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Confidence Calibration Documentation](./RELEASE-CANDIDATE-AUDIT.md)
- [SDUI Production Readiness](./SDUI-PRODUCTION-READINESS.md)

---

**Last Updated**: December 14, 2024  
**Version**: 1.0  
**Status**: Production Ready
