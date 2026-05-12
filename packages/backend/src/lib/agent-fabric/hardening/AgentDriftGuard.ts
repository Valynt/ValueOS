import { createHash } from "node:crypto";
import { logger } from "../../logger.js";
import { z } from "zod";
import { CONFIDENCE_THRESHOLDS } from "./AgentHardeningTypes.js";

export interface DriftGuardConfig {
  enabled: boolean;
  strictMode: boolean;
  reconciliationIntervalMs: number;
  baselineVersion: string;
}

export interface DriftCheckInput {
  agentName: string;
  riskTier: string;
  outputSchemaFingerprint: string;
}

export type DriftCorrectionType = "none" | "risk_tier_fallback" | "schema_fingerprint_regenerated";

export interface DriftCheckResult {
  driftDetected: boolean;
  reasons: string[];
  correctionApplied: boolean;
  correctionType: DriftCorrectionType;
  baselineVersion: string;
  requestedRiskTier: string;
  appliedRiskTier: string;
  requestedSchemaFingerprint: string;
  appliedSchemaFingerprint: string;
}

const DEFAULT_RECONCILIATION_MS = 5 * 60_000;
const MIN_RECONCILIATION_INTERVAL_MS = 1_000;
const MAX_RECONCILIATION_INTERVAL_MS = 3_600_000;

const DriftGuardIntervalSchema = z
  .number()
  .int()
  .finite()
  .min(MIN_RECONCILIATION_INTERVAL_MS)
  .max(MAX_RECONCILIATION_INTERVAL_MS);

interface ParsedIntervalResult {
  value: number;
  usedDefault: boolean;
}

export function validateDriftGuardIntervalMs(
  rawValue: string | undefined,
  fallbackValue: number = DEFAULT_RECONCILIATION_MS
): ParsedIntervalResult {
  if (rawValue === undefined) {
    return { value: fallbackValue, usedDefault: false };
  }

  const trimmed = rawValue.trim();
  const candidate = Number(trimmed);
  const valid = DriftGuardIntervalSchema.safeParse(candidate).success;

  if (valid) {
    return { value: candidate, usedDefault: false };
  }

  logger.warn("agent.drift_guard.invalid_interval_ms", {
    env_var: "AGENT_DRIFT_GUARD_INTERVAL_MS",
    raw_value: rawValue,
    default_value: fallbackValue,
    min_value: MIN_RECONCILIATION_INTERVAL_MS,
    max_value: MAX_RECONCILIATION_INTERVAL_MS,
  });

  return { value: fallbackValue, usedDefault: true };
}

export function readDriftGuardConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DriftGuardConfig {
  const baselineVersion = env.AGENT_DRIFT_GUARD_BASELINE_VERSION ?? env.RELEASE_VERSION ?? env.GIT_SHA;
  if (!baselineVersion || baselineVersion.trim().length < 7) {
    throw new Error(
      "AgentDriftGuard requires AGENT_DRIFT_GUARD_BASELINE_VERSION, RELEASE_VERSION, or GIT_SHA with at least 7 characters"
    );
  }

  return {
    enabled: env.AGENT_DRIFT_GUARD_ENABLED !== "false",
    strictMode: env.AGENT_DRIFT_GUARD_STRICT === "true",
    reconciliationIntervalMs: validateDriftGuardIntervalMs(env.AGENT_DRIFT_GUARD_INTERVAL_MS).value,
    baselineVersion: baselineVersion.trim(),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AgentDriftGuard {
  private readonly baselineThresholdFingerprint = sha256(stableJson(CONFIDENCE_THRESHOLDS));
  private readonly baselineVersion: string;
  private lastCheckedAt = 0;

  constructor(private readonly config: DriftGuardConfig) {
    if (!config.baselineVersion || config.baselineVersion.trim().length < 7) {
      throw new Error("AgentDriftGuard baselineVersion must be a non-empty deterministic identifier with at least 7 characters");
    }

    this.baselineVersion = config.baselineVersion.trim();
  }

  public shouldRun(now: number = Date.now()): boolean {
    if (!this.config.enabled) return false;
    return now - this.lastCheckedAt >= this.config.reconciliationIntervalMs;
  }

  public check(input: DriftCheckInput): DriftCheckResult {
    this.lastCheckedAt = Date.now();

    const reasons: string[] = [];
    let correctionType: DriftCorrectionType = "none";
    let correctionApplied = false;

    const runtimeThresholdFingerprint = sha256(stableJson(CONFIDENCE_THRESHOLDS));
    if (runtimeThresholdFingerprint !== this.baselineThresholdFingerprint) {
      reasons.push("confidence_thresholds_drift");
    }

    const requestedRiskTier = input.riskTier;
    const fallbackRiskTier: keyof typeof CONFIDENCE_THRESHOLDS = "discovery";
    const riskTierKnown = Object.prototype.hasOwnProperty.call(CONFIDENCE_THRESHOLDS, input.riskTier);
    const appliedRiskTier = riskTierKnown ? input.riskTier : (this.config.strictMode ? input.riskTier : fallbackRiskTier);

    if (!riskTierKnown) {
      reasons.push("unknown_risk_tier");
      if (!this.config.strictMode) {
        correctionType = "risk_tier_fallback";
        correctionApplied = true;
      }
    }

    const requestedSchemaFingerprint = input.outputSchemaFingerprint;
    const schemaFingerprintValid = Boolean(input.outputSchemaFingerprint && input.outputSchemaFingerprint.length >= 16);
    const appliedSchemaFingerprint = schemaFingerprintValid
      ? input.outputSchemaFingerprint
      : sha256(`regenerated:${input.agentName}:${this.baselineVersion}:${this.baselineThresholdFingerprint}`);

    if (!schemaFingerprintValid) {
      reasons.push("schema_fingerprint_missing_or_invalid");
      if (!this.config.strictMode && !correctionApplied) {
        correctionType = "schema_fingerprint_regenerated";
        correctionApplied = true;
      }
    }

    const driftDetected = reasons.length > 0;

    if (driftDetected) {
      logger.warn("agent.drift_detected", {
        agent: input.agentName,
        reasons,
        drift_guard_strict: this.config.strictMode,
        requested_risk_tier: requestedRiskTier,
        applied_risk_tier: appliedRiskTier,
        requested_schema_fingerprint: requestedSchemaFingerprint,
        applied_schema_fingerprint: appliedSchemaFingerprint,
        correction_applied: correctionApplied,
        correction_type: correctionType,
      });
    }

    return {
      driftDetected,
      reasons,
      correctionApplied,
      correctionType,
      baselineVersion: this.baselineVersion,
      requestedRiskTier,
      appliedRiskTier,
      requestedSchemaFingerprint,
      appliedSchemaFingerprint,
    };
  }

  public isStrictMode(): boolean {
    return this.config.strictMode;
  }
}

export function fingerprintSchema(schemaDescription: unknown): string {
  return sha256(stableJson(schemaDescription));
}
