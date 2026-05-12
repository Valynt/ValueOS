import { createHash } from "node:crypto";
import { z } from "zod";
import { logger } from "../../logger.js";
import { CONFIDENCE_THRESHOLDS } from "./AgentHardeningTypes.js";

export interface DriftGuardConfig {
  enabled: boolean;
  strictMode: boolean;
  reconciliationIntervalMs: number;
}

export interface DriftCheckInput {
  agentName: string;
  riskTier: string;
  outputSchemaFingerprint: string;
}

export interface DriftCheckResult {
  driftDetected: boolean;
  reasons: string[];
  correctionApplied: boolean;
  baselineVersion: string;
}

const DEFAULT_RECONCILIATION_MS = 5 * 60_000;
const DRIFT_GUARD_INTERVAL_MIN_MS = 1_000;
const DRIFT_GUARD_INTERVAL_MAX_MS = 3_600_000;

const driftGuardEnvConfigSchema = z.object({
  enabled: z.boolean(),
  strictMode: z.boolean(),
  reconciliationIntervalMs: z
    .number()
    .int()
    .min(DRIFT_GUARD_INTERVAL_MIN_MS)
    .max(DRIFT_GUARD_INTERVAL_MAX_MS),
});

export function parseDriftGuardConfig(rawConfig: unknown): DriftGuardConfig {
  return driftGuardEnvConfigSchema.parse(rawConfig);
}

export function readDriftGuardConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DriftGuardConfig {
  const rawInterval = env.AGENT_DRIFT_GUARD_INTERVAL_MS;
  const parsedInterval = Number(rawInterval ?? DEFAULT_RECONCILIATION_MS);
  const validatedInterval = z
    .number()
    .finite()
    .int()
    .min(DRIFT_GUARD_INTERVAL_MIN_MS)
    .max(DRIFT_GUARD_INTERVAL_MAX_MS)
    .safeParse(parsedInterval);

  if (!validatedInterval.success) {
    logger.warn("agent.drift_guard_config_invalid", {
      field: "AGENT_DRIFT_GUARD_INTERVAL_MS",
      raw_value: rawInterval,
      fallback_value: DEFAULT_RECONCILIATION_MS,
      min_ms: DRIFT_GUARD_INTERVAL_MIN_MS,
      max_ms: DRIFT_GUARD_INTERVAL_MAX_MS,
      reason: validatedInterval.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  const candidateConfig = {
    enabled: env.AGENT_DRIFT_GUARD_ENABLED !== "false",
    strictMode: env.AGENT_DRIFT_GUARD_STRICT === "true",
    reconciliationIntervalMs: validatedInterval.success
      ? validatedInterval.data
      : DEFAULT_RECONCILIATION_MS,
  };

  return parseDriftGuardConfig(candidateConfig);
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

  constructor(private readonly config: DriftGuardConfig) {}

  public shouldRun(now: number = Date.now()): boolean {
    if (!this.config.enabled) return false;
    return now - this.lastCheckedAt >= this.config.reconciliationIntervalMs;
  }

  public check(input: DriftCheckInput): DriftCheckResult {
    this.lastCheckedAt = Date.now();

    const reasons: string[] = [];
    const runtimeThresholdFingerprint = sha256(stableJson(CONFIDENCE_THRESHOLDS));
    if (runtimeThresholdFingerprint !== this.baselineThresholdFingerprint) {
      reasons.push("confidence_thresholds_drift");
    }

    if (!Object.prototype.hasOwnProperty.call(CONFIDENCE_THRESHOLDS, input.riskTier)) {
      reasons.push("unknown_risk_tier");
    }

    if (!input.outputSchemaFingerprint || input.outputSchemaFingerprint.length < 16) {
      reasons.push("schema_fingerprint_missing_or_invalid");
    }

    const driftDetected = reasons.length > 0;

    if (driftDetected) {
      logger.warn("agent.drift_detected", {
        agent: input.agentName,
        risk_tier: input.riskTier,
        reasons,
        drift_guard_strict: this.config.strictMode,
      });
    }

    return {
      driftDetected,
      reasons,
      correctionApplied: reasons.includes("unknown_risk_tier"),
      baselineVersion: this.baselineVersion,
    };
  }

  public isStrictMode(): boolean {
    return this.config.strictMode;
  }
}

export function fingerprintSchema(schemaDescription: unknown): string {
  return sha256(stableJson(schemaDescription));
}
