import {
  buildRuntimeFailureDetails,
  type RuntimeFailureDetails,
} from '@valueos/shared';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';

export interface RuntimeFailureInput {
  failureClass: RuntimeFailureDetails['class'];
  severity: RuntimeFailureDetails['severity'];
  machineReasonCode: string;
  diagnosis: string;
  confidence: number;
  blastRadiusEstimate: RuntimeFailureDetails['blastRadiusEstimate'];
  recommendedNextActions?: RuntimeFailureDetails['recommendedNextActions'];
}

export function buildFailureDetails(input: RuntimeFailureInput): RuntimeFailureDetails {
  return buildRuntimeFailureDetails({
    class: input.failureClass,
    severity: input.severity,
    machineReasonCode: input.machineReasonCode,
    diagnosis: input.diagnosis,
    confidence: input.confidence,
    blastRadiusEstimate: input.blastRadiusEstimate,
    recommendedNextActions: input.recommendedNextActions,
  });
}

export function classifyStageFailure(errorMessage: string): RuntimeFailureDetails {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('policy') || msg.includes('veto') || msg.includes('approval')) {
    return buildFailureDetails({
      failureClass: 'policy-blocked',
      severity: 'failed',
      machineReasonCode: 'POLICY_BLOCKED',
      diagnosis: errorMessage,
      confidence: 0.9,
      blastRadiusEstimate: 'workflow',
    });
  }

  if (msg.includes('missing') || msg.includes('not found') || msg.includes('artifact') || msg.includes('required')) {
    return buildFailureDetails({
      failureClass: 'data-missing',
      severity: 'failed',
      machineReasonCode: 'DATA_MISSING',
      diagnosis: errorMessage,
      confidence: 0.85,
      blastRadiusEstimate: 'single-stage',
    });
  }

  if (msg.includes('timeout') || msg.includes('unavailable') || msg.includes('connection') || msg.includes('service')) {
    return buildFailureDetails({
      failureClass: 'dependency-unavailable',
      severity: 'failed',
      machineReasonCode: 'DEPENDENCY_UNAVAILABLE',
      diagnosis: errorMessage,
      confidence: 0.81,
      blastRadiusEstimate: 'workflow',
    });
  }

  return buildFailureDetails({
    failureClass: 'execution-failed',
    severity: 'failed',
    machineReasonCode: 'EXECUTION_FAILED',
    diagnosis: errorMessage,
    confidence: 0.78,
    blastRadiusEstimate: 'single-stage',
  });
}

export function withRuntimeFailure(
  snapshot: WorkflowExecutionRecord,
  runtimeFailure: RuntimeFailureDetails,
): WorkflowExecutionRecord {
  return {
    ...snapshot,
    io: {
      ...(snapshot.io && typeof snapshot.io === 'object'
        ? (snapshot.io as Record<string, unknown>)
        : {}),
      runtime_failure: runtimeFailure,
    },
  };
}
