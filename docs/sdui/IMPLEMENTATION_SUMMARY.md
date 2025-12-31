# Agentic Canvas SDUI - Implementation Summary

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
    { op: 'update_props', componentId: 'kpi_1', props: { trend: '+20%' } }
  ],
  reason: 'User updated retention assumption',
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
  sendToAgent({ type: 'canvas_event', payload: event });
});

// Emit (in canvas component)
eventBus.emit({
  type: 'drill_down',
  metric: 'revenue',
  context: { quarter: 'Q4' },
}, 'canvas_v1');
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

### 2. Create Your First Layout Component

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
import { useCanvasEvent } from '../../sdui/canvas/hooks';

export const KPICard: React.FC<KPICardProps & { componentId: string }> = ({ 
  componentId,
  title, 
  value, 
  trend 
}) => {
  const emitEvent = useCanvasEvent(componentId);
  
  return (
    <div 
      onClick={() => emitEvent({
        type: 'drill_down',
        metric: title,
        context: { value, trend }
      })}
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
    timestamp: Date.now()
  },
  canvas: {
    operation: 'replace',
    canvasId: 'test_canvas',
    version: 1,
    layout: {
      type: 'VerticalSplit',
      ratios: [30, 70],
      gap: 16,
      children: [
        {
          type: 'Component',
          componentId: 'kpi_1',
          component: 'KPICard',
          version: 1,
          props: { title: 'Revenue', value: '$1.2M', trend: '+15%' }
        },
        {
          type: 'Component',
          componentId: 'chart_1',
          component: 'LineChart',
          version: 1,
          props: { /* chart config */ }
        }
      ]
    }
  },
  metadata: {
    confidence: 0.95
  }
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
