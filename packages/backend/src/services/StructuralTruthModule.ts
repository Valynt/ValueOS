/*
 * StructuralTruthModule.ts
 *
 * Defines the core schema and validation logic for Structural Truth Module
 *
 * This module ensures all agent outputs conform to the defined structural integrity
 * requirements before being processed by the UnifiedAgentOrchestrator.
 */

import { z } from "zod";

// Define the core schema for structural integrity validation
const StructuralTruthSchema = z.object({
  // Core fields that must be present
  agentId: z.string().min(1),
  operation: z.string().min(1),
  timestamp: z.string().uuid(),
  data: z.object({
    // Main payload structure
    payload: z.any(),
    metadata: z
      .object({
        context: z.string().optional(),
        assumptions: z.array(z.string()),
        confidence: z.number().min(0).max(1),
      })
      .optional(),
  }),
  // Validation rules
  validationRules: z.object({
    // Rules that must be satisfied
    requiredFields: z.array(z.string()),
    dataConstraints: z
      .object({
        maxSize: z.number().optional(),
        minConfidence: z.number().optional(),
      })
      .optional(),
  }),
  // Audit trail
  auditTrail: z
    .array({
      event: z.string(),
      timestamp: z.string().uuid(),
      agent: z.string().optional(),
    })
    .optional(),
});

// Export the schema for use in validation
export const StructuralTruthModuleSchema = StructuralTruthSchema;

// Validation function
export function validateStructuralTruth(payload: any): boolean {
  try {
    StructuralTruthModuleSchema.parse(payload);
    return true;
  } catch (error) {
    return false;
  }
}
