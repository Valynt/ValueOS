# SDUI Quick Reference Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-28

---

## 🚀 Quick Start

### **1. Import SDUI**
```typescript
import { SDUIRenderer } from '@/sdui';
import { createTenantContext } from '@/sdui/TenantContext';
```

### **2. Create Tenant Context**
```typescript
const tenantContext = createTenantContext({
  tenantId: 'tenant_123',
  organizationId: 'org_456',
  userId: 'user_789',
  permissions: ['data:read', 'data:write'],
  theme: { mode: 'dark' },
  dataResidency: 'us',
});
```

### **3. Render SDUI Page**
```typescript
<SDUIRenderer 
  schema={pageDefinition} 
  tenantContext={tenantContext} 
/>
```

---

## 📦 Component Quick Reference

### **Navigation**
```typescript
// SideNavigation
{ component: 'SideNavigation', props: { items: [...], activeId: 'id' } }

// TabBar
{ component: 'TabBar', props: { tabs: [...], activeId: 'id', variant: 'underline' } }

// Breadcrumbs
{ component: 'Breadcrumbs', props: { items: [...], showHome: true } }
```

### **Data Display**
```typescript
// DataTable
{ component: 'DataTable', props: { data: [...], columns: [...], sortable: true } }

// ConfidenceIndicator
{ component: 'ConfidenceIndicator', props: { value: 85, variant: 'bar', animated: true } }
```

### **Agent Components**
```typescript
// AgentResponseCard
{ component: 'AgentResponseCard', props: { response: {...}, showReasoning: true } }

// AgentWorkflowPanel
{ component: 'AgentWorkflowPanel', props: { agents: [...], showMessages: true } }
```

---

## 🔄 Real-Time Data Binding

### **Basic Real-Time Binding**
```typescript
{
  $bind: 'metrics.revenue',
  $source: 'realtime_stream',
  $channel: 'metrics',
  $transform: 'currency',
  $fallback: 'Loading...',
}
```

### **With Debouncing**
```typescript
{
  $bind: 'metrics.revenue',
  $source: 'realtime_stream',
  $channel: 'metrics',
  $debounce: 1000,  // 1 second
  $bufferSize: 10,  // Keep last 10 values
}
```

### **WebSocket Hook**
```typescript
const ws = useWebSocket({
  url: 'wss://api.example.com/ws',
  reconnect: true,
});

const unsubscribe = ws.subscribe('channel', (data) => {
  console.log(data);
});
```

---

## ⚡ Performance

### **Lazy Loading**
```typescript
import { LazyComponent } from '@/sdui/performance';

<LazyComponent
  name="HeavyComponent"
  loader={() => import('./HeavyComponent')}
  preloadOnHover
  retryAttempts={3}
/>
```

### **Performance Monitoring**
```typescript
import { PerformanceMonitor } from '@/sdui/performance';

const monitor = PerformanceMonitor.getInstance();

// Time operation
const endTiming = monitor.startTiming('operation');
await doSomething();
endTiming();

// Get report
const report = monitor.generateReport();
```

---

## 🛡️ Error Handling

### **Retry Strategy**
```typescript
import { retryExponential } from '@/sdui/errors';

const result = await retryExponential(
  async () => await fetchData(),
  3,  // max attempts
  1000  // initial delay
);
```

### **Circuit Breaker**
```typescript
import { getCircuitBreaker } from '@/sdui/errors';

const breaker = getCircuitBreaker({
  name: 'api_service',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
});

await breaker.execute(async () => {
  return await api.getData();
});
```

### **Error Telemetry**
```typescript
import { captureException } from '@/sdui/errors';

try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    component: 'DataTable',
    action: 'fetch_data',
  });
}
```

---

## 🎨 Theme

### **Use Theme**
```typescript
import { useSDUITheme } from '@/sdui/theme';

const { theme, colors, setTheme } = useSDUITheme();
```

### **Theme Colors**
```typescript
import { SDUIColors } from '@/sdui/theme';

// Primary
SDUIColors.dark      // #121212
SDUIColors.neon      // #39FF14

// Surface
SDUIColors.card      // #333333
SDUIColors.border    // #444444

// Text
SDUIColors.textPrimary    // #FFFFFF
SDUIColors.textSecondary  // #B3B3B3
```

---

## 🔐 Multi-Tenant

### **Check Permission**
```typescript
import { hasPermission } from '@/sdui/TenantContext';

if (hasPermission(tenantContext, 'data:write')) {
  // Allow write
}
```

### **Tenant-Aware Binding**
```typescript
import { createTenantBinding } from '@/sdui/TenantAwareDataBinding';

const binding = createTenantBinding(
  'metrics.revenue',
  'realization_engine',
  tenantContext,
  { $transform: 'currency' }
);
```

---

## 📊 Data Sources

| Source | Description | Example |
|--------|-------------|---------|
| `realization_engine` | Realization metrics | `metrics.revenue_uplift` |
| `system_mapper` | System entities | `entities.length` |
| `intervention_designer` | Interventions | `intervention.status` |
| `outcome_engineer` | Hypotheses | `hypothesis.confidence` |
| `value_eval` | Evaluation scores | `evaluation.total_score` |
| `semantic_memory` | Memory store | `memories` |
| `tool_registry` | Tool results | `tool_result` |
| `supabase` | Database query | `count` |
| `mcp_tool` | MCP tool | `results` |
| `realtime_stream` | WebSocket | `live_data` |

---

## 🔧 Transform Functions

| Transform | Input | Output |
|-----------|-------|--------|
| `currency` | 1200000 | "$1.2M" |
| `percentage` | 0.85 | "85%" |
| `number` | 1234567 | "1,234,567" |
| `date` | ISO string | "Jan 15, 2024" |
| `relative_time` | ISO string | "2 hours ago" |
| `round` | 3.14159 | 3.14 |
| `uppercase` | "hello" | "HELLO" |
| `lowercase` | "HELLO" | "hello" |
| `truncate` | "long text..." | "long te..." |
| `array_length` | [1,2,3] | 3 |
| `sum` | [1,2,3] | 6 |
| `average` | [1,2,3] | 2 |
| `max` | [1,2,3] | 3 |
| `min` | [1,2,3] | 1 |

---

## 🎯 Common Patterns

### **Page with Real-Time Data**
```typescript
{
  type: 'page',
  version: 2,
  tenantId: 'tenant_123',
  sections: [
    {
      type: 'component',
      component: 'MetricBadge',
      props: {
        label: 'Live Revenue',
        value: {
          $bind: 'metrics.revenue',
          $source: 'realtime_stream',
          $channel: 'metrics',
          $transform: 'currency',
        },
      },
    },
  ],
}
```

### **Table with Lazy Loading**
```typescript
<LazyComponent
  name="DataTable"
  loader={() => import('@/components/SDUI/DataTable')}
  props={{
    data: tableData,
    columns: tableColumns,
    sortable: true,
    pagination: true,
  }}
/>
```

### **Error-Resilient API Call**
```typescript
const breaker = getCircuitBreaker({ name: 'api', failureThreshold: 5, timeout: 60000 });

const result = await breaker.execute(async () => {
  return await retryExponential(
    async () => await api.getData(),
    3,
    1000
  );
});
```

---

## 📝 Environment Variables

```bash
# WebSocket
VITE_WEBSOCKET_URL=wss://api.example.com/ws

# Sentry
VITE_SENTRY_DSN=https://your-sentry-dsn
VITE_SENTRY_ENVIRONMENT=production

# Performance
VITE_PERFORMANCE_MONITORING=true
VITE_PERFORMANCE_SAMPLE_RATE=1.0

# Feature Flags
VITE_ENABLE_REALTIME=true
VITE_ENABLE_LAZY_LOADING=true
```

---

## 🐛 Debugging

### **Enable Debug Mode**
```typescript
// WebSocket
const ws = useWebSocket({ url: '...', debug: true });

// Performance
const monitor = PerformanceMonitor.getInstance();
monitor.setThreshold('operation', { warning: 100, critical: 500, unit: 'ms' });

// Error Telemetry
initializeErrorTelemetry({ enabled: true, environment: 'development' });
```

### **Check Stats**
```typescript
// WebSocket
console.log(ws.stats);

// Performance
console.log(monitor.getStats());

// Circuit Breaker
console.log(breaker.getStats());
```

---

## 📚 Documentation Links

- **Master Summary:** `docs/SDUI_MASTER_SUMMARY.md`
- **Phase 3 Complete:** `docs/SDUI_PHASE3_IMPLEMENTATION_COMPLETE.md`
- **Comprehensive Status:** `docs/SDUI_COMPREHENSIVE_IMPLEMENTATION_STATUS.md`
- **Verification Report:** `docs/SDUI_VERIFICATION_REPORT.md`

---

## 🆘 Troubleshooting

### **WebSocket Not Connecting**
1. Check WebSocket URL
2. Verify authentication
3. Check network/firewall
4. Enable debug mode

### **Performance Issues**
1. Enable lazy loading
2. Check bundle size
3. Review performance report
4. Optimize data fetching

### **Errors Not Captured**
1. Initialize error telemetry
2. Check Sentry DSN
3. Verify error patterns
4. Check sample rate

---

## ✅ Production Checklist

- [ ] Environment variables configured
- [ ] WebSocket URL set
- [ ] Sentry DSN configured
- [ ] Performance thresholds set
- [ ] Circuit breakers configured
- [ ] Tenant permissions defined
- [ ] Theme customization ready
- [ ] Error patterns defined
- [ ] Monitoring alerts set
- [ ] Documentation reviewed

---

**Quick Reference v1.0.0** | **Last Updated:** 2024-11-28
