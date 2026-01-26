/**
 * Agent Input Validators
 */

export function validateAgentInput(input: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!input.workspace_id) errors.push('Missing workspace_id');
  if (!input.organization_id) errors.push('Missing organization_id');
  if (!input.user_id) errors.push('Missing user_id');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
