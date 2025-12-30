# Configuration Monitoring & Alerting Guide

## Overview

Monitoring system for tracking configuration changes and triggering alerts based on predefined rules.

## Components

### ConfigurationMonitor Service
**File**: `lib/monitoring/configuration-monitor.ts`

**Features**:
- Automatic change tracking
- Rule-based alerting
- Multi-channel notifications (email, Slack)
- Metrics collection
- Change history
- Alert statistics

## Alert Rules

### Default Rules

#### 1. LLM Budget Increase
**Severity**: Warning  
**Condition**: Monthly hard cap increased by >50%  
**Recipients**: finance@valueos.com  
**Purpose**: Monitor unexpected budget increases

#### 2. Security Policy Change
**Severity**: Critical  
**Condition**: Any security or auth policy change  
**Recipients**: security@valueos.com  
**Purpose**: Track security-related configuration changes

#### 3. Tenant Status Change
**Severity**: Info  
**Condition**: Tenant status changes (trial → active, etc.)  
**Recipients**: ops@valueos.com  
**Purpose**: Track tenant lifecycle

#### 4. Resource Limit Increase
**Severity**: Warning  
**Condition**: User or storage limits doubled  
**Recipients**: ops@valueos.com  
**Purpose**: Monitor resource allocation

#### 5. RLS Monitoring Disabled
**Severity**: Critical  
**Condition**: RLS monitoring turned off  
**Recipients**: security@valueos.com, ops@valueos.com  
**Purpose**: Prevent security monitoring gaps

#### 6. Audit Integrity Disabled
**Severity**: Critical  
**Condition**: Hash chaining disabled  
**Recipients**: security@valueos.com, compliance@valueos.com  
**Purpose**: Maintain audit trail integrity

#### 7. Retention Policy Reduced
**Severity**: Warning  
**Condition**: Data or audit retention period decreased  
**Recipients**: compliance@valueos.com  
**Purpose**: Ensure compliance requirements met

#### 8. AI Agent Disabled
**Severity**: Info  
**Condition**: Any AI agent disabled  
**Recipients**: ai-team@valueos.com  
**Purpose**: Track agent availability

## Integration

### 1. Add to Configuration Update Flow

```typescript
// app/api/admin/configurations/route.ts
import { configurationMonitor } from '@/lib/monitoring/configuration-monitor';

export async function PUT(request: NextRequest) {
  // ... existing code ...
  
  // Get old value
  const oldValue = await configManager.getConfiguration(setting, scope);
  
  // Update configuration
  const newValue = await configManager.updateConfiguration(
    setting,
    value,
    scope,
    accessLevel
  );
  
  // Record change
  await configurationMonitor.recordChange({
    organizationId,
    userId: user.id,
    category,
    setting,
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
    userRole: accessLevel
  });
  
  return NextResponse.json({ success: true, data: newValue });
}
```

### 2. Environment Variables

```bash
# .env.local

# Slack webhook for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Email service configuration
EMAIL_SERVICE_API_KEY=your-api-key
EMAIL_FROM=alerts@valueos.com

# Metrics service
METRICS_ENDPOINT=https://metrics.valueos.com
```

### 3. Database Tables

```sql
-- Alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  triggered_by UUID NOT NULL REFERENCES users(id),
  event_data JSONB NOT NULL,
  recipients TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_alerts_org ON alerts(organization_id);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
```

## Usage Examples

### Record Configuration Change

```typescript
import { configurationMonitor } from '@/lib/monitoring/configuration-monitor';

await configurationMonitor.recordChange({
  organizationId: 'org-123',
  userId: 'user-456',
  category: 'ai',
  setting: 'llm_spending_limits',
  oldValue: { monthlyHardCap: 1000 },
  newValue: { monthlyHardCap: 5000 },
  timestamp: new Date().toISOString(),
  userRole: 'tenant_admin'
});
```

### Get Change History

```typescript
const history = await configurationMonitor.getChangeHistory('org-123', {
  category: 'security',
  startDate: '2024-01-01',
  limit: 50
});

console.log(`Found ${history.length} security configuration changes`);
```

### Get Alert Statistics

```typescript
const stats = await configurationMonitor.getAlertStats('org-123', {
  start: '2024-01-01',
  end: '2024-12-31'
});

console.log(`Total alerts: ${stats.total}`);
console.log(`Critical alerts: ${stats.bySeverity.critical}`);
```

### Add Custom Alert Rule

```typescript
configurationMonitor.addAlertRule({
  id: 'custom-rule-1',
  name: 'High User Limit',
  condition: (event) =>
    event.setting === 'tenant_provisioning' &&
    event.newValue.maxUsers > 1000,
  severity: 'warning',
  recipients: ['ops@valueos.com'],
  enabled: true
});
```

### Disable Alert Rule

```typescript
configurationMonitor.toggleAlertRule('llm-budget-increase', false);
```

## Notification Channels

### Email Notifications

**Format**: Plain text with structured information

**Example**:
```
Configuration Change Alert: LLM Budget Increase

Severity: WARNING
Organization: org-123
User: user-456 (tenant_admin)
Category: ai
Setting: llm_spending_limits
Timestamp: 2024-12-30T10:00:00Z

Old Value:
{
  "monthlyHardCap": 1000
}

New Value:
{
  "monthlyHardCap": 5000
}

This alert was triggered because: LLM Budget Increase
```

### Slack Notifications

**Format**: Rich attachment with color-coded severity

**Example**:
```json
{
  "attachments": [{
    "color": "#ff9900",
    "title": "🔔 LLM Budget Increase",
    "text": "Configuration change detected...",
    "fields": [
      { "title": "Organization", "value": "org-123", "short": true },
      { "title": "User", "value": "user-456 (tenant_admin)", "short": true },
      { "title": "Category", "value": "ai", "short": true },
      { "title": "Setting", "value": "llm_spending_limits", "short": true }
    ],
    "footer": "ValueOS Configuration Monitor",
    "ts": 1704024000
  }]
}
```

## Metrics

### Tracked Metrics

- `configuration.changes.total` - Total configuration changes
- `configuration.changes.{category}` - Changes by category
- `configuration.changes.{category}.{setting}` - Changes by specific setting
- `configuration.changes.by_role.{role}` - Changes by user role

### Integration with Monitoring Systems

#### Prometheus

```typescript
// lib/metrics/prometheus.ts
import { Counter } from 'prom-client';

const configChanges = new Counter({
  name: 'configuration_changes_total',
  help: 'Total configuration changes',
  labelNames: ['category', 'setting', 'organization', 'role']
});

// In ConfigurationMonitor
configChanges.inc({
  category: event.category,
  setting: event.setting,
  organization: event.organizationId,
  role: event.userRole
});
```

#### DataDog

```typescript
// lib/metrics/datadog.ts
import { StatsD } from 'hot-shots';

const dogstatsd = new StatsD();

// In ConfigurationMonitor
dogstatsd.increment('configuration.changes', 1, [
  `category:${event.category}`,
  `setting:${event.setting}`,
  `organization:${event.organizationId}`,
  `role:${event.userRole}`
]);
```

## Dashboards

### Configuration Changes Dashboard

**Metrics**:
- Total changes (last 24h, 7d, 30d)
- Changes by category
- Changes by organization
- Changes by user role
- Alert frequency
- Alert severity distribution

**Visualizations**:
- Time series: Changes over time
- Pie chart: Changes by category
- Bar chart: Top 10 organizations by changes
- Table: Recent changes

### Alert Dashboard

**Metrics**:
- Total alerts (last 24h, 7d, 30d)
- Alerts by severity
- Alerts by rule
- Alert response time
- Failed notifications

**Visualizations**:
- Time series: Alerts over time
- Pie chart: Alerts by severity
- Bar chart: Top triggered rules
- Table: Recent alerts

## Runbook

### High Alert Volume

**Symptoms**: Excessive alerts being triggered

**Investigation**:
1. Check alert statistics
2. Identify most triggered rules
3. Review recent configuration changes
4. Check for automated changes

**Resolution**:
- Adjust alert thresholds
- Disable noisy rules temporarily
- Investigate root cause of changes
- Update alert rules if needed

### Failed Notifications

**Symptoms**: Alerts not being delivered

**Investigation**:
1. Check alert status in database
2. Review error messages
3. Verify email/Slack configuration
4. Test notification channels

**Resolution**:
- Fix email service configuration
- Update Slack webhook URL
- Retry failed notifications
- Monitor notification success rate

### Missing Alerts

**Symptoms**: Expected alerts not triggered

**Investigation**:
1. Verify alert rule is enabled
2. Check rule condition logic
3. Review configuration change events
4. Test rule condition manually

**Resolution**:
- Enable disabled rules
- Fix rule condition logic
- Verify event recording
- Add missing alert rules

## Testing

### Unit Tests

```typescript
describe('ConfigurationMonitor', () => {
  it('should trigger alert for LLM budget increase', async () => {
    const event = {
      organizationId: 'org-123',
      userId: 'user-456',
      category: 'ai',
      setting: 'llm_spending_limits',
      oldValue: { monthlyHardCap: 1000 },
      newValue: { monthlyHardCap: 2000 },
      timestamp: new Date().toISOString(),
      userRole: 'tenant_admin'
    };

    await configurationMonitor.recordChange(event);

    // Verify alert was created
    const alerts = await getAlerts('org-123');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('LLM Budget Increase');
  });
});
```

### Integration Tests

```typescript
describe('Alert Notifications', () => {
  it('should send email notification', async () => {
    const mockEmailService = jest.fn();
    
    await configurationMonitor.recordChange(criticalEvent);
    
    expect(mockEmailService).toHaveBeenCalledWith({
      to: 'security@valueos.com',
      subject: expect.stringContaining('Security Policy Change'),
      body: expect.any(String)
    });
  });
});
```

## Best Practices

### Alert Rule Design
- Keep conditions simple and specific
- Avoid overlapping rules
- Use appropriate severity levels
- Target relevant recipients
- Test rules before enabling

### Notification Management
- Avoid alert fatigue
- Group related alerts
- Use severity appropriately
- Provide actionable information
- Include context in messages

### Monitoring
- Review alert statistics regularly
- Adjust thresholds based on patterns
- Archive old alerts
- Monitor notification delivery
- Track alert response times

## Related Documentation

- [Configuration Matrix Implementation](./CONFIGURATION_MATRIX_IMPLEMENTATION.md)
- [Audit Logging Guide](./audit/logging.md)
- [Metrics & Monitoring](./monitoring/README.md)
- [Incident Response](./ops/incident-response.md)

---

**Status**: Implemented

**Alert Rules**: 8 default rules

**Notification Channels**: Email, Slack

**Last Updated**: December 30, 2024
