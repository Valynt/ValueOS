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
    component: string;
    type: "layout.directive";
    props: Record<string, any>;
    intent: string;
    metadata?: Record<string, any> | undefined;
    layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
}, {
    component: string;
    type: "layout.directive";
    intent: string;
    metadata?: Record<string, any> | undefined;
    layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
    props?: Record<string, any> | undefined;
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
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    }, {
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    component: string;
    type: "component";
    version: number;
    props: Record<string, any>;
    fallback?: {
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    } | undefined;
    hydrateWith?: string[] | undefined;
}, {
    component: string;
    type: "component";
    version?: number | undefined;
    fallback?: {
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    } | undefined;
    props?: Record<string, any> | undefined;
    hydrateWith?: string[] | undefined;
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
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    }, {
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    component: string;
    type: "component";
    version: number;
    props: Record<string, any>;
    fallback?: {
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    } | undefined;
    hydrateWith?: string[] | undefined;
}, {
    component: string;
    type: "component";
    version?: number | undefined;
    fallback?: {
        message?: string | undefined;
        component?: string | undefined;
        props?: Record<string, any> | undefined;
    } | undefined;
    props?: Record<string, any> | undefined;
    hydrateWith?: string[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"layout.directive">;
    intent: z.ZodString;
    component: z.ZodString;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    layout: z.ZodOptional<z.ZodEnum<["default", "full_width", "two_column", "dashboard", "single_column"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    component: string;
    type: "layout.directive";
    props: Record<string, any>;
    intent: string;
    metadata?: Record<string, any> | undefined;
    layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
}, {
    component: string;
    type: "layout.directive";
    intent: string;
    metadata?: Record<string, any> | undefined;
    layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
    props?: Record<string, any> | undefined;
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
            message?: string | undefined;
            component?: string | undefined;
            props?: Record<string, any> | undefined;
        }, {
            message?: string | undefined;
            component?: string | undefined;
            props?: Record<string, any> | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        component: string;
        type: "component";
        version: number;
        props: Record<string, any>;
        fallback?: {
            message?: string | undefined;
            component?: string | undefined;
            props?: Record<string, any> | undefined;
        } | undefined;
        hydrateWith?: string[] | undefined;
    }, {
        component: string;
        type: "component";
        version?: number | undefined;
        fallback?: {
            message?: string | undefined;
            component?: string | undefined;
            props?: Record<string, any> | undefined;
        } | undefined;
        props?: Record<string, any> | undefined;
        hydrateWith?: string[] | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"layout.directive">;
        intent: z.ZodString;
        component: z.ZodString;
        props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        layout: z.ZodOptional<z.ZodEnum<["default", "full_width", "two_column", "dashboard", "single_column"]>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        component: string;
        type: "layout.directive";
        props: Record<string, any>;
        intent: string;
        metadata?: Record<string, any> | undefined;
        layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
    }, {
        component: string;
        type: "layout.directive";
        intent: string;
        metadata?: Record<string, any> | undefined;
        layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
        props?: Record<string, any> | undefined;
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
            level?: "A" | "AA" | "AAA" | undefined;
            screen_reader_optimized?: boolean | undefined;
            high_contrast_mode?: boolean | undefined;
            keyboard_navigation?: boolean | undefined;
        }, {
            level?: "A" | "AA" | "AAA" | undefined;
            screen_reader_optimized?: boolean | undefined;
            high_contrast_mode?: boolean | undefined;
            keyboard_navigation?: boolean | undefined;
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
        theme: "dark" | "light";
        debug?: boolean | undefined;
        permissions?: string[] | undefined;
        session_id?: string | undefined;
        trace_id?: string | undefined;
        priority?: "critical" | "low" | "high" | "normal" | undefined;
        confidence_score?: number | undefined;
        agent_name?: string | undefined;
        lifecycle_stage?: string | undefined;
        case_id?: string | undefined;
        dataResidency?: "us" | "eu" | "apac" | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        cacheTtlSeconds?: number | undefined;
        experienceId?: string | undefined;
        generated_at?: number | undefined;
        estimated_render_time_ms?: number | undefined;
        required_components?: string[] | undefined;
        optional_components?: string[] | undefined;
        accessibility?: {
            level?: "A" | "AA" | "AAA" | undefined;
            screen_reader_optimized?: boolean | undefined;
            high_contrast_mode?: boolean | undefined;
            keyboard_navigation?: boolean | undefined;
        } | undefined;
        telemetry_enabled?: boolean | undefined;
        parent_span_id?: string | undefined;
        sofEnabled?: boolean | undefined;
        requiresClosedLoops?: boolean | undefined;
        supportsReplication?: boolean | undefined;
        requiresInterventions?: boolean | undefined;
        requiresOutcomeHypotheses?: boolean | undefined;
        requiresSystemMap?: boolean | undefined;
        requiresFeedbackLoops?: boolean | undefined;
        requiresGovernance?: boolean | undefined;
        tracksCompliance?: boolean | undefined;
        supportsAudit?: boolean | undefined;
    }, {
        debug?: boolean | undefined;
        permissions?: string[] | undefined;
        session_id?: string | undefined;
        trace_id?: string | undefined;
        priority?: "critical" | "low" | "high" | "normal" | undefined;
        confidence_score?: number | undefined;
        agent_name?: string | undefined;
        lifecycle_stage?: string | undefined;
        case_id?: string | undefined;
        dataResidency?: "us" | "eu" | "apac" | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        cacheTtlSeconds?: number | undefined;
        experienceId?: string | undefined;
        theme?: "dark" | "light" | undefined;
        generated_at?: number | undefined;
        estimated_render_time_ms?: number | undefined;
        required_components?: string[] | undefined;
        optional_components?: string[] | undefined;
        accessibility?: {
            level?: "A" | "AA" | "AAA" | undefined;
            screen_reader_optimized?: boolean | undefined;
            high_contrast_mode?: boolean | undefined;
            keyboard_navigation?: boolean | undefined;
        } | undefined;
        telemetry_enabled?: boolean | undefined;
        parent_span_id?: string | undefined;
        sofEnabled?: boolean | undefined;
        requiresClosedLoops?: boolean | undefined;
        supportsReplication?: boolean | undefined;
        requiresInterventions?: boolean | undefined;
        requiresOutcomeHypotheses?: boolean | undefined;
        requiresSystemMap?: boolean | undefined;
        requiresFeedbackLoops?: boolean | undefined;
        requiresGovernance?: boolean | undefined;
        tracksCompliance?: boolean | undefined;
        supportsAudit?: boolean | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    type: "page";
    version: number;
    sections: ({
        component: string;
        type: "layout.directive";
        props: Record<string, any>;
        intent: string;
        metadata?: Record<string, any> | undefined;
        layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
    } | {
        component: string;
        type: "component";
        version: number;
        props: Record<string, any>;
        fallback?: {
            message?: string | undefined;
            component?: string | undefined;
            props?: Record<string, any> | undefined;
        } | undefined;
        hydrateWith?: string[] | undefined;
    })[];
    tenantId?: string | undefined;
    metadata?: {
        theme: "dark" | "light";
        debug?: boolean | undefined;
        permissions?: string[] | undefined;
        session_id?: string | undefined;
        trace_id?: string | undefined;
        priority?: "critical" | "low" | "high" | "normal" | undefined;
        confidence_score?: number | undefined;
        agent_name?: string | undefined;
        lifecycle_stage?: string | undefined;
        case_id?: string | undefined;
        dataResidency?: "us" | "eu" | "apac" | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        cacheTtlSeconds?: number | undefined;
        experienceId?: string | undefined;
        generated_at?: number | undefined;
        estimated_render_time_ms?: number | undefined;
        required_components?: string[] | undefined;
        optional_components?: string[] | undefined;
        accessibility?: {
            level?: "A" | "AA" | "AAA" | undefined;
            screen_reader_optimized?: boolean | undefined;
            high_contrast_mode?: boolean | undefined;
            keyboard_navigation?: boolean | undefined;
        } | undefined;
        telemetry_enabled?: boolean | undefined;
        parent_span_id?: string | undefined;
        sofEnabled?: boolean | undefined;
        requiresClosedLoops?: boolean | undefined;
        supportsReplication?: boolean | undefined;
        requiresInterventions?: boolean | undefined;
        requiresOutcomeHypotheses?: boolean | undefined;
        requiresSystemMap?: boolean | undefined;
        requiresFeedbackLoops?: boolean | undefined;
        requiresGovernance?: boolean | undefined;
        tracksCompliance?: boolean | undefined;
        supportsAudit?: boolean | undefined;
    } | undefined;
    organizationId?: string | undefined;
}, {
    type: "page";
    sections: ({
        component: string;
        type: "layout.directive";
        intent: string;
        metadata?: Record<string, any> | undefined;
        layout?: "default" | "full_width" | "two_column" | "dashboard" | "single_column" | undefined;
        props?: Record<string, any> | undefined;
    } | {
        component: string;
        type: "component";
        version?: number | undefined;
        fallback?: {
            message?: string | undefined;
            component?: string | undefined;
            props?: Record<string, any> | undefined;
        } | undefined;
        props?: Record<string, any> | undefined;
        hydrateWith?: string[] | undefined;
    })[];
    tenantId?: string | undefined;
    metadata?: {
        debug?: boolean | undefined;
        permissions?: string[] | undefined;
        session_id?: string | undefined;
        trace_id?: string | undefined;
        priority?: "critical" | "low" | "high" | "normal" | undefined;
        confidence_score?: number | undefined;
        agent_name?: string | undefined;
        lifecycle_stage?: string | undefined;
        case_id?: string | undefined;
        dataResidency?: "us" | "eu" | "apac" | undefined;
        featureFlags?: Record<string, boolean> | undefined;
        cacheTtlSeconds?: number | undefined;
        experienceId?: string | undefined;
        theme?: "dark" | "light" | undefined;
        generated_at?: number | undefined;
        estimated_render_time_ms?: number | undefined;
        required_components?: string[] | undefined;
        optional_components?: string[] | undefined;
        accessibility?: {
            level?: "A" | "AA" | "AAA" | undefined;
            screen_reader_optimized?: boolean | undefined;
            high_contrast_mode?: boolean | undefined;
            keyboard_navigation?: boolean | undefined;
        } | undefined;
        telemetry_enabled?: boolean | undefined;
        parent_span_id?: string | undefined;
        sofEnabled?: boolean | undefined;
        requiresClosedLoops?: boolean | undefined;
        supportsReplication?: boolean | undefined;
        requiresInterventions?: boolean | undefined;
        requiresOutcomeHypotheses?: boolean | undefined;
        requiresSystemMap?: boolean | undefined;
        requiresFeedbackLoops?: boolean | undefined;
        requiresGovernance?: boolean | undefined;
        tracksCompliance?: boolean | undefined;
        supportsAudit?: boolean | undefined;
    } | undefined;
    version?: number | undefined;
    organizationId?: string | undefined;
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