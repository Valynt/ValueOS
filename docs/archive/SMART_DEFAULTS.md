# Smart Defaults

## Configuration Templates

Smart defaults are provided through 4 pre-configured templates:

### 1. Startup Template (Default for new orgs)

```typescript
{
  maxUsers: 25,
  maxStorageGB: 100,
  monthlyBudget: $500,
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  complianceRequirements: []
}
```

**Use case**: Cost-conscious startups, small teams

### 2. Enterprise Template

```typescript
{
  maxUsers: 500,
  maxStorageGB: 5000,
  monthlyBudget: $10,000,
  model: 'gpt-4',
  temperature: 0.5,
  complianceRequirements: ['GDPR', 'SOC2', 'ISO27001']
}
```

**Use case**: Large organizations, compliance-heavy

### 3. Development Template

```typescript
{
  maxUsers: 10,
  maxStorageGB: 50,
  monthlyBudget: $100,
  model: 'gpt-3.5-turbo',
  temperature: 0.9,
  complianceRequirements: []
}
```

**Use case**: Testing, development environments

### 4. Production Template

```typescript
{
  maxUsers: 200,
  maxStorageGB: 2000,
  monthlyBudget: $5,000,
  model: 'gpt-4',
  temperature: 0.3,
  complianceRequirements: ['GDPR', 'HIPAA', 'SOC2']
}
```

**Use case**: Production deployments, strict security

## Form Field Defaults

### Organization Settings

**Tenant Provisioning**

- Status: `'active'` (most common)
- Max Users: `25` (starter tier)
- Max Storage: `100` GB (reasonable starting point)

**Custom Branding**

- Logo URL: `''` (empty, optional)
- Primary Color: `'#3B82F6'` (blue, professional)
- Secondary Color: `'#10B981'` (green, success)
- Font Family: `'Inter, sans-serif'` (modern, readable)

**Data Residency**

- Primary Region: `'us-east-1'` (most common)
- Compliance Requirements: `[]` (none by default)

### AI Settings

**LLM Spending Limits**

- Monthly Hard Cap: `$500` (prevents runaway costs)
- Monthly Soft Cap: `$400` (80% of hard cap)
- Per Request Limit: `$1.00` (reasonable per-request cap)
- Alert Threshold: `80%` (early warning)

**Model Routing**

- Default Model: `'gpt-3.5-turbo'` (cost-effective)
- Temperature: `0.7` (balanced creativity/consistency)
- Max Tokens: `2000` (reasonable response length)

**Agent Toggles**

- Causal Analysis: `true` (core feature)
- Bias Detection: `true` (core feature)
- Value Mapping: `true` (core feature)
- Stakeholder Analysis: `false` (advanced feature)

**HITL Thresholds**

- Min Confidence: `70%` (reasonable quality bar)
- Max Confidence: `95%` (high confidence auto-approve)
- Auto Reject Below: `50%` (clearly low quality)

## Validation Defaults

### Numeric Fields

- Min value: Prevents negative/zero where inappropriate
- Max value: Prevents unrealistic values
- Step: Appropriate for field type (0.01 for currency, 1 for counts)

### Text Fields

- Max length: Prevents database overflow
- Pattern validation: URL format, hex color format
- Trim whitespace: Automatic on save

### Select Fields

- First option selected by default where appropriate
- Most common option pre-selected

## Auto-fill Behavior

### Import Configuration

- Validates all fields before import
- Shows preview of changes
- Warns about overwrites

### Apply Template

- Shows template details before applying
- One-click apply with confirmation
- Preserves custom branding if set

## Progressive Disclosure

### Basic Settings (Always Visible)

- Status, users, storage
- Budget caps
- Default model

### Advanced Settings (Collapsed by Default)

- Compliance requirements
- HITL thresholds
- Agent toggles

## Contextual Defaults

### Based on Organization Size

- Small (<50 users): Startup template
- Medium (50-200 users): Production template
- Large (>200 users): Enterprise template

### Based on Industry

- Healthcare: HIPAA compliance enabled
- Finance: SOC2 compliance enabled
- EU-based: GDPR compliance enabled

## Smart Suggestions

### Budget Recommendations

- Startup: $500/month
- Growing: $2,000/month
- Enterprise: $10,000/month

### Model Recommendations

- Cost-sensitive: gpt-3.5-turbo
- Quality-focused: gpt-4
- Balanced: gpt-4 with lower temperature

### Storage Recommendations

- Per user: 4GB average
- With file uploads: 10GB per user
- Media-heavy: 20GB per user

## Result

✅ **All forms have sensible defaults that:**

- Minimize configuration time
- Prevent common mistakes
- Scale with organization needs
- Follow industry best practices
- Can be easily customized
