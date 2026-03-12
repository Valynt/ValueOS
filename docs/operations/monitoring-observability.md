---
title: Monitoring Observability
owner: team-operations
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Monitoring Observability

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Customer Portal Analytics & Monitoring

*Source: `operations/analytics/CUSTOMER_PORTAL_ANALYTICS.md`*

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

| Event Type                | Description             | Properties                                         |
| ------------------------- | ----------------------- | -------------------------------------------------- |
| `portal_page_view`        | Page view with duration | `page`, `duration`, `valueCaseId`, `companyName`   |
| `portal_session_start`    | Session initialization  | `sessionId`, `userAgent`                           |
| `portal_session_end`      | Session termination     | `sessionId`, `duration`, `pageViews`, `eventCount` |
| `portal_export_pdf`       | PDF export action       | `valueCaseId`, `companyName`, `status`             |
| `portal_export_excel`     | Excel export action     | `valueCaseId`, `companyName`, `status`             |
| `portal_share_email`      | Email share action      | `valueCaseId`, `recipientCount`                    |
| `portal_benchmark_view`   | Benchmark KPI view      | `kpiName`, `valueCaseId`                           |
| `portal_metric_view`      | Metric view             | `metricName`, `valueCaseId`                        |
| `portal_error`            | Error occurrence        | `errorMessage`, `errorCode`, `valueCaseId`         |
| `portal_token_validation` | Token validation        | `token`, `valueCaseId`, `success`                  |
| `portal_token_expired`    | Token expiration        | `token`                                            |
| `portal_token_invalid`    | Invalid token           | `token`, `errorMessage`                            |

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
import {
  captureError,
  ErrorSeverity,
  ErrorCategory,
} from "../lib/monitoring/errorMonitoring";

try {
  // Your code
} catch (error) {
  captureError(error, {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.API,
    context: {
      valueCaseId: "vc-123",
      endpoint: "/api/data",
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
  enabled: import.meta.env.VITE_ANALYTICS_ENABLED === "true",
  debug: import.meta.env.VITE_ANALYTICS_DEBUG === "true",
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
trackClick("button-1");

// ✅ Good
trackExport("pdf", {
  valueCaseId: "vc-123",
  intent: "share-with-stakeholders",
});
```

### 2. Include Context

Always include relevant context with events:

```typescript
trackPageView("realization-portal", {
  valueCaseId: "vc-123",
  companyName: "Acme Corp",
  lifecycleStage: "active",
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


## Production SLO Framework

### Service-Level SLOs (Tenant + Region Segmentation)

SLO evaluation is computed per `service`, `tenant_tier`, and `region` labels to prevent aggregate metrics from hiding localized regressions.

| SLO ID | Service | Segment | Target | Measurement Window | Dashboard/Query ID |
| --- | --- | --- | --- | --- | --- |
| `SLO-API-AVAIL` | Backend API (`/api/*`) | `tenant_tier` (`enterprise`, `growth`, `starter`) × `region` (`us-east-1`, `eu-west-1`) | Availability ≥ `99.95%` | Rolling 30 days | Grafana panel `prod-slo-overview:api-availability-by-segment`, PromQL `1 - (sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m])) by (tenant_tier,region) / sum(rate(valuecanvas_http_requests_total[5m])) by (tenant_tier,region))` |
| `SLO-API-LAT` | Backend API | Same segment grid as above | p95 latency ≤ `450ms` | Rolling 30 days | Grafana panel `prod-slo-overview:api-p95-latency-by-segment`, PromQL `histogram_quantile(0.95, sum(rate(valuecanvas_http_request_duration_ms_bucket[5m])) by (le,tenant_tier,region))` |
| `SLO-API-ERR` | Backend API | Same segment grid as above | Error rate ≤ `0.5%` | Rolling 30 days | Grafana panel `prod-slo-overview:api-error-rate-by-segment`, PromQL `sum(rate(valuecanvas_http_requests_total{status_code=~"5.."}[5m])) by (tenant_tier,region) / sum(rate(valuecanvas_http_requests_total[5m])) by (tenant_tier,region)` |
| `SLO-WORKER-AVAIL` | Queue workers (`worker`, `bullmq`) | `tenant_tier` × `region` | Job success ratio ≥ `99.5%` | Rolling 30 days | Grafana panel `prod-slo-overview:worker-success-by-segment`, PromQL `sum(rate(job_completed_total{service="worker"}[5m])) by (tenant_tier,region) / (sum(rate(job_completed_total{service="worker"}[5m])) by (tenant_tier,region) + sum(rate(job_failed_total{service="worker"}[5m])) by (tenant_tier,region))` |

> **Tenant isolation requirement:** all SLO metrics and exemplars must carry `organization_id` and/or `tenant_id` dimensions in upstream telemetry and derived recording rules.

### Value Loop Tenant-Scoped Queries

Use `organization_id` as the canonical tenant label key for value-loop dashboards and alerts.

| Query ID | Purpose | PromQL |
| --- | --- | --- |
| `value-loop:stage-transition-p95-by-org` | Detect slow lifecycle handoffs per tenant | `histogram_quantile(0.95, sum(rate(value_loop_stage_transition_seconds_bucket{organization_id!=""}[5m])) by (le,organization_id,from_stage,to_stage))` |
| `value-loop:agent-invocation-rate-by-org` | Track agent traffic and outcomes per tenant | `sum(rate(value_loop_agent_invocations_total{organization_id!=""}[5m])) by (organization_id,agent,stage,outcome)` |
| `value-loop:hypothesis-confidence-avg-by-org` | Monitor model confidence drift per tenant | `sum(rate(value_loop_hypothesis_confidence_sum{organization_id!=""}[15m])) by (organization_id,agent) / clamp_min(sum(rate(value_loop_hypothesis_confidence_count{organization_id!=""}[15m])) by (organization_id,agent), 1)` |
| `value-loop:financial-unvalidated-rate-by-org` | Alert when unvalidated financial outputs spike per tenant | `sum(rate(value_loop_financial_calculations_total{organization_id!="",validated="false"}[15m])) by (organization_id,type) / clamp_min(sum(rate(value_loop_financial_calculations_total{organization_id!=""}[15m])) by (organization_id,type), 1)` |
| `value-loop:e2e-duration-p95-by-org` | Measure end-to-end value-loop latency per tenant | `histogram_quantile(0.95, sum(rate(value_loop_e2e_duration_seconds_bucket{organization_id!=""}[15m])) by (le,organization_id,stages))` |


### Error Budget Policy

- **Budget window:** 30-day rolling SLO window with daily budget recomputation at 00:00 UTC.
- **Budget ownership:** Release Captain owns release gating decisions, On-Call SRE owns active incident budget triage, and service owners provide mitigation plans.
- **Release gating policy:**
  - Remaining budget **≥ 50%**: normal releases allowed.
  - Remaining budget **20–49%**: require Release Captain + On-Call SRE approval and reduced blast-radius rollout (canary only).
  - Remaining budget **< 20%**: freeze non-critical releases; only fixes that improve reliability are permitted.

#### Burn-Rate Alerts

| Alert ID | Severity | Trigger | Source | Expected Action |
| --- | --- | --- | --- | --- |
| `alert-slo-burnrate-api-fast` | Critical | `burn_rate_1h > 14.4` and `burn_rate_5m > 14.4` for any evaluated SLO segment | Grafana managed alert (`uid: slo-api-fast-burn`) on `SLO-API-AVAIL` | Page Release Captain + On-Call SRE; assess rollback within 10 minutes. |
| `alert-slo-burnrate-api-slow` | High | `burn_rate_6h > 6` and `burn_rate_30m > 6` | Grafana managed alert (`uid: slo-api-slow-burn`) | Stop progressive rollout; open incident channel. |
| `alert-slo-burnrate-worker` | High | `burn_rate_6h > 4` and failed jobs concentrated in any segment | Grafana managed alert (`uid: slo-worker-burn`) | Pause queue-consuming deploys; divert traffic if region-specific. |

Burn-rate recording rules in Prometheus are defined in `infra/k8s/monitoring/prometheus-slo-rules.yaml` (for example, `slo:api_availability:error_budget_burn_rate5m/1h`).

### Rollback Signals (Release Captain Decision Inputs)

The Release Captain triggers rollback when **any one** critical signal persists for 10 minutes (or faster if customer-impacting):

1. **Availability breach:** `SLO-API-AVAIL` projection drops below `99.90%` for any enterprise tenant segment (`dashboard panel: prod-slo-overview:api-availability-by-segment`).
2. **Latency regression:** API p95 exceeds `800ms` in two consecutive 5-minute windows for the same `tenant_tier,region` (`panel: prod-slo-overview:api-p95-latency-by-segment`).
3. **Error spike:** `alert-slo-burnrate-api-fast` firing plus Loki exceptions query returns sustained release-correlated errors:
   - Loki query ID `loki-release-errors`: `{app="api",env="prod"} |= "ERROR" |= "release_version={{ .ReleaseVersion }}"`
4. **Trace health collapse:** Tempo service graph query ID `tempo-release-critical-path` shows >25% failed spans on the request critical path:
   - Tempo TraceQL: `{ resource.service.name = "api" && span.http.route = "/api/workflows/:id" && span.status = error }`
5. **Tenant-specific regressions:** two or more enterprise tenants in the same region fail smoke checks or produce P1 alerts tied to current release hash.

When rollback criteria are met, capture decision evidence in incident notes with the relevant dashboard panel IDs, Loki query IDs, Tempo query IDs, and the release hash.


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

---

## Service-Level Objectives (SLOs) and Error Budgets

The platform SLOs below are used for alerting, release gates, and weekly reliability reporting. SLO windows are evaluated over rolling 30-day periods unless otherwise noted.

| Service Area | SLI Definition | SLO Target | Error Budget | Burn-Rate Alert Trigger |
| --- | --- | --- | --- | --- |
| API latency | Percentage of API requests completing in `<=300ms` at P95 (`http_server_request_duration_seconds_bucket`) | `95.0%` good events | `5.0%` | `>14.4x` burn in 5m + 1h |
| API availability | Non-5xx responses over total API requests (`http_requests_total`) | `99.9%` | `0.1%` | `>14.4x` burn in 5m + 1h |
| Authentication success | Successful auth attempts over total auth attempts (`auth_attempts_total`) | `99.5%` | `0.5%` | `>14.4x` burn in 5m + 1h |
| Queue health | Time queue depth <100 and oldest age <120s (`queue_depth`, `queue_oldest_message_age_seconds`) | `99.0%` | `1.0%` | `>14.4x` burn in 5m + 1h |

### SLO policy and operational usage

- **Release policy**: production promotion is blocked when any `*SLOBurnRateTooHigh` alert is active in pre-production.
- **Incident policy**: a sustained burn-rate alert (`for: 5m`) opens a reliability incident and consumes the service's monthly error budget.
- **Reporting cadence**: weekly reports summarize current SLO attainment, active burn-rate alerts, and 7-day incident trend deltas.
- **Ownership**: API platform owns API latency/availability SLOs, Identity owns authentication SLO, and Platform Runtime owns queue health.
