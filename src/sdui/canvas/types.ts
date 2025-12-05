/**
 * Canvas Types for Agentic SDUI
 * 
 * Types for chat-driven canvas updates, delta operations, and bidirectional events
 */

import { z } from 'zod';

// ============================================================================
// Layout Primitives
// ============================================================================

export const CanvasLayoutSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion('type', [
    // Vertical split with ratio control
    z.object({
      type: z.literal('VerticalSplit'),
      ratios: z.array(z.number()).min(2).max(4),
      children: z.array(CanvasLayoutSchema),
      gap: z.number().default(16),
    }),

    // Horizontal split
    z.object({
      type: z.literal('HorizontalSplit'),
      ratios: z.array(z.number()),
      children: z.array(CanvasLayoutSchema),
      gap: z.number().default(16),
    }),

    // Grid layout
    z.object({
      type: z.literal('Grid'),
      columns: z.number().min(1).max(12),
      rows: z.number().optional(),
      children: z.array(CanvasLayoutSchema),
      gap: z.number().default(16),
      responsive: z.boolean().default(true),
    }),

    // Dashboard panel
    z.object({
      type: z.literal('DashboardPanel'),
      title: z.string().optional(),
      collapsible: z.boolean().default(false),
      children: z.array(CanvasLayoutSchema),
    }),

    // Component leaf node
    z.object({
      type: z.literal('Component'),
      componentId: z.string(), // Unique ID for patching
      component: z.string(),
      version: z.number().default(1),
      props: z.record(z.any()).default({}),
    }),
  ])
);

export type CanvasLayout = z.infer<typeof CanvasLayoutSchema>;

// ============================================================================
// Agent Protocol
// ============================================================================

/**
 * Agent response format for canvas updates
 */
export interface AgentCanvasResponse {
  // Chat message (displayed in sidebar)
  message: {
    text: string;
    agentId: string;
    timestamp: number;
    reasoning?: string; // Internal reasoning (optional display)
  };

  // Canvas update (applied to canvas)
  canvas: {
    // Operation type
    operation: 'replace' | 'patch' | 'stream' | 'reset';

    // Canvas versioning
    canvasId: string;
    version: number;

    // Layout definition (for 'replace' or initial 'stream')
    layout?: CanvasLayout;

    // Delta updates (for 'patch' operation)
    delta?: CanvasDelta;

    // Streaming chunks (for 'stream' operation)
    chunks?: CanvasChunk[];
  };

  // Metadata
  metadata: {
    reasoning?: string; // Why agent chose this layout
    confidence: number; // 0-1
    fallback?: CanvasLayout; // If main layout fails
    estimatedRenderTime?: number; // ms
  };
}

/**
 * Streaming chunk (partial canvas update)
 */
export interface CanvasChunk {
  chunkId: string;
  path: string; // Where in layout tree
  content: Partial<CanvasLayout>;
  complete: boolean;
}

// ============================================================================
// Delta/Patch Operations
// ============================================================================

/**
 * Operation types for delta updates
 */
export type PatchOperation =
  | { op: 'replace'; path: string; value: any }
  | { op: 'add'; path: string; value: any }
  | { op: 'remove'; path: string }
  | { op: 'update_props'; componentId: string; props: Record<string, any> }
  | { op: 'update_data'; componentId: string; data: any }
  | { op: 'reorder'; parentPath: string; fromIndex: number; toIndex: number };

/**
 * Canvas delta (multiple patch operations)
 */
export interface CanvasDelta {
  operations: PatchOperation[];
  reason?: string; // Why this update?
  timestamp: number;
}

// ============================================================================
// Bidirectional Events
// ============================================================================

/**
 * Events emitted from canvas to agent
 */
export type CanvasEvent =
  | { type: 'component_click'; componentId: string; data?: any }
  | { type: 'value_change'; componentId: string; value: any }
  | { type: 'drill_down'; metric: string; context: any }
  | { type: 'filter_applied'; filters: Record<string, any> }
  | { type: 'export_requested'; format: 'pdf' | 'csv' | 'json' }
  | { type: 'question'; question: string; context: any }
  | { type: 'undo_requested' }
  | { type: 'redo_requested' };

/**
 * Event payload sent to agent
 */
export interface CanvasEventPayload {
  event: CanvasEvent;
  canvasId: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
}

// ============================================================================
// Agent Constraints
// ============================================================================

/**
 * Allowed component types (prevents hallucination)
 */
export const ALLOWED_CANVAS_COMPONENTS = [
  // Charts
  'LineChart',
  'BarChart',
  'PieChart',
  'AreaChart',
  'ScatterPlot',

  // KPIs & Metrics
  'KPICard',
  'MetricBadge',
  'MetricGrid',
  'TrendIndicator',

  // Value Model
  'ValueTreeCard',
  'ROICalculator',
  'AssumptionCard',
  'RealizationDashboard',

  // Tables & Data
  'DataTable',
  'ComparisonTable',

  // Displays
  'InfoBanner',
  'NarrativeBlock',
  'ConfidenceIndicator',

  // Forms
  'KPIForm',
  'ValueCommitForm',
] as const;

export type AllowedCanvasComponent = (typeof ALLOWED_CANVAS_COMPONENTS)[number];

/**
 * Component prop schemas (for validation)
 */
export const COMPONENT_PROP_SCHEMAS: Record<string, z.ZodType<any>> = {
  KPICard: z.object({
    title: z.string(),
    value: z.union([z.string(), z.number()]),
    trend: z.string().optional(),
    trendColor: z.enum(['green', 'red', 'gray']).optional(),
    subtitle: z.string().optional(),
  }),

  LineChart: z.object({
    title: z.string(),
    series: z.array(
      z.object({
        name: z.string(),
        points: z.array(z.number()),
        color: z.string().optional(),
      })
    ),
    xAxis: z.object({
      label: z.string(),
      categories: z.array(z.string()).optional(),
    }),
    yAxis: z.object({
      label: z.string(),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
  }),

  DataTable: z.object({
    data: z.array(z.record(z.any())),
    columns: z.array(
      z.object({
        key: z.string(),
        header: z.string(),
        sortable: z.boolean().optional(),
      })
    ),
    pageSize: z.number().default(10),
  }),

  // ... add schemas for other components
};

// ============================================================================
// Canvas State
// ============================================================================

/**
 * Canvas state for Zustand store
 */
export interface CanvasState {
  // Current canvas
  current: CanvasLayout | null;
  canvasId: string | null;
  version: number;

  // History
  history: CanvasLayout[];
  historyIndex: number;

  // Streaming state
  isStreaming: boolean;
  streamChunks: CanvasChunk[];

  // Metadata
  lastUpdated: number;
  agentId?: string;

  // Actions
  setCanvas: (layout: CanvasLayout, canvasId: string, agentId?: string) => void;
  patchCanvas: (delta: CanvasDelta) => void;
  startStreaming: () => void;
  addStreamChunk: (chunk: CanvasChunk) => void;
  completeStreaming: (finalLayout: CanvasLayout) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;

  // Queries
  canUndo: () => boolean;
  canRedo: () => boolean;
  getComponentById: (componentId: string) => CanvasLayout | null;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation result for agent output
 */
export interface AgentOutputValidation {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  sanitized?: CanvasLayout; // Sanitized version if fixable
}

/**
 * OpenAI function calling schema
 */
export interface AgentFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    definitions?: Record<string, any>;
  };
}
