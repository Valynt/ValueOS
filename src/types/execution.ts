export type ExecutionIntent =
  | 'FullValueAnalysis'
  | 'StageRepair'
  | 'WhatIfScenario'
  | 'PostSaleExpansion';

export type ExecutionEntrypoint = 'action-router' | 'playground' | 'agent-query';

export type ExecutionEnvironment = 'sandbox' | 'production';

export interface ExecutionRequest {
  intent: ExecutionIntent;
  environment: ExecutionEnvironment;
  parameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const ENTRYPOINT_INTENT_MATRIX: Record<ExecutionEntrypoint, ExecutionIntent[]> = {
  'action-router': ['FullValueAnalysis', 'StageRepair', 'PostSaleExpansion'],
  playground: ['StageRepair', 'WhatIfScenario'],
  'agent-query': ['FullValueAnalysis', 'WhatIfScenario'],
};

export function normalizeExecutionRequest(
  entrypoint: ExecutionEntrypoint,
  request: ExecutionRequest
): ExecutionRequest {
  const allowedIntents = ENTRYPOINT_INTENT_MATRIX[entrypoint];

  if (!allowedIntents.includes(request.intent)) {
    throw new Error(
      `Execution intent ${request.intent} is not allowed for entrypoint ${entrypoint}`
    );
  }

  if (request.environment !== 'sandbox' && request.environment !== 'production') {
    throw new Error(`Unknown execution environment: ${request.environment}`);
  }

  return {
    ...request,
    parameters: request.parameters ?? {},
    metadata: request.metadata ?? {},
  };
}
