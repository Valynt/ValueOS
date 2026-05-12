import { createHash } from "node:crypto";
import { logger } from "../../logger.js";
import { CONFIDENCE_THRESHOLDS } from "./AgentHardeningTypes.js";

export interface DriftGuardConfig {
  enabled: boolean;
  strictMode: boolean;
  reconciliationIntervalMs: number;
}

export interface DriftEvaluationArtifact {
  evaluatedAt: string;
  reasons: string[];
  correctionApplied: boolean;
  correctionType: DriftCorrectionType;
  policyFingerprint: string;
  requestedRiskTier: string;
  appliedRiskTier: string;
  requestedSchemaFingerprint: string;
  appliedSchemaFingerprint: string;
}

export interface DriftSharedStateAdapter {
  acquireReconciliationLock(lockKey: string, ttlMs: number): Promise<boolean>;
  readLatestArtifact(cacheKey: string): Promise<DriftEvaluationArtifact | null>;
  writeLatestArtifact(cacheKey: string, artifact: DriftEvaluationArtifact, ttlMs: number): Promise<void>;
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
  evaluatedAt: string;
  policyFingerprint: string;
  source: "local" | "shared_cache";
}

const DEFAULT_RECONCILIATION_MS = 5 * 60_000;

export function readDriftGuardConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DriftGuardConfig {
  return {
    enabled: env.AGENT_DRIFT_GUARD_ENABLED !== "false",
    strictMode: env.AGENT_DRIFT_GUARD_STRICT === "true",
    reconciliationIntervalMs: Number(env.AGENT_DRIFT_GUARD_INTERVAL_MS ?? DEFAULT_RECONCILIATION_MS),
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
  private readonly baselineVersion = new Date().toISOString();
  private lastCheckedAt = 0;
  private readonly cacheKey: string;
  private readonly lockKey: string;
  private readonly lockTtlMs: number;
  private readonly artifactTtlMs: number;

  constructor(
    private readonly config: DriftGuardConfig,
    private readonly sharedState?: DriftSharedStateAdapter,
    sharedKeyPrefix = "agent-drift-guard"
  ) {
    this.cacheKey = `${sharedKeyPrefix}:latest-artifact`;
    this.lockKey = `${sharedKeyPrefix}:reconcile-lock`;
    this.lockTtlMs = Math.max(1_000, Math.min(this.config.reconciliationIntervalMs, 30_000));
    this.artifactTtlMs = Math.max(this.config.reconciliationIntervalMs * 2, 60_000);
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
      : sha256(`regenerated:${input.agentName}:${this.baselineVersion}`);

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

    const evaluatedAt = new Date().toISOString();

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
      evaluatedAt,
      policyFingerprint: this.baselineThresholdFingerprint,
      source: "local",
    };
  }

  public async reconcile(input: DriftCheckInput): Promise<DriftCheckResult> {
    if (!this.sharedState) return this.check(input);

    const lockAcquired = await this.sharedState.acquireReconciliationLock(this.lockKey, this.lockTtlMs);
    if (!lockAcquired) {
      const artifact = await this.sharedState.readLatestArtifact(this.cacheKey);
      if (artifact) {
        this.lastCheckedAt = Date.now();
        return {
          driftDetected: artifact.reasons.length > 0,
          reasons: artifact.reasons,
          correctionApplied: artifact.correctionApplied,
          correctionType: artifact.correctionType,
          baselineVersion: this.baselineVersion,
          requestedRiskTier: artifact.requestedRiskTier,
          appliedRiskTier: artifact.appliedRiskTier,
          requestedSchemaFingerprint: artifact.requestedSchemaFingerprint,
          appliedSchemaFingerprint: artifact.appliedSchemaFingerprint,
          evaluatedAt: artifact.evaluatedAt,
          policyFingerprint: artifact.policyFingerprint,
          source: "shared_cache",
        };
      }
    }

    const result = this.check(input);
    await this.sharedState.writeLatestArtifact(
      this.cacheKey,
      {
        evaluatedAt: result.evaluatedAt,
        reasons: result.reasons,
        correctionApplied: result.correctionApplied,
        correctionType: result.correctionType,
        policyFingerprint: result.policyFingerprint,
        requestedRiskTier: result.requestedRiskTier,
        appliedRiskTier: result.appliedRiskTier,
        requestedSchemaFingerprint: result.requestedSchemaFingerprint,
        appliedSchemaFingerprint: result.appliedSchemaFingerprint,
      },
      this.artifactTtlMs
    );
    return result;
  }

  public isStrictMode(): boolean {
    return this.config.strictMode;
  }
}

export function fingerprintSchema(schemaDescription: unknown): string {
  return sha256(stableJson(schemaDescription));
}
