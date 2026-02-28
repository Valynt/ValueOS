import { logger } from "../../lib/logger.js";

export const INTEGRITY_REMEDIATION = "request_tier_1_evidence" as const;

export type IntegrityVetoReasonCode =
  | "churn_below_zero"
  | "irr_above_stage_limit"
  | "npv_deviation_requires_justification";

export interface VetoEvaluationInput {
  proposedPayload: Record<string, unknown>;
  previousPayload?: Record<string, unknown>;
  stageFlags?: {
    allowHighIrrException?: boolean;
  };
  justificationText?: string;
}

export interface VetoEvaluationResult {
  vetoed: boolean;
  reasonCodes: IntegrityVetoReasonCode[];
  remediation: typeof INTEGRITY_REMEDIATION;
  overrideUsed: boolean;
  context: {
    churn?: number;
    irr?: number;
    currentNpv?: number;
    priorSessionNpv?: number;
    npvDeviationRatio?: number;
    justificationPresent: boolean;
  };
}

function getNumericValue(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const direct = source[key];
    if (typeof direct === "number" && Number.isFinite(direct)) {
      return direct;
    }
  }

  for (const value of Object.values(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = getNumericValue(value as Record<string, unknown>, keys);
      if (typeof nested === "number") {
        return nested;
      }
    }
  }

  return undefined;
}

export class VetoController {
  evaluate(input: VetoEvaluationInput): VetoEvaluationResult {
    const reasonCodes: IntegrityVetoReasonCode[] = [];
    const justificationPresent = !!input.justificationText?.trim();

    const churn = getNumericValue(input.proposedPayload, ["churn", "customer_churn", "churn_rate"]);
    if (typeof churn === "number" && churn < 0) {
      reasonCodes.push("churn_below_zero");
    }

    const irr = getNumericValue(input.proposedPayload, ["irr", "IRR", "internal_rate_of_return"]);
    const allowIrrOverride = !!input.stageFlags?.allowHighIrrException;
    const irrViolates = typeof irr === "number" && irr > 500;
    if (irrViolates && !allowIrrOverride) {
      reasonCodes.push("irr_above_stage_limit");
    }

    const currentNpv = getNumericValue(input.proposedPayload, ["npv", "NPV"]);
    const priorSessionNpv =
      getNumericValue(input.proposedPayload, ["prior_session_npv", "priorSessionNpv", "previous_npv"]) ??
      getNumericValue(input.previousPayload || {}, ["npv", "NPV"]);

    let npvDeviationRatio: number | undefined;
    if (
      typeof currentNpv === "number" &&
      typeof priorSessionNpv === "number" &&
      priorSessionNpv !== 0
    ) {
      npvDeviationRatio = Math.abs((currentNpv - priorSessionNpv) / priorSessionNpv);
      if (npvDeviationRatio > 0.2 && !justificationPresent) {
        reasonCodes.push("npv_deviation_requires_justification");
      }
    }

    const result: VetoEvaluationResult = {
      vetoed: reasonCodes.length > 0,
      reasonCodes,
      remediation: INTEGRITY_REMEDIATION,
      overrideUsed: irrViolates && allowIrrOverride,
      context: {
        churn,
        irr,
        currentNpv,
        priorSessionNpv,
        npvDeviationRatio,
        justificationPresent,
      },
    };

    logger.debug("Integrity veto evaluation complete", result);
    return result;
  }
}

export const vetoController = new VetoController();
