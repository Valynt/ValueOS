import { z } from 'zod';

import { ScenarioSchema } from '../../services/value/ScenarioBuilder.js';
import type { WorkflowStage } from '../../types/workflow.js';

export const ScenarioBuildOutputSchema = z.object({
  conservative: ScenarioSchema,
  base: ScenarioSchema,
  upside: ScenarioSchema,
});

export type StageOutputSchemaValidationResult =
  | { valid: true }
  | { valid: false; schemaName: string; issues: string[] };

export function validateStageOutputSchema(
  stage: WorkflowStage,
  stageOutput: unknown,
): StageOutputSchemaValidationResult {
  if (stage.id !== 'scenario_building') {
    return { valid: true };
  }

  const parsedOutput = ScenarioBuildOutputSchema.safeParse(stageOutput);
  if (parsedOutput.success) {
    return { valid: true };
  }

  return {
    valid: false,
    schemaName: 'ScenarioBuildOutputSchema',
    issues: parsedOutput.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}
