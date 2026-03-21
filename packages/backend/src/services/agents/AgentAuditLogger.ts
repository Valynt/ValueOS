/**
 * Agent Audit Logger
 *
 * Centralized logging system for all agent interactions with
 * database persistence and query capabilities.
 */

import { decrypt, encrypt } from "../../lib/crypto/CryptoUtils";
import {
  resolveAuditLogEncryptionKey,
  validateAuditLogEncryptionConfig,
} from "./AuditLogEncryptionConfig.js";
import { logger } from "../../lib/logger.js"
import { supabase } from "../../lib/supabase.js"
import { AgentContext, AgentType } from "../agent-types.js"

/**
 * Audit log entry
 */
export interface AgentAuditLog {
  /**
   * Unique log ID
   */
  id?: string;

  /**
   * Agent name/type
   */
  agent_name: AgentType;

  /**
   * Input query
   */
  input_query: string;

  /**
   * Request context
   */
  context?: AgentContext;

  /**
   * Response data (sanitized)
   */
  response_data?: unknown;

  /**
   * Response metadata
   */
  response_metadata?: unknown;

  /**
   * Success status
   */
  success: boolean;

  /**
   * Error message if failed
   */
  error_message?: string;

  /**
   * Timestamp
   */
  timestamp?: string;

  /**
   * User ID
   */
  user_id?: string;

  /**
   * Organization ID
   */
  organization_id?: string;

  /**
   * Session ID
   */
  session_id?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  /**
   * Filter by agent type
   */
  agent?: AgentType;

  /**
   * Filter by user ID
   */
  userId?: string;

  /**
   * Filter by organization ID
   */
  organizationId?: string;

  /**
   * Filter by session ID
   */
  sessionId?: string;

  /**
   * Filter by success status
   */
  success?: boolean;

  /**
   * Filter by date range (start)
   */
  startDate?: Date;

  /**
   * Filter by date range (end)
   */
  endDate?: Date;

  /**
   * Limit results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Sort order
   */
  sortOrder?: "asc" | "desc";
}

/**
 * Audit log statistics
 */
export interface AuditLogStats {
  /**
   * Total requests
   */
  totalRequests: number;

  /**
   * Successful requests
   */
  successfulRequests: number;

  /**
   * Failed requests
   */
  failedRequests: number;

  /**
   * Average duration (ms)
   */
  averageDuration: number;

  /**
   * Average confidence
   */
  averageConfidence: number;

  /**
   * Requests by agent
   */
  byAgent: Record<AgentType, number>;

  /**
   * Requests over time
   */
  timeline?: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * Agent Audit Logger Class
 */
export class AgentAuditLogger {
  private static instance: AgentAuditLogger | null = null;
  private enableLogging: boolean = true;
  private logQueue: AgentAuditLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
  private readonly MAX_QUEUE_SIZE = 100;

  // Encryption configuration
  private encryptionEnabled: boolean =
    process.env.AUDIT_LOG_ENCRYPTION_ENABLED === "true";
  private encryptionKey: string | null = null;

  private constructor() {
    // Initialize encryption if enabled
    if (this.encryptionEnabled) {
      this.initializeEncryption();
    }

    // Start auto-flush
    this.startAutoFlush();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentAuditLogger {
    if (!AgentAuditLogger.instance) {
      AgentAuditLogger.instance = new AgentAuditLogger();
    }
    return AgentAuditLogger.instance;
  }

  /**
   * Initialize encryption key and configuration
   */
  private initializeEncryption(): void {
    const validationErrors = validateAuditLogEncryptionConfig(process.env);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(" "));
    }

    const configuredKey = resolveAuditLogEncryptionKey(process.env);
    if (!configuredKey) {
      throw new Error(
        "Audit log encryption could not be initialized because AUDIT_LOG_ENCRYPTION_KEY is not configured."
      );
    }

    this.encryptionKey = configuredKey;
    logger.info("Audit log encryption initialized with configured key material");
  }

  /**
   * Enable or disable encryption
   */
  setEncryptionEnabled(enabled: boolean): void {
    this.encryptionEnabled = enabled;
    if (enabled && !this.encryptionKey) {
      this.initializeEncryption();
    }
  }

  /**
   * Check if encryption is enabled and available
   */
  isEncryptionEnabled(): boolean {
    return this.encryptionEnabled && !!this.encryptionKey;
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Sanitize and encrypt audit log entry before storage
   */
  private async sanitizeLogEntry(entry: AgentAuditLog): Promise<AgentAuditLog> {
    const sanitized: AgentAuditLog = {
      ...entry,
    };

    // Sanitize string fields to prevent injection
    if (sanitized.input_query && typeof sanitized.input_query === "string") {
      sanitized.input_query = this.sanitizeString(sanitized.input_query, 1000);
    }

    if (
      sanitized.error_message &&
      typeof sanitized.error_message === "string"
    ) {
      sanitized.error_message = this.sanitizeString(
        sanitized.error_message,
        500
      );
    }

    if (sanitized.user_id && typeof sanitized.user_id === "string") {
      sanitized.user_id = this.sanitizeString(sanitized.user_id, 100);
    }

    if (
      sanitized.organization_id &&
      typeof sanitized.organization_id === "string"
    ) {
      sanitized.organization_id = this.sanitizeString(
        sanitized.organization_id,
        100
      );
    }

    if (sanitized.session_id && typeof sanitized.session_id === "string") {
      sanitized.session_id = this.sanitizeString(sanitized.session_id, 100);
    }

    // Encrypt sensitive response data
    if (sanitized.response_data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sanitized.response_data = await this.encryptSensitiveData(sanitized.response_data);
    }

    // Encrypt sensitive context
    if (sanitized.context) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sanitized.context = await this.encryptSensitiveData(sanitized.context);
    }

    // Encrypt sensitive metadata
    if (sanitized.metadata) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sanitized.metadata = await this.encryptSensitiveData(sanitized.metadata);
    }

    // Encrypt sensitive response metadata
    if (sanitized.response_metadata) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sanitized.response_metadata = await this.encryptSensitiveData(sanitized.response_metadata);
    }

    return sanitized;
  }

  /**
   * Sanitize string to prevent injection and limit length
   */
  private sanitizeString(str: string, maxLength: number): string {
    if (!str || typeof str !== "string") {
      return "";
    }

    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .replace(/[<>\"'&]/g, "")
      .substring(0, maxLength);
  }

  /**
   * Encrypt sensitive data if encryption is enabled
   */
  private async encryptSensitiveData(data: unknown): Promise<unknown> {
    if (!this.isEncryptionEnabled()) {
      // Fall back to sanitization if encryption is not available
      return this.sanitizeAndZeroMemory(data);
    }

    if (data === null || data === undefined) {
      return null;
    }

    try {
      // Encrypt the entire data structure
      const dataString = JSON.stringify(data);
      const encryptedString = await encrypt(dataString, this.encryptionKey!);

      // Return encrypted data with encryption marker
      return {
        __encrypted__: true,
        data: encryptedString,
        iv: '',
        tag: '',
        algorithm: 'aes-256-gcm',
      };
    } catch (error) {
      logger.error(
        "Failed to encrypt sensitive data, falling back to sanitization",
        error instanceof Error ? error : undefined
      );
      // Fall back to sanitization if encryption fails
      return this.sanitizeAndZeroMemory(data);
    }
  }

  /**
   * Decrypt sensitive data if it's encrypted
   */
  private async decryptSensitiveData(data: unknown): Promise<unknown> {
    if (!this.isEncryptionEnabled() || !data || typeof data !== "object") {
      return data;
    }

    // Check if data is encrypted
    const dataRecord = data as Record<string, unknown>;
    if (!dataRecord.__encrypted__) {
      return data;
    }

    try {
      const encryptedString = dataRecord.data as string;
      const decryptedString = await decrypt(encryptedString, this.encryptionKey!);
      return JSON.parse(decryptedString);
    } catch (error) {
      logger.error(
        "Failed to decrypt sensitive data",
        error instanceof Error ? error : undefined
      );
      // Return encrypted data as-is if decryption fails
      return data;
    }
  }

  /**
   * Sanitize and zero out sensitive data from memory
   */
  private sanitizeAndZeroMemory(data: unknown): unknown {
    if (data === null || data === undefined) {
      return null;
    }

    if (typeof data === "string") {
      const sanitized = this.sanitizeString(data, 10000);
      // Zero out original string reference if it contains sensitive patterns
      if (this.containsSensitiveData(data)) {
        // In production, use secure string zeroing
        // For now, we'll rely on garbage collection
        data = undefined;
      }
      return sanitized;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return data;
    }

    if (Array.isArray(data)) {
      const sanitizedArray = data.slice(0, 100).map((item, index) => {
        const sanitized = this.sanitizeAndZeroMemory(item);
        // Zero out original array element if sensitive
        if (this.containsSensitiveData(item)) {
          data[index] = null;
        }
        return sanitized;
      });
      return sanitizedArray;
    }

    if (typeof data === "object") {
      const sanitized: Record<string, unknown> = {};
      let keyCount = 0;
      const maxKeys = 50;

      for (const [key, value] of Object.entries(data)) {
        if (keyCount >= maxKeys) break;

        const sanitizedKey = this.sanitizeString(key, 100);
        const sanitizedValue = this.sanitizeAndZeroMemory(value);

        sanitized[sanitizedKey] = sanitizedValue;

        // Zero out sensitive fields
        if (this.isSensitiveField(key) || this.containsSensitiveData(value)) {
          (data as Record<string, unknown>)[key] = null;
        }

        keyCount++;
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Check if data contains sensitive patterns
   */
  private containsSensitiveData(data: unknown): boolean {
    if (!data) return false;

    const dataString =
      typeof data === "string" ? data : JSON.stringify(data).toLowerCase();

    // Sensitive patterns to detect
    const sensitivePatterns = [
      /\b(password|passwd|pwd|secret|token|key|api_key)\b/i,
      /\b(social security|ssn|tax id)\b/i,
      /\b(credit card|card number|cvv|expiry)\b/i,
      /\b(bank account|account number|routing)\b/i,
      /\b(medical|health|diagnosis|treatment)\b/i,
      /\b(confidential|proprietary|trade secret)\b/i,
      /\b(private key|public key|certificate)\b/i,
      /\b(session|session id|jwt|oauth)\b/i,
      /\b(two factor|2fa|mfa|totp)\b/i,
      /\b(phone number|mobile|telephone)\b/i,
      /\b(email address|email)\b/i,
      /\b(home address|street address|address)\b/i,
      /\b(birth date|dob|date of birth)\b/i,
      /\b(driver's license|license number)\b/i,
      /\b(passport|passport number)\b/i,
      /\b(income|salary|wages|employment)\b/i,
      /\b(hipaa|phi|protected health)\b/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(dataString));
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      "password",
      "passwd",
      "pwd",
      "secret",
      "token",
      "key",
      "api_key",
      "private_key",
      "public_key",
      "certificate",
      "session",
      "session_id",
      "jwt",
      "oauth",
      "authorization",
      "auth",
      "credentials",
      "ssn",
      "social_security",
      "tax_id",
      "credit_card",
      "card_number",
      "cvv",
      "expiry",
      "bank_account",
      "account_number",
      "routing",
      "medical",
      "health",
      "diagnosis",
      "treatment",
      "patient",
      "confidential",
      "proprietary",
      "trade_secret",
      "internal",
      "phone",
      "mobile",
      "telephone",
      "email",
      "address",
      "birth_date",
      "dob",
      "license",
      "passport",
      "income",
      "salary",
      "wages",
    ];

    return sensitiveFields.some((field) =>
      fieldName.toLowerCase().includes(field)
    );
  }

  /**
   * Log agent interaction
   */
  async log(entry: Omit<AgentAuditLog, "id" | "timestamp">): Promise<void> {
    if (!this.enableLogging) {
      return;
    }

    // Sanitize the log entry
    const sanitizedEntry = await this.sanitizeLogEntry({
      ...entry,
      timestamp: new Date().toISOString(),
    });

    // Add to queue
    this.logQueue.push(sanitizedEntry);

    // Flush if queue is full
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
      await this.flush();
    }
  }

  /**
   * Flush log queue to database with secure memory cleanup
   */
  async flush(): Promise<void> {
    if (this.logQueue.length === 0) {
      return;
    }

    const entries = [...this.logQueue];
    // Clear queue immediately to prevent data exposure
    this.logQueue = [];

    try {
      const { error } = await supabase.from("agent_audit_logs").insert(entries);

      if (error) {
        logger.error(
          "Failed to flush audit logs",
          error instanceof Error ? error : undefined
        );
        // Re-add to queue on failure
        this.logQueue.unshift(...entries);
      } else {
        // Successfully flushed - zero out sensitive data in entries
        this.securelyZeroEntries(entries);
      }
    } catch (error) {
      logger.error(
        "Error flushing audit logs",
        error instanceof Error ? error : undefined
      );
      // Re-add to queue on failure
      this.logQueue.unshift(...entries);
    }
  }

  /**
   * Securely zero out sensitive data in flushed entries
   */
  private securelyZeroEntries(entries: AgentAuditLog[]): void {
    entries.forEach((entry) => {
      // Zero out sensitive fields
      if (entry.input_query && this.containsSensitiveData(entry.input_query)) {
        entry.input_query = "[REDACTED]";
      }

      if (
        entry.error_message &&
        this.containsSensitiveData(entry.error_message)
      ) {
        entry.error_message = "[REDACTED]";
      }

      if (entry.response_data) {
        entry.response_data = this.sanitizeAndZeroMemory(entry.response_data);
      }

      if (entry.context) {
        entry.context = this.sanitizeAndZeroMemory(entry.context);
      }

      if (entry.metadata) {
        entry.metadata = this.sanitizeAndZeroMemory(entry.metadata);
      }

      if (entry.response_metadata) {
        entry.response_metadata = this.sanitizeAndZeroMemory(entry.response_metadata);
      }
    });
  }

  /**
   * Query audit logs. organizationId is required for tenant isolation.
   */
  async query(filters: AuditLogFilters & { organizationId: string }): Promise<AgentAuditLog[]> {
    if (!filters.organizationId) {
      throw new Error("organizationId is required for agent audit log queries to enforce tenant isolation");
    }

    let query = supabase.from("agent_audit_logs").select("*");

    // CRITICAL: Apply tenant filter first
    query = query.eq("organization_id", filters.organizationId);

    if (filters.agent) {
      query = query.eq("agent_name", filters.agent);
    }

    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters.sessionId) {
      query = query.eq("session_id", filters.sessionId);
    }

    if (filters.success !== undefined) {
      query = query.eq("success", filters.success);
    }

    if (filters.startDate) {
      query = query.gte("timestamp", filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte("timestamp", filters.endDate.toISOString());
    }

    // Sort
    query = query.order("timestamp", {
      ascending: filters.sortOrder === "asc",
    });

    // Pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        "Failed to query audit logs",
        error instanceof Error ? error : undefined
      );
      return [];
    }

    // Decrypt sensitive data in retrieved logs
    const decryptedLogs = await Promise.all(
      (data as AgentAuditLog[]).map(async (log: AgentAuditLog) => ({
        ...log,
        response_data: await this.decryptSensitiveData(log.response_data),
        context: await this.decryptSensitiveData(log.context),
        metadata: await this.decryptSensitiveData(log.metadata),
        response_metadata: await this.decryptSensitiveData(log.response_metadata),
      }))
    ) as AgentAuditLog[];

    return decryptedLogs;
  }

  /**
   * Get audit log statistics. organizationId is required for tenant isolation.
   */
  async getStats(
    filters: Omit<AuditLogFilters, "limit" | "offset" | "sortOrder"> & { organizationId: string }
  ): Promise<AuditLogStats> {
    const logs = await this.query({ ...filters, limit: 10000 });

    const stats: AuditLogStats = {
      totalRequests: logs.length,
      successfulRequests: logs.filter((log) => log.success).length,
      failedRequests: logs.filter((log) => !log.success).length,
      averageDuration: 0,
      averageConfidence: 0,
      byAgent: {} as Record<AgentType, number>,
    };

    if (logs.length > 0) {
      // Calculate averages
      const durations = logs
        .map((log) => log.response_metadata?.duration || 0)
        .filter((d) => d > 0);
      stats.averageDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length || 0;

      const confidences = logs
        .map((log) => log.response_metadata?.confidence || 0)
        .filter((c) => c > 0);
      stats.averageConfidence =
        confidences.reduce((sum, c) => sum + c, 0) / confidences.length || 0;

      // Count by agent
      logs.forEach((log) => {
        const agent = log.agent_name;
        stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
      });

      // Timeline (group by date)
      const timelineMap = new Map<string, number>();
      logs.forEach((log) => {
        const date = log.timestamp?.split("T")[0] || "";
        timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
      });

      stats.timeline = Array.from(timelineMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return stats;
  }

  /**
   * Get recent logs. organizationId is required for tenant isolation.
   */
  async getRecent(organizationId: string, limit: number = 50): Promise<AgentAuditLog[]> {
    return this.query({ organizationId, limit, sortOrder: "desc" });
  }

  /**
   * Get logs for a specific agent. organizationId is required for tenant isolation.
   */
  async getByAgent(
    organizationId: string,
    agent: AgentType,
    limit: number = 50
  ): Promise<AgentAuditLog[]> {
    return this.query({ organizationId, agent, limit, sortOrder: "desc" });
  }

  /**
   * Get logs for a specific user. organizationId is required for tenant isolation.
   */
  async getByUser(
    organizationId: string,
    userId: string,
    limit: number = 50
  ): Promise<AgentAuditLog[]> {
    return this.query({ organizationId, userId, limit, sortOrder: "desc" });
  }

  /**
   * Get logs for a specific session. organizationId is required for tenant isolation.
   */
  async getBySession(organizationId: string, sessionId: string): Promise<AgentAuditLog[]> {
    return this.query({ organizationId, sessionId, sortOrder: "asc" });
  }

  /**
   * Delete old logs for a specific tenant. organizationId is required to prevent
   * cross-tenant deletion.
   */
  async deleteOldLogs(organizationId: string, daysToKeep: number = 90): Promise<number> {
    if (!organizationId) {
      throw new Error("organizationId is required for deleteOldLogs to enforce tenant isolation");
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from("agent_audit_logs")
      .delete()
      .eq("organization_id", organizationId)
      .lt("timestamp", cutoffDate.toISOString())
      .select("id");

    if (error) {
      logger.error(
        "Failed to delete old logs",
        error instanceof Error ? error : undefined
      );
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Cleanup and stop logger
   */
  async cleanup(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }
}

/**
 * Get singleton instance
 */
export function getAuditLogger(): AgentAuditLogger {
  return AgentAuditLogger.getInstance();
}

/**
 * Helper function to log agent request
 */
export async function logAgentRequest(
  agent: AgentType,
  query: string,
  context?: AgentContext
): Promise<void> {
  const logger = getAuditLogger();
  await logger.log({
    agent_name: agent,
    input_query: query,
    context,
    success: true, // Will be updated on response
    user_id: context?.userId,
    organization_id: context?.organizationId,
    session_id: context?.sessionId,
  });
}

/**
 * Helper function to log agent response
 */
export async function logAgentResponse(
  agent: AgentType,
  query: string,
  success: boolean,
  responseData?: unknown,
  responseMetadata?: unknown,
  error?: string,
  context?: AgentContext
): Promise<void> {
  const logger = getAuditLogger();
  await logger.log({
    agent_name: agent,
    input_query: query,
    context,
    response_data: responseData,
    response_metadata: responseMetadata,
    success,
    error_message: error,
    user_id: context?.userId,
    organization_id: context?.organizationId,
    session_id: context?.sessionId,
  });
}


