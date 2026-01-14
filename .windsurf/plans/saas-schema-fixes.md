# SaaS Schema Architecture Fixes

This plan addresses critical schema inconsistencies and data integrity issues in the multi-tenant billing architecture by standardizing tenant models, fixing type mismatches, resolving configuration conflicts, and adding transaction support for subscription operations.

## Critical Issues to Address

### 1. Schema Duplication Resolution (HIGH PRIORITY)

**Problem**: Prisma `Organization` model has `tier` enum and `limits` JSON, but Supabase `tenants` table lacks these fields.

**Analysis Required**:

- Determine which schema is authoritative
- Identify all references to tenant tier/limits across codebase
- Plan migration strategy for data consistency

**Approach Options**:

1. **Option A**: Add `tier` and `limits` fields to Supabase tenants table
2. **Option B**: Remove tier/limits from Prisma and use separate billing tables
3. **Option C**: Create migration to sync data between both schemas

### 2. ID Type Standardization (MEDIUM PRIORITY)

**Problem**: `billing_customers.tenant_id` is UUID but `tenants.id` is TEXT.

**Impact**: Prevents foreign key constraints and causes join performance issues.

**Approach**:

- Audit all tenant_id references across database
- Choose standard type (UUID recommended for scalability)
- Create migration plan with minimal downtime

### 3. Free Tier Logic Fix (MEDIUM PRIORITY)

**Problem**: Soft caps with zero overage rates create de facto hard caps.

**Current Configuration Issues**:

```typescript
// Free tier has soft caps but no overage pricing
hardCaps: { llm_tokens: false, agent_executions: false }
overageRates: { llm_tokens: 0, agent_executions: 0 }
```

**Fix Options**:

1. Set hardCaps to true for consistency
2. Add overage rates > 0 for paid tiers only
3. Implement warning system before blocking

### 4. Subscription Update Transaction Safety (MEDIUM PRIORITY)

**Problem**: Multiple Stripe API calls without atomic transaction.

**Risk**: Partial updates leave subscriptions in inconsistent state.

**Solution Required**:

- Implement transaction wrapper for subscription updates
- Add rollback mechanism for failed updates
- Enhance error handling with retry logic

## Implementation Strategy

### Phase 1: Schema Analysis (Day 1)

1. **Audit Current Usage**
   - Search codebase for `Organization.tier` references
   - Find all `tenant_id` usage patterns
   - Map data flow between Prisma and Supabase

2. **Data Consistency Check**
   - Query existing tenant data
   - Identify any existing tier/limits data
   - Assess migration complexity

### Phase 2: Schema Alignment (Day 2-3)

1. **Choose Schema Approach**
   - Decision between Option A/B/C for schema duplication
   - Document rationale for chosen approach

2. **Create Migration Scripts**
   - Schema changes with minimal downtime
   - Data migration with rollback capability
   - Test migrations on staging environment

### Phase 3: Type Standardization (Day 4)

1. **ID Type Migration**
   - Update all tenant_id references to UUID
   - Add proper foreign key constraints
   - Update application code for UUID handling

2. **Index Optimization**
   - Add performance indexes for tenant queries
   - Optimize RLS policies for new types

### Phase 4: Configuration & Transaction Fixes (Day 5)

1. **Billing Configuration**
   - Fix free tier hard cap logic
   - Validate overage rate consistency
   - Add configuration validation tests

2. **Transaction Safety**
   - Implement subscription update transactions
   - Add comprehensive error handling
   - Create retry mechanisms for Stripe failures

### Phase 5: Testing & Validation (Day 6)

1. **Integration Testing**
   - End-to-end subscription flow tests
   - Multi-tenant isolation validation
   - Billing calculation accuracy tests

2. **Performance Testing**
   - Query performance with new schema
   - Concurrent subscription updates
   - RLS policy performance impact

## Risk Mitigation

### High-Risk Changes

- **Schema Migration**: Requires careful planning and rollback strategy
- **ID Type Changes**: Affects all foreign key relationships
- **Production Data**: Must preserve existing tenant data

### Mitigation Strategies

- **Staging Environment**: Test all migrations before production
- **Blue-Green Deployment**: Minimize downtime during schema changes
- **Data Backups**: Full database backup before any schema changes
- **Rollback Plans**: Documented rollback procedures for each change

## Success Criteria

### Functional Requirements

- [ ] Single source of truth for tenant tier/limits data
- [ ] Consistent ID types across all tables
- [ ] Logical hard cap/overage rate configuration
- [ ] Atomic subscription update operations

### Non-Functional Requirements

- [ ] Zero data loss during migrations
- [ ] No performance regression in tenant queries
- [ ] Maintained RLS security guarantees
- [ ] Comprehensive test coverage for changes

## Dependencies

### Required Approvals

- Database schema changes require DBA approval
- Production migration requires change management process
- Billing logic changes require finance team review

### Technical Dependencies

- Staging environment availability for testing
- Database backup and restore procedures
- Monitoring and alerting for migration events

## Timeline Estimate

- **Phase 1**: 1 day (analysis)
- **Phase 2**: 2 days (schema alignment)
- **Phase 3**: 1 day (type standardization)
- **Phase 4**: 1 day (configuration fixes)
- **Phase 5**: 1 day (testing)

**Total Estimated Duration**: 6 business days

## Next Steps

1. **Immediate**: Begin Phase 1 analysis to understand current schema usage
2. **Decision Point**: Choose schema alignment approach after analysis
3. **Staging Setup**: Ensure staging environment mirrors production for testing
4. **Backup Strategy**: Verify database backup procedures before any changes
