# SaaS Schema Architecture Fixes - Deployment Guide

## Overview

This guide covers the deployment of critical fixes for the SaaS billing architecture, addressing schema duplication, ID type inconsistencies, billing logic issues, and transaction safety problems.

## Critical Issues Fixed

### 1. Schema Duplication (HIGH PRIORITY)

- **Issue**: Prisma `Organization` model had `tier` field, Supabase `tenants` table did not
- **Fix**: Added `tier` and `limits` fields to `tenants` table for consistency
- **Migration**: `20260114000001_fix_schema_alignment.sql`

### 2. ID Type Standardization (MEDIUM PRIORITY)

- **Issue**: Mixed UUID/TEXT types for tenant IDs across tables
- **Fix**: Standardized on UUID type with migration path
- **Migration**: `20260114000002_standardize_tenant_id_types.sql`

### 3. Free Tier Logic Fix (MEDIUM PRIORITY)

- **Issue**: Soft caps with zero overage rates created de facto hard caps
- **Fix**: Set all free tier hard caps to `true` for consistency
- **File**: `src/config/billing.ts`

### 4. Transaction Safety (MEDIUM PRIORITY)

- **Issue**: Subscription updates lacked atomic transactions
- **Fix**: Added transactional service with rollback capability
- **Files**: `src/services/billing/SubscriptionService.transaction.ts`

## Pre-Deployment Checklist

### Database Preparation

- [ ] Create full database backup
- [ ] Verify staging environment mirrors production
- [ ] Test migrations on staging environment
- [ ] Validate rollback procedures

### Application Preparation

- [ ] Update environment variables for new schema
- [ ] Test billing configuration changes
- [ ] Validate transaction service functionality
- [ ] Run comprehensive test suite

### Monitoring Setup

- [ ] Enable database migration monitoring
- [ ] Set up alerts for billing operation failures
- [ ] Configure rollback failure notifications
- [ ] Test monitoring dashboards

## Deployment Steps

### Phase 1: Schema Alignment (Day 1)

#### 1.1 Database Migration

```bash
# Run schema alignment migration
psql $DATABASE_URL -f supabase/migrations/20260114000001_fix_schema_alignment.sql
```

#### 1.2 Validation

```sql
-- Verify tier field exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'tier';

-- Verify limits field exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'limits';

-- Verify data integrity
SELECT COUNT(*) as tenants_without_tier FROM tenants WHERE tier IS NULL;
SELECT COUNT(*) as tenants_without_limits FROM tenants WHERE limits IS NULL;
```

#### 1.3 Application Update

- Deploy updated billing configuration
- Restart application services
- Verify tenant creation works with new schema

### Phase 2: ID Type Standardization (Day 2)

#### 2.1 Database Migration

```bash
# Run ID type standardization migration
psql $DATABASE_URL -f supabase/migrations/20260114000002_standardize_tenant_id_types.sql
```

#### 2.2 Data Validation

```sql
-- Verify UUID column creation
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'id_uuid';

-- Verify foreign key updates
SELECT conname, contype
FROM pg_constraint
WHERE conname LIKE '%tenant_id%';
```

#### 2.3 Application Updates

- Update services to use UUID tenant IDs
- Test all tenant-related operations
- Validate foreign key constraints work

### Phase 3: Billing Logic Fixes (Day 3)

#### 3.1 Configuration Update

- Deploy updated `billing.ts` configuration
- Verify free tier hard cap logic
- Test overage calculation accuracy

#### 3.2 Validation

```typescript
// Test free tier behavior
const freePlan = PLANS.free;
Object.values(freePlan.hardCaps).forEach((isHardCap) => {
  console.assert(isHardCap === true, "Free tier should have hard caps");
});
```

### Phase 4: Transaction Safety (Day 4)

#### 4.1 Service Deployment

- Deploy `SubscriptionService.transaction.ts`
- Update main `SubscriptionService.ts` to use transactional approach
- Test subscription update operations

#### 4.2 Testing

```typescript
// Test transaction rollback
const subscriptionService = new SubscriptionService();
await subscriptionService.updateSubscription("tenant_123", "standard");
// Verify atomic behavior and rollback capability
```

## Rollback Procedures

### Database Rollback

```bash
# Rollback schema alignment
psql $DATABASE_URL -c "
ALTER TABLE tenants DROP COLUMN IF EXISTS tier;
ALTER TABLE tenants DROP COLUMN IF EXISTS limits;
"

# Rollback ID type changes (complex - requires careful data handling)
psql $DATABASE_URL -c "
-- This requires custom rollback script based on your data
-- See rollback section in migration files
"
```

### Application Rollback

```bash
# Revert to previous application version
git checkout <previous-commit-tag>
docker-compose down
docker-compose up -d
```

## Monitoring and Validation

### Key Metrics to Monitor

- Database connection latency
- Subscription update success rate
- Billing calculation accuracy
- Tenant creation success rate
- Error rates for billing operations

### Alerts Configuration

```yaml
# Example alert configuration
alerts:
  - name: "Subscription Update Failures"
    condition: "subscription_update_error_rate > 5%"
    action: "rollback_to_legacy_service"

  - name: "Tenant ID Type Mismatches"
    condition: "tenant_id_type_errors > 0"
    action: "investigate_schema_issues"
```

### Validation Scripts

```bash
#!/bin/bash
# Post-deployment validation script

echo "Validating schema fixes..."

# Check tenant tier field
TIER_FIELD_EXISTS=$(psql $DATABASE_URL -tAc "
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'tenants' AND column_name = 'tier'
)")

if [ "$TIER_FIELD_EXISTS" = "t" ]; then
  echo "✓ Tier field exists in tenants table"
else
  echo "✗ Tier field missing in tenants table"
  exit 1
fi

# Check subscription transaction service
TRANSACTION_SERVICE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health/billing)
if [ "$TRANSACTION_SERVICE_HEALTH" = "200" ]; then
  echo "✓ Transaction service healthy"
else
  echo "✗ Transaction service unhealthy"
  exit 1
fi

echo "All validations passed!"
```

## Post-Deployment Tasks

### Documentation Updates

- [ ] Update API documentation for new schema
- [ ] Update database schema documentation
- [ ] Update deployment runbooks
- [ ] Update monitoring dashboards

### Team Communication

- [ ] Notify development team of schema changes
- [ ] Update onboarding documentation
- [ ] Schedule knowledge sharing session
- [ ] Update troubleshooting guides

### Performance Monitoring

- [ ] Monitor database query performance
- [ ] Track subscription update latency
- [ ] Monitor error rates for 7 days
- [ ] Document any performance regressions

## Troubleshooting Guide

### Common Issues

#### Schema Migration Failures

**Symptoms**: Migration SQL errors, constraint violations
**Causes**: Data inconsistencies, missing dependencies
**Solutions**:

- Check migration prerequisites
- Validate data consistency before migration
- Use staged migration approach

#### Transaction Service Issues

**Symptoms**: Subscription update failures, inconsistent state
**Causes**: Stripe API failures, database connection issues
**Solutions**:

- Check Stripe API credentials and connectivity
- Verify database connection pool settings
- Enable detailed logging for transaction service

#### ID Type Mismatches

**Symptoms**: Foreign key constraint errors, type conversion failures
**Causes**: Incomplete migration, mixed ID types in code
**Solutions**:

- Verify all tenant ID references updated
- Check application code for type consistency
- Run data validation scripts

### Emergency Procedures

#### Immediate Rollback

1. Stop application services
2. Restore database from backup
3. Deploy previous application version
4. Verify system functionality
5. Investigate root cause

#### Partial Rollback

1. Disable affected features
2. Revert specific configuration changes
3. Monitor system stability
4. Plan full rollback if needed

## Success Criteria

### Functional Requirements

- [ ] All tenant operations work with new schema
- [ ] Subscription updates are atomic and consistent
- [ ] Free tier billing logic is consistent
- [ ] No data loss during migrations

### Performance Requirements

- [ ] Database query latency < 100ms
- [ ] Subscription update latency < 5s
- [ ] Error rate < 1% for billing operations
- [ ] No performance regression vs baseline

### Security Requirements

- [ ] RLS policies remain effective
- [ ] Tenant isolation is maintained
- [ ] No unauthorized data access
- [ ] Audit trail remains intact

## Contact Information

### Deployment Team

- **Database Administrator**: [DBA Contact]
- **Application Lead**: [App Lead Contact]
- **DevOps Engineer**: [DevOps Contact]
- **Product Owner**: [Product Contact]

### Escalation

- **Level 1**: Development team
- **Level 2**: Engineering management
- **Level 3**: CTO/VP Engineering

---

**Note**: This deployment involves critical database schema changes. Ensure all prerequisites are met and rollback procedures are tested before proceeding.
