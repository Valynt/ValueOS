import { z } from "zod";

const severityValues = ["low", "medium", "high", "critical"] as const;

export const alertDetailsSchema = z
  .object({
    alertId: z.string().min(1),
    caseId: z.string().min(1),
    tenantId: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    severity: z.enum(severityValues),
    source: z.string().min(1),
    detectedAt: z.string().datetime(),
    indicators: z.array(z.string().min(1)).max(50).optional(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict();

export type AlertDetails = z.infer<typeof alertDetailsSchema>;

export const alertDetailsJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://valueos.dev/contracts/alert-details.schema.json",
  title: "AlertDetails",
  type: "object",
  additionalProperties: false,
  required: [
    "alertId",
    "caseId",
    "tenantId",
    "title",
    "summary",
    "severity",
    "source",
    "detectedAt",
  ],
  properties: {
    alertId: { type: "string", minLength: 1 },
    caseId: { type: "string", minLength: 1 },
    tenantId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    severity: { type: "string", enum: [...severityValues] },
    source: { type: "string", minLength: 1 },
    detectedAt: { type: "string", format: "date-time" },
    indicators: {
      type: "array",
      maxItems: 50,
      items: { type: "string", minLength: 1 },
    },
    metadata: {
      type: "object",
      additionalProperties: {
        type: ["string", "number", "boolean", "null"],
      },
    },
  },
} as const;

export interface AlertDetailsViolation {
  path: string;
  code: string;
  message: string;
}

export interface InputGuardrailTripwire {
  errorType: "InputGuardrailTripwire";
  code: "ALERT_DETAILS_VALIDATION_FAILED";
  message: "Structured alert payload failed AlertDetails validation";
  violations: AlertDetailsViolation[];
  traceId?: string;
  tenantId?: string;
  caseId?: string;
}

export function validateAlertDetails(payload: unknown):
  | { success: true; data: AlertDetails }
  | { success: false; violations: AlertDetailsViolation[] } {
  const result = alertDetailsSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    violations: result.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "$",
      code: issue.code,
      message: issue.message,
    })),
  };
}

function sanitizeIdentifier(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 8) return "***";
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-2)}`;
}

export function createInputGuardrailTripwire(params: {
  violations: AlertDetailsViolation[];
  traceId?: string;
  tenantId?: string;
  caseId?: string;
}): InputGuardrailTripwire {
  return {
    errorType: "InputGuardrailTripwire",
    code: "ALERT_DETAILS_VALIDATION_FAILED",
    message: "Structured alert payload failed AlertDetails validation",
    violations: params.violations,
    traceId: sanitizeIdentifier(params.traceId),
    tenantId: sanitizeIdentifier(params.tenantId),
    caseId: sanitizeIdentifier(params.caseId),
  };
}
