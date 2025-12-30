# Configuration Management Test Plan

## Overview

Comprehensive test plan for the Configuration & Settings Matrix implementation.

## Test Files

### 1. ConfigurationManager Tests
**File**: `lib/configuration/__tests__/ConfigurationManager.test.ts`

**Test Suites**:
- Configuration CRUD operations
- Access control enforcement
- Caching behavior
- Validation logic
- Scope resolution
- Error handling

**Test Cases** (50+ tests):

#### Configuration CRUD
- ✅ Get default configuration
- ✅ Update configuration
- ✅ Validate configuration before update
- ✅ Handle missing configurations

#### Access Control
- ✅ Allow tenant_admin to update tenant settings
- ✅ Allow vendor_admin to update vendor settings
- ✅ Reject tenant_admin updating vendor-only settings
- ✅ Enforce read-only restrictions

#### Caching
- ✅ Cache configuration after first fetch
- ✅ Invalidate cache after update
- ✅ Clear cache on demand
- ✅ Handle cache misses gracefully

#### Validation
- ✅ Validate required fields
- ✅ Validate field types
- ✅ Validate enum values
- ✅ Reject invalid configurations

#### Scope Resolution
- ✅ Resolve tenant scope
- ✅ Resolve vendor scope
- ✅ Fall back to vendor defaults for tenant

#### Error Handling
- ✅ Handle invalid configuration type
- ✅ Handle database errors gracefully
- ✅ Handle concurrent updates

### 2. Manager Tests
**File**: `lib/configuration/__tests__/managers.test.ts`

**Test Suites**:
- OrganizationSettingsManager
- IAMConfigurationManager
- AIOrchestrationManager
- OperationalSettingsManager
- SecurityGovernanceManager
- BillingUsageManager
- Bulk operations

**Test Cases** (100+ tests):

#### OrganizationSettingsManager
- ✅ Provision new tenant
- ✅ Update tenant status
- ✅ Update resource limits
- ✅ Manage custom branding
- ✅ Set data residency
- ✅ Add/remove custom domains
- ✅ Configure namespace isolation

#### IAMConfigurationManager
- ✅ Enable MFA
- ✅ Update password policy
- ✅ Configure SAML SSO
- ✅ Configure OIDC SSO
- ✅ Set session timeout
- ✅ Manage IP whitelist
- ✅ Set bypass roles

#### AIOrchestrationManager
- ✅ Set LLM spending limits
- ✅ Configure model routing
- ✅ Add routing rules
- ✅ Toggle agents
- ✅ Set HITL thresholds
- ✅ Configure ground truth sync
- ✅ Manage formula versions

#### OperationalSettingsManager
- ✅ Enable feature flags
- ✅ Set rate limits
- ✅ Configure observability
- ✅ Manage cache settings
- ✅ Add/remove webhooks
- ✅ Set retry policies

#### SecurityGovernanceManager
- ✅ Enable hash chaining
- ✅ Set retention policies
- ✅ Configure manifesto strictness
- ✅ Enable secret rotation
- ✅ Configure RLS monitoring

#### BillingUsageManager
- ✅ Enable real-time dashboard
- ✅ Enable value metering
- ✅ Add billable milestones
- ✅ Set subscription tier
- ✅ Configure invoicing

#### Bulk Operations
- ✅ Fetch all organization settings
- ✅ Fetch all IAM settings
- ✅ Clear all caches

## Running Tests

### Full Test Suite

```bash
# Run all configuration tests
npm test lib/configuration

# Run with coverage
npm test -- --coverage lib/configuration

# Run in watch mode
npm test -- --watch lib/configuration
```

### Specific Test Files

```bash
# Run ConfigurationManager tests only
npm test lib/configuration/__tests__/ConfigurationManager.test.ts

# Run manager tests only
npm test lib/configuration/__tests__/managers.test.ts
```

### Individual Test Suites

```bash
# Run specific test suite
npm test -- --grep "Configuration CRUD"

# Run specific test case
npm test -- --grep "should get default configuration"
```

## Test Environment Setup

### Prerequisites

1. **Database Connection**:
   - Supabase instance running
   - Test database configured
   - Migrations applied

2. **Environment Variables**:
   ```bash
   SUPABASE_URL=your-test-supabase-url
   SUPABASE_ANON_KEY=your-test-anon-key
   REDIS_URL=your-test-redis-url
   ```

3. **Test Data**:
   - Test organizations created
   - Test users with different roles
   - Sample configurations

### Setup Script

```bash
#!/bin/bash
# setup-test-env.sh

# Apply migrations
supabase db push

# Create test organization
psql $DATABASE_URL << EOF
INSERT INTO organizations (id, name, slug)
VALUES ('test-org-123', 'Test Organization', 'test-org')
ON CONFLICT (id) DO NOTHING;
EOF

# Create test users
psql $DATABASE_URL << EOF
INSERT INTO users (id, email, role, organization_id)
VALUES 
  ('test-tenant-admin', 'tenant@test.com', 'tenant_admin', 'test-org-123'),
  ('test-vendor-admin', 'vendor@test.com', 'vendor_admin', NULL)
ON CONFLICT (id) DO NOTHING;
EOF

# Run tests
npm test lib/configuration
```

## Integration Tests

### API Endpoint Tests

```typescript
describe('Configuration API', () => {
  it('should fetch all configurations', async () => {
    const response = await fetch(
      '/api/admin/configurations?organizationId=test-org-123',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.configurations).toBeDefined();
  });

  it('should update configuration', async () => {
    const response = await fetch('/api/admin/configurations', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId: 'test-org-123',
        category: 'ai',
        setting: 'llm_spending_limits',
        value: { monthlyHardCap: 5000 }
      })
    });
    
    expect(response.status).toBe(200);
  });

  it('should clear cache', async () => {
    const response = await fetch(
      '/api/admin/configurations/cache?organizationId=test-org-123',
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    expect(response.status).toBe(200);
  });
});
```

### Database Tests

```typescript
describe('Database Integration', () => {
  it('should enforce RLS policies', async () => {
    // Test tenant isolation
    const { data, error } = await supabase
      .from('organization_configurations')
      .select('*')
      .eq('organization_id', 'other-org');
    
    expect(data).toHaveLength(0); // Should not see other org's data
  });

  it('should update timestamps automatically', async () => {
    const before = new Date();
    
    await supabase
      .from('organization_configurations')
      .update({ tenant_provisioning: { status: 'active' } })
      .eq('organization_id', 'test-org-123');
    
    const { data } = await supabase
      .from('organization_configurations')
      .select('updated_at')
      .eq('organization_id', 'test-org-123')
      .single();
    
    expect(new Date(data.updated_at)).toBeGreaterThan(before);
  });
});
```

### Cache Tests

```typescript
describe('Redis Cache', () => {
  it('should cache configurations', async () => {
    const key = 'config:tenant:test-org-123:tenant_provisioning';
    
    // First fetch - cache miss
    await configManager.getConfiguration('tenant_provisioning', scope);
    
    // Check cache populated
    const cached = await redis.get(key);
    expect(cached).toBeDefined();
  });

  it('should invalidate cache on update', async () => {
    const key = 'config:tenant:test-org-123:tenant_provisioning';
    
    // Populate cache
    await configManager.getConfiguration('tenant_provisioning', scope);
    
    // Update configuration
    await configManager.updateConfiguration(
      'tenant_provisioning',
      newConfig,
      scope,
      'tenant_admin'
    );
    
    // Check cache cleared
    const cached = await redis.get(key);
    expect(cached).toBeNull();
  });
});
```

## Performance Tests

### Load Testing

```typescript
describe('Performance', () => {
  it('should handle concurrent reads', async () => {
    const promises = Array(100).fill(null).map(() =>
      configManager.getConfiguration('tenant_provisioning', scope)
    );
    
    const start = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000); // Should complete in < 1s
  });

  it('should handle concurrent updates', async () => {
    const promises = Array(10).fill(null).map((_, i) =>
      configManager.updateConfiguration(
        'tenant_provisioning',
        { maxUsers: 50 + i },
        scope,
        'tenant_admin'
      )
    );
    
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});
```

### Cache Performance

```typescript
describe('Cache Performance', () => {
  it('should improve read performance', async () => {
    // First read (cache miss)
    const start1 = Date.now();
    await configManager.getConfiguration('tenant_provisioning', scope);
    const duration1 = Date.now() - start1;
    
    // Second read (cache hit)
    const start2 = Date.now();
    await configManager.getConfiguration('tenant_provisioning', scope);
    const duration2 = Date.now() - start2;
    
    expect(duration2).toBeLessThan(duration1 * 0.5); // 50% faster
  });
});
```

## Test Coverage Goals

### Target Coverage
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Current Coverage
Run `npm test -- --coverage lib/configuration` to see current coverage.

### Coverage Report

```bash
# Generate HTML coverage report
npm test -- --coverage lib/configuration

# View report
open coverage/index.html
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Configuration Tests

on:
  push:
    paths:
      - 'lib/configuration/**'
      - 'supabase/migrations/*configuration*'
  pull_request:
    paths:
      - 'lib/configuration/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: supabase/postgres
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Apply migrations
        run: supabase db push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      
      - name: Run tests
        run: npm test lib/configuration
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Manual Testing Checklist

### Configuration CRUD
- [ ] Create new configuration
- [ ] Read existing configuration
- [ ] Update configuration
- [ ] Delete configuration (if applicable)

### Access Control
- [ ] Tenant admin can update tenant settings
- [ ] Tenant admin cannot update vendor settings
- [ ] Vendor admin can update all settings
- [ ] Unauthorized users are rejected

### Caching
- [ ] First read populates cache
- [ ] Subsequent reads use cache
- [ ] Updates invalidate cache
- [ ] Manual cache clear works

### Validation
- [ ] Invalid data is rejected
- [ ] Required fields are enforced
- [ ] Type validation works
- [ ] Enum validation works

### API Endpoints
- [ ] GET endpoint returns all configs
- [ ] PUT endpoint updates config
- [ ] DELETE endpoint clears cache
- [ ] Authorization is enforced

## Troubleshooting

### Tests Failing

1. **Database connection issues**:
   - Verify Supabase is running
   - Check environment variables
   - Ensure migrations are applied

2. **Cache issues**:
   - Verify Redis is running
   - Check Redis connection string
   - Clear Redis cache manually

3. **Permission issues**:
   - Verify test users exist
   - Check role assignments
   - Review RLS policies

### Coverage Issues

1. **Low coverage**:
   - Add more test cases
   - Test edge cases
   - Test error paths

2. **Coverage parsing errors**:
   - Update vitest configuration
   - Exclude problematic files
   - Use different coverage provider

## Next Steps

1. ✅ Create test files
2. ⏳ Set up test environment
3. ⏳ Run tests locally
4. ⏳ Fix any failing tests
5. ⏳ Achieve coverage goals
6. ⏳ Set up CI/CD pipeline
7. ⏳ Document test results

## Related Documentation

- [Configuration Matrix Implementation](./CONFIGURATION_MATRIX_IMPLEMENTATION.md)
- [Migration Instructions](./MIGRATION_INSTRUCTIONS.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

**Test Files Created**: 2

**Test Cases**: 150+

**Coverage Goal**: > 90%

**Status**: Ready for execution

**Last Updated**: December 30, 2024
