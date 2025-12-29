# VOS-SUPER-003: Audit Trail Dashboard - User Guide & Documentation

## Overview

The Audit Trail Dashboard provides comprehensive, immutable visibility into all agent activities with enterprise-grade security and SOC 2 compliance features. This dashboard enables auditors, administrators, and compliance officers to monitor, analyze, and export audit data.

## Features

### 1. Real-time Monitoring
- **Live Event Streaming**: Watch agent activities as they happen
- **Pause/Resume**: Control real-time updates to reduce noise
- **Buffer Management**: Handles high-volume events efficiently
- **Visual Indicators**: Live status and update indicators

### 2. Immutable Audit Logs
- **Cryptographic Integrity**: Each event has a hash chain
- **Tamper Detection**: Visual indicators for integrity failures
- **Hash Verification**: Verify entire chain with one click
- **Previous Hash Tracking**: Complete audit trail of modifications

### 3. Advanced Filtering
- **Date Range**: Custom date/time ranges or presets
- **User/Agent Filtering**: Filter by specific actors
- **Action Types**: agent_action, security_event, system_event, compliance_check
- **Severity Levels**: info, warning, critical, compliance
- **Session Tracking**: Follow specific workflows
- **Full-text Search**: Search across all fields

### 4. Compliance Dashboard
- **SOC 2 Indicators**: Real-time compliance metrics
- **Compliance Score**: Automated scoring (0-100)
- **Gap Analysis**: Identify missing audit events
- **Integrity Status**: Hash chain validation

### 5. Export & Reporting
- **CSV Export**: For spreadsheet analysis
- **JSON Export**: For system integration
- **Compliance Reports**: Pre-formatted for auditors
- **Batch Export**: Handle 10,000+ records

## Getting Started

### Access Requirements

**Required Permissions:**
- `audit:read` - View audit logs
- `audit:export` - Export audit data
- `audit:compliance_view` - View compliance metrics

**Role Requirements:**
- Auditor
- Administrator
- Compliance Officer

### Navigation

1. **Main Dashboard**: `/audit-trail`
2. **Real-time Updates**: Toggle "Live" button
3. **Filters**: Click "Filters" to expand
4. **Event Details**: Click any row to view details
5. **Export**: Click "Export" and select format

## Using the Dashboard

### Basic Workflow

#### 1. Viewing Audit Events
```bash
# Navigate to dashboard
# Events load automatically
# Real-time updates enabled by default
```

#### 2. Applying Filters
```
1. Click "Filters" to expand
2. Set date range (optional)
3. Enter user/agent IDs (optional)
4. Select action type (optional)
5. Select severity (optional)
6. Enter search term (optional)
7. Click "Apply Filters"
```

#### 3. Exporting Data
```
1. Click "Export" button
2. Choose format:
   - CSV (Basic): Core fields only
   - CSV (Full): Includes metadata
   - JSON (Full): Complete data
4. File downloads automatically
```

#### 4. Verifying Integrity
```
1. Click "Verify Integrity"
2. System validates hash chain
3. Results shown in alert:
   - ✓ All valid
   - ✗ Tampered events listed
```

### Advanced Features

#### Real-time Control
- **Enabled**: Green "Live" indicator, automatic updates
- **Paused**: Gray "Paused" indicator, no updates
- **Buffer**: Holds 1000 events max, flushes every 5 seconds

#### Event Details Modal
When clicking an event row, you'll see:
- **Basic Info**: Timestamp, user/agent, action
- **Security Info**: Type, severity, integrity status
- **Integrity Info**: Hash chain data
- **Metadata**: Full JSON metadata

#### Compliance Monitoring
- **Score**: 0-100 based on integrity, critical events, warnings
- **Integrity**: Hash chain validation status
- **Events**: Count by severity
- **Users**: Unique actors

## Security Features

### 1. Access Control
```typescript
// Permission checks on every action
const requiredPermissions = [
  'audit:read',
  'audit:export',
  'audit:compliance_view'
];
```

### 2. Input Validation
- All filter inputs sanitized
- SQL injection prevention
- XSS protection for metadata display
- Export size limits enforced

### 3. Audit Logging
- All dashboard access logged
- Export activities tracked
- Filter usage recorded
- Integrity verification logged

### 4. Data Protection
- Read-only view of immutable logs
- No modification capabilities
- Cryptographic verification
- Tamper detection alerts

## Performance Optimization

### 1. Loading Strategy
- **Initial Load**: 1000 events (configurable)
- **Lazy Loading**: Additional events on scroll
- **Virtualization**: Only visible rows rendered
- **Caching**: Filter results cached for 30 seconds

### 2. Real-time Updates
- **Throttling**: 5-second intervals (configurable)
- **Batching**: Multiple events processed together
- **Buffer Limits**: 1000 events max
- **Pause on Inactivity**: Saves resources

### 3. Export Performance
- **Streaming**: Large exports stream to browser
- **Compression**: Optional gzip for large datasets
- **Progress**: Loading indicators for long operations
- **Timeouts**: 30-second limit for exports

### 4. Memory Management
- **Event Limits**: 2000 events in memory max
- **Cleanup**: Old events purged automatically
- **Garbage Collection**: Manual triggers available
- **Monitoring**: Memory usage indicators

## Accessibility

### WCAG 2.1 AA Compliance

#### Keyboard Navigation
- **Tab**: Navigate between controls
- **Enter/Space**: Activate buttons
- **Arrow Keys**: Navigate tables
- **Escape**: Close modals

#### Screen Reader Support
- **ARIA Labels**: All interactive elements
- **Live Regions**: Real-time updates announced
- **Status Announcements**: Filter applied, export complete
- **Modal Announcements**: Event details opened/closed

#### Visual Accessibility
- **High Contrast**: Full support
- **Color Independence**: Information not conveyed by color alone
- **Focus Indicators**: Clear focus rings
- **Text Scaling**: Supports 200% zoom

#### Motor Accessibility
- **Large Targets**: Minimum 44px touch targets
- **No Time Limits**: All operations user-paced
- **Alternative Input**: Keyboard-only operation supported

## Mobile Responsiveness

### Breakpoints

#### Mobile (< 768px)
- Collapsible filter panel
- Horizontal scroll for table
- Touch-friendly controls
- Stacked statistics cards

#### Tablet (768px - 1024px)
- Side filters
- Responsive table
- Split statistics
- Optimized spacing

#### Desktop (> 1024px)
- Full layout
- All features visible
- Advanced filtering
- Detailed views

### Mobile Features
- **Swipe Gestures**: Swipe left/right on rows
- **Pull to Refresh**: Update event list
- **Touch Optimization**: Larger hit areas
- **Offline Support**: Cached events available

## Troubleshooting

### Common Issues

#### 1. No Events Loading
**Symptoms**: Empty table, loading spinner persists
**Solutions**:
- Check network connection
- Verify audit:read permission
- Check date range filters
- Contact administrator for access

#### 2. Real-time Not Updating
**Symptoms**: "Live" indicator but no new events
**Solutions**:
- Toggle pause/resume
- Check WebSocket connection
- Verify message bus subscription
- Check browser console for errors

#### 3. Export Fails
**Symptoms**: Error message, no download
**Solutions**:
- Verify audit:export permission
- Reduce date range
- Try smaller export size
- Check browser pop-up blocker

#### 4. Integrity Verification Fails
**Symptoms**: Tampered events detected
**Solutions**:
- Contact security team immediately
- Do not modify or delete logs
- Export logs for investigation
- Verify system time synchronization

### Performance Issues

#### Slow Loading
- Reduce date range
- Apply more specific filters
- Clear browser cache
- Try different browser

#### High Memory Usage
- Close other tabs
- Clear browser cache
- Reduce event limit
- Restart browser

#### Slow Exports
- Export smaller date ranges
- Use CSV instead of JSON
- Disable metadata for basic exports
- Try during off-peak hours

## Integration

### API Integration

#### Fetching Audit Events
```typescript
import { auditLogService } from '../services/AuditLogService';

const events = await auditLogService.query({
  limit: 1000,
  orderBy: 'timestamp_desc',
  filters: {
    userId: 'user-123',
    actionType: 'agent_action',
  }
});
```

#### Real-time Subscriptions
```typescript
import { secureMessageBus } from '../lib/agent-fabric/SecureMessageBus';

const subscription = secureMessageBus.subscribe(
  'audit_events',
  (event) => {
    console.log('New audit event:', event);
  }
);
```

#### Integrity Verification
```typescript
import { useAuditTrail } from '../hooks/useAuditTrail';

const { verifyIntegrity } = useAuditTrail();
const result = await verifyIntegrity();
console.log('Valid:', result.hashChainValid);
```

### Export Formats

#### CSV (Basic)
```csv
Timestamp,User ID,User Name,Agent ID,Agent Name,Action,Action Type,Severity,Resource,Session ID,Integrity Status
2024-12-29T10:00:00Z,user-123,John Doe,agent-coord-1,Coordinator,Created hypothesis,agent_action,info,opp-456,sess-abc,verified
```

#### CSV (Full)
```csv
Timestamp,User ID,User Name,Agent ID,Agent Name,Action,Action Type,Severity,Resource,Session ID,Integrity Status,Metadata
2024-12-29T10:00:00Z,user-123,John Doe,agent-coord-1,Coordinator,Created hypothesis,agent_action,info,opp-456,sess-abc,verified,"{""confidence"":0.95,""sessionId"":""sess-abc""}"
```

#### JSON (Full)
```json
[
  {
    "id": "evt-1",
    "timestamp": "2024-12-29T10:00:00Z",
    "userId": "user-123",
    "userName": "John Doe",
    "agentId": "agent-coord-1",
    "agentName": "Coordinator",
    "action": "Created value hypothesis for SaaS opportunity",
    "actionType": "agent_action",
    "severity": "info",
    "resource": "opportunity/opp-456",
    "metadata": {
      "sessionId": "sess-abc",
      "confidence": 0.95
    },
    "integrityHash": "sha256-abc123",
    "previousHash": "sha256-def456",
    "verificationStatus": "verified"
  }
]
```

## Configuration

### Environment Variables

```bash
# Audit Trail Configuration
AUDIT_LOG_LIMIT=1000
AUDIT_REALTIME_INTERVAL=5000
AUDIT_BUFFER_SIZE=1000
AUDIT_EXPORT_TIMEOUT=30000
AUDIT_MAX_EVENTS=2000
```

### Feature Flags

```typescript
interface AuditTrailConfig {
  enableRealTime: boolean;
  enableExport: boolean;
  enableIntegrityCheck: boolean;
  maxEvents: number;
  exportTimeout: number;
  complianceThreshold: number; // 75 = 75% score
}
```

## Compliance Checklist

### SOC 2 Requirements
- ✅ **CC6.1**: Logical access controls - Permission middleware
- ✅ **CC6.2**: Authentication - Agent identity system
- ✅ **CC7.2**: System monitoring - Real-time dashboard
- ✅ **CC7.3**: Audit logging - Immutable logs
- ✅ **CC7.4**: Integrity verification - Hash chain validation
- ✅ **CC7.5**: Retention policies - Configurable retention

### GDPR Requirements
- ✅ **Article 30**: Records of processing - Complete audit trail
- ✅ **Article 32**: Security - Encryption and access controls
- ✅ **Article 35**: DPIA - Audit logging supports assessment

### HIPAA Requirements
- ✅ **164.312(b)**: Audit controls - Comprehensive logging
- ✅ **164.308(a)(1)**: Access control - RBAC integration
- ✅ **164.312(c)**: Integrity - Hash chain verification

## Maintenance

### Regular Tasks

#### Daily
- Monitor compliance score
- Check for integrity failures
- Review critical events
- Verify real-time updates

#### Weekly
- Export compliance reports
- Review filter usage patterns
- Check system performance
- Verify backup integrity

#### Monthly
- Compliance audit review
- Performance optimization
- Access review (who viewed logs)
- Retention policy verification

### System Health Checks

```bash
# Check audit service health
curl https://api.valueos.com/health/audit

# Verify integrity
curl -X POST https://api.valueos.com/audit/verify

# Export health metrics
curl https://api.valueos.com/audit/metrics
```

## Support

### Getting Help

1. **Documentation**: This guide
2. **In-App Help**: Click "?" icon in dashboard
3. **Support**: support@valueos.com
4. **Emergency**: security@valueos.com (for integrity issues)

### Reporting Issues

When reporting issues, include:
- Browser version
- Steps to reproduce
- Expected vs actual behavior
- Console errors
- Network requests (if applicable)

## Version History

### v1.0.0 (Current)
- ✅ Real-time monitoring
- ✅ Immutable audit logs
- ✅ Advanced filtering
- ✅ Compliance dashboard
- ✅ Export functionality
- ✅ Integrity verification
- ✅ WCAG 2.1 AA compliance
- ✅ Mobile responsive
- ✅ Security hardening

---

**Last Updated**: 2024-12-29  
**Version**: 1.0.0  
**Status**: Production Ready