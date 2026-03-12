/**
 * IExecutionRuntime
 *
 * Minimal interface for the ExecutionRuntime used by services/agents/.
 * Placing it in types/ breaks the circular dependency between
 * services/agents/ (ActionRouter, AgentQueryService) and
 * runtime/execution-runtime/ (which imports from services/agents/).
 *
 * The concrete ExecutionRuntime in runtime/execution-runtime/index.ts
 * satisfies this interface structurally.
 */

import type { WorkflowState } from '../../repositories/WorkflowStateRepository.js';
import type { ExecutionEnvelope, ProcessQueryResult, WorkflowExecutionResult } from '../orchestration.js';
import type { WorkflowContextDTO } from '../workflow/orchestration.js';

export interface IExecutionRuntime {
  processQuery(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId?: string,
  ): Promise<ProcessQueryResult>;

  executeWorkflow(
    envelope: ExecutionEnvelope,
    workflowDefinitionId: string,
    context?: WorkflowContextDTO,
    userId?: string,
  ): Promise<WorkflowExecutionResult>;
}
