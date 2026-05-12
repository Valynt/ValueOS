import { createHash } from "node:crypto";
import { logger } from "../../logger.js";
import { CONFIDENCE_THRESHOLDS } from "./AgentHardeningTypes.js";
import { getIoRedisClient } from "../../ioredisClient.js";

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

export interface DriftCheckpointState {
  last_checked_at: number;
  last_result: "pass" | "drift_detected";
  baseline_version: string;
}

export interface DriftCheckpointStore {
  getCheckpoint(scopeKey: string): Promise<DriftCheckpointState | null>;
  setCheckpoint(scopeKey: string, checkpoint: DriftCheckpointState): Promise<void>;
  acquireLease(scopeKey: string, instanceId: string, leaseTtlMs: number): Promise<boolean>;
  releaseLease(scopeKey: string, instanceId: string): Promise<void>;
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
  private readonly instanceId: string;
  private readonly leaseTtlMs: number;

  constructor(
    private readonly config: DriftGuardConfig,
    private readonly store: DriftCheckpointStore,
    instanceId: string = process.env.HOSTNAME ?? `instance-${process.pid}`,
    leaseTtlMs: number = 15_000
  ) {
    this.instanceId = instanceId;
    this.leaseTtlMs = leaseTtlMs;
  }

  public async shouldRun(scopeKey: string, now: number = Date.now()): Promise<boolean> {
    if (!this.config.enabled) return false;

    const checkpoint = await this.store.getCheckpoint(scopeKey);
    const lastCheckedAt = checkpoint?.last_checked_at ?? 0;
    if (now - lastCheckedAt < this.config.reconciliationIntervalMs) {
      return false;
    }

    const jitterCeilingMs = Math.min(250, Math.max(25, Math.floor(this.config.reconciliationIntervalMs * 0.02)));
    const jitterMs = Math.floor(Math.random() * jitterCeilingMs);
    if (jitterMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    return this.store.acquireLease(scopeKey, this.instanceId, this.leaseTtlMs);
  }

  public async check(input: DriftCheckInput, scopeKey: string): Promise<DriftCheckResult> {

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

    const result: DriftCheckResult = {
      driftDetected,
      reasons,
      correctionApplied: reasons.includes("unknown_risk_tier"),
      baselineVersion: this.baselineVersion,
    };

    await this.store.setCheckpoint(scopeKey, {
      last_checked_at: Date.now(),
      last_result: driftDetected ? "drift_detected" : "pass",
      baseline_version: result.baselineVersion,
    });

    if (driftDetected) {
      logger.warn("agent.drift_detected", {
        agent: input.agentName,
        risk_tier: input.riskTier,
        reasons,
        drift_guard_strict: this.config.strictMode,
        reconciliation_scope: scopeKey,
        instance_id: this.instanceId,
        checkpoint_source: this.store.constructor.name,
      });
    }

    await this.store.releaseLease(scopeKey, this.instanceId);

    logger.info("agent.reconciliation_checkpoint_updated", {
      reconciliation_scope: scopeKey,
      instance_id: this.instanceId,
      checkpoint_source: this.store.constructor.name,
      result: driftDetected ? "drift_detected" : "pass",
    });

    return result;
  }

  public isStrictMode(): boolean {
    return this.config.strictMode;
  }
}

export class RedisDriftCheckpointStore implements DriftCheckpointStore {
  public async getCheckpoint(scopeKey: string): Promise<DriftCheckpointState | null> {
    const raw = await getIoRedisClient().get(`drift:checkpoint:${scopeKey}`);
    return raw ? (JSON.parse(raw) as DriftCheckpointState) : null;
  }
  public async setCheckpoint(scopeKey: string, checkpoint: DriftCheckpointState): Promise<void> {
    await getIoRedisClient().set(`drift:checkpoint:${scopeKey}`, JSON.stringify(checkpoint));
  }
  public async acquireLease(scopeKey: string, instanceId: string, leaseTtlMs: number): Promise<boolean> {
    const res = await getIoRedisClient().set(`drift:lease:${scopeKey}`, instanceId, "PX", leaseTtlMs, "NX");
    return res === "OK";
  }
  public async releaseLease(scopeKey: string, instanceId: string): Promise<void> {
    const client = getIoRedisClient();
    const key = `drift:lease:${scopeKey}`;
    const owner = await client.get(key);
    if (owner === instanceId) await client.del(key);
  }
}

export class InMemoryDriftCheckpointStore implements DriftCheckpointStore {
  private readonly checkpoints = new Map<string, DriftCheckpointState>();
  private readonly leases = new Map<string, { owner: string; expiresAt: number }>();
  async getCheckpoint(scopeKey: string): Promise<DriftCheckpointState | null> {
    return this.checkpoints.get(scopeKey) ?? null;
  }
  async setCheckpoint(scopeKey: string, checkpoint: DriftCheckpointState): Promise<void> {
    this.checkpoints.set(scopeKey, checkpoint);
  }
  async acquireLease(scopeKey: string, instanceId: string, leaseTtlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.leases.get(scopeKey);
    if (existing && existing.expiresAt > now) return false;
    this.leases.set(scopeKey, { owner: instanceId, expiresAt: now + leaseTtlMs });
    return true;
  }
  async releaseLease(scopeKey: string, instanceId: string): Promise<void> {
    const existing = this.leases.get(scopeKey);
    if (existing?.owner === instanceId) this.leases.delete(scopeKey);
  }
}

export function fingerprintSchema(schemaDescription: unknown): string {
  return sha256(stableJson(schemaDescription));
}
