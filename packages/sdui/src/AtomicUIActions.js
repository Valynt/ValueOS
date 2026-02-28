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
 * Zod schemas for validation
 */
export const ComponentSelectorSchema = z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    index: z.number().optional(),
    props: z.record(z.any()).optional(),
    description: z.string().optional(),
}).refine((data) => data.id || data.type || data.index !== undefined || data.description, { message: 'At least one selector field must be provided' });
export const PropertyMutationSchema = z.object({
    path: z.string().min(1),
    operation: z.enum(['set', 'merge', 'append', 'prepend', 'remove', 'replace']),
    value: z.any().optional(),
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
        props: z.record(z.any()),
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
export const AtomicUIActionSchema = z.union([
    NonBatchActionSchema,
    BatchActionSchema,
]);
/**
 * Validate atomic UI action
 */
export function validateAtomicAction(action) {
    try {
        AtomicUIActionSchema.parse(action);
        return { valid: true, errors: [] };
    }
    catch (error) {
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
export function createMutateAction(selector, mutations, description) {
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
export function createPropertyUpdate(selector, propertyPath, value, description) {
    return createMutateAction(selector, [{ path: propertyPath, operation: 'set', value }], description);
}
/**
 * Create an add component action
 */
export function createAddAction(component, position, description) {
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
export function createRemoveAction(selector, description) {
    return {
        type: 'remove_component',
        selector,
        description,
    };
}
/**
 * Create a batch action
 */
export function createBatchAction(actions, description) {
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
    changeChartType: createPropertyUpdate({ type: 'InteractiveChart', description: 'ROI chart' }, 'props.type', 'bar', 'Change ROI chart to bar graph'),
    // Update metric value
    updateMetricValue: createPropertyUpdate({ type: 'StatCard', props: { title: 'Revenue' } }, 'props.value', '$1.5M', 'Update revenue metric'),
    // Change color scheme
    changeColors: createMutateAction({ type: 'InteractiveChart' }, [
        { path: 'props.data[0].color', operation: 'set', value: '#10b981' },
        { path: 'props.data[1].color', operation: 'set', value: '#3b82f6' },
    ], 'Update chart colors'),
    // Add new metric card
    addMetricCard: createAddAction({
        component: 'StatCard',
        props: {
            label: 'New Metric',
            value: '100',
            icon: 'trending-up',
        },
    }, { append: true }, 'Add new metric card'),
    // Remove component
    removeChart: createRemoveAction({ type: 'InteractiveChart', index: 2 }, 'Remove third chart'),
    // Reorder components
    reorderDashboard: {
        type: 'reorder_components',
        order: [2, 0, 1],
        description: 'Move third component to first position',
    },
    // Batch update
    updateDashboard: createBatchAction([
        createPropertyUpdate({ type: 'StatCard', index: 0 }, 'props.value', '$2M', 'Update first metric'),
        createPropertyUpdate({ type: 'StatCard', index: 1 }, 'props.value', '85%', 'Update second metric'),
    ], 'Update all metrics'),
};
export default AtomicUIActionSchema;
//# sourceMappingURL=AtomicUIActions.js.map