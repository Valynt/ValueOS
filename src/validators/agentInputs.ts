/**
 * Zod schemas for validating inputs to the various lifecycle agents.
 */
import { z } from 'zod';

// Schema for BusinessObjective, based on types/vos.ts
const BusinessObjectiveSchema = z.object({
    id: z.string(),
    value_case_id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    priority: z.number().min(1).max(5),
    owner: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
});

// Schema for Capability, based on types/vos.ts
const CapabilitySchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const TargetAgentInputSchema = z.object({
  valueCaseId: z.string().uuid("Invalid valueCaseId"),
  businessObjectives: z.array(BusinessObjectiveSchema).min(1, "At least one business objective is required."),
  capabilities: z.array(CapabilitySchema).min(1, "At least one capability is required."),
});
