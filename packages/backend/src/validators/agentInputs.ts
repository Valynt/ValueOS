/**
 * Agent Input Validators
 */

export function validateAgentInput(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!input.workspace_id) errors.push('Missing workspace_id');
  if (!input.organization_id) errors.push('Missing organization_id');
  if (!input.user_id) errors.push('Missing user_id');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

import { z } from "zod";

// Zod schema for TargetAgent input validation
export const TargetAgentInputSchema = z.object({
  workspace_id: z.string().min(1),
  organization_id: z.string().min(1),
  user_id: z.string().min(1),
  opportunity_id: z.string().optional(),
  context: z.record(z.unknown()).optional(),
}).passthrough();

export type TargetAgentInput = z.infer<typeof TargetAgentInputSchema>;
