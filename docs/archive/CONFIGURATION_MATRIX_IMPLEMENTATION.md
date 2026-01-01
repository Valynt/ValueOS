# Configuration & Settings Matrix Implementation

## Overview

Complete implementation of the Configuration & Settings Matrix system for ValueOS, providing centralized management of 30+ configuration types across 6 categories with proper access control, caching, and validation.

## Implementation Date

December 30, 2024

## Components Delivered

### 1. Core Configuration Manager

**File**: `lib/configuration/ConfigurationManager.ts`

Core service providing:
- CRUD operations for all configuration types
- Access control enforcement (Tenant Admin vs Vendor Admin)
- Redis caching with automatic invalidation
- Configuration validation
- Scope resolution (tenant vs vendor)
- Audit logging integration

### 2. Database Schema

**File**: `supabase/migrations/20251230013534_organization_configurations.sql`

Database schema including:
- `organization_configurations` table with 30+ JSONB columns
- Row-level security policies for tenant isolation
- Indexes for performance (GIN indexes on JSONB fields)
- Helper functions for configuration access
- Audit view for configuration changes
- Default configurations for existing organizations

### 3. Specialized Managers

#### Organization Settings Manager
**File**: `lib/configuration/managers/OrganizationSettingsManager.ts`

Manages:
- Tenant provisioning and lifecycle
- Custom branding (SDUI themes)
- Data residency and geographic pinning
- Domain management
- Namespace isolation

**Key Methods**:
- `provisionTenant()` - Create new tenant with resource limits
- `updateTenantStatus()` - Change tenant lifecycle status
- `updateResourceLimits()` - Adjust user/storage limits
- `updateLogo()` / `updateTheme()` - Branding customization
- `setPrimaryRegion()` - Data residency configuration
- `addCustomDomain()` / `verifyDomain()` - Domain management

#### IAM Configuration Manager
**File**: `lib/configuration/managers/IAMConfigurationManager.ts`

Manages:
- Authentication policies (MFA, WebAuthn, passwordless)
- SSO configuration (SAML, OIDC)
- Session control and timeout policies
- IP whitelisting

**Key Methods**:
- `enableMFA()` - Enforce multi-factor authentication
- `updatePasswordPolicy()` - Set password requirements
- `configureSAML()` / `configureOIDC()` - SSO setup
- `setSessionTimeout()` - Session management
- `addIPRange()` - IP whitelist management

#### AI Orchestration Manager
**File**: `lib/configuration/managers/AIOrchestrationManager.ts`

Manages:
- LLM spending limits and budget controls
- Model routing and fallback strategies
- Agent toggles and enablement
- Human-in-the-loop (HITL) thresholds
- Ground truth synchronization
- Formula versioning

**Key Methods**:
- `setMonthlyHardCap()` / `setMonthlySoftCap()` - Budget limits
- `setDefaultModel()` - Model selection
- `addRoutingRule()` - Conditional routing
- `enableAgent()` - Agent toggles
- `setAutoApprovalThreshold()` - HITL configuration
- `setActiveVersion()` - Formula version management

#### Operational Settings Manager
**File**: `lib/configuration/managers/OperationalSettingsManager.ts`

Manages:
- Feature flags and toggles
- Rate limiting policies
- Observability configuration
- Cache management
- Webhook configuration

**Key Methods**:
- `enableFeature()` / `enableBetaFeature()` - Feature flags
- `setRequestsPerMinute()` - Rate limiting
- `setTraceSamplingRate()` - Observability
- `setCacheTTL()` - Cache configuration
- `addWebhook()` - Webhook management

#### Security & Governance Manager
**File**: `lib/configuration/managers/SecurityGovernanceManager.ts`

Manages:
- Audit integrity and hash chaining
- Data retention policies
- Manifesto strictness and compliance
- Secret rotation policies
- RLS monitoring

**Key Methods**:
- `enableHashChaining()` - Audit integrity
- `setDataRetention()` - Retention policies
- `setMode()` - Manifesto strictness
- `enableAutoRotation()` - Secret rotation
- `setPerformanceThreshold()` - RLS monitoring

#### Billing & Usage Manager
**File**: `lib/configuration/managers/BillingUsageManager.ts`

Manages:
- Token dashboard and real-time usage
- Value metering and milestone billing
- Subscription plans and tiers
- Invoicing and payment configuration

**Key Methods**:
- `enableRealTime()` - Real-time dashboard
- `addBillableMilestone()` - Value metering
- `setTier()` - Subscription management
- `setBillingEmail()` - Invoicing configuration

### 4. Admin API Endpoints

**File**: `app/api/admin/configurations/route.ts`

REST API providing:
- `GET /api/admin/configurations` - Fetch all configurations
- `PUT /api/admin/configurations` - Update specific configuration
- `DELETE /api/admin/configurations/cache` - Clear cache

Features:
- Access control verification
- Category-based routing
- Error handling
- Audit logging

### 5. Comprehensive Tests

**Files**:
- `lib/configuration/__tests__/ConfigurationManager.test.ts`
- `lib/configuration/__tests__/managers.test.ts`

Test coverage:
- Configuration CRUD operations
- Access control enforcement
- Caching behavior
- Validation logic
- Scope resolution
- Error handling
- Concurrent updates
- All manager methods

## Configuration Categories

### 1. Multi-Tenant & Organization (5 settings)
- Tenant Provisioning
- Custom Branding
- Data Residency
- Domain Management
- Namespace Isolation

### 2. Identity & Access Management (4 settings)
- Authentication Policy
- SSO Configuration
- Session Control
- IP Whitelist

### 3. AI Orchestration & Agent Fabric (6 settings)
- LLM Spending Limits
- Model Routing
- Agent Toggles
- HITL Thresholds
- Ground Truth Sync
- Formula Versioning

### 4. Operational & Performance (5 settings)
- Feature Flags
- Rate Limiting
- Observability
- Cache Management
- Webhooks

### 5. Security, Audit & Governance (5 settings)
- Audit Integrity
- Retention Policies
- Manifesto Strictness
- Secret Rotation
- RLS Monitoring

### 6. Billing & Usage Analytics (4 settings)
- Token Dashboard
- Value Metering
- Subscription Plan
- Invoicing

## Access Control Matrix

| Configuration Type | Tenant Admin | Vendor Admin |
|-------------------|--------------|--------------|
| Tenant Provisioning | ✅ Read/Write | ✅ Read/Write |
| Custom Branding | ✅ Read/Write | ✅ Read/Write |
| Data Residency | ✅ Read/Write | ✅ Read/Write |
| Domain Management | ✅ Read/Write | ✅ Read/Write |
| Namespace Isolation | ❌ Read-only | ✅ Read/Write |
| Auth Policy | ✅ Read/Write | ✅ Read/Write |
| SSO Config | ✅ Read/Write | ✅ Read/Write |
| Session Control | ✅ Read/Write | ✅ Read/Write |
| IP Whitelist | ✅ Read/Write | ✅ Read/Write |
| LLM Spending Limits | ✅ Read/Write | ✅ Read/Write |
| Model Routing | ✅ Read/Write | ✅ Read/Write |
| Agent Toggles | ✅ Read/Write | ✅ Read/Write |
| HITL Thresholds | ✅ Read/Write | ✅ Read/Write |
| Ground Truth Sync | ❌ Read-only | ✅ Read/Write |
| Formula Versioning | ❌ Read-only | ✅ Read/Write |
| Feature Flags | ❌ Read-only | ✅ Read/Write |
| Rate Limiting | ❌ Read-only | ✅ Read/Write |
| Observability | ✅ Read/Write | ✅ Read/Write |
| Cache Management | ❌ Read-only | ✅ Read/Write |
| Webhooks | ✅ Read/Write | ✅ Read/Write |
| Audit Integrity | ❌ Read-only | ✅ Read/Write |
| Retention Policies | ✅ Read/Write | ✅ Read/Write |
| Manifesto Strictness | ✅ Read/Write | ✅ Read/Write |
| Secret Rotation | ❌ Read-only | ✅ Read/Write |
| RLS Monitoring | ❌ Read-only | ✅ Read/Write |
| Token Dashboard | ✅ Read/Write | ✅ Read/Write |
| Value Metering | ✅ Read/Write | ✅ Read/Write |
| Subscription Plan | ✅ Read/Write | ✅ Read/Write |
| Invoicing | ✅ Read/Write | ✅ Read/Write |

## Usage Examples

### Provisioning a New Tenant

```typescript
import { ConfigurationManager } from '@/lib/configuration/ConfigurationManager';
import { OrganizationSettingsManager } from '@/lib/configuration/managers/OrganizationSettingsManager';

const configManager = new ConfigurationManager();
const orgManager = new OrganizationSettingsManager(configManager);

// Provision new tenant
const config = await orgManager.provisionTenant('org-123', {
  maxUsers: 50,
  maxStorageGB: 100,
  enabledFeatures: ['advanced-analytics', 'api-access']
});

// Update to active status
await orgManager.updateTenantStatus('org-123', 'active', 'vendor_admin');
```

### Configuring LLM Spending Limits

```typescript
import { AIOrchestrationManager } from '@/lib/configuration/managers/AIOrchestrationManager';

const aiManager = new AIOrchestrationManager(configManager);

// Set budget caps
await aiManager.setMonthlyHardCap('org-123', 5000, 'tenant_admin');
await aiManager.setMonthlySoftCap('org-123', 4000, 'tenant_admin');

// Configure alerts
await aiManager.setAlertThreshold(
  'org-123',
  80,
  ['admin@example.com'],
  'tenant_admin'
);
```

### Enabling SSO

```typescript
import { IAMConfigurationManager } from '@/lib/configuration/managers/IAMConfigurationManager';

const iamManager = new IAMConfigurationManager(configManager);

// Configure SAML SSO
await iamManager.configureSAML('org-123', {
  entityId: 'valueos-org-123',
  ssoUrl: 'https://sso.example.com/saml',
  certificate: '-----BEGIN CERTIFICATE-----...',
  signRequests: true
}, 'tenant_admin');

// Enable SSO
await iamManager.enableSSO('org-123', true, 'tenant_admin');
```

### Managing Feature Flags

```typescript
import { OperationalSettingsManager } from '@/lib/configuration/managers/OperationalSettingsManager';

const opsManager = new OperationalSettingsManager(configManager);

// Enable feature for organization
await opsManager.enableFeature('org-123', 'newDashboard', true, 'vendor_admin');

// Enable beta feature
await opsManager.enableBetaFeature('org-123', 'aiAssistant', true, 'vendor_admin');

// Set gradual rollout
await opsManager.setFeatureRollout('org-123', 'newDashboard', 50, 'vendor_admin');
```

### Using the Admin API

```bash
# Get all configurations
curl -X GET "https://api.valueos.com/api/admin/configurations?organizationId=org-123" \
  -H "Authorization: Bearer $TOKEN"

# Update configuration
curl -X PUT "https://api.valueos.com/api/admin/configurations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-123",
    "category": "ai",
    "setting": "llm_spending_limits",
    "value": {
      "monthlyHardCap": 5000,
      "monthlySoftCap": 4000,
      "perRequestLimit": 10
    }
  }'

# Clear cache
curl -X DELETE "https://api.valueos.com/api/admin/configurations/cache?organizationId=org-123" \
  -H "Authorization: Bearer $TOKEN"
```

## Performance Considerations

### Caching Strategy

- Redis caching with 5-minute TTL
- Automatic cache invalidation on updates
- Scope-specific cache keys
- Bulk cache clearing support

### Database Optimization

- GIN indexes on frequently queried JSONB fields
- Partial indexes for status and tier filtering
- Efficient RLS policies with proper indexing
- Connection pooling via Supabase

### API Performance

- Bulk fetch operations for related settings
- Parallel configuration retrieval
- Minimal database round-trips
- Efficient JSONB queries

## Security Features

### Access Control

- Role-based permissions (Tenant Admin vs Vendor Admin)
- Row-level security on database
- API endpoint authorization
- Audit logging for all changes

### Data Protection

- Tenant isolation via RLS
- Encrypted sensitive fields
- Secret rotation support
- Compliance with retention policies

### Audit Trail

- All configuration changes logged
- User attribution
- Timestamp tracking
- Change history view

## Testing

### Test Coverage

- Unit tests for ConfigurationManager
- Integration tests for all managers
- Access control validation
- Caching behavior verification
- Error handling scenarios
- Concurrent update handling

### Running Tests

```bash
# Run all configuration tests
npm test lib/configuration

# Run specific test suite
npm test lib/configuration/__tests__/ConfigurationManager.test.ts

# Run with coverage
npm test -- --coverage lib/configuration
```

## Migration Guide

### Applying the Migration

```bash
# Apply migration
supabase db push

# Verify migration
supabase db diff
```

### Backfilling Existing Organizations

The migration automatically creates default configurations for existing organizations. No manual backfill required.

### Rolling Back

```bash
# Create rollback migration
supabase migration new rollback_configurations

# Add DROP statements
# DROP TABLE organization_configurations CASCADE;
```

## Future Enhancements

### Planned Features

1. **Configuration Templates**: Pre-defined configuration sets for common use cases
2. **Configuration Versioning**: Track and rollback configuration changes
3. **Configuration Import/Export**: Bulk configuration management
4. **Configuration Validation Rules**: Custom validation logic per setting
5. **Configuration Webhooks**: Notify external systems of changes
6. **Configuration UI**: Admin dashboard for visual configuration management

### Integration Points

- Integrate with existing audit log system
- Connect to notification system for alerts
- Link to billing system for usage tracking
- Sync with monitoring for observability settings

## Support

For questions or issues:
- Review this documentation
- Check test files for usage examples
- Consult the Configuration & Settings Matrix specification
- Contact the platform team

## Related Documentation

- [Configuration & Settings Matrix Specification](./CONFIGURATION_MATRIX_SPEC.md)
- [LLM Gating Implementation](./LLM_GATING_IMPLEMENTATION.md)
- [Production Readiness Updates](./PRODUCTION_READINESS_UPDATES.md)
- [Multi-tenant Architecture](./MULTI_TENANT_ARCHITECTURE.md)

---

**Implementation Status**: ✅ Complete

**Last Updated**: December 30, 2024

**Implemented By**: Ona AI Assistant
