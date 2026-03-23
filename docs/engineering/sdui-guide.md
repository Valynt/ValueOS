# Sdui Guide

**Last Updated**: 2026-02-08

**Consolidated from 4 source documents**

---

## Table of Contents

1. [Agentic Canvas SDUI - Quick Reference](#agentic-canvas-sdui---quick-reference)
2. [SDUI Quick Reference Guide](#sdui-quick-reference-guide)
3. [Agentic Canvas SDUI - Implementation Summary](#agentic-canvas-sdui---implementation-summary)
4. [Agentic Canvas Enhancement Plan](#agentic-canvas-enhancement-plan)

---

## Agentic Canvas SDUI - Quick Reference

*Source: `engineering/sdui/README_AGENTIC.md`*

**Last Updated:** 2024-11-30
**Status:** ✅ Foundation Complete, Ready for Implementation

---

## 📁 What Was Created

### Documentation

- **Enhancement Plan:** `docs/sdui/AGENTIC_CANVAS_ENHANCEMENT.md` (full specification, 400+ lines)
- **Implementation Summary:** `docs/sdui/IMPLEMENTATION_SUMMARY.md` (quick start guide)
- **This File:** Quick reference for developers

### Code Files

All files created in `src/sdui/canvas/`:

| File                | Purpose                            | Lines | Status      |
| ------------------- | ---------------------------------- | ----- | ----------- |
| `types.ts`          | Type definitions for canvas system | 450   | ✅ Complete |
| `CanvasPatcher.ts`  | Delta update system                | 327   | ✅ Complete |
| `CanvasEventBus.ts` | Bidirectional event system         | 150   | ✅ Complete |
| `hooks.tsx`         | React hooks for canvas             | 75    | ✅ Complete |

---

## 🎯 What This Enables

### The Problem

Your current SDUI works great for **static templates**, but the agentic chat-canvas use case needs:

- Agent can dynamically compose layouts
- Surgical updates without full re-renders
- Components can send events back to agent
- LLM is constrained to prevent hallucination

### The Solution

**Hybrid Architecture:**

- **Static Shell:** Chat sidebar (1/3 width) - regular React
- **Dynamic Canvas:** Value model builder (2/3 width) - SDUI with layouts

**Key Innovations:**

1. **Layout Primitives** - Nested containers (VerticalSplit, Grid)
2. **Delta Updates** - Change one KPI without re-rendering entire canvas
3. **Event System** - Click chart → agent explains detail
4. **LLM Constraints** - Function calling schema prevents invalid components

---

## 🚀 How to Use

### 1. Agent Sends Layout

```typescript
// Agent response
const response: AgentCanvasResponse = {
  message: {
    text: "Here's your revenue projection",
    agentId: "analyst",
    timestamp: Date.now()
  },
  canvas: {
    operation: 'replace',
    canvasId: 'value_model_v1',
    version: 1,
    layout: {
      type: 'VerticalSplit',
      ratios: [30, 70],
      gap: 16,
      children: [
        {
          type: 'Component',
          componentId: 'kpi_revenue',
          component: 'KPICard',
          version: 1,
          props: { title: 'Revenue', value: '$1.2M', trend: '+15%' }
        },
        {
          type: 'Component',
          componentId: 'chart_revenue',
          component: 'LineChart',
          version: 1,
          props: { title: 'Revenue Trend', series: [...] }
        }
      ]
    }
  },
  metadata: {
    reasoning: "User asked about revenue. Showing KPI + trend.",
    confidence: 0.95
  }
};
```

### 2. Canvas Renders Layout

```tsx
// In your app
<StreamingCanvas
  canvasId="value_model_v1"
  layout={response.canvas.layout}
  onEvent={(event) => sendToAgent(event)}
/>
```

### 3. User Clicks Chart

```typescript
// Component emits event
const emitEvent = useCanvasEvent('chart_revenue');

<LineChart
  onClick={() => emitEvent({
    type: 'drill_down',
    metric: 'revenue',
    context: { quarter: 'Q4' }
  })}
/>
```

### 4. Agent Sends Delta Update

```typescript
// Agent adds detail table
const delta: CanvasDelta = {
  operations: [
    {
      op: 'add',
      path: '/children/-1',  // Append to end
      value: {
        type: 'Component',
        componentId: 'table_q4_detail',
        component: 'DataTable',
        props: { data: [...], columns: [...] }
      }
    }
  ],
  reason: 'User requested Q4 detail',
  timestamp: Date.now()
};

// Apply delta
const newLayout = CanvasPatcher.applyDelta(currentLayout, delta);
```

---

## 📊 Available Operations

### Canvas Operations

| Operation | When to Use                           | Example                   |
| --------- | ------------------------------------- | ------------------------- |
| `replace` | Initial render or major change        | Full dashboard            |
| `patch`   | Small update (e.g., change one value) | Update KPI trend          |
| `stream`  | Progressive loading                   | Show skeleton → fill data |
| `reset`   | Clear canvas                          | Start new conversation    |

### Delta Operations

| Op             | Effect                 | Example          |
| -------------- | ---------------------- | ---------------- |
| `update_props` | Change component props | Update KPI trend |
| `update_data`  | Replace component data | New chart series |
| `add`          | Add new component      | Add detail table |
| `remove`       | Delete component       | Remove old chart |
| `reorder`      | Change order           | Move KPI to top  |
| `replace`      | Replace at path        | Swap chart type  |

### Canvas Events

| Event              | Triggered When        | Use Case          |
| ------------------ | --------------------- | ----------------- |
| `component_click`  | User clicks component | Drill down        |
| `value_change`     | User edits value      | Update assumption |
| `drill_down`       | User wants detail     | Show breakdown    |
| `filter_applied`   | User filters data     | Refine view       |
| `export_requested` | User wants export     | Generate PDF      |
| `question`         | User asks question    | Agent responds    |

---

## 🏗️ Next Steps (Phase 1)

### This Week: Create Layout Components

**Files to Create:**

```
src/components/SDUI/CanvasLayout/
├── VerticalSplit.tsx       # Side-by-side layout
├── HorizontalSplit.tsx     # Top-bottom layout
├── Grid.tsx                # Dashboard grid
├── DashboardPanel.tsx      # Collapsible panel
└── index.ts                # Exports
```

**Example:**

```tsx
// VerticalSplit.tsx
export const VerticalSplit: React.FC<{
  ratios: number[];
  children: React.ReactNode[];
  gap?: number;
}> = ({ ratios, children, gap = 16 }) => {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full" style={{ gap: `${gap}px` }}>
      {children.map((child, i) => (
        <div
          key={i}
          style={{ flex: ratios[i] / totalRatio }}
          className="overflow-auto"
        >
          {child}
        </div>
      ))}
    </div>
  );
};
```

**Register in Registry:**

```typescript
// src/sdui/registry.tsx
import { VerticalSplit, Grid, ... } from '../components/SDUI/CanvasLayout';

const baseRegistry = {
  // ... existing components

  VerticalSplit: {
    component: VerticalSplit,
    versions: [1],
    requiredProps: ['ratios', 'children'],
    description: 'Vertical split layout with configurable ratios',
  },

  // ... add Grid, HorizontalSplit, etc.
};
```

**Update Renderer:**

```typescript
// src/sdui/renderer.tsx
const renderSection = (section: CanvasLayout, ...) => {
  // Check if it's a layout type
  if (section.type === 'VerticalSplit' ||
      section.type === 'HorizontalSplit' ||
      section.type === 'Grid') {
    const LayoutComponent = resolveLayoutComponent(section.type);
    return (
      <LayoutComponent {...section}>
        {section.children.map((child, i) =>
          renderSection(child, i, ...)
        )}
      </LayoutComponent>
    );
  }

  // Existing component rendering
  if (section.type === 'Component') {
    // ... existing code
  }
};
```

---

## 🧪 Testing

### Test Layout Rendering

```typescript
// Test nested layouts
const testLayout: CanvasLayout = {
  type: 'VerticalSplit',
  ratios: [30, 70],
  gap: 16,
  children: [
    {
      type: 'Component',
      componentId: 'kpi_1',
      component: 'KPICard',
      version: 1,
      props: { title: 'Revenue', value: '$1.2M' }
    },
    {
      type: 'Grid',
      columns: 2,
      gap: 16,
      children: [
        { type: 'Component', componentId: 'c1', component: 'LineChart', ... },
        { type: 'Component', componentId: 'c2', component: 'BarChart', ... },
        { type: 'Component', componentId: 'c3', component: 'PieChart', ... },
        { type: 'Component', componentId: 'c4', component: 'DataTable', ... },
      ]
    }
  ]
};

render(<CanvasRenderer layout={testLayout} />);
```

### Test Delta Updates

```typescript
import { CanvasPatcher } from "../sdui/canvas/CanvasPatcher";

test("update KPI props", () => {
  const layout = {
    /* ... */
  };
  const delta: CanvasDelta = {
    operations: [
      { op: "update_props", componentId: "kpi_1", props: { trend: "+20%" } },
    ],
    timestamp: Date.now(),
  };

  const newLayout = CanvasPatcher.applyDelta(layout, delta);
  const kpi = CanvasPatcher.findComponentById(newLayout, "kpi_1");

  expect(kpi?.props.trend).toBe("+20%");
});
```

### Test Event Bus

```typescript
import { CanvasEventBus } from "../sdui/canvas/CanvasEventBus";

test("emit and receive events", () => {
  const eventBus = new CanvasEventBus();
  const received: CanvasEventPayload[] = [];

  eventBus.subscribe((event) => received.push(event));

  eventBus.emit(
    {
      type: "component_click",
      componentId: "kpi_1",
    },
    "canvas_v1",
  );

  expect(received).toHaveLength(1);
  expect(received[0].event.type).toBe("component_click");
});
```

---

## 📚 Reference

### Full Documentation

1. **Enhancement Plan:** `docs/sdui/AGENTIC_CANVAS_ENHANCEMENT.md`
   - Complete technical specification
   - All 6 implementation phases
   - Code examples for every feature

2. **Implementation Summary:** `docs/sdui/IMPLEMENTATION_SUMMARY.md`
   - Quick start guide
   - Success criteria
   - Roadmap

3. **Type Definitions:** `src/sdui/canvas/types.ts`
   - All TypeScript types
   - Zod schemas
   - Constraint constants

### Key Classes

- **`CanvasPatcher`** - Apply delta updates
- **`CanvasEventBus`** - Bidirectional events
- **`useCanvasEvent`** - Hook for components

### Key Types

- **`CanvasLayout`** - Layout tree structure
- **`AgentCanvasResponse`** - Agent → canvas protocol
- **`CanvasDelta`** - Patch operations
- **`CanvasEvent`** - Canvas → agent events

---

## ✅ Checklist

### Foundation (Complete)

- [x] Type definitions
- [x] Delta patcher
- [x] Event bus
- [x] React hooks
- [x] Documentation

### Phase 1 (Next)

- [ ] Create VerticalSplit component
- [ ] Create HorizontalSplit component
- [ ] Create Grid component
- [ ] Create DashboardPanel component
- [ ] Register layout components
- [ ] Update renderer for layouts
- [ ] Test nested rendering

### Phase 2

- [ ] Canvas store (Zustand)
- [ ] Undo/redo
- [ ] Delta validation
- [ ] Integration tests

### Phase 3

- [ ] Event bus integration
- [ ] Update existing components
- [ ] Connect to chat agent
- [ ] E2E event flow

---

## 🎯 Success Criteria

You'll know it's working when:

1. ✅ Agent can send nested layouts
2. ✅ Canvas renders layouts correctly
3. ✅ Delta updates work without flicker
4. ✅ Components emit events
5. ✅ Agent receives events
6. ✅ Undo/redo works
7. ✅ Demo end-to-end

---

## 💡 Tips

**Start Simple:**

- First, just get VerticalSplit rendering
- Test with mock data before connecting to agent
- Build one phase at a time

**Use Existing Patterns:**

- Follow your current component structure
- Reuse error boundaries
- Keep registry pattern

**Test Incrementally:**

- Write tests as you build
- Use Storybook for components
- Mock agent responses

---

**Status:** 📋 Ready to Implement
**Next Action:** Create `VerticalSplit.tsx`
**Estimated Time:** 4 weeks to production

Good luck building the future of agentic UI! 🚀

---

## SDUI Quick Reference Guide

*Source: `engineering/sdui/sdui-quick-reference.md`*

**Version:** 1.0.0
**Last Updated:** 2024-11-28

---

## 🚀 Quick Start

### **1. Import SDUI**

```typescript
import { SDUIRenderer } from "@/sdui";
import { createTenantContext } from "@/sdui/TenantContext";
```

### **2. Create Tenant Context**

```typescript
const tenantContext = createTenantContext({
  tenantId: "tenant_123",
  organizationId: "org_456",
  userId: "user_789",
  permissions: ["data:read", "data:write"],
  theme: { mode: "dark" },
  dataResidency: "us",
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
  url: "wss://api.example.com/ws",
  reconnect: true,
});

const unsubscribe = ws.subscribe("channel", (data) => {
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
import { PerformanceMonitor } from "@/sdui/performance";

const monitor = PerformanceMonitor.getInstance();

// Time operation
const endTiming = monitor.startTiming("operation");
await doSomething();
endTiming();

// Get report
const report = monitor.generateReport();
```

---

## 🛡️ Error Handling

### **Retry Strategy**

```typescript
import { retryExponential } from "@/sdui/errors";

const result = await retryExponential(
  async () => await fetchData(),
  3, // max attempts
  1000, // initial delay
);
```

### **Circuit Breaker**

```typescript
import { getCircuitBreaker } from "@/sdui/errors";

const breaker = getCircuitBreaker({
  name: "api_service",
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
import { captureException } from "@/sdui/errors";

try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    component: "DataTable",
    action: "fetch_data",
  });
}
```

---

## 🎨 Theme

### **Use Theme**

```typescript
import { useSDUITheme } from "@/sdui/theme";

const { theme, colors, setTheme } = useSDUITheme();
```

### **Theme Colors**

```typescript
import { SDUIColors } from "@/sdui/theme";

// Primary
SDUIColors.dark; // #121212
SDUIColors.neon; // #39FF14

// Surface
SDUIColors.card; // #333333
SDUIColors.border; // #444444

// Text
SDUIColors.textPrimary; // #FFFFFF
SDUIColors.textSecondary; // #B3B3B3
```

---

## 🔐 Multi-Tenant

### **Check Permission**

```typescript
import { hasPermission } from "@/sdui/TenantContext";

if (hasPermission(tenantContext, "data:write")) {
  // Allow write
}
```

### **Tenant-Aware Binding**

```typescript
import { createTenantBinding } from "@/sdui/TenantAwareDataBinding";

const binding = createTenantBinding(
  "metrics.revenue",
  "realization_engine",
  tenantContext,
  { $transform: "currency" },
);
```

---

## 📊 Data Sources

| Source                  | Description         | Example                  |
| ----------------------- | ------------------- | ------------------------ |
| `realization_engine`    | Realization metrics | `metrics.revenue_uplift` |
| `system_mapper`         | System entities     | `entities.length`        |
| `intervention_designer` | Interventions       | `intervention.status`    |
| `outcome_engineer`      | Hypotheses          | `hypothesis.confidence`  |
| `value_eval`            | Evaluation scores   | `evaluation.total_score` |
| `semantic_memory`       | Memory store        | `memories`               |
| `tool_registry`         | Tool results        | `tool_result`            |
| `supabase`              | Database query      | `count`                  |
| `mcp_tool`              | MCP tool            | `results`                |
| `realtime_stream`       | WebSocket           | `live_data`              |

---

## 🔧 Transform Functions

| Transform       | Input          | Output         |
| --------------- | -------------- | -------------- |
| `currency`      | 1200000        | "$1.2M"        |
| `percentage`    | 0.85           | "85%"          |
| `number`        | 1234567        | "1,234,567"    |
| `date`          | ISO string     | "Jan 15, 2024" |
| `relative_time` | ISO string     | "2 hours ago"  |
| `round`         | 3.14159        | 3.14           |
| `uppercase`     | "hello"        | "HELLO"        |
| `lowercase`     | "HELLO"        | "hello"        |
| `truncate`      | "long text..." | "long te..."   |
| `array_length`  | [1,2,3]        | 3              |
| `sum`           | [1,2,3]        | 6              |
| `average`       | [1,2,3]        | 2              |
| `max`           | [1,2,3]        | 3              |
| `min`           | [1,2,3]        | 1              |

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
const breaker = getCircuitBreaker({
  name: "api",
  failureThreshold: 5,
  timeout: 60000,
});

const result = await breaker.execute(async () => {
  return await retryExponential(async () => await api.getData(), 3, 1000);
});
```

---

## 📝 Environment Variables

```bash
# WebSocket
VITE_WEBSOCKET_URL=wss://api.example.com/ws

# Error Monitoring
# Errors are tracked via structured logging (Winston)

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
const ws = useWebSocket({ url: "...", debug: true });

// Performance
const monitor = PerformanceMonitor.getInstance();
monitor.setThreshold("operation", { warning: 100, critical: 500, unit: "ms" });

// Error Telemetry
initializeErrorTelemetry({ enabled: true, environment: "development" });
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
2. Check error logging config
3. Verify error patterns
4. Check sample rate

---

## ✅ Production Checklist

- [ ] Environment variables configured
- [ ] WebSocket URL set
- [ ] Error logging configured
- [ ] Performance thresholds set
- [ ] Circuit breakers configured
- [ ] Tenant permissions defined
- [ ] Theme customization ready
- [ ] Error patterns defined
- [ ] Monitoring alerts set
- [ ] Documentation reviewed

---

**Quick Reference v1.0.0** | **Last Updated:** 2024-11-28

---

## Agentic Canvas SDUI - Implementation Summary

*Source: `engineering/sdui/IMPLEMENTATION_SUMMARY.md`*

**Created:** 2024-11-30
**Status:** ✅ Foundation Ready, 📋 Enhancement Plan Complete

---

## 📊 Current Implementation Review

### What You Have ✅

Your current SDUI implementation is **solid** and **production-ready** for static use cases:

**Component Registry:**

- 25+ registered components (KPICard, LineChart, DataTable, etc.)
- Version support for component evolution
- Hot-swapping capability for development
- Component metadata (requiredProps, description)

**Schema Validation:**

- Zod-based validation for entire page definitions
- Recursive validation of nested components
- Version normalization and compatibility checks
- Clear error messages with field paths

**Data System:**

- WebSocket support for real-time updates
- Data hydration with parallel fetching
- Retry logic with exponential backoff
- Caching with TTL

**Error Handling:**

- Component-level error boundaries
- Graceful degradation for missing components
- Custom fallback UI support
- Error logging and reporting

**Performance:**

- Memoization for expensive operations
- Efficient re-rendering strategies
- Performance metrics tracking

---

## 🎯 Enhancement for Agentic Use Case

### The Gap

Your current implementation is optimized for **static templates** (OpportunityTemplate, TargetTemplate, etc.) but the **agentic chat-canvas** use case requires:

1. **Layout Primitives** - VerticalSplit, Grid, etc. (not just flat component lists)
2. **Delta Updates** - Surgical changes without full re-renders
3. **Bidirectional Events** - Canvas → Agent communication
4. **LLM Constraints** - Prevent component hallucination
5. **Streaming UI** - Progressive rendering as agent "thinks"
6. **State Management** - Undo/redo, versioning

---

## 📦 What We've Created

### 1. Enhancement Plan

**File:** `docs/sdui/AGENTIC_CANVAS_ENHANCEMENT.md` (full specification)

### 2. Type Definitions

**File:** `src/sdui/canvas/types.ts`

**Key Types:**

- `CanvasLayout` - Recursive layout schema (VerticalSplit, Grid, Component)
- `AgentCanvasResponse` - Protocol for agent → canvas updates
- `CanvasDelta` - Delta/patch operations
- `CanvasEvent` - Canvas → agent events
- `ALLOWED_CANVAS_COMPONENTS` - Constraint list for LLM

### 3. Delta Patcher

**File:** `src/sdui/canvas/CanvasPatcher.ts`

**Features:**

- Apply surgical updates to canvas without full re-render
- Support for replace, add, remove, update_props, update_data, reorder
- Deep component search by ID
- Validation before applying deltas
- JSONPath-style updates

**Usage:**

```typescript
const delta: CanvasDelta = {
  operations: [
    { op: "update_props", componentId: "kpi_1", props: { trend: "+20%" } },
  ],
  reason: "User updated retention assumption",
  timestamp: Date.now(),
};

const newLayout = CanvasPatcher.applyDelta(currentLayout, delta);
```

### 4. Event Bus

**File:** `src/sdui/canvas/CanvasEventBus.ts`

**Features:**

- Bidirectional canvas ↔ agent communication
- Event filtering by type
- Multiple listener support
- Global singleton instance

**Usage:**

```typescript
const eventBus = new CanvasEventBus();

// Subscribe (in chat component)
eventBus.subscribe((event) => {
  sendToAgent({ type: "canvas_event", payload: event });
});

// Emit (in canvas component)
eventBus.emit(
  {
    type: "drill_down",
    metric: "revenue",
    context: { quarter: "Q4" },
  },
  "canvas_v1",
);
```

### 5. React Hooks

**File:** `src/sdui/canvas/hooks.tsx`

**Hooks:**

- `useCanvasEvent(componentId)` - Emit events from components
- `useCanvasContext()` - Access canvas context
- `useIsInCanvas()` - Check if in canvas

**Usage in Components:**

```typescript
const KPICard = ({ componentId, title, value }) => {
  const emitEvent = useCanvasEvent(componentId);

  return (
    <div onClick={() => emitEvent({
      type: 'drill_down',
      metric: title,
      context: { value }
    })}>
      {/* KPI display */}
    </div>
  );
};
```

---

## 🏗️ Architecture Overview

### The Hybrid Shell Pattern

```
┌────────────────────────────────────────────────────────────┐
│                    App Layout (Static)                      │
├──────────────────┬─────────────────────────────────────────┤
│                  │                                          │
│   Chat Sidebar   │        Canvas Container                 │
│   (1/3 width)    │        (2/3 width)                      │
│                  │                                          │
│   Static React   │   Dynamic SDUI Renderer                 │
│   Components:    │   - Receives layout from agent          │
│   - ChatInput    │   - Renders components dynamically      │
│   - MessageList  │   - Emits events back to agent          │
│   - AgentStatus  │   - Supports delta updates              │
│                  │   - Progressive streaming               │
│                  │                                          │
└──────────────────┴─────────────────────────────────────────┘
```

### The Agent-Canvas Protocol

```typescript
// 1. User asks question in chat
"Show me how 5% retention increase affects LTV"

// 2. Agent responds with:
{
  message: {
    text: "I've created a projection...",
    agentId: "ltv-analyst"
  },
  canvas: {
    operation: 'replace',  // or 'patch', 'stream'
    layout: {
      type: 'VerticalSplit',
      ratios: [30, 70],
      children: [
        {
          type: 'Component',
          componentId: 'kpi_ltv',
          component: 'KPICard',
          props: { title: 'LTV', value: '$4,500', trend: '+15%' }
        },
        {
          type: 'Component',
          componentId: 'chart_1',
          component: 'LineChart',
          props: { /* chart config */ }
        }
      ]
    }
  }
}

// 3. Canvas renders layout

// 4. User clicks chart (canvas → agent event)
{
  event: { type: 'drill_down', metric: 'LTV', context: { quarter: 'Q4' } },
  canvasId: 'value_model_v1'
}

// 5. Agent responds with delta update
{
  canvas: {
    operation: 'patch',
    delta: {
      operations: [
        { op: 'add', path: '/children/-1', value: { /* detail table */ } }
      ]
    }
  }
}
```

---

## 📋 Implementation Roadmap

### Phase 1: Layout Primitives (Week 1) ⚡ START HERE

**Priority:** 🔥 Critical

**Tasks:**

1. Create layout components:
   - `src/components/SDUI/CanvasLayout/VerticalSplit.tsx`
   - `src/components/SDUI/CanvasLayout/HorizontalSplit.tsx`
   - `src/components/SDUI/CanvasLayout/Grid.tsx`
   - `src/components/SDUI/CanvasLayout/DashboardPanel.tsx`

2. Update renderer to support nested layouts:
   - Modify `src/sdui/renderer.tsx` to handle layout types
   - Add recursive rendering for nested children

3. Register layout components:
   - Add to `src/sdui/registry.tsx`

4. Test with mock data:
   ```typescript
   const mockLayout: CanvasLayout = {
     type: 'VerticalSplit',
     ratios: [30, 70],
     gap: 16,
     children: [
       { type: 'Component', componentId: 'k1', component: 'KPICard', props: {...} },
       { type: 'Component', componentId: 'c1', component: 'LineChart', props: {...} }
     ]
   };
   ```

**Estimated Time:** 3-4 days
**Deliverable:** Nested layout rendering working

---

### Phase 2: Delta Updates (Week 1-2)

**Priority:** 🔥 Critical

**Tasks:**

1. Create canvas store:
   - `src/sdui/canvas/CanvasStore.ts` (Zustand)
   - Actions: setCanvas, patchCanvas, undo, redo

2. Integrate patcher:
   - Connect `CanvasPatcher` to store
   - Add validation before applying deltas

3. Build test suite:
   - Test all patch operations
   - Test undo/redo
   - Test validation

**Estimated Time:** 3-4 days
**Deliverable:** Delta updates working with undo/redo

---

### Phase 3: Event System (Week 2)

**Priority:** 🟡 High

**Tasks:**

1. Connect event bus to canvas:
   - Provide `CanvasContext` at app level
   - Wrap canvas in context provider

2. Update existing components:
   - Add event emission to `KPICard`, `LineChart`, etc.
   - Use `useCanvasEvent` hook

3. Connect to chat agent:
   - Subscribe to events in chat component
   - Send to backend via WebSocket/API

**Estimated Time:** 2-3 days
**Deliverable:** Bidirectional communication working

---

### Phase 4: Agent Constraints (Week 2-3)

**Priority:** 🟡 High

**Tasks:**

1. Generate OpenAI function schema:
   - `src/sdui/canvas/AgentConstraints.ts`
   - Export JSON schema for function calling

2. Add validation layer:
   - Validate agent output before rendering
   - Provide helpful error messages
   - Auto-sanitize if possible

3. Test with real LLM:
   - OpenAI function calling
   - Verify no hallucinated components

**Estimated Time:** 2-3 days
**Deliverable:** LLM constrained to valid components

---

### Phase 5: Streaming UI (Week 3)

**Priority:** 🟢 Medium

**Tasks:**

1. Create streaming renderer:
   - `src/sdui/canvas/StreamingRenderer.tsx`
   - Skeleton loaders
   - Progressive rendering

2. WebSocket streaming:
   - Backend sends layout in chunks
   - Frontend assembles incrementally

3. Optimistic UI:
   - Show skeleton immediately
   - Fill in as data arrives

**Estimated Time:** 3-4 days
**Deliverable:** Smooth streaming experience

---

### Phase 6: Integration & Polish (Week 4)

**Priority:** 🟢 Medium

**Tasks:**

1. End-to-end testing
2. Performance optimization
3. Documentation
4. Demo video
5. Deployment

**Estimated Time:** 5 days
**Deliverable:** Production-ready system

---

## 🚀 Quick Start Guide

### 1. Install Dependencies (if needed)

```bash
npm install zustand  # For canvas state management
```

### 2. Generate the UI Manifest

```bash
pnpm ui:manifest
```

This writes `ui-manifest.json` at the repo root with component names and their paths under `apps/ValyntApp/src`.

### 3. Create Your First Layout Component

```tsx
// src/components/SDUI/CanvasLayout/VerticalSplit.tsx
export const VerticalSplit: React.FC<{
  ratios: number[];
  children: React.ReactNode[];
  gap?: number;
}> = ({ ratios, children, gap = 16 }) => {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full" style={{ gap: `${gap}px` }}>
      {children.map((child, i) => (
        <div
          key={i}
          style={{ flex: ratios[i] / totalRatio }}
          className="overflow-auto"
        >
          {child}
        </div>
      ))}
    </div>
  );
};
```

### 3. Update a Component to Emit Events

```tsx
// src/components/SDUI/KPICard.tsx (enhanced)
import { useCanvasEvent } from "../../sdui/canvas/hooks";

export const KPICard: React.FC<KPICardProps & { componentId: string }> = ({
  componentId,
  title,
  value,
  trend,
}) => {
  const emitEvent = useCanvasEvent(componentId);

  return (
    <div
      onClick={() =>
        emitEvent({
          type: "drill_down",
          metric: title,
          context: { value, trend },
        })
      }
      className="cursor-pointer hover:shadow-lg transition-shadow"
    >
      {/* existing KPI display */}
    </div>
  );
};
```

### 4. Test with Mock Agent Response

```typescript
// In your app or Storybook
const mockAgentResponse: AgentCanvasResponse = {
  message: {
    text: "Here's your revenue projection",
    agentId: "analyst",
    timestamp: Date.now(),
  },
  canvas: {
    operation: "replace",
    canvasId: "test_canvas",
    version: 1,
    layout: {
      type: "VerticalSplit",
      ratios: [30, 70],
      gap: 16,
      children: [
        {
          type: "Component",
          componentId: "kpi_1",
          component: "KPICard",
          version: 1,
          props: { title: "Revenue", value: "$1.2M", trend: "+15%" },
        },
        {
          type: "Component",
          componentId: "chart_1",
          component: "LineChart",
          version: 1,
          props: {
            /* chart config */
          },
        },
      ],
    },
  },
  metadata: {
    confidence: 0.95,
  },
};
```

---

## 📚 Key Concepts

### 1. Layout vs. Component

**Layout:** Container that arranges children

- `VerticalSplit`, `Grid`, `DashboardPanel`
- Has `children` array
- Controls positioning

**Component:** Leaf node that displays content

- `KPICard`, `LineChart`, `DataTable`
- Has `props` object
- Displays data

### 2. Replace vs. Patch

**Replace:** Full canvas update

- Use for initial render
- Use when changing entire structure
- Simple but less efficient

**Patch:** Surgical update

- Use for small changes (e.g., update one KPI)
- More efficient
- Preserves component state

### 3. Streaming Workflow

```
1. Agent starts thinking → Send skeleton layout
2. Agent calculates data → Stream data chunks
3. Agent finishes → Send complete signal
```

User sees progressive loading instead of blank screen.

---

## ✅ Success Criteria

Your implementation will be complete when:

1. ✅ Layouts can be nested (VerticalSplit inside Grid)
2. ✅ Agent can send delta updates
3. ✅ Components can emit events to agent
4. ✅ LLM is constrained to valid components
5. ✅ Canvas supports undo/redo
6. ✅ Streaming shows progressive loading
7. ✅ End-to-end demo works

---

## 🎯 Next Steps

**Right Now:**

1. Review this summary
2. Review full enhancement plan: `docs/sdui/AGENTIC_CANVAS_ENHANCEMENT.md`
3. Start Phase 1: Create `VerticalSplit.tsx`

**This Week:**

1. Complete layout primitives
2. Test nested rendering
3. Begin delta system

**This Month:**

1. Complete all 6 phases
2. Deploy to production
3. 🎉 Celebrate!

---

## 📞 Resources

- **OpenAI Function Calling:** https://platform.openai.com/docs/guides/function-calling
- **Zustand Docs:** https://github.com/pmndrs/zustand
- **JSON Patch RFC:** https://tools.ietf.org/html/rfc6902
- **SDUI Best Practices:** Already in your `src/sdui/ARCHITECTURE.md`

---

**Status:** 📋 Ready to Implement
**Foundation:** ✅ Complete
**Next Phase:** 🏗️ Phase 1 - Layout Primitives
**Estimated Completion:** 4 weeks from start

Good luck! You have a **solid foundation** and a **clear path forward**. The agentic canvas will be a powerful differentiator for ValueCanvas! 🚀

---

## Agentic Canvas Enhancement Plan

*Source: `engineering/sdui/AGENTIC_CANVAS_ENHANCEMENT.md`*

**Created:** 2024-11-30
**Purpose:** Enhance SDUI for hybrid chat-driven value model builder
**Target Architecture:** Static Shell + Dynamic Canvas

---

## 🎯 Current State vs. Target State

### Current Implementation ✅

**What You Have:**

- ✅ Component registry with 20+ components
- ✅ Schema validation (Zod)
- ✅ Data hydration system
- ✅ WebSocket support (realtime/)
- ✅ Static templates (OpportunityTemplate, etc.)
- ✅ Error boundaries
- ✅ Performance optimization

**Gaps for Agentic Use Case:**

- ❌ Chat-driven canvas protocol
- ❌ Delta/patch updates
- ❌ Bidirectional canvas events
- ❌ LLM output constraints
- ❌ Layout primitives (VerticalSplit, Grid, etc.)
- ❌ Streaming/optimistic UI
- ❌ Canvas state management

---

## 🏗️ Proposed Architecture

### 1. The Hybrid Shell

```
┌────────────────────────────────────────────────────────────┐
│                    App Layout (Static)                      │
├──────────────────┬─────────────────────────────────────────┤
│                  │                                          │
│   Chat Sidebar   │        Canvas Container                 │
│   (1/3 width)    │        (2/3 width)                      │
│                  │                                          │
│   [Component]    │   <CanvasRenderer                       │
│   - ChatInput    │     schema={agentPayload}               │
│   - MessageList  │     onEvent={handleCanvasEvent}         │
│   - AgentStatus  │     enablePatching={true}               │
│                  │   />                                     │
│                  │                                          │
└──────────────────┴─────────────────────────────────────────┘
```

### 2. The Agent-Canvas Protocol

```typescript
// Agent Response Format
interface AgentCanvasResponse {
  // Chat message (goes to sidebar)
  message: {
    text: string;
    agentId: string;
    timestamp: number;
  };

  // Canvas update (goes to canvas)
  canvas: {
    // Operation type
    operation: "replace" | "patch" | "stream" | "reset";

    // Canvas ID (for versioning)
    canvasId: string;
    version: number;

    // Layout definition
    layout: CanvasLayoutDefinition;

    // Delta updates (for 'patch' operation)
    delta?: CanvasDelta[];

    // Streaming chunks (for 'stream' operation)
    chunks?: CanvasChunk[];
  };

  // Metadata
  metadata: {
    reasoning?: string; // Why agent chose this layout
    confidence: number; // 0-1
    fallback?: CanvasLayoutDefinition; // If main fails
  };
}
```

---

## 📦 Enhancement Components

### Enhancement 1: Layout Primitives

**New Schema Types:**

```typescript
// src/sdui/schema.ts additions

export const CanvasLayoutSchema = z.discriminatedUnion("type", [
  // Vertical split with ratio control
  z.object({
    type: z.literal("VerticalSplit"),
    ratios: z.array(z.number()).min(2).max(4),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
    gap: z.number().default(16),
  }),

  // Horizontal split
  z.object({
    type: z.literal("HorizontalSplit"),
    ratios: z.array(z.number()),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
    gap: z.number().default(16),
  }),

  // Grid layout
  z.object({
    type: z.literal("Grid"),
    columns: z.number().min(1).max(12),
    rows: z.number().optional(),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
    gap: z.number().default(16),
    responsive: z.boolean().default(true),
  }),

  // Dashboard panels
  z.object({
    type: z.literal("DashboardPanel"),
    title: z.string().optional(),
    collapsible: z.boolean().default(false),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
  }),

  // Component leaf node
  z.object({
    type: z.literal("Component"),
    componentId: z.string(), // Unique ID for patching
    component: z.string(),
    version: z.number().default(1),
    props: z.record(z.any()).default({}),
  }),
]);

export type CanvasLayout = z.infer<typeof CanvasLayoutSchema>;
```

**New Components:**

```typescript
// src/components/SDUI/CanvasLayout/VerticalSplit.tsx
export const VerticalSplit: React.FC<{
  ratios: number[];
  children: React.ReactNode[];
  gap?: number;
}> = ({ ratios, children, gap = 16 }) => {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full" style={{ gap: `${gap}px` }}>
      {children.map((child, i) => (
        <div
          key={i}
          style={{ flex: ratios[i] / totalRatio }}
          className="overflow-auto"
        >
          {child}
        </div>
      ))}
    </div>
  );
};

// Similar for HorizontalSplit, Grid, DashboardPanel...
```

---

### Enhancement 2: Delta/Patch Update System

**New File:** `src/sdui/canvas/CanvasPatcher.ts`

```typescript
/**
 * Canvas Delta Update System
 *
 * Allows agents to make surgical updates without re-rendering entire canvas
 */

export type PatchOperation =
  | { op: "replace"; path: string; value: any }
  | { op: "add"; path: string; value: any }
  | { op: "remove"; path: string }
  | { op: "update_props"; componentId: string; props: Record<string, any> }
  | { op: "update_data"; componentId: string; data: any };

export interface CanvasDelta {
  operations: PatchOperation[];
  reason?: string; // Why this update?
}

export class CanvasPatcher {
  /**
   * Apply delta patches to existing canvas state
   */
  static applyDelta(
    currentLayout: CanvasLayout,
    delta: CanvasDelta,
  ): CanvasLayout {
    let newLayout = JSON.parse(JSON.stringify(currentLayout));

    for (const op of delta.operations) {
      switch (op.op) {
        case "replace":
          newLayout = this.replaceAtPath(newLayout, op.path, op.value);
          break;
        case "add":
          newLayout = this.addAtPath(newLayout, op.path, op.value);
          break;
        case "remove":
          newLayout = this.removeAtPath(newLayout, op.path);
          break;
        case "update_props":
          newLayout = this.updateComponentProps(
            newLayout,
            op.componentId,
            op.props,
          );
          break;
        case "update_data":
          newLayout = this.updateComponentData(
            newLayout,
            op.componentId,
            op.data,
          );
          break;
      }
    }

    return newLayout;
  }

  /**
   * Update component props by ID (deep search)
   */
  private static updateComponentProps(
    layout: CanvasLayout,
    componentId: string,
    newProps: Record<string, any>,
  ): CanvasLayout {
    if (layout.type === "Component" && layout.componentId === componentId) {
      return { ...layout, props: { ...layout.props, ...newProps } };
    }

    if ("children" in layout) {
      return {
        ...layout,
        children: layout.children.map((child) =>
          this.updateComponentProps(child, componentId, newProps),
        ),
      };
    }

    return layout;
  }

  // ... other helper methods
}
```

---

### Enhancement 3: Bidirectional Event System

**New File:** `src/sdui/canvas/CanvasEventBus.ts`

```typescript
/**
 * Canvas → Agent Event System
 *
 * Allows canvas components to send events back to the agent
 */

export type CanvasEvent =
  | { type: "component_click"; componentId: string; data?: any }
  | { type: "value_change"; componentId: string; value: any }
  | { type: "drill_down"; metric: string; context: any }
  | { type: "filter_applied"; filters: Record<string, any> }
  | { type: "export_requested"; format: "pdf" | "csv" | "json" }
  | { type: "question"; question: string; context: any };

export interface CanvasEventPayload {
  event: CanvasEvent;
  canvasId: string;
  timestamp: number;
  sessionId?: string;
}

export class CanvasEventBus {
  private listeners: Array<(event: CanvasEventPayload) => void> = [];

  /**
   * Emit an event from canvas to agent
   */
  emit(event: CanvasEvent, canvasId: string, sessionId?: string): void {
    const payload: CanvasEventPayload = {
      event,
      canvasId,
      timestamp: Date.now(),
      sessionId,
    };

    // Notify all listeners (typically sends to chat agent)
    this.listeners.forEach((listener) => listener(payload));
  }

  /**
   * Subscribe to canvas events
   */
  subscribe(listener: (event: CanvasEventPayload) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }
}
```

**Usage in Components:**

```typescript
// src/components/SDUI/KPICard.tsx (enhanced)
import { useCanvasEvent } from '../../sdui/canvas/hooks';

export const KPICard: React.FC<KPICardProps> = ({
  componentId,
  title,
  value,
  trend
}) => {
  const emitEvent = useCanvasEvent();

  const handleClick = () => {
    emitEvent({
      type: 'drill_down',
      metric: title,
      context: { value, trend },
    }, componentId);
  };

  return (
    <div onClick={handleClick} className="cursor-pointer">
      {/* ... KPI display ... */}
    </div>
  );
};
```

---

### Enhancement 4: LLM Output Constraints

**New File:** `src/sdui/canvas/AgentConstraints.ts`

```typescript
/**
 * LLM Output Constraint System
 *
 * Prevents agents from hallucinating invalid components
 */

import { z } from "zod";

/**
 * Generate JSON Schema for OpenAI function calling
 * to constrain agent outputs to valid components
 */
export function generateAgentConstraintSchema(
  allowedComponents: string[],
): any {
  return {
    name: "update_canvas",
    description:
      "Update the value model canvas with charts, KPIs, and visualizations",
    parameters: {
      type: "object",
      properties: {
        layout: {
          type: "object",
          oneOf: [
            {
              type: "object",
              properties: {
                type: { const: "VerticalSplit" },
                ratios: {
                  type: "array",
                  items: { type: "number", minimum: 0 },
                  minItems: 2,
                  maxItems: 4,
                },
                children: {
                  type: "array",
                  items: { $ref: "#/definitions/CanvasNode" },
                },
              },
              required: ["type", "ratios", "children"],
            },
            // ... other layout types
            {
              type: "object",
              properties: {
                type: { const: "Component" },
                componentId: { type: "string" },
                component: {
                  enum: allowedComponents, // ⚡ CONSTRAINT
                },
                props: { type: "object" },
              },
              required: ["type", "component"],
            },
          ],
        },
      },
      definitions: {
        CanvasNode: {
          // ... recursive definition
        },
      },
    },
  };
}

/**
 * Validate agent output before applying to canvas
 */
export function validateAgentOutput(
  output: unknown,
  allowedComponents: string[],
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  function validateNode(node: any, path: string = "root"): void {
    if (node.type === "Component") {
      if (!allowedComponents.includes(node.component)) {
        errors.push(
          `Invalid component "${node.component}" at ${path}. ` +
            `Allowed components: ${allowedComponents.join(", ")}`,
        );
      }
    }

    if (node.children) {
      node.children.forEach((child: any, i: number) =>
        validateNode(child, `${path}.children[${i}]`),
      );
    }
  }

  try {
    validateNode(output);
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (e) {
    return { valid: false, errors: [(e as Error).message] };
  }
}
```

---

### Enhancement 5: Streaming/Optimistic UI

**New File:** `src/sdui/canvas/StreamingRenderer.tsx`

```typescript
/**
 * Streaming Canvas Renderer
 *
 * Renders canvas incrementally as agent generates layout
 */

import { useState, useEffect } from 'react';
import { CanvasLayout } from '../schema';

export interface StreamingCanvasProps {
  canvasId: string;
  onEvent?: (event: any) => void;
}

export const StreamingCanvas: React.FC<StreamingCanvasProps> = ({
  canvasId,
  onEvent
}) => {
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chunks, setChunks] = useState<Partial<CanvasLayout>[]>([]);

  useEffect(() => {
    // Connect to WebSocket for streaming updates
    const ws = new WebSocket(`/api/canvas/stream/${canvasId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'chunk') {
        // Optimistic: Show skeleton immediately
        setIsStreaming(true);
        setChunks(prev => [...prev, data.chunk]);
      } else if (data.type === 'complete') {
        // Final layout received
        setLayout(data.layout);
        setIsStreaming(false);
        setChunks([]);
      }
    };

    return () => ws.close();
  }, [canvasId]);

  if (isStreaming) {
    return <StreamingSkeletons chunks={chunks} />;
  }

  if (!layout) {
    return <EmptyCanvas message="Waiting for agent..." />;
  }

  return <CanvasRenderer layout={layout} onEvent={onEvent} />;
};

/**
 * Show skeleton loaders for streaming components
 */
const StreamingSkeletons: React.FC<{ chunks: Partial<CanvasLayout>[] }> = ({
  chunks
}) => {
  return (
    <div className="space-y-4">
      {chunks.map((chunk, i) => (
        <div key={i} className="animate-pulse">
          {chunk.type === 'Component' && chunk.component === 'LineChart' && (
            <div className="h-64 bg-gray-200 rounded"></div>
          )}
          {chunk.type === 'Component' && chunk.component === 'KPICard' && (
            <div className="h-32 bg-gray-200 rounded"></div>
          )}
          {/* ... other skeletons ... */}
        </div>
      ))}
    </div>
  );
};
```

---

### Enhancement 6: Canvas State Management

**New File:** `src/sdui/canvas/CanvasStore.ts`

```typescript
/**
 * Canvas State Management
 *
 * Maintains canvas history, undo/redo, versioning
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface CanvasState {
  // Current canvas
  current: CanvasLayout | null;
  canvasId: string | null;
  version: number;

  // History
  history: CanvasLayout[];
  historyIndex: number;

  // Actions
  setCanvas: (layout: CanvasLayout, canvasId: string) => void;
  patchCanvas: (delta: CanvasDelta) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;

  // Metadata
  lastUpdated: number;
  agentId?: string;
}

export const useCanvasStore = create<CanvasState>()(
  devtools(
    persist(
      (set, get) => ({
        current: null,
        canvasId: null,
        version: 0,
        history: [],
        historyIndex: -1,
        lastUpdated: 0,

        setCanvas: (layout, canvasId) =>
          set((state) => ({
            current: layout,
            canvasId,
            version: state.version + 1,
            history: [
              ...state.history.slice(0, state.historyIndex + 1),
              layout,
            ],
            historyIndex: state.historyIndex + 1,
            lastUpdated: Date.now(),
          })),

        patchCanvas: (delta) =>
          set((state) => {
            if (!state.current) return state;
            const newLayout = CanvasPatcher.applyDelta(state.current, delta);
            return {
              current: newLayout,
              version: state.version + 1,
              history: [
                ...state.history.slice(0, state.historyIndex + 1),
                newLayout,
              ],
              historyIndex: state.historyIndex + 1,
              lastUpdated: Date.now(),
            };
          }),

        undo: () =>
          set((state) => {
            if (state.historyIndex <= 0) return state;
            return {
              current: state.history[state.historyIndex - 1],
              historyIndex: state.historyIndex - 1,
            };
          }),

        redo: () =>
          set((state) => {
            if (state.historyIndex >= state.history.length - 1) return state;
            return {
              current: state.history[state.historyIndex + 1],
              historyIndex: state.historyIndex + 1,
            };
          }),

        reset: () =>
          set({
            current: null,
            canvasId: null,
            version: 0,
            history: [],
            historyIndex: -1,
            lastUpdated: 0,
          }),
      }),
      {
        name: "canvas-store",
        partialize: (state) => ({
          current: state.current,
          canvasId: state.canvasId,
          version: state.version,
        }),
      },
    ),
  ),
);
```

---

## 📋 Implementation Roadmap

### Phase 1: Layout Primitives (Week 1)

- [ ] Create `CanvasLayoutSchema` with VerticalSplit, HorizontalSplit, Grid
- [ ] Build layout components (VerticalSplit.tsx, etc.)
- [ ] Update renderer to support nested layouts
- [ ] Test with mock data

### Phase 2: Delta Updates (Week 1-2)

- [ ] Implement `CanvasPatcher` class
- [ ] Add `operation` field to canvas protocol
- [ ] Test patch operations
- [ ] Add undo/redo support

### Phase 3: Event System (Week 2)

- [ ] Create `CanvasEventBus`
- [ ] Add `useCanvasEvent` hook
- [ ] Update components to emit events
- [ ] Connect to chat agent

### Phase 4: Agent Constraints (Week 2-3)

- [ ] Generate OpenAI function calling schema
- [ ] Add validation layer
- [ ] Test with real LLM
- [ ] Add fallback for invalid outputs

### Phase 5: Streaming UI (Week 3)

- [ ] Implement `StreamingCanvas` component
- [ ] Add skeleton loaders
- [ ] Connect WebSocket streaming
- [ ] Test latency improvements

### Phase 6: Integration (Week 4)

- [ ] Connect chat sidebar to canvas
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation

---

## 🎨 Example Usage

### Agent Output Example

```typescript
// What the agent sends:
const agentResponse: AgentCanvasResponse = {
  message: {
    text: "I've created a projection showing how a 5% retention increase affects LTV. Notice the sharp growth in Q4.",
    agentId: "ltv-analyst",
    timestamp: Date.now(),
  },
  canvas: {
    operation: "replace",
    canvasId: "value_model_v2",
    version: 2,
    layout: {
      type: "VerticalSplit",
      ratios: [30, 70],
      gap: 16,
      children: [
        {
          type: "Component",
          componentId: "kpi_ltv",
          component: "KPICard",
          props: {
            title: "Projected LTV",
            value: "$4,500",
            trend: "+15%",
            trendColor: "green",
          },
        },
        {
          type: "Component",
          componentId: "chart_retention",
          component: "LineChart",
          props: {
            title: "Retention Sensitivity Analysis",
            series: [
              { name: "Baseline", points: [10, 20, 30, 40] },
              { name: "+5% Retention", points: [10, 25, 45, 70] },
            ],
            xAxis: { label: "Quarter", categories: ["Q1", "Q2", "Q3", "Q4"] },
            yAxis: { label: "LTV ($)", min: 0, max: 100 },
          },
        },
      ],
    },
  },
  metadata: {
    reasoning:
      "User asked about retention impact. Line chart best shows trend over time.",
    confidence: 0.95,
  },
};
```

### Canvas Component Usage

```typescript
// App.tsx
import { StreamingCanvas } from './sdui/canvas/StreamingRenderer';
import { useCanvasStore } from './sdui/canvas/CanvasStore';
import { CanvasEventBus } from './sdui/canvas/CanvasEventBus';

export const App: React.FC = () => {
  const eventBus = useMemo(() => new CanvasEventBus(), []);
  const canvasId = useCanvasStore(state => state.canvasId);

  // Send canvas events to chat agent
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(event => {
      // Send to agent via WebSocket/API
      sendToAgent({ type: 'canvas_event', event });
    });
    return unsubscribe;
  }, [eventBus]);

  return (
    <div className="flex h-screen">
      {/* Static chat sidebar */}
      <div className="w-1/3 border-r">
        <ChatSidebar onAgentResponse={handleAgentResponse} />
      </div>

      {/* Dynamic canvas */}
      <div className="w-2/3">
        <StreamingCanvas
          canvasId={canvasId || 'default'}
          onEvent={(e) => eventBus.emit(e, canvasId || 'default')}
        />
      </div>
    </div>
  );
};
```

---

## 🚀 Quick Wins

**Immediate Enhancements (Today):**

1. **Add Layout Components** - Create VerticalSplit, Grid
2. **Canvas Event Hook** - `useCanvasEvent()` for bidirectional events
3. **Agent Constraint Schema** - Generate JSON schema for OpenAI

**Next Sprint:**

4. **Delta Patcher** - Surgical updates without full re-renders
5. **Streaming Renderer** - Progressive loading with skeletons
6. **Canvas Store** - Undo/redo, history management

---

## 📚 Additional Resources

- **OpenAI Function Calling:** https://platform.openai.com/docs/guides/function-calling
- **JSON Schema Validator:** https://www.jsonschemavalidator.net/
- **React Virtualization:** https://github.com/bvaughn/react-window
- **WebSocket Streaming:** https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API

---

**Status:** 📋 Ready for Implementation
**Priority:** 🔥 High (Core feature for agentic use case)
**Complexity:** ⭐⭐⭐ Moderate (builds on existing SDUI foundation)

---
