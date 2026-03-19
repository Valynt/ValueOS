import { ActionContext, ActionResult, CanonicalAction } from '@valueos/shared/types/actions';

import { logger } from '../../lib/logger.js';
import { AuditLogService } from '../AuditLogService.js';

export async function logAction(
  auditLogService: AuditLogService,
  action: CanonicalAction,
  context: ActionContext,
  result: ActionResult,
  duration: number
): Promise<void> {
  try {
    await auditLogService.logAction({
      action_type: action.type,
      workspace_id: context.workspaceId,
      user_id: context.userId,
      session_id: context.sessionId,
      organization_id: context.organizationId,
      action_data: action,
      result_data: result,
      success: result.success,
      error_message: result.error,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      trace_id: context.traceId,
    });
  } catch (error) {
    logger.error('Failed to log action to audit trail', {
      actionType: action.type,
      traceId: context.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
