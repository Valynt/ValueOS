# Customer Portal Analytics & Monitoring

## Overview

The Customer Portal Analytics system tracks user interactions, page views, exports, and errors in the customer-facing realization portal. This enables data-driven insights into customer engagement and portal performance.

## Architecture

### Components

1. **Analytics Tracking Service** (`src/lib/analytics/customerPortalTracking.ts`)
   - Session management
   - Event tracking
   - Data collection and transmission

2. **React Hooks** (`src/hooks/usePortalAnalytics.ts`)
   - Easy integration with React components
   - Automatic page view tracking
   - Event tracking helpers

3. **Error Monitoring** (`src/lib/monitoring/errorMonitoring.ts`)
   - Global error capture
   - Error categorization
   - Integration with monitoring platforms

4. **Grafana Dashboard** (`infra/grafana/dashboards/customer-portal.json`)
   - Real-time metrics visualization
   - Performance monitoring
   - Error tracking

## Event Types

### Core Events

| Event Type | Description | Properties |
|------------|-------------|------------|
| `portal_page_view` | Page view with duration | `page`, `duration`, `valueCaseId`, `companyName` |
| `portal_session_start` | Session initialization | `sessionId`, `userAgent` |
| `portal_session_end` | Session termination | `sessionId`, `duration`, `pageViews`, `eventCount` |
| `portal_export_pdf` | PDF export action | `valueCaseId`, `companyName`, `status` |
| `portal_export_excel` | Excel export action | `valueCaseId`, `companyName`, `status` |
| `portal_share_email` | Email share action | `valueCaseId`, `recipientCount` |
| `portal_benchmark_view` | Benchmark KPI view | `kpiName`, `valueCaseId` |
| `portal_metric_view` | Metric view | `metricName`, `valueCaseId` |
| `portal_error` | Error occurrence | `errorMessage`, `errorCode`, `valueCaseId` |
| `portal_token_validation` | Token validation | `token`, `valueCaseId`, `success` |
| `portal_token_expired` | Token expiration | `token` |
| `portal_token_invalid` | Invalid token | `token`, `errorMessage` |

## Usage

### Basic Page Tracking

```typescript
import { usePageTracking } from '../../hooks/usePortalAnalytics';

function MyComponent() {
  // Automatically tracks page view and time on page
  usePageTracking('my-page', {
    valueCaseId: 'vc-123',
    companyName: 'Acme Corp',
  });

  return <div>My Component</div>;
}
```

### Export Tracking

```typescript
import { useExportTracking } from '../../hooks/usePortalAnalytics';

function ExportButton() {
  const trackExport = useExportTracking();

  const handleExport = async () => {
    trackExport('pdf', {
      valueCaseId: 'vc-123',
      companyName: 'Acme Corp',
      status: 'started',
    });

    try {
      await exportPDF();
      trackExport('pdf', { status: 'success' });
    } catch (error) {
      trackExport('pdf', { 
        status: 'error',
        errorMessage: error.message 
      });
    }
  };

  return <button onClick={handleExport}>Export PDF</button>;
}
```

### Error Tracking

```typescript
import { useErrorTracking } from '../../hooks/usePortalAnalytics';

function DataComponent() {
  const trackError = useErrorTracking();

  const loadData = async () => {
    try {
      const data = await fetchData();
      return data;
    } catch (error) {
      trackError(error.message, 'API_ERROR', {
        valueCaseId: 'vc-123',
        endpoint: '/api/data',
      });
      throw error;
    }
  };

  return <div>...</div>;
}
```

### Token Validation Tracking

```typescript
import { useTokenTracking } from '../../hooks/usePortalAnalytics';

function AuthComponent() {
  const { trackValidation, trackExpired } = useTokenTracking();

  const validateToken = async (token: string) => {
    const result = await customerAccessService.validateCustomerToken(token);

    if (result.is_valid) {
      trackValidation(true, { 
        token, 
        valueCaseId: result.value_case_id 
      });
    } else if (result.error_message?.includes('expired')) {
      trackExpired({ token });
    } else {
      trackValidation(false, { 
        token, 
        errorMessage: result.error_message 
      });
    }

    return result;
  };

  return <div>...</div>;
}
```

## Session Management

### Session Lifecycle

1. **Session Start**: Automatically created when analytics service initializes
2. **Activity Tracking**: Updates on every event
3. **Session Timeout**: 30 minutes of inactivity
4. **Session End**: Triggered on page unload or timeout

### Session Data

```typescript
interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
  pageViews: number;
  events: Array<{
    type: PortalEventType;
    timestamp: number;
    properties: PortalEventProperties;
  }>;
}
```

## Error Monitoring

### Error Categories

- **AUTHENTICATION**: Token and auth errors
- **API**: API request failures
- **VALIDATION**: Data validation errors
- **NETWORK**: Network connectivity issues
- **RENDERING**: React rendering errors
- **DATA**: Data parsing/processing errors
- **EXPORT**: Export generation errors
- **UNKNOWN**: Uncategorized errors

### Error Severity Levels

- **LOW**: Minor issues, no user impact
- **MEDIUM**: Degraded functionality
- **HIGH**: Feature unavailable
- **CRITICAL**: System failure

### Global Error Handling

```typescript
import { captureError, ErrorSeverity, ErrorCategory } from '../lib/monitoring/errorMonitoring';

try {
  // Your code
} catch (error) {
  captureError(error, {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.API,
    context: {
      valueCaseId: 'vc-123',
      endpoint: '/api/data',
    },
  });
}
```

## Grafana Dashboard

### Metrics Displayed

1. **Overview**
   - Total page views (24h)
   - Active sessions
   - Export counts (PDF, Excel)
   - Email shares

2. **Trends**
   - Page views over time
   - Session duration
   - Time on page by page type

3. **Engagement**
   - Export format distribution
   - Top viewed KPIs
   - Session activity heatmap

4. **Quality**
   - Error summary
   - Token validation success rate
   - Expired/invalid token counts

### Accessing the Dashboard

1. Navigate to Grafana: `http://grafana.yourdomain.com`
2. Go to Dashboards → Customer Portal Analytics
3. Select time range (default: last 24 hours)
4. Use filters to drill down by company, value case, etc.

### Dashboard Refresh

- Auto-refresh: 30 seconds
- Manual refresh: Click refresh button
- Time range: Adjustable from 1 hour to 30 days

## API Endpoints

### Analytics Events

**POST** `/api/analytics/portal/event`

```json
{
  "type": "portal_page_view",
  "timestamp": 1704556800000,
  "properties": {
    "page": "realization-portal",
    "valueCaseId": "vc-123",
    "companyName": "Acme Corp",
    "sessionId": "session_123",
    "userAgent": "Mozilla/5.0...",
    "timestamp": "2026-01-06T10:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "evt_123"
}
```

### Session Data

**POST** `/api/analytics/portal/session`

```json
{
  "sessionId": "session_123",
  "startTime": 1704556800000,
  "lastActivityTime": 1704560400000,
  "pageViews": 5,
  "events": [...]
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_123"
}
```

### Error Reports

**POST** `/api/monitoring/errors`

```json
{
  "message": "Failed to load data",
  "stack": "Error: Failed to load data\n    at ...",
  "severity": "high",
  "category": "api",
  "context": {
    "valueCaseId": "vc-123",
    "url": "https://portal.example.com/...",
    "timestamp": "2026-01-06T10:00:00Z"
  },
  "fingerprint": "Failed to load data:Error: Failed to load data"
}
```

**Response:**
```json
{
  "success": true,
  "errorId": "err_123"
}
```

## Configuration

### Environment Variables

```bash
# Analytics
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_DEBUG=false

# Error Monitoring
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_ENVIRONMENT=production

# Session
VITE_SESSION_TIMEOUT=1800000  # 30 minutes in ms
```

### Analytics Configuration

```typescript
// src/config/analytics.ts
export const analyticsConfig = {
  enabled: import.meta.env.VITE_ANALYTICS_ENABLED === 'true',
  debug: import.meta.env.VITE_ANALYTICS_DEBUG === 'true',
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  heartbeatInterval: 60 * 1000, // 1 minute
  maxQueueSize: 100,
};
```

## Best Practices

### 1. Track User Intent

Track what users are trying to accomplish, not just clicks:

```typescript
// ❌ Bad
trackClick('button-1');

// ✅ Good
trackExport('pdf', { 
  valueCaseId: 'vc-123',
  intent: 'share-with-stakeholders' 
});
```

### 2. Include Context

Always include relevant context with events:

```typescript
trackPageView('realization-portal', {
  valueCaseId: 'vc-123',
  companyName: 'Acme Corp',
  lifecycleStage: 'active',
  metricsCount: 15,
});
```

### 3. Handle Errors Gracefully

Never let analytics failures break the user experience:

```typescript
try {
  trackEvent(...);
} catch (error) {
  // Log but don't throw
  console.warn('Analytics tracking failed', error);
}
```

### 4. Respect Privacy

- Don't track PII without consent
- Anonymize sensitive data
- Provide opt-out mechanisms
- Follow GDPR/CCPA requirements

### 5. Monitor Performance

Analytics shouldn't slow down the app:

```typescript
// Use async tracking
trackEvent(...); // Fire and forget

// Batch events when possible
const events = [...];
batchTrackEvents(events);
```

## Troubleshooting

### Events Not Appearing

1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check analytics is enabled: `getPortalAnalytics().isEnabled()`
4. Verify network requests in DevTools

### Session Not Persisting

1. Check session timeout configuration
2. Verify heartbeat is running
3. Check for page visibility changes
4. Review session storage

### Dashboard Not Updating

1. Verify Prometheus is scraping metrics
2. Check Grafana data source configuration
3. Verify time range selection
4. Check for query errors in Grafana

### High Error Rates

1. Review error logs in Grafana
2. Check error categories and patterns
3. Verify API endpoint health
4. Review recent deployments

## Performance Considerations

### Event Batching

Events are sent individually by default. For high-traffic scenarios, implement batching:

```typescript
const eventBatch = [];
const BATCH_SIZE = 10;
const BATCH_INTERVAL = 5000; // 5 seconds

function trackEventBatched(event) {
  eventBatch.push(event);
  
  if (eventBatch.length >= BATCH_SIZE) {
    flushBatch();
  }
}

setInterval(flushBatch, BATCH_INTERVAL);
```

### Data Retention

- **Real-time data**: 7 days
- **Aggregated data**: 90 days
- **Long-term storage**: 1 year (sampled)

### Query Optimization

Use appropriate time ranges and aggregations:

```promql
# ❌ Expensive
sum(portal_page_views_total)

# ✅ Efficient
sum(rate(portal_page_views_total[5m]))
```

## Security

### Data Protection

- All analytics data is encrypted in transit (HTTPS)
- Sensitive fields are hashed before storage
- Access logs are maintained
- Regular security audits

### Access Control

- Analytics data requires authentication
- Role-based access to Grafana dashboards
- API endpoints protected by rate limiting
- Audit trail for data access

## Support

For issues or questions:

- **Documentation**: `/docs/analytics/`
- **Slack**: `#customer-portal-analytics`
- **Email**: `analytics-support@valueos.com`
- **On-call**: PagerDuty escalation for critical issues
