"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDUIValidationError = exports.SDUIPageSchema = exports.SDUISectionSchema = exports.SDUIComponentSectionSchema = exports.SDUILayoutDirectiveSchema = exports.SDUIComponentVersionSchema = exports.SDUI_VERSION = void 0;
exports.normalizeComponentSection = normalizeComponentSection;
exports.normalizeSection = normalizeSection;
exports.validateSDUISchema = validateSDUISchema;
const zod_1 = require("zod");
exports.SDUI_VERSION = 2;
exports.SDUIComponentVersionSchema = zod_1.z.number().int().min(1);
const SDUIFallbackSchema = zod_1.z.object({
    message: zod_1.z.string().optional(),
    component: zod_1.z.string().optional(),
    props: zod_1.z.record(zod_1.z.any()).optional(),
});
// Layout directive for CoordinatorAgent
exports.SDUILayoutDirectiveSchema = zod_1.z.object({
    type: zod_1.z.literal("layout.directive"),
    intent: zod_1.z.string().min(1, "Intent is required"),
    component: zod_1.z.string().min(1, "Component name is required"),
    props: zod_1.z.record(zod_1.z.any()).default({}),
    layout: zod_1.z.enum(["default", "full_width", "two_column", "dashboard", "single_column"]).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.SDUIComponentSectionSchema = zod_1.z.object({
    type: zod_1.z.literal("component"),
    component: zod_1.z.string().min(1, "Component name is required"),
    version: exports.SDUIComponentVersionSchema.default(1),
    props: zod_1.z.record(zod_1.z.any()).default({}),
    hydrateWith: zod_1.z.array(zod_1.z.string()).optional(),
    fallback: SDUIFallbackSchema.optional(),
});
// Multi-tenant metadata schema with enhanced fields
const SDUIMetadataSchema = zod_1.z
    .object({
    debug: zod_1.z.boolean().optional(),
    cacheTtlSeconds: zod_1.z.number().int().positive().optional(),
    experienceId: zod_1.z.string().optional(),
    // Multi-tenant support
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
    theme: zod_1.z.enum(["dark", "light"]).default("dark"),
    featureFlags: zod_1.z.record(zod_1.z.boolean()).optional(),
    dataResidency: zod_1.z.enum(["us", "eu", "apac"]).optional(),
    // Phase 3: Enhanced metadata
    lifecycle_stage: zod_1.z.string().optional(), // e.g., 'opportunity', 'target', 'realization', 'expansion'
    case_id: zod_1.z.string().optional(), // Associated value case ID
    session_id: zod_1.z.string().optional(), // Workflow session ID
    generated_at: zod_1.z.number().optional(), // Unix timestamp
    agent_name: zod_1.z.string().optional(), // Which agent generated this
    confidence_score: zod_1.z.number().min(0).max(1).optional(), // AI confidence (0-1)
    // Performance hints
    estimated_render_time_ms: zod_1.z.number().positive().optional(),
    priority: zod_1.z.enum(["low", "normal", "high", "critical"]).optional(),
    // Component dependencies for lazy loading
    required_components: zod_1.z.array(zod_1.z.string()).optional(),
    optional_components: zod_1.z.array(zod_1.z.string()).optional(),
    // Accessibility
    accessibility: zod_1.z
        .object({
        level: zod_1.z.enum(["A", "AA", "AAA"]).optional(),
        screen_reader_optimized: zod_1.z.boolean().optional(),
        high_contrast_mode: zod_1.z.boolean().optional(),
        keyboard_navigation: zod_1.z.boolean().optional(),
    })
        .optional(),
    // Telemetry
    telemetry_enabled: zod_1.z.boolean().optional(),
    trace_id: zod_1.z.string().optional(),
    parent_span_id: zod_1.z.string().optional(),
    // SOF (System of Flows) features
    sofEnabled: zod_1.z.boolean().optional(),
    requiresClosedLoops: zod_1.z.boolean().optional(),
    supportsReplication: zod_1.z.boolean().optional(),
    requiresInterventions: zod_1.z.boolean().optional(),
    requiresOutcomeHypotheses: zod_1.z.boolean().optional(),
    requiresSystemMap: zod_1.z.boolean().optional(),
    requiresFeedbackLoops: zod_1.z.boolean().optional(),
    requiresGovernance: zod_1.z.boolean().optional(),
    tracksCompliance: zod_1.z.boolean().optional(),
    supportsAudit: zod_1.z.boolean().optional(),
})
    .optional();
// Union type for sections (component or layout directive)
exports.SDUISectionSchema = zod_1.z.union([exports.SDUIComponentSectionSchema, exports.SDUILayoutDirectiveSchema]);
// Multi-tenant page schema
exports.SDUIPageSchema = zod_1.z
    .object({
    type: zod_1.z.literal("page"),
    version: exports.SDUIComponentVersionSchema.default(1),
    // Multi-tenant identifiers
    tenantId: zod_1.z.string().optional(),
    organizationId: zod_1.z.string().optional(),
    sections: zod_1.z.array(exports.SDUISectionSchema).min(1, "At least one section is required"),
    metadata: SDUIMetadataSchema,
})
    .strict();
class SDUIValidationError extends Error {
    errors;
    constructor(message, errors) {
        super(message);
        this.errors = errors;
        this.name = "SDUIValidationError";
    }
}
exports.SDUIValidationError = SDUIValidationError;
const clampVersion = (version) => {
    if (!version || version < 1)
        return 1;
    if (version > exports.SDUI_VERSION)
        return exports.SDUI_VERSION;
    return version;
};
function normalizeComponentSection(section) {
    return {
        ...section,
        version: clampVersion(section.version),
        props: section.props ?? {},
    };
}
function normalizeSection(section) {
    if (section.type === "layout.directive") {
        return {
            ...section,
            props: section.props ?? {},
        };
    }
    return normalizeComponentSection(section);
}
function validateSDUISchema(payload) {
    if (!payload || typeof payload !== "object") {
        return { success: false, errors: ["Payload must be an object"] };
    }
    const parsed = exports.SDUIPageSchema.safeParse(payload);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
        return { success: false, errors: issues };
    }
    const normalizedSections = parsed.data.sections.map(normalizeSection);
    const warnings = [];
    if (parsed.data.version > exports.SDUI_VERSION) {
        warnings.push(`Layout version ${parsed.data.version} is newer than supported (${exports.SDUI_VERSION}). Using ${exports.SDUI_VERSION}.`);
    }
    return {
        success: true,
        page: {
            ...parsed.data,
            version: clampVersion(parsed.data.version),
            sections: normalizedSections,
        },
        warnings,
    };
}
//# sourceMappingURL=schema.js.map