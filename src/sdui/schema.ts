import { z } from 'zod';

export const SDUI_VERSION = 2 as const;

export const SDUIComponentVersionSchema = z.number().int().min(1);

const SDUIFallbackSchema = z.object({
  message: z.string().optional(),
  component: z.string().optional(),
  props: z.record(z.any()).optional(),
});

// Layout directive for CoordinatorAgent
export const SDUILayoutDirectiveSchema = z.object({
  type: z.literal('layout.directive'),
  intent: z.string().min(1, 'Intent is required'),
  component: z.string().min(1, 'Component name is required'),
  props: z.record(z.any()).default({}),
  layout: z.enum(['default', 'full_width', 'two_column', 'dashboard', 'single_column']).optional(),
  metadata: z.record(z.any()).optional(),
});

export const SDUIComponentSectionSchema = z.object({
  type: z.literal('component'),
  component: z.string().min(1, 'Component name is required'),
  version: SDUIComponentVersionSchema.default(1),
  props: z.record(z.any()).default({}),
  hydrateWith: z.array(z.string()).optional(),
  fallback: SDUIFallbackSchema.optional(),
});

// Multi-tenant metadata schema with enhanced fields
const SDUIMetadataSchema = z.object({
  debug: z.boolean().optional(),
  cacheTtlSeconds: z.number().int().positive().optional(),
  experienceId: z.string().optional(),
  // Multi-tenant support
  permissions: z.array(z.string()).optional(),
  theme: z.enum(['dark', 'light']).default('dark'),
  featureFlags: z.record(z.boolean()).optional(),
  dataResidency: z.enum(['us', 'eu', 'apac']).optional(),
  // Phase 3: Enhanced metadata
  lifecycle_stage: z.string().optional(), // e.g., 'opportunity', 'target', 'realization', 'expansion'
  case_id: z.string().optional(), // Associated value case ID
  session_id: z.string().optional(), // Workflow session ID
  generated_at: z.number().optional(), // Unix timestamp
  agent_name: z.string().optional(), // Which agent generated this
  confidence_score: z.number().min(0).max(1).optional(), // AI confidence (0-1)
  // Performance hints
  estimated_render_time_ms: z.number().positive().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  // Component dependencies for lazy loading
  required_components: z.array(z.string()).optional(),
  optional_components: z.array(z.string()).optional(),
  // Accessibility
  accessibility: z.object({
    level: z.enum(['A', 'AA', 'AAA']).optional(),
    screen_reader_optimized: z.boolean().optional(),
    high_contrast_mode: z.boolean().optional(),
    keyboard_navigation: z.boolean().optional(),
  }).optional(),
  // Telemetry
  telemetry_enabled: z.boolean().optional(),
  trace_id: z.string().optional(),
  parent_span_id: z.string().optional(),
}).optional();

// Union type for sections (component or layout directive)
export const SDUISectionSchema = z.union([
  SDUIComponentSectionSchema,
  SDUILayoutDirectiveSchema,
]);

// Multi-tenant page schema
export const SDUIPageSchema = z.object({
  type: z.literal('page'),
  version: SDUIComponentVersionSchema.default(1),
  // Multi-tenant identifiers
  tenantId: z.string().optional(),
  organizationId: z.string().optional(),
  sections: z.array(SDUISectionSchema).min(1, 'At least one section is required'),
  metadata: SDUIMetadataSchema,
}).strict();

export type SDUILayoutDirective = z.infer<typeof SDUILayoutDirectiveSchema>;
export type SDUIComponentSection = z.infer<typeof SDUIComponentSectionSchema>;
export type SDUISection = z.infer<typeof SDUISectionSchema>;
export type SDUIPageDefinition = z.infer<typeof SDUIPageSchema>;

export type SDUIValidationResult =
  | { success: true; page: SDUIPageDefinition; warnings: string[] }
  | { success: false; errors: string[] };

export class SDUIValidationError extends Error {
  constructor(message: string, public readonly errors: string[]) {
    super(message);
    this.name = 'SDUIValidationError';
  }
}

const clampVersion = (version: number | undefined) => {
  if (!version || version < 1) return 1;
  if (version > SDUI_VERSION) return SDUI_VERSION;
  return version;
};

export function normalizeComponentSection(section: SDUIComponentSection): SDUIComponentSection {
  return {
    ...section,
    version: clampVersion(section.version),
    props: section.props ?? {},
  };
}

export function normalizeSection(section: SDUISection): SDUISection {
  if (section.type === 'layout.directive') {
    return {
      ...section,
      props: section.props ?? {},
    };
  }
  return normalizeComponentSection(section);
}

export function validateSDUISchema(payload: unknown): SDUIValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { success: false, errors: ['Payload must be an object'] };
  }

  const parsed = SDUIPageSchema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`);
    return { success: false, errors: issues };
  }

  const normalizedSections = parsed.data.sections.map(normalizeSection);
  const warnings: string[] = [];
  if (parsed.data.version > SDUI_VERSION) {
    warnings.push(`Layout version ${parsed.data.version} is newer than supported (${SDUI_VERSION}). Using ${SDUI_VERSION}.`);
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
