import { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { ConfidenceLevel } from "./types";

/**
 * Audit Log Encryption Manager
 * Provides encryption/decryption for sensitive audit data
 */
class AuditEncryptionManager {
  private encryptionKey: Buffer;
  private algorithm = "aes-256-gcm";

  constructor() {
    // Get encryption key from environment
    const keyHex = process.env.AUDIT_ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error(
        "AUDIT_ENCRYPTION_KEY environment variable is required for audit encryption"
      );
    }

    // Ensure key is 32 bytes (256 bits) for AES-256
    this.encryptionKey = Buffer.from(keyHex, "hex");
    if (this.encryptionKey.length !== 32) {
      throw new Error(
        "AUDIT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
      );
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv
    );

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(tag, "hex"));

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Check if data contains sensitive information that should be encrypted
   */
  containsSensitiveData(data: any): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    const sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /credential/i,
      /email/i,
      /phone/i,
      /ssn/i,
      /social.*security/i,
      /credit.*card/i,
      /bank.*account/i,
      /api.*key/i,
      /auth.*token/i,
      /session.*id/i,
      /user.*id/i,
      /personal.*data/i,
      /pii/i,
    ];

    const jsonString = JSON.stringify(data).toLowerCase();

    for (const pattern of sensitivePatterns) {
      if (pattern.test(jsonString)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Encrypt sensitive fields in an object
   */
  encryptSensitiveFields(obj: Record<string, any>): Record<string, any> & {
    _encryptedFields?: string[];
    _encryptionMetadata?: Record<string, { iv: string; tag: string }>;
  } {
    const result = { ...obj };
    const encryptedFields: string[] = [];
    const encryptionMetadata: Record<string, { iv: string; tag: string }> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.containsSensitiveData({ [key]: value })) {
        const valueStr = JSON.stringify(value);
        const encrypted = this.encrypt(valueStr);

        result[key] = encrypted.encrypted;
        encryptedFields.push(key);
        encryptionMetadata[key] = { iv: encrypted.iv, tag: encrypted.tag };
      }
    }

    if (encryptedFields.length > 0) {
      result._encryptedFields = encryptedFields;
      result._encryptionMetadata = encryptionMetadata;
    }

    return result;
  }

  /**
   * Decrypt sensitive fields in an object
   */
  decryptSensitiveFields(obj: Record<string, any>): Record<string, any> {
    const result = { ...obj };

    if (!obj._encryptedFields || !obj._encryptionMetadata) {
      return result;
    }

    for (const field of obj._encryptedFields) {
      if (obj[field] && obj._encryptionMetadata[field]) {
        try {
          const decryptedStr = this.decrypt(
            obj[field],
            obj._encryptionMetadata[field].iv,
            obj._encryptionMetadata[field].tag
          );
          result[field] = JSON.parse(decryptedStr);
        } catch (error) {
          console.warn(`Failed to decrypt field ${field}:`, error);
          result[field] = "[ENCRYPTION_ERROR]";
        }
      }
    }

    // Remove encryption metadata from result
    delete result._encryptedFields;
    delete result._encryptionMetadata;

    return result;
  }
}

export class AuditLogger {
  private traceAnchors: Map<string, string> = new Map();
  private encryptionManager?: AuditEncryptionManager;

  constructor(private supabase: SupabaseClient) {
    if (process.env.AUDIT_ENCRYPTION_KEY) {
      this.encryptionManager = new AuditEncryptionManager();
    }
  }

  async logAction(
    sessionId: string,
    agentId: string,
    action: string,
    options: {
      reasoning?: string;
      inputData?: Record<string, any>;
      outputData?: Record<string, any>;
      confidenceLevel?: ConfidenceLevel;
      evidence?: any[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    // Encrypt sensitive data before storing (if encryption is enabled)
    const encryptedInputData = options.inputData
      ? this.encryptionManager
        ? this.encryptionManager.encryptSensitiveFields(options.inputData)
        : options.inputData
      : undefined;

    const encryptedOutputData = options.outputData
      ? this.encryptionManager
        ? this.encryptionManager.encryptSensitiveFields(options.outputData)
        : options.outputData
      : undefined;

    const encryptedMetadata = options.metadata
      ? this.encryptionManager
        ? this.encryptionManager.encryptSensitiveFields(options.metadata)
        : options.metadata
      : options.metadata || {};

    await this.supabase.from("agent_audit_log").insert({
      session_id: sessionId,
      agent_id: agentId,
      action,
      reasoning: options.reasoning,
      input_data: encryptedInputData,
      output_data: encryptedOutputData,
      confidence_level: options.confidenceLevel,
      evidence: options.evidence || [],
      metadata: encryptedMetadata || {},
    });
  }

  async logMetric(
    sessionId: string,
    agentId: string,
    metricType: string,
    metricValue: number,
    unit?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase.from("agent_metrics").insert({
      session_id: sessionId,
      agent_id: agentId,
      metric_type: metricType,
      metric_value: metricValue,
      unit,
      metadata,
    });
  }

  async logPerformanceMetric(
    sessionId: string,
    agentId: string,
    operation: string,
    durationMs: number,
    metadata: Record<string, any> = {},
    alertThresholdMs: number = 1000
  ): Promise<void> {
    await this.supabase.from("performance_metrics").insert({
      session_id: sessionId,
      agent_id: agentId,
      operation,
      duration_ms: durationMs,
      alert_threshold_ms: alertThresholdMs,
      metadata,
    });

    if (durationMs >= alertThresholdMs) {
      await this.logMetric(
        sessionId,
        agentId,
        "performance_alert",
        durationMs,
        "ms"
      );
    }
  }

  async getSessionAuditLog(sessionId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("agent_audit_log")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getSessionMetrics(sessionId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("agent_metrics")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getTotalTokens(sessionId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("agent_metrics")
      .select("metric_value")
      .eq("session_id", sessionId)
      .eq("metric_type", "tokens_used");

    if (error || !data) return 0;
    return data.reduce((sum, item) => sum + item.metric_value, 0);
  }

  async getTotalLatency(sessionId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("agent_metrics")
      .select("metric_value")
      .eq("session_id", sessionId)
      .eq("metric_type", "latency_ms");

    if (error || !data) return 0;
    return data.reduce((sum, item) => sum + item.metric_value, 0);
  }

  async logAgentTrace(
    sessionId: string,
    agentId: string,
    tool: string,
    payload: { input: Record<string, any>; output: Record<string, any> },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const previousHash = this.traceAnchors.get(sessionId) || "";
    const entry = {
      session_id: sessionId,
      agent_id: agentId,
      tool,
      input: payload.input,
      output: payload.output,
      metadata,
      previous_hash: previousHash,
    };

    const serialized = JSON.stringify(entry);
    const hash = crypto.createHash("sha256").update(serialized).digest("hex");
    this.traceAnchors.set(sessionId, hash);

    await this.supabase.from("agent_audit_log").insert({
      ...entry,
      hash,
    });
  }
}
