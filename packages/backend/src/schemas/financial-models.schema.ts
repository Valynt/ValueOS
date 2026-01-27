import { z } from 'zod';

export const FinancialModelOutputsSchema = z.object({
  roi: z.number().min(0).max(1000),
  npv: z.number(),
  paybackPeriod: z.number().positive(),
  irr: z.number().optional(),
  sensitivityAnalysis: z.record(z.string(), z.number()).optional(),
  calculatedAt: z.string().datetime()
});

export const ValueDriverMetadataSchema = z.object({
  category: z.enum(['revenue', 'cost', 'efficiency', 'risk']),
  weight: z.number().min(0).max(1),
  parentId: z.string().uuid().nullable(),
  displayOrder: z.number().int().nonnegative()
});

export type FinancialModelOutputs = z.infer<typeof FinancialModelOutputsSchema>;
export type ValueDriverMetadata = z.infer<typeof ValueDriverMetadataSchema>;

export class JsonValidationError extends Error {
  constructor(message: string, public readonly issues: z.ZodIssue[]) {
    super(message);
    this.name = 'JsonValidationError';
  }
}

// Service-level validation wrapper
export function validateJsonField<T>(
  schema: z.ZodType<T>,
  data: unknown,
  fieldName: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new JsonValidationError(
      `Invalid ${fieldName}: ${result.error.message}`,
      result.error.issues
    );
  }
  return result.data;
}