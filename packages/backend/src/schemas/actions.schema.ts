/**
 * Zod schemas for ActionRouter validation
 *
 * Schema-first validation for all CanonicalAction types.
 * Provides type-safe validation with detailed error messages.
 */

import { z } from "zod";

// Base schemas
export const ActionMetadataSchema = z.object({
  timestamp: z.string().datetime(),
  source: z.enum(["user", "agent", "system"]),
  idempotency_key: z.string().uuid().optional(),
  retry_count: z.number().int().min(0).optional(),
});

export const BaseCanonicalActionSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  metadata: ActionMetadataSchema.optional(),
});

// Action-specific schemas
export const InvokeAgentActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("invokeAgent"),
  agentId: z.string().min(1, "agentId is required"),
  input: z.unknown(),
  execution: z.unknown().optional(),
});

export const RunWorkflowStepActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("runWorkflowStep"),
  workflowId: z.string().uuid("workflowId must be a valid UUID"),
  stepId: z.string().min(1, "stepId is required"),
  input: z.unknown().optional(),
  reason: z.string().optional(),
});

export const UpdateValueTreeActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("updateValueTree"),
  treeId: z.string().uuid("treeId must be a valid UUID"),
  updates: z.unknown(),
});

export const UpdateAssumptionActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("updateAssumption"),
  assumptionId: z.string().uuid("assumptionId must be a valid UUID"),
  updates: z.unknown(),
});

export const ExportArtifactActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("exportArtifact"),
  artifactType: z.string().min(1, "artifactType is required"),
  format: z.enum(["pdf", "png", "excel", "csv"], "format must be one of: pdf, png, excel, csv"),
});

export const OpenAuditTrailActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("openAuditTrail"),
  entityId: z.string().uuid("entityId must be a valid UUID"),
  entityType: z.string().min(1, "entityType is required"),
});

export const ShowExplanationActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("showExplanation"),
  componentId: z.string().min(1, "componentId is required"),
  topic: z.string().min(1, "topic is required"),
});

export const NavigateToStageActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("navigateToStage"),
  stage: z.string().min(1, "stage is required"),
});

export const SaveWorkspaceActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("saveWorkspace"),
  workspaceId: z.string().uuid("workspaceId must be a valid UUID"),
});

export const MutateComponentActionSchema = BaseCanonicalActionSchema.extend({
  type: z.literal("mutateComponent"),
  action: z.string().min(1, "action is required"),
});

// Union schema for all actions
export const CanonicalActionSchema = z.discriminatedUnion("type", [
  InvokeAgentActionSchema,
  RunWorkflowStepActionSchema,
  UpdateValueTreeActionSchema,
  UpdateAssumptionActionSchema,
  ExportArtifactActionSchema,
  OpenAuditTrailActionSchema,
  ShowExplanationActionSchema,
  NavigateToStageActionSchema,
  SaveWorkspaceActionSchema,
  MutateComponentActionSchema,
]);

// ActionContext schema
export const ActionContextSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  organizationId: z.string().uuid("organizationId must be a valid UUID"),
  workspaceId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  traceId: z.string().uuid().optional(), // Added for trace-ID injection
});

// Validation result schema
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
});

// Enhanced validation error class
export class ActionValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
    public readonly actionType: string
  ) {
    super(message);
    this.name = "ActionValidationError";
  }
}

// Schema-first validation function
export function validateCanonicalAction(action: unknown): z.infer<typeof CanonicalActionSchema> {
  const result = CanonicalActionSchema.safeParse(action);
  if (!result.success) {
    const actionType = (action as any)?.type || "unknown";
    throw new ActionValidationError(
      `Invalid action of type '${actionType}': ${result.error.message}`,
      result.error.issues,
      actionType
    );
  }
  return result.data;
}

// Context validation function
export function validateActionContext(context: unknown): z.infer<typeof ActionContextSchema> {
  const result = ActionContextSchema.safeParse(context);
  if (!result.success) {
    throw new ActionValidationError(
      `Invalid action context: ${result.error.message}`,
      result.error.issues,
      "context"
    );
  }
  return result.data;
}

// Type exports
export type CanonicalAction = z.infer<typeof CanonicalActionSchema>;
export type ActionContext = z.infer<typeof ActionContextSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
