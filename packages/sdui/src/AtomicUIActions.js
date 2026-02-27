"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_ACTIONS = exports.AtomicUIActionSchema = exports.UpdateLayoutActionSchema = exports.ReorderComponentsActionSchema = exports.RemoveComponentActionSchema = exports.AddComponentActionSchema = exports.MutateComponentActionSchema = exports.PropertyMutationSchema = exports.ComponentSelectorSchema = void 0;
exports.validateAtomicAction = validateAtomicAction;
exports.createMutateAction = createMutateAction;
exports.createPropertyUpdate = createPropertyUpdate;
exports.createAddAction = createAddAction;
exports.createRemoveAction = createRemoveAction;
exports.createBatchAction = createBatchAction;
const zod_1 = require("zod");
/**
 * Zod schemas for validation
 */
exports.ComponentSelectorSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    type: zod_1.z.string().optional(),
    index: zod_1.z.number().optional(),
    props: zod_1.z.record(zod_1.z.any()).optional(),
    description: zod_1.z.string().optional(),
}).refine((data) => data.id || data.type || data.index !== undefined || data.description, { message: 'At least one selector field must be provided' });
exports.PropertyMutationSchema = zod_1.z.object({
    path: zod_1.z.string().min(1),
    operation: zod_1.z.enum(['set', 'merge', 'append', 'prepend', 'remove', 'replace']),
    value: zod_1.z.any().optional(),
});
exports.MutateComponentActionSchema = zod_1.z.object({
    type: zod_1.z.literal('mutate_component'),
    selector: exports.ComponentSelectorSchema,
    mutations: zod_1.z.array(exports.PropertyMutationSchema).min(1),
    description: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.AddComponentActionSchema = zod_1.z.object({
    type: zod_1.z.literal('add_component'),
    component: zod_1.z.object({
        component: zod_1.z.string(),
        version: zod_1.z.string().optional(),
        props: zod_1.z.record(zod_1.z.any()),
        type: zod_1.z.string().optional(),
        layout: zod_1.z.string().optional(),
    }),
    position: zod_1.z.object({
        index: zod_1.z.number().optional(),
        before: exports.ComponentSelectorSchema.optional(),
        after: exports.ComponentSelectorSchema.optional(),
        append: zod_1.z.boolean().optional(),
    }),
    description: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.RemoveComponentActionSchema = zod_1.z.object({
    type: zod_1.z.literal('remove_component'),
    selector: exports.ComponentSelectorSchema,
    description: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.ReorderComponentsActionSchema = zod_1.z.object({
    type: zod_1.z.literal('reorder_components'),
    order: zod_1.z.array(zod_1.z.union([zod_1.z.string(), zod_1.z.number()])).min(1),
    description: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.UpdateLayoutActionSchema = zod_1.z.object({
    type: zod_1.z.literal('update_layout'),
    layout: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
// Non-batch actions discriminated union (no circular reference)
const NonBatchActionSchema = zod_1.z.discriminatedUnion('type', [
    exports.MutateComponentActionSchema,
    exports.AddComponentActionSchema,
    exports.RemoveComponentActionSchema,
    exports.ReorderComponentsActionSchema,
    exports.UpdateLayoutActionSchema,
]);
// Batch action schema with explicit type literal
const BatchActionSchema = zod_1.z.object({
    type: zod_1.z.literal('batch'),
    actions: zod_1.z.array(zod_1.z.lazy(() => exports.AtomicUIActionSchema)),
    description: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
// Combined schema using union (not discriminatedUnion to avoid lazy issues)
exports.AtomicUIActionSchema = zod_1.z.union([
    NonBatchActionSchema,
    BatchActionSchema,
]);
/**
 * Validate atomic UI action
 */
function validateAtomicAction(action) {
    try {
        exports.AtomicUIActionSchema.parse(action);
        return { valid: true, errors: [] };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
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
function createMutateAction(selector, mutations, description) {
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
function createPropertyUpdate(selector, propertyPath, value, description) {
    return createMutateAction(selector, [{ path: propertyPath, operation: 'set', value }], description);
}
/**
 * Create an add component action
 */
function createAddAction(component, position, description) {
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
function createRemoveAction(selector, description) {
    return {
        type: 'remove_component',
        selector,
        description,
    };
}
/**
 * Create a batch action
 */
function createBatchAction(actions, description) {
    return {
        type: 'batch',
        actions,
        description,
    };
}
/**
 * Example actions for common use cases
 */
exports.EXAMPLE_ACTIONS = {
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
exports.default = exports.AtomicUIActionSchema;
//# sourceMappingURL=AtomicUIActions.js.map