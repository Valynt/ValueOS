import { securityLogger } from "../../services/core/SecurityLogger.js";
import type { RuntimeFailureDetails } from "@valueos/shared";
import type { StageExecutionResultDTO } from "../../types/workflow/runner.js";

export function buildHitlPendingApprovalResult(input: {
  traceId: string;
  stageId: string;
  organizationId: string;
  hitlReason: string;
  ruleId: string;
  confidenceScore: number;
}): StageExecutionResultDTO {
  const output = {
    rule_id: input.ruleId,
    confidence_score: input.confidenceScore,
    traceId: input.traceId,
    reason: input.hitlReason,
    stageId: input.stageId,
    organizationId: input.organizationId,
  };

  securityLogger.log({
    category: "autonomy",
    action: "hitl_pending_approval",
    severity: "warning",
    metadata: output,
  });

  return {
    status: "pending_approval",
    output,
  };
}

export function buildRetryAwareRuntimeFailure(
  attempts: number,
  buildFailureDetails: (input: {
    failureClass: RuntimeFailureDetails["class"];
    severity: RuntimeFailureDetails["severity"];
    machineReasonCode: string;
    diagnosis: string;
    confidence: number;
    blastRadiusEstimate: RuntimeFailureDetails["blastRadiusEstimate"];
    recommendedNextActions?: RuntimeFailureDetails["recommendedNextActions"];
  }) => RuntimeFailureDetails
): RuntimeFailureDetails | undefined {
  if (attempts <= 1) {
    return undefined;
  }

  return buildFailureDetails({
    failureClass: "transient-degraded",
    severity: "degraded",
    machineReasonCode: "TRANSIENT_RETRY_RECOVERED",
    diagnosis: `Stage recovered after ${attempts} attempts.`,
    confidence: 0.72,
    blastRadiusEstimate: "single-stage",
  });
}
