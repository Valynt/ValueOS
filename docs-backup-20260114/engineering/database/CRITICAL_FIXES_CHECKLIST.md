# Critical Database Fixes Checklist

**Date**: January 5, 2026  
**Status**: 🔴 IN PROGRESS  
**Target Completion**: January 19, 2026

---

## Critical Issues (Must Complete Before Release)

### 1. ✅ Enable RLS on 13 Unprotected Tables
**Status**: ✅ MIGRATION CREATED  
**File**: `supabase/migrations/20260105000001_fix_missing_rls.sql`  
**Effort**: 1-2 days

**Tables Fixed**:
- [x] llm_calls
- [x] webhook_events
- [x] login_attempts
- [x] integration_usage_log
- [x] memory_provenance
- [x] value_prediction_accuracy
- [x] approval_requests_archive
- [x] approvals_archive
- [x] retention_policies
- [x] secret_audit_logs_2024
- [x] secret_audit_logs_2025
- [x] secret_audit_logs_2026
- [x] secret_audit_logs_default

**Next Steps**:
- [ ] Test migration in development
- [ ] Verify RLS policies work correctly
- [ ] Test cross-tenant isolation
- [ ] Deploy to staging
- [ ] Deploy to production

---

### 2. ✅ Add Audit Trail Immutability
**Status**: ✅ MIGRATION CREATED  
**File**: `supabase/migrations/20260105000002_fix_audit_immutability.sql`  
**Effort**: 1 day

**Tables Fixed**:
- [x] audit_logs
- [x] security_audit_events
- [x] secret_audit_logs
- [x] secret_audit_logs_legacy
- [x] audit_logs_archive
- [x] audit_log_access
- [x] agent_audit_log
- [x] login_attempts

**Additional Features**:
- [x] archive_old_audit_logs() function
- [x] verify_audit_trail_integrity() function
- [x] audit_trail_health view

**Next Steps**:
- [ ] Test immutability policies
- [ ] Verify service role can still insert
- [ ] Test archival function
- [ ] Deploy to staging
- [ ] Deploy to production

---

### 3. ✅ Add Performance Indexes
**Status**: ✅ MIGRATION CREATED  
**File**: `supabase/migrations/20260105000003_add_performance_indexes.sql`  
**Effort**: 1 day

**Indexes Added**:
- [x] user_organizations(user_id, organization_id) composite
- [x] user_tenants(user_id, tenant_id) composite
- [x] integration_connections(organization_id, adapter_type)
- [x] sync_history(connection_id, started_at)
- [x] audit_logs(organization_id, created_at)
- [x] security_audit_events(tenant_id, timestamp)
- [x] llm_gating_policies(tenant_id)
- [x] llm_usage(tenant_id, created_at)
- [x] JSONB GIN indexes on config columns
- [x] BRIN indexes on time-series columns

**Next Steps**:
- [ ] Test query performance improvements
- [ ] Monitor index usage
- [ ] Deploy to staging
- [ ] Deploy to production

---

### 4. ⏳ Encrypt Integration Credentials
**Status**: ⏳ TODO  
**Effort**: 2-3 days

**Tasks**:
- [ ] Install pgsodium extension
- [ ] Create encryption key in Supabase Vault
- [ ] Create migration to add encrypted columns
- [ ] Migrate existing credentials
- [ ] Update application code to encrypt/decrypt
- [ ] Test encryption/decryption
- [ ] Remove plaintext columns
- [ ] Deploy to staging
- [ ] Deploy to production

**Affected Tables**:
- integration_connections.credentials
- tenant_integrations.access_token
- tenant_integrations.refresh_token

**Migration Template**:
```sql
-- Install extension
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Add encrypted column
ALTER TABLE integration_connections 
ADD COLUMN credentials_encrypted BYTEA;

-- Migrate data (requires application-level encryption)
-- This must be done in application code, not SQL

-- Drop plaintext column (after migration complete)
-- ALTER TABLE integration_connections DROP COLUMN credentials;
```

---

### 5. ✅ Migrate JWT-Based RLS Policies
**Status**: ✅ MIGRATION CREATED  
**File**: `supabase/migrations/20260105000006_fix_jwt_rls_policies.sql`  
**Effort**: 2-3 days

**Tasks**:
- [x] Create helper functions for tenant lookups
- [x] Migrate llm_gating_policies policies
- [x] Migrate llm_usage policies
- [x] Migrate agent_accuracy_metrics policies
- [x] Migrate agent_retraining_queue policies
- [x] Migrate backup_logs policies
- [x] Migrate cost_alerts policies
- [x] Migrate rate_limit_violations policies
- [x] Test all migrated policies
- [ ] Deploy to staging
- [ ] Deploy to production

**Helper Function Template**:
```sql
CREATE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
  SELECT ARRAY_AGG(tenant_id) 
  FROM user_tenants
  WHERE user_id = p_user_id 
  AND status = 'active';
$$;
```

---

### 6. ⏳ Fix Hardcoded Credentials in Seeds
**Status**: ⏳ TODO  
**Effort**: 1 day

**Files to Fix**:
- [ ] scripts/seed_database.ts
- [ ] scripts/seeds/create_dummy_user.sql
- [ ] prisma/seed.ts

**Tasks**:
- [ ] Add environment checks
- [ ] Use bcrypt for password hashing
- [ ] Generate random API keys
- [ ] Use environment variables for credentials
- [ ] Add transaction handling
- [ ] Make seeds idempotent
- [ ] Test seed scripts
- [ ] Update documentation

---

## High Priority Issues (Fix Before Launch)

### 7. ✅ Fix Archive Tables RLS
**Status**: ✅ MIGRATION CREATED  
**File**: `supabase/migrations/20260105000007_fix_archive_tables_rls.sql`  
**Effort**: 1 day

**Tasks**:
- [x] Add SELECT policies to audit_logs_archive
- [x] Verify approval_requests_archive (already fixed)
- [x] Verify approvals_archive (already fixed)
- [x] Add indexes to archive tables
- [x] Create verification views
- [ ] Deploy to staging
- [ ] Deploy to production

---

### 8. ⏳ Add WITH CHECK Clauses to UPDATE Policies
**Status**: ⏳ TODO  
**Effort**: 1 day

**Tasks**:
- [ ] Audit all UPDATE policies
- [ ] Add WITH CHECK clauses
- [ ] Test policies
- [ ] Deploy to staging
- [ ] Deploy to production

---

### 9. ⏳ Add Missing Foreign Key Actions
**Status**: ⏳ TODO  
**Effort**: 1 day

**Tasks**:
- [ ] Identify 19 FKs without ON DELETE actions
- [ ] Determine appropriate actions (CASCADE, SET NULL, RESTRICT)
- [ ] Create migration
- [ ] Test FK behavior
- [ ] Deploy to staging
- [ ] Deploy to production

---

## Testing Checklist

### RLS Testing
- [ ] Test tenant isolation (users cannot access other tenants' data)
- [ ] Test service role bypass
- [ ] Test admin role access
- [ ] Test cross-tenant access attempts (should fail)
- [ ] Performance test RLS policies with large datasets

### Audit Trail Testing
- [ ] Test audit log immutability (UPDATE should fail)
- [ ] Test audit log immutability (DELETE should fail)
- [ ] Test service role can still INSERT
- [ ] Test archival function
- [ ] Test integrity verification function

### Performance Testing
- [ ] Benchmark queries before/after indexes
- [ ] Test RLS policy performance
- [ ] Monitor index usage
- [ ] Check for unused indexes
- [ ] Test with production-like data volumes

### Security Testing
- [ ] Test credential encryption/decryption
- [ ] Test JWT manipulation attempts
- [ ] Test SQL injection attempts
- [ ] Test privilege escalation attempts
- [ ] Run security audit tools

---

## Deployment Plan

### Week 1: Critical Fixes
**Days 1-2**: Credential encryption
- Implement pgsodium encryption
- Migrate existing credentials
- Update application code

**Days 3-4**: JWT policy migration
- Create helper functions
- Migrate all JWT-based policies
- Test thoroughly

**Day 5**: Seed script fixes
- Fix hardcoded credentials
- Add environment checks
- Test seed scripts

### Week 2: High Priority Fixes
**Day 6**: WITH CHECK clauses
- Add to all UPDATE policies
- Test policies

**Day 7**: Foreign key actions
- Add ON DELETE actions
- Test FK behavior

**Days 8-9**: Testing
- Run all test suites
- Performance testing
- Security testing

**Day 10**: Staging deployment
- Deploy all migrations to staging
- Validate fixes
- Monitor for issues

### Week 3: Production Deployment
**Days 11-12**: Final testing
- Full regression testing
- Load testing
- Security audit

**Day 13**: Production deployment
- Deploy migrations to production
- Monitor closely
- Be ready to rollback

**Days 14-15**: Post-deployment
- Monitor performance
- Monitor security
- Address any issues

---

## Rollback Plan

### If Issues Occur
1. **Immediate**: Stop deployment
2. **Assess**: Determine severity
3. **Rollback**: Revert migrations if critical
4. **Fix**: Address issues in development
5. **Redeploy**: After thorough testing

### Rollback Commands
```bash
# Rollback last migration
supabase db reset --db-url $DATABASE_URL

# Rollback specific migration
supabase migration down <timestamp>
```

---

## Success Criteria

### Critical Issues
- [x] All 13 tables have RLS enabled
- [x] All audit tables are immutable
- [x] Performance indexes added
- [ ] Integration credentials encrypted
- [ ] JWT-based policies migrated
- [ ] Seed scripts fixed

### Testing
- [ ] All RLS tests pass
- [ ] All audit tests pass
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] No regressions detected

### Compliance
- [ ] SOC2 requirements met
- [ ] ISO 27001 requirements met
- [ ] GDPR requirements met
- [ ] Audit trail complete
- [ ] Data encryption verified

---

## Sign-Off

### Development Team
- [ ] Database migrations reviewed
- [ ] Application code updated
- [ ] Tests written and passing
- [ ] Documentation updated

### Security Team
- [ ] Security audit completed
- [ ] Vulnerabilities addressed
- [ ] Compliance verified
- [ ] Penetration testing passed

### Operations Team
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] Alerts configured

### Management
- [ ] Risk assessment reviewed
- [ ] Timeline approved
- [ ] Resources allocated
- [ ] Go/no-go decision

---

**Last Updated**: January 5, 2026  
**Next Review**: January 12, 2026  
**Owner**: Database Team
