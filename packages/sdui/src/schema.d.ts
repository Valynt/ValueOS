import { z } from "zod";
export declare const SDUI_VERSION: 2;
export declare const SDUIComponentVersionSchema: z.ZodNumber;
export declare const SDUILayoutDirectiveSchema: z.ZodObject<{
    type: z.ZodLiteral<"layout.directive">;
    intent: z.ZodString;
    component: z.ZodString;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    layout: z.ZodOptional<z.ZodEnum<["default", "full_width", "two_column", "dashboard", "single_column"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    component?: string;
    type?: "layout.directive";
    metadata?: Record<string, any>;
    layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
    props?: Record<string, any>;
    intent?: string;
}, {
    component?: string;
    type?: "layout.directive";
    metadata?: Record<string, any>;
    layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
    props?: Record<string, any>;
    intent?: string;
}>;
export declare const SDUIComponentSectionSchema: z.ZodObject<{
    type: z.ZodLiteral<"component">;
    component: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    hydrateWith: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    fallback: z.ZodOptional<z.ZodObject<{
        message: z.ZodOptional<z.ZodString>;
        component: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    }, {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    }>>;
}, "strip", z.ZodTypeAny, {
    component?: string;
    type?: "component";
    version?: number;
    fallback?: {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    };
    props?: Record<string, any>;
    hydrateWith?: string[];
}, {
    component?: string;
    type?: "component";
    version?: number;
    fallback?: {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    };
    props?: Record<string, any>;
    hydrateWith?: string[];
}>;
export declare const SDUISectionSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"component">;
    component: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    hydrateWith: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    fallback: z.ZodOptional<z.ZodObject<{
        message: z.ZodOptional<z.ZodString>;
        component: z.ZodOptional<z.ZodString>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    }, {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    }>>;
}, "strip", z.ZodTypeAny, {
    component?: string;
    type?: "component";
    version?: number;
    fallback?: {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    };
    props?: Record<string, any>;
    hydrateWith?: string[];
}, {
    component?: string;
    type?: "component";
    version?: number;
    fallback?: {
        message?: string;
        component?: string;
        props?: Record<string, any>;
    };
    props?: Record<string, any>;
    hydrateWith?: string[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"layout.directive">;
    intent: z.ZodString;
    component: z.ZodString;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    layout: z.ZodOptional<z.ZodEnum<["default", "full_width", "two_column", "dashboard", "single_column"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    component?: string;
    type?: "layout.directive";
    metadata?: Record<string, any>;
    layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
    props?: Record<string, any>;
    intent?: string;
}, {
    component?: string;
    type?: "layout.directive";
    metadata?: Record<string, any>;
    layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
    props?: Record<string, any>;
    intent?: string;
}>]>;
export declare const SDUIPageSchema: z.ZodObject<{
    type: z.ZodLiteral<"page">;
    version: z.ZodDefault<z.ZodNumber>;
    tenantId: z.ZodOptional<z.ZodString>;
    organizationId: z.ZodOptional<z.ZodString>;
    sections: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"component">;
        component: z.ZodString;
        version: z.ZodDefault<z.ZodNumber>;
        props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        hydrateWith: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        fallback: z.ZodOptional<z.ZodObject<{
            message: z.ZodOptional<z.ZodString>;
            component: z.ZodOptional<z.ZodString>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            message?: string;
            component?: string;
            props?: Record<string, any>;
        }, {
            message?: string;
            component?: string;
            props?: Record<string, any>;
        }>>;
    }, "strip", z.ZodTypeAny, {
        component?: string;
        type?: "component";
        version?: number;
        fallback?: {
            message?: string;
            component?: string;
            props?: Record<string, any>;
        };
        props?: Record<string, any>;
        hydrateWith?: string[];
    }, {
        component?: string;
        type?: "component";
        version?: number;
        fallback?: {
            message?: string;
            component?: string;
            props?: Record<string, any>;
        };
        props?: Record<string, any>;
        hydrateWith?: string[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"layout.directive">;
        intent: z.ZodString;
        component: z.ZodString;
        props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        layout: z.ZodOptional<z.ZodEnum<["default", "full_width", "two_column", "dashboard", "single_column"]>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        component?: string;
        type?: "layout.directive";
        metadata?: Record<string, any>;
        layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
        props?: Record<string, any>;
        intent?: string;
    }, {
        component?: string;
        type?: "layout.directive";
        metadata?: Record<string, any>;
        layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
        props?: Record<string, any>;
        intent?: string;
    }>]>, "many">;
    metadata: z.ZodOptional<z.ZodObject<{
        debug: z.ZodOptional<z.ZodBoolean>;
        cacheTtlSeconds: z.ZodOptional<z.ZodNumber>;
        experienceId: z.ZodOptional<z.ZodString>;
        permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        theme: z.ZodDefault<z.ZodEnum<["dark", "light"]>>;
        featureFlags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
        dataResidency: z.ZodOptional<z.ZodEnum<["us", "eu", "apac"]>>;
        lifecycle_stage: z.ZodOptional<z.ZodString>;
        case_id: z.ZodOptional<z.ZodString>;
        session_id: z.ZodOptional<z.ZodString>;
        generated_at: z.ZodOptional<z.ZodNumber>;
        agent_name: z.ZodOptional<z.ZodString>;
        confidence_score: z.ZodOptional<z.ZodNumber>;
        estimated_render_time_ms: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodEnum<["low", "normal", "high", "critical"]>>;
        required_components: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        optional_components: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        accessibility: z.ZodOptional<z.ZodObject<{
            level: z.ZodOptional<z.ZodEnum<["A", "AA", "AAA"]>>;
            screen_reader_optimized: z.ZodOptional<z.ZodBoolean>;
            high_contrast_mode: z.ZodOptional<z.ZodBoolean>;
            keyboard_navigation: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            level?: "A" | "AA" | "AAA";
            screen_reader_optimized?: boolean;
            high_contrast_mode?: boolean;
            keyboard_navigation?: boolean;
        }, {
            level?: "A" | "AA" | "AAA";
            screen_reader_optimized?: boolean;
            high_contrast_mode?: boolean;
            keyboard_navigation?: boolean;
        }>>;
        telemetry_enabled: z.ZodOptional<z.ZodBoolean>;
        trace_id: z.ZodOptional<z.ZodString>;
        parent_span_id: z.ZodOptional<z.ZodString>;
        sofEnabled: z.ZodOptional<z.ZodBoolean>;
        requiresClosedLoops: z.ZodOptional<z.ZodBoolean>;
        supportsReplication: z.ZodOptional<z.ZodBoolean>;
        requiresInterventions: z.ZodOptional<z.ZodBoolean>;
        requiresOutcomeHypotheses: z.ZodOptional<z.ZodBoolean>;
        requiresSystemMap: z.ZodOptional<z.ZodBoolean>;
        requiresFeedbackLoops: z.ZodOptional<z.ZodBoolean>;
        requiresGovernance: z.ZodOptional<z.ZodBoolean>;
        tracksCompliance: z.ZodOptional<z.ZodBoolean>;
        supportsAudit: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        debug?: boolean;
        session_id?: string;
        trace_id?: string;
        permissions?: string[];
        priority?: "critical" | "high" | "low" | "normal";
        case_id?: string;
        lifecycle_stage?: string;
        confidence_score?: number;
        dataResidency?: "us" | "eu" | "apac";
        featureFlags?: Record<string, boolean>;
        cacheTtlSeconds?: number;
        experienceId?: string;
        theme?: "dark" | "light";
        generated_at?: number;
        agent_name?: string;
        estimated_render_time_ms?: number;
        required_components?: string[];
        optional_components?: string[];
        accessibility?: {
            level?: "A" | "AA" | "AAA";
            screen_reader_optimized?: boolean;
            high_contrast_mode?: boolean;
            keyboard_navigation?: boolean;
        };
        telemetry_enabled?: boolean;
        parent_span_id?: string;
        sofEnabled?: boolean;
        requiresClosedLoops?: boolean;
        supportsReplication?: boolean;
        requiresInterventions?: boolean;
        requiresOutcomeHypotheses?: boolean;
        requiresSystemMap?: boolean;
        requiresFeedbackLoops?: boolean;
        requiresGovernance?: boolean;
        tracksCompliance?: boolean;
        supportsAudit?: boolean;
    }, {
        debug?: boolean;
        session_id?: string;
        trace_id?: string;
        permissions?: string[];
        priority?: "critical" | "high" | "low" | "normal";
        case_id?: string;
        lifecycle_stage?: string;
        confidence_score?: number;
        dataResidency?: "us" | "eu" | "apac";
        featureFlags?: Record<string, boolean>;
        cacheTtlSeconds?: number;
        experienceId?: string;
        theme?: "dark" | "light";
        generated_at?: number;
        agent_name?: string;
        estimated_render_time_ms?: number;
        required_components?: string[];
        optional_components?: string[];
        accessibility?: {
            level?: "A" | "AA" | "AAA";
            screen_reader_optimized?: boolean;
            high_contrast_mode?: boolean;
            keyboard_navigation?: boolean;
        };
        telemetry_enabled?: boolean;
        parent_span_id?: string;
        sofEnabled?: boolean;
        requiresClosedLoops?: boolean;
        supportsReplication?: boolean;
        requiresInterventions?: boolean;
        requiresOutcomeHypotheses?: boolean;
        requiresSystemMap?: boolean;
        requiresFeedbackLoops?: boolean;
        requiresGovernance?: boolean;
        tracksCompliance?: boolean;
        supportsAudit?: boolean;
    }>>;
}, "strict", z.ZodTypeAny, {
    tenantId?: string;
    type?: "page";
    metadata?: {
        debug?: boolean;
        session_id?: string;
        trace_id?: string;
        permissions?: string[];
        priority?: "critical" | "high" | "low" | "normal";
        case_id?: string;
        lifecycle_stage?: string;
        confidence_score?: number;
        dataResidency?: "us" | "eu" | "apac";
        featureFlags?: Record<string, boolean>;
        cacheTtlSeconds?: number;
        experienceId?: string;
        theme?: "dark" | "light";
        generated_at?: number;
        agent_name?: string;
        estimated_render_time_ms?: number;
        required_components?: string[];
        optional_components?: string[];
        accessibility?: {
            level?: "A" | "AA" | "AAA";
            screen_reader_optimized?: boolean;
            high_contrast_mode?: boolean;
            keyboard_navigation?: boolean;
        };
        telemetry_enabled?: boolean;
        parent_span_id?: string;
        sofEnabled?: boolean;
        requiresClosedLoops?: boolean;
        supportsReplication?: boolean;
        requiresInterventions?: boolean;
        requiresOutcomeHypotheses?: boolean;
        requiresSystemMap?: boolean;
        requiresFeedbackLoops?: boolean;
        requiresGovernance?: boolean;
        tracksCompliance?: boolean;
        supportsAudit?: boolean;
    };
    version?: number;
    organizationId?: string;
    sections?: ({
        component?: string;
        type?: "layout.directive";
        metadata?: Record<string, any>;
        layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
        props?: Record<string, any>;
        intent?: string;
    } | {
        component?: string;
        type?: "component";
        version?: number;
        fallback?: {
            message?: string;
            component?: string;
            props?: Record<string, any>;
        };
        props?: Record<string, any>;
        hydrateWith?: string[];
    })[];
}, {
    tenantId?: string;
    type?: "page";
    metadata?: {
        debug?: boolean;
        session_id?: string;
        trace_id?: string;
        permissions?: string[];
        priority?: "critical" | "high" | "low" | "normal";
        case_id?: string;
        lifecycle_stage?: string;
        confidence_score?: number;
        dataResidency?: "us" | "eu" | "apac";
        featureFlags?: Record<string, boolean>;
        cacheTtlSeconds?: number;
        experienceId?: string;
        theme?: "dark" | "light";
        generated_at?: number;
        agent_name?: string;
        estimated_render_time_ms?: number;
        required_components?: string[];
        optional_components?: string[];
        accessibility?: {
            level?: "A" | "AA" | "AAA";
            screen_reader_optimized?: boolean;
            high_contrast_mode?: boolean;
            keyboard_navigation?: boolean;
        };
        telemetry_enabled?: boolean;
        parent_span_id?: string;
        sofEnabled?: boolean;
        requiresClosedLoops?: boolean;
        supportsReplication?: boolean;
        requiresInterventions?: boolean;
        requiresOutcomeHypotheses?: boolean;
        requiresSystemMap?: boolean;
        requiresFeedbackLoops?: boolean;
        requiresGovernance?: boolean;
        tracksCompliance?: boolean;
        supportsAudit?: boolean;
    };
    version?: number;
    organizationId?: string;
    sections?: ({
        component?: string;
        type?: "layout.directive";
        metadata?: Record<string, any>;
        layout?: "default" | "dashboard" | "full_width" | "two_column" | "single_column";
        props?: Record<string, any>;
        intent?: string;
    } | {
        component?: string;
        type?: "component";
        version?: number;
        fallback?: {
            message?: string;
            component?: string;
            props?: Record<string, any>;
        };
        props?: Record<string, any>;
        hydrateWith?: string[];
    })[];
}>;
export type SDUILayoutDirective = z.infer<typeof SDUILayoutDirectiveSchema>;
export type SDUIComponentSection = z.infer<typeof SDUIComponentSectionSchema>;
export type SDUISection = z.infer<typeof SDUISectionSchema>;
export type SDUIPageDefinition = z.infer<typeof SDUIPageSchema>;
export type SDUIValidationResult = {
    success: true;
    page: SDUIPageDefinition;
    warnings: string[];
} | {
    success: false;
    errors: string[];
};
export declare class SDUIValidationError extends Error {
    readonly errors: string[];
    constructor(message: string, errors: string[]);
}
export declare function normalizeComponentSection(section: SDUIComponentSection): SDUIComponentSection;
export declare function normalizeSection(section: SDUISection): SDUISection;
export declare function validateSDUISchema(payload: unknown): SDUIValidationResult;
//# sourceMappingURL=schema.d.ts.map