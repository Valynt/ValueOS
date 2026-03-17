/**
 * Atomic UI Actions for Partial Mutations
 * 
 * Enables snappy, responsive UI updates without full page regeneration.
 * Instead of regenerating the entire SDUI layout, agents can apply surgical
 * patches to specific components.
 * 
 * Example:
 * User: "Change the ROI chart to a bar graph"
 * Agent: mutateComponent('comp_123', { type: 'bar' })
 * Result: Only the chart type changes, rest of page untouched
 */

import { z } from 'zod';

/**
 * Atomic UI action types
 */
export type AtomicActionType =
  | 'mutate_component'      // Modify component props
  | 'add_component'         // Add new component
  | 'remove_component'      // Remove component
  | 'reorder_components'    // Change component order
  | 'update_layout'         // Change layout directive
  | 'batch';                // Execute multiple actions

/**
 * Component selector for targeting
 */
export interface ComponentSelector {
  /**
   * Component ID (most specific)
   */
  id?: string;

  /**
   * Component type (e.g., 'StatCard', 'InteractiveChart')
   */
  type?: string;

  /**
   * Component index in sections array
   */
  index?: number;

  /**
   * Props to match (partial match)
   */
  props?: Record<string, unknown>;

  /**
   * Natural language description for fuzzy matching
   */
  description?: string;
}

/**
 * Mutation operation types
 */
export type MutationOperation =
  | 'set'      // Set property value
  | 'merge'    // Merge with existing value (for objects)
  | 'append'   // Append to array
  | 'prepend'  // Prepend to array
  | 'remove'   // Remove property
  | 'replace'; // Replace entire props object

/**
 * Property mutation
 */
export interface PropertyMutation {
  /**
   * Path to property (e.g., 'props.title', 'props.data[0].value')
   */
  path: string;

  /**
   * Operation to perform
   */
  operation: MutationOperation;

  /**
   * New value
   */
  value?: unknown;
}

/**
 * Mutate Component Action
 */
export interface MutateComponentAction {
  type: 'mutate_component';
  
  /**
   * Component selector
   */
  selector: ComponentSelector;

  /**
   * Property mutations to apply
   */
  mutations: PropertyMutation[];

  /**
   * Human-readable description of the change
   */
  description?: string;

  /**
   * Idempotency key for deduplication
   */
  idempotencyKey?: string;
}

/**
 * Add Component Action
 */
export interface AddComponentAction {
  type: 'add_component';

  /**
   * Component to add
   */
  component: {
    component: string;
    version?: string;
    props: Record<string, unknown>;
    type?: string;
    layout?: string;
  };

  /**
   * Position to insert
   */
  position: {
    /**
     * Insert at specific index
     */
    index?: number;

    /**
     * Insert before component matching selector
     */
    before?: ComponentSelector;

    /**
     * Insert after component matching selector
     */
    after?: ComponentSelector;

    /**
     * Append to end
     */
    append?: boolean;
  };

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Idempotency key for deduplication
   */
  idempotencyKey?: string;
}

/**
 * Remove Component Action
 */
export interface RemoveComponentAction {
  type: 'remove_component';

  /**
   * Component selector
   */
  selector: ComponentSelector;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Idempotency key for deduplication
   */
  idempotencyKey?: string;
}

/**
 * Reorder Components Action
 */
export interface ReorderComponentsAction {
  type: 'reorder_components';

  /**
   * New order (array of component IDs or indices)
   */
  order: Array<string | number>;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Idempotency key for deduplication
   */
  idempotencyKey?: string;
}

/**
 * Update Layout Action
 */
export interface UpdateLayoutAction {
  type: 'update_layout';

  /**
   * Layout directive to update
   */
  layout: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Idempotency key for deduplication
   */
  idempotencyKey?: string;
}

/**
 * Batch Action (execute multiple actions atomically)
 */
export interface BatchAction {
  type: 'batch';

  /**
   * Actions to execute in order
   */
  actions: AtomicUIAction[];

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Idempotency key for deduplication
   */
  idempotencyKey?: string;

  /** Execute all actions atomically — roll back on any failure. */
  atomic?: boolean;

  /** Reason for the batch — used for audit logging. */
  reason?: string;
}

/**
 * Union type for all atomic actions
 */
export type AtomicUIAction =
  | MutateComponentAction
  | AddComponentAction
  | RemoveComponentAction
  | ReorderComponentsAction
  | UpdateLayoutAction
  | BatchAction;

/**
 * Action execution result
 */
export interface ActionResult {
  /**
   * Whether the action succeeded
   */
  success: boolean;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Components affected by the action
   */
  affected_components: string[];

  /**
   * Human-readable description of what changed
   */
  changes_made: string[];

  /**
   * Execution time in milliseconds
   */
  duration_ms: number;
}

/**
 * Zod schemas for validation
 */

export const ComponentSelectorSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  index: z.number().optional(),
  props: z.record(z.unknown()).optional(),
  description: z.string().optional(),
}).refine(
  (data) => data.id || data.type || data.index !== undefined || data.description,
  { message: 'At least one selector field must be provided' }
);

export const PropertyMutationSchema = z.object({
  path: z.string().min(1),
  operation: z.enum(['set', 'merge', 'append', 'prepend', 'remove', 'replace']),
  value: z.unknown().optional(),
});

export const MutateComponentActionSchema = z.object({
  type: z.literal('mutate_component'),
  selector: ComponentSelectorSchema,
  mutations: z.array(PropertyMutationSchema).min(1),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const AddComponentActionSchema = z.object({
  type: z.literal('add_component'),
  component: z.object({
    component: z.string(),
    version: z.string().optional(),
    props: z.record(z.unknown()),
    type: z.string().optional(),
    layout: z.string().optional(),
  }),
  position: z.object({
    index: z.number().optional(),
    before: ComponentSelectorSchema.optional(),
    after: ComponentSelectorSchema.optional(),
    append: z.boolean().optional(),
  }),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const RemoveComponentActionSchema = z.object({
  type: z.literal('remove_component'),
  selector: ComponentSelectorSchema,
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const ReorderComponentsActionSchema = z.object({
  type: z.literal('reorder_components'),
  order: z.array(z.union([z.string(), z.number()])).min(1),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const UpdateLayoutActionSchema = z.object({
  type: z.literal('update_layout'),
  layout: z.string(),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// Non-batch actions discriminated union (no circular reference)
const NonBatchActionSchema = z.discriminatedUnion('type', [
  MutateComponentActionSchema,
  AddComponentActionSchema,
  RemoveComponentActionSchema,
  ReorderComponentsActionSchema,
  UpdateLayoutActionSchema,
]);

// Batch action schema with explicit type literal
const BatchActionSchema = z.object({
  type: z.literal('batch'),
  actions: z.array(z.lazy(() => AtomicUIActionSchema)),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

// Combined schema using union (not discriminatedUnion to avoid lazy issues)
export const AtomicUIActionSchema: z.ZodType<AtomicUIAction> = z.union([
  NonBatchActionSchema,
  BatchActionSchema,
]);

/**
 * Validate atomic UI action
 */
export function validateAtomicAction(action: unknown): {
  valid: boolean;
  errors: string[];
} {
  try {
    AtomicUIActionSchema.parse(action);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Helper functions for creating actions
 */

/**
 * Create a mutate component action
 */
export function createMutateAction(
  selector: ComponentSelector,
  mutations: PropertyMutation[],
  description?: string
): MutateComponentAction {
  return {
    type: 'mutate_component',
    selector,
    mutations,
    description,
  };
}

/**
 * Create a simple property update action
 */
export function createPropertyUpdate(
  selector: ComponentSelector,
  propertyPath: string,
  value: unknown,
  description?: string
): MutateComponentAction {
  return createMutateAction(
    selector,
    [{ path: propertyPath, operation: 'set', value }],
    description
  );
}

/**
 * Create an add component action
 */
export function createAddAction(
  component: AddComponentAction['component'],
  position: AddComponentAction['position'],
  description?: string
): AddComponentAction {
  return {
    type: 'add_component',
    component,
    position,
    description,
  };
}

/**
 * Create a remove component action
 */
export function createRemoveAction(
  selector: ComponentSelector,
  description?: string
): RemoveComponentAction {
  return {
    type: 'remove_component',
    selector,
    description,
  };
}

/**
 * Create a batch action
 */
export function createBatchAction(
  actions: AtomicUIAction[],
  description?: string
): BatchAction {
  return {
    type: 'batch',
    actions,
    description,
  };
}

/**
 * Example actions for common use cases
 */
export const EXAMPLE_ACTIONS = {
  // Change chart type
  changeChartType: createPropertyUpdate(
    { type: 'InteractiveChart', description: 'ROI chart' },
    'props.type',
    'bar',
    'Change ROI chart to bar graph'
  ),

  // Update metric value
  updateMetricValue: createPropertyUpdate(
    { type: 'StatCard', props: { title: 'Revenue' } },
    'props.value',
    '$1.5M',
    'Update revenue metric'
  ),

  // Change color scheme
  changeColors: createMutateAction(
    { type: 'InteractiveChart' },
    [
      { path: 'props.data[0].color', operation: 'set', value: '#10b981' },
      { path: 'props.data[1].color', operation: 'set', value: '#3b82f6' },
    ],
    'Update chart colors'
  ),

  // Add new metric card
  addMetricCard: createAddAction(
    {
      component: 'StatCard',
      props: {
        label: 'New Metric',
        value: '100',
        icon: 'trending-up',
      },
    },
    { append: true },
    'Add new metric card'
  ),

  // Remove component
  removeChart: createRemoveAction(
    { type: 'InteractiveChart', index: 2 },
    'Remove third chart'
  ),

  // Reorder components
  reorderDashboard: {
    type: 'reorder_components' as const,
    order: [2, 0, 1],
    description: 'Move third component to first position',
  },

  // Batch update
  updateDashboard: createBatchAction(
    [
      createPropertyUpdate(
        { type: 'StatCard', index: 0 },
        'props.value',
        '$2M',
        'Update first metric'
      ),
      createPropertyUpdate(
        { type: 'StatCard', index: 1 },
        'props.value',
        '85%',
        'Update second metric'
      ),
    ],
    'Update all metrics'
  ),
} as const;

export default AtomicUIActionSchema;

// ---------------------------------------------------------------------------
// AtomicUIActions class — imperative API for layout mutations
// ---------------------------------------------------------------------------

import type { SDUIPageDefinition, SDUIComponentSection } from "./schema";

type SimpleSelector = { id?: string; type?: string; index?: number };

type MutationResult =
  | { success: true; layout: SDUIPageDefinition }
  | { success: false; error: string };

type BatchOp =
  | { type: "mutate_component"; selector: SimpleSelector; props: Record<string, unknown> }
  | { type: "add_component"; section: Partial<SDUIComponentSection> }
  | { type: "remove_component"; selector: SimpleSelector }
  | { type: "reorder_components"; order: number[] };

function findIndex(sections: SDUIComponentSection[], selector: SimpleSelector): number {
  if (selector.index !== undefined) return selector.index;
  return sections.findIndex((s) => {
    if (selector.id && s.props?.id === selector.id) return true;
    if (selector.type && s.component === selector.type) return true;
    return false;
  });
}

export class AtomicUIActions {
  mutateComponent(
    layout: SDUIPageDefinition,
    selector: SimpleSelector,
    props: Record<string, unknown>
  ): MutationResult {
    const sections = layout.sections as SDUIComponentSection[];
    const idx = findIndex(sections, selector);
    if (idx === -1) {
      return { success: false, error: `Component not found: ${JSON.stringify(selector)}` };
    }
    const updated = sections.map((s, i) =>
      i === idx ? { ...s, props: { ...s.props, ...props } } : s
    );
    return { success: true, layout: { ...layout, sections: updated } };
  }

  addComponent(
    layout: SDUIPageDefinition,
    section: Partial<SDUIComponentSection>
  ): MutationResult {
    const newSection: SDUIComponentSection = {
      type: "component",
      component: section.component ?? "Unknown",
      props: section.props ?? {},
      version: section.version ?? 1,
      ...section,
    };
    return {
      success: true,
      layout: { ...layout, sections: [...(layout.sections as SDUIComponentSection[]), newSection] },
    };
  }

  removeComponent(
    layout: SDUIPageDefinition,
    selector: ComponentSelector
  ): MutationResult {
    const sections = layout.sections as SDUIComponentSection[];
    const idx = findIndex(sections, selector);
    if (idx === -1) {
      return { success: false, error: `Component not found: ${JSON.stringify(selector)}` };
    }
    return {
      success: true,
      layout: { ...layout, sections: sections.filter((_, i) => i !== idx) },
    };
  }

  reorderComponents(layout: SDUIPageDefinition, order: number[]): MutationResult {
    const sections = layout.sections as SDUIComponentSection[];
    if (order.length !== sections.length) {
      return { success: false, error: "Order length must match sections length" };
    }
    const reordered = order.map((i) => sections[i]!).filter((s): s is SDUIComponentSection => s !== undefined);
    return { success: true, layout: { ...layout, sections: reordered } };
  }

  batch(layout: SDUIPageDefinition, ops: BatchOp[]): MutationResult {
    let current = layout;
    for (const op of ops) {
      let result: MutationResult;
      if (op.type === "mutate_component") {
        result = this.mutateComponent(current, op.selector, op.props);
      } else if (op.type === "add_component") {
        result = this.addComponent(current, op.section);
      } else if (op.type === "remove_component") {
        result = this.removeComponent(current, op.selector);
      } else if (op.type === "reorder_components") {
        result = this.reorderComponents(current, op.order);
      } else {
        return { success: false, error: `Unknown op type` };
      }
      if (!result.success) return result;
      current = result.layout;
    }
    return { success: true, layout: current };
  }
}