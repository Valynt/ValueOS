import {
  buildRuntimeFailureDetails,
  type RuntimeFailureDetails,
} from "@valueos/shared";

export function buildRecoveredRetryRuntimeFailure(
  attempts: number
): RuntimeFailureDetails | undefined {
  if (attempts <= 1) {
    return undefined;
  }

  return buildRuntimeFailureDetails({
    class: "transient-degraded",
    severity: "degraded",
    machineReasonCode: "TRANSIENT_RETRY_RECOVERED",
    diagnosis: `Stage recovered after ${attempts} attempts.`,
    confidence: 0.72,
    blastRadiusEstimate: "single-stage",
  });
}
