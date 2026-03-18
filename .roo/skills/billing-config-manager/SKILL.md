---
name: billing-config-manager
description: Automate billing meter configuration and validation. Use to set up billing meters, price versions, entitlements, and usage policies for the ValueOS billing system.
license: MIT
compatibility: ValueOS Billing V2 system
metadata:
  author: ValueOS
  version: "1.0"
  generatedBy: "1.2.0"
---

# Billing Config Manager Skill

Automates billing meter configuration and validation for the ValueOS billing system, handling billing meters, price versions, entitlements, and usage policies.

## When to Use

- Setting up new billing meters
- Configuring price versions and plans
- Managing entitlements and usage policies
- Testing billing configurations
- Troubleshooting billing issues
- Implementing billing V2 features
- Setting up enterprise pricing

## Input

- **action**: Action to perform (create-meter, update-price, configure-entitlements, validate-config)
- **meterType**: Type of billing meter (llm_tokens, agent_invocations, storage_gb, api_calls)
- **priceConfig**: Price configuration with tiers and limits
- **entitlementConfig**: Entitlement rules and allowances
- **tenantId**: Target tenant for configuration (optional)
- **validateOnly**: Validate without applying changes (--validate flag)

## Output

Comprehensive billing configuration report including:

- Meter configuration status
- Price version validation
- Entitlement computation results
- Usage policy verification
- Configuration recommendations
- Cost impact analysis

## Implementation Steps

1. **Validate Input Parameters**
   - Check meter type against supported types
   - Validate price configuration format
   - Verify entitlement rules logic
   - Check tenant permissions

2. **Create Billing Meter**
   - Generate meter ID and metadata
   - Configure measurement units
   - Set up aggregation rules
   - Define billing periods

3. **Configure Price Versions**
   - Create price version records
   - Set up tiered pricing
   - Configure volume discounts
   - Define currency and tax rules

4. **Set Up Entitlements**
   - Compute entitlement snapshots
   - Configure usage allowances
   - Set up overage handling
   - Define approval workflows

5. **Configure Usage Policies**
   - Create usage policy rules
   - Set up enforcement mechanisms
   - Configure notification thresholds
   - Define escalation procedures

## Billing Meter Types

### LLM Token Consumption

```typescript
{
  meterType: "llm_tokens",
  unit: "tokens",
  aggregation: "sum",
  billingPeriod: "monthly",
  tiers: [
    { limit: 1000000, price: 0.001 },
    { limit: 10000000, price: 0.0008 },
    { limit: Infinity, price: 0.0005 }
  ]
}
```

### Agent Invocations

```typescript
{
  meterType: "agent_invocations",
  unit: "invocations",
  aggregation: "count",
  billingPeriod: "monthly",
  tiers: [
    { limit: 1000, price: 0.1 },
    { limit: 10000, price: 0.08 },
    { limit: Infinity, price: 0.05 }
  ]
}
```

### Storage Usage

```typescript
{
  meterType: "storage_gb",
  unit: "gigabytes",
  aggregation: "max",
  billingPeriod: "monthly",
  price: 0.5 // per GB per month
}
```

### API Calls

```typescript
{
  meterType: "api_calls",
  unit: "requests",
  aggregation: "count",
  billingPeriod: "monthly",
  tiers: [
    { limit: 100000, price: 0.001 },
    { limit: 1000000, price: 0.0008 },
    { limit: Infinity, price: 0.0005 }
  ]
}
```

## Example Usage

```bash
# Create a new LLM token billing meter
/billing-config-manager --action=create-meter --meterType=llm_tokens --priceConfig='{"tiers":[{"limit":1000000,"price":0.001},{"limit":10000000,"price":0.0008}]}'

# Update price version for existing meter
/billing-config-manager --action=update-price --meterId="meter_llm_tokens" --priceConfig='{"tiers":[{"limit":2000000,"price":0.0009}]}'

# Configure entitlements for enterprise tenant
/billing-config-manager --action=configure-entitlements --tenantId="enterprise_123" --entitlementConfig='{"llm_tokens":5000000,"agent_invocations":5000}'

# Validate billing configuration
/billing-config-manager --action=validate-config --validateOnly

# Set up complete billing for new tenant
/billing-config-manager --action=setup-tenant --tenantId="new_tenant" --plan="professional"
```

## Entitlement Configuration

### Tier-Based Entitlements

```typescript
{
  plan: "starter",
  entitlements: {
    llm_tokens: { monthly: 1000000, overage: "block" },
    agent_invocations: { monthly: 1000, overage: "warn" },
    storage_gb: { monthly: 10, overage: "charge" }
  }
}
```

### Custom Enterprise Entitlements

```typescript
{
  plan: "enterprise",
  customConfig: true,
  entitlements: {
    llm_tokens: { monthly: 50000000, overage: "approve" },
    agent_invocations: { monthly: 50000, overage: "approve" },
    storage_gb: { monthly: 1000, overage: "charge" },
    api_calls: { monthly: 10000000, overage: "charge" }
  },
  approvalWorkflow: {
    threshold: 0.8,
    approvers: ["finance@company.com"]
  }
}
```

## Price Version Management

### Creating New Price Versions

- Version numbering (semantic versioning)
- Effective date configuration
- Grace period for transitions
- Rollback capabilities

### Price Version Pinning

- Pin tenants to specific versions
- Handle version migrations
- Maintain price history
- Support grandfathering

## Usage Policy Configuration

### Hard Enforcement

```typescript
{
  policyType: "hard_enforcement",
  rules: [
    { metric: "llm_tokens", threshold: 1.0, action: "block" },
    { metric: "agent_invocations", threshold: 1.0, action: "block" }
  ]
}
```

### Soft Enforcement

```typescript
{
  policyType: "soft_enforcement",
  rules: [
    { metric: "llm_tokens", threshold: 0.9, action: "warn" },
    { metric: "llm_tokens", threshold: 1.0, action: "notify" }
  ],
  notifications: {
    channels: ["email", "slack"],
    recipients: ["admin@company.com"]
  }
}
```

## Validation and Testing

### Configuration Validation

- Schema validation for all inputs
- Price logic verification
- Entitlement computation testing
- Policy rule validation

### Cost Impact Analysis

- Projected monthly costs
- Usage pattern analysis
- Break-even calculations
- ROI estimates

### Integration Testing

- End-to-end billing flows
- Stripe integration testing
- Webhook processing validation
- Invoice generation testing

## Enterprise Features

### Custom Pricing

- Negotiated rates per tenant
- Volume-based discounts
- Commitment-based pricing
- Custom billing cycles

### Multi-Currency Support

- Currency conversion
- Tax calculation
- Regional pricing
- Compliance reporting

### Approval Workflows

- Usage increase requests
- Temporary cap adjustments
- Emergency overrides
- Audit trail maintenance

## Monitoring and Analytics

### Usage Tracking

- Real-time usage metrics
- Trend analysis
- Anomaly detection
- Forecasting

### Billing Analytics

- Revenue tracking
- Churn analysis
- Upgrade/downgrade patterns
- Customer lifetime value

### Cost Optimization

- Usage optimization suggestions
- Plan recommendation engine
- Cost alerting
- Budget management

## Error Handling

### Configuration Errors

- Invalid price configurations
- Missing required fields
- Circular dependency detection
- Schema validation failures

### Service Failures

- Database connectivity issues
- Stripe API failures
- Webhook processing errors
- Notification delivery failures

### Business Logic Errors

- Invalid entitlement calculations
- Pricing rule conflicts
- Policy enforcement failures
- Approval workflow issues

## Security Considerations

### Data Protection

- Sensitive data encryption
- Access control
- Audit logging
- Compliance validation

### Financial Security

- Secure payment processing
- Fraud detection
- Rate limiting
- Input validation

## Performance Optimization

### Caching Strategy

- Price configuration caching
- Entitlement computation caching
- Usage aggregation caching
- Tenant settings caching

### Database Optimization

- Index optimization
- Query performance tuning
- Batch operations
- Connection pooling

## Integration Points

- **Stripe API**: Payment processing and invoicing
- **Supabase**: Data persistence and RLS
- **Redis**: Caching and session management
- **Message Bus**: Event-driven billing updates
- **Agent Fabric**: Usage tracking and enforcement
