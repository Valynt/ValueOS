# Agentic Canvas Enhancement Plan

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
    operation: 'replace' | 'patch' | 'stream' | 'reset';
    
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
    reasoning?: string;  // Why agent chose this layout
    confidence: number;  // 0-1
    fallback?: CanvasLayoutDefinition;  // If main fails
  };
}
```

---

## 📦 Enhancement Components

### Enhancement 1: Layout Primitives

**New Schema Types:**

```typescript
// src/sdui/schema.ts additions

export const CanvasLayoutSchema = z.discriminatedUnion('type', [
  // Vertical split with ratio control
  z.object({
    type: z.literal('VerticalSplit'),
    ratios: z.array(z.number()).min(2).max(4),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
    gap: z.number().default(16),
  }),
  
  // Horizontal split
  z.object({
    type: z.literal('HorizontalSplit'),
    ratios: z.array(z.number()),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
    gap: z.number().default(16),
  }),
  
  // Grid layout
  z.object({
    type: z.literal('Grid'),
    columns: z.number().min(1).max(12),
    rows: z.number().optional(),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
    gap: z.number().default(16),
    responsive: z.boolean().default(true),
  }),
  
  // Dashboard panels
  z.object({
    type: z.literal('DashboardPanel'),
    title: z.string().optional(),
    collapsible: z.boolean().default(false),
    children: z.array(z.lazy(() => CanvasLayoutSchema)),
  }),
  
  // Component leaf node
  z.object({
    type: z.literal('Component'),
    componentId: z.string(),  // Unique ID for patching
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
  | { op: 'replace'; path: string; value: any }
  | { op: 'add'; path: string; value: any }
  | { op: 'remove'; path: string }
  | { op: 'update_props'; componentId: string; props: Record<string, any> }
  | { op: 'update_data'; componentId: string; data: any };

export interface CanvasDelta {
  operations: PatchOperation[];
  reason?: string;  // Why this update?
}

export class CanvasPatcher {
  /**
   * Apply delta patches to existing canvas state
   */
  static applyDelta(
    currentLayout: CanvasLayout,
    delta: CanvasDelta
  ): CanvasLayout {
    let newLayout = JSON.parse(JSON.stringify(currentLayout));
    
    for (const op of delta.operations) {
      switch (op.op) {
        case 'replace':
          newLayout = this.replaceAtPath(newLayout, op.path, op.value);
          break;
        case 'add':
          newLayout = this.addAtPath(newLayout, op.path, op.value);
          break;
        case 'remove':
          newLayout = this.removeAtPath(newLayout, op.path);
          break;
        case 'update_props':
          newLayout = this.updateComponentProps(newLayout, op.componentId, op.props);
          break;
        case 'update_data':
          newLayout = this.updateComponentData(newLayout, op.componentId, op.data);
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
    newProps: Record<string, any>
  ): CanvasLayout {
    if (layout.type === 'Component' && layout.componentId === componentId) {
      return { ...layout, props: { ...layout.props, ...newProps } };
    }
    
    if ('children' in layout) {
      return {
        ...layout,
        children: layout.children.map(child =>
          this.updateComponentProps(child, componentId, newProps)
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
  | { type: 'component_click'; componentId: string; data?: any }
  | { type: 'value_change'; componentId: string; value: any }
  | { type: 'drill_down'; metric: string; context: any }
  | { type: 'filter_applied'; filters: Record<string, any> }
  | { type: 'export_requested'; format: 'pdf' | 'csv' | 'json' }
  | { type: 'question'; question: string; context: any };

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
    this.listeners.forEach(listener => listener(payload));
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

import { z } from 'zod';

/**
 * Generate JSON Schema for OpenAI function calling
 * to constrain agent outputs to valid components
 */
export function generateAgentConstraintSchema(
  allowedComponents: string[]
): any {
  return {
    name: 'update_canvas',
    description: 'Update the value model canvas with charts, KPIs, and visualizations',
    parameters: {
      type: 'object',
      properties: {
        layout: {
          type: 'object',
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { const: 'VerticalSplit' },
                ratios: {
                  type: 'array',
                  items: { type: 'number', minimum: 0 },
                  minItems: 2,
                  maxItems: 4,
                },
                children: {
                  type: 'array',
                  items: { $ref: '#/definitions/CanvasNode' },
                },
              },
              required: ['type', 'ratios', 'children'],
            },
            // ... other layout types
            {
              type: 'object',
              properties: {
                type: { const: 'Component' },
                componentId: { type: 'string' },
                component: { 
                  enum: allowedComponents,  // ⚡ CONSTRAINT
                },
                props: { type: 'object' },
              },
              required: ['type', 'component'],
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
  allowedComponents: string[]
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  function validateNode(node: any, path: string = 'root'): void {
    if (node.type === 'Component') {
      if (!allowedComponents.includes(node.component)) {
        errors.push(
          `Invalid component "${node.component}" at ${path}. ` +
          `Allowed components: ${allowedComponents.join(', ')}`
        );
      }
    }
    
    if (node.children) {
      node.children.forEach((child: any, i: number) =>
        validateNode(child, `${path}.children[${i}]`)
      );
    }
  }
  
  try {
    validateNode(output);
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
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

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

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
            history: [...state.history.slice(0, state.historyIndex + 1), layout],
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
              history: [...state.history.slice(0, state.historyIndex + 1), newLayout],
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
        name: 'canvas-store',
        partialize: (state) => ({ 
          current: state.current,
          canvasId: state.canvasId,
          version: state.version,
        }),
      }
    )
  )
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
    operation: 'replace',
    canvasId: 'value_model_v2',
    version: 2,
    layout: {
      type: 'VerticalSplit',
      ratios: [30, 70],
      gap: 16,
      children: [
        {
          type: 'Component',
          componentId: 'kpi_ltv',
          component: 'KPICard',
          props: {
            title: 'Projected LTV',
            value: '$4,500',
            trend: '+15%',
            trendColor: 'green',
          },
        },
        {
          type: 'Component',
          componentId: 'chart_retention',
          component: 'LineChart',
          props: {
            title: 'Retention Sensitivity Analysis',
            series: [
              { name: 'Baseline', points: [10, 20, 30, 40] },
              { name: '+5% Retention', points: [10, 25, 45, 70] },
            ],
            xAxis: { label: 'Quarter', categories: ['Q1', 'Q2', 'Q3', 'Q4'] },
            yAxis: { label: 'LTV ($)', min: 0, max: 100 },
          },
        },
      ],
    },
  },
  metadata: {
    reasoning: "User asked about retention impact. Line chart best shows trend over time.",
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
