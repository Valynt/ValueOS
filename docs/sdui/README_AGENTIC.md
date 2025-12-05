# Agentic Canvas SDUI - Quick Reference

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

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `types.ts` | Type definitions for canvas system | 450 | ✅ Complete |
| `CanvasPatcher.ts` | Delta update system | 327 | ✅ Complete |
| `CanvasEventBus.ts` | Bidirectional event system | 150 | ✅ Complete |
| `hooks.tsx` | React hooks for canvas | 75 | ✅ Complete |

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

| Operation | When to Use | Example |
|-----------|-------------|---------|
| `replace` | Initial render or major change | Full dashboard |
| `patch` | Small update (e.g., change one value) | Update KPI trend |
| `stream` | Progressive loading | Show skeleton → fill data |
| `reset` | Clear canvas | Start new conversation |

### Delta Operations

| Op | Effect | Example |
|----|--------|---------|
| `update_props` | Change component props | Update KPI trend |
| `update_data` | Replace component data | New chart series |
| `add` | Add new component | Add detail table |
| `remove` | Delete component | Remove old chart |
| `reorder` | Change order | Move KPI to top |
| `replace` | Replace at path | Swap chart type |

### Canvas Events

| Event | Triggered When | Use Case |
|-------|----------------|----------|
| `component_click` | User clicks component | Drill down |
| `value_change` | User edits value | Update assumption |
| `drill_down` | User wants detail | Show breakdown |
| `filter_applied` | User filters data | Refine view |
| `export_requested` | User wants export | Generate PDF |
| `question` | User asks question | Agent responds |

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
import { CanvasPatcher } from '../sdui/canvas/CanvasPatcher';

test('update KPI props', () => {
  const layout = { /* ... */ };
  const delta: CanvasDelta = {
    operations: [
      { op: 'update_props', componentId: 'kpi_1', props: { trend: '+20%' } }
    ],
    timestamp: Date.now()
  };
  
  const newLayout = CanvasPatcher.applyDelta(layout, delta);
  const kpi = CanvasPatcher.findComponentById(newLayout, 'kpi_1');
  
  expect(kpi?.props.trend).toBe('+20%');
});
```

### Test Event Bus

```typescript
import { CanvasEventBus } from '../sdui/canvas/CanvasEventBus';

test('emit and receive events', () => {
  const eventBus = new CanvasEventBus();
  const received: CanvasEventPayload[] = [];
  
  eventBus.subscribe((event) => received.push(event));
  
  eventBus.emit({
    type: 'component_click',
    componentId: 'kpi_1',
  }, 'canvas_v1');
  
  expect(received).toHaveLength(1);
  expect(received[0].event.type).toBe('component_click');
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
