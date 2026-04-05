import { supabase } from '../../../lib/supabase.js';
import type { AdapterExecutionContext, AdapterResult, InfraAdapter, TypedFailure } from '../../ports/Contract.js';

export interface WorkflowFailureUpdateRequest {
  executionId: string;
  organizationId: string;
  errorMessage: string;
}

export interface WorkflowFailureUpdateResponse {
  updated: boolean;
}

export interface WorkflowFailureAdapterFailure extends TypedFailure {
  code: 'WORKFLOW_FAILURE_UPDATE_ERROR';
}

export class WorkflowFailureSupabaseAdapter
  implements InfraAdapter<WorkflowFailureUpdateRequest, WorkflowFailureUpdateResponse, WorkflowFailureAdapterFailure> {
  readonly adapterName = 'workflow-failure-supabase-adapter';

  async execute(
    request: WorkflowFailureUpdateRequest,
    _ctx: AdapterExecutionContext,
  ): Promise<AdapterResult<WorkflowFailureUpdateResponse, WorkflowFailureAdapterFailure>> {
    const { error } = await supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        error_message: request.errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', request.executionId)
      .eq('organization_id', request.organizationId);

    if (error) {
      return {
        ok: false,
        failure: {
          code: 'WORKFLOW_FAILURE_UPDATE_ERROR',
          message: error.message,
          retryable: true,
          cause: error,
        },
      };
    }

    return {
      ok: true,
      data: {
        updated: true,
      },
    };
  }
}
