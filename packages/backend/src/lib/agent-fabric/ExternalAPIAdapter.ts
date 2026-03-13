/**
 * ExternalAPIAdapter
 *
 * Wraps outbound HTTP calls from agent-fabric and service code with:
 * - Configurable timeout (default 30s)
 * - Structured success/error response envelope
 * - Audit logging of every call (caller, operation, url, status, latency)
 *
 * Use createExternalAPIAdapter() to get a caller-scoped instance.
 * Never call fetch() directly from agent or service code.
 */

import { logger } from "../logger.js";

export interface ExternalAPICallOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeout?: number;
  /** Arbitrary context logged with the audit entry — must not contain PII. */
  auditContext?: Record<string, unknown>;
}

export interface ExternalAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  latencyMs?: number;
}

export class ExternalAPIAdapter {
  private readonly callerName: string;
  private readonly operationTag: string;

  constructor(callerName = "unknown", operationTag = "default") {
    this.callerName = callerName;
    this.operationTag = operationTag;
  }

  async call<T = unknown>(
    operationName: string,
    url: string,
    options: ExternalAPICallOptions = {}
  ): Promise<ExternalAPIResponse<T>> {
    const { method = "GET", headers = {}, body, timeout = 30_000, auditContext = {} } = options;
    const start = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      clearTimeout(timer);

      let data: T | undefined;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      const success = response.ok;

      logger.info("ExternalAPIAdapter call completed", {
        caller: this.callerName,
        operationTag: this.operationTag,
        operationName,
        status: response.status,
        latencyMs,
        success,
        ...auditContext,
      });

      if (!success) {
        return {
          success: false,
          status: response.status,
          error: `HTTP ${response.status} ${response.statusText}`,
          latencyMs,
        };
      }

      return { success: true, data, status: response.status, latencyMs };
    } catch (err) {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const errorMessage = isTimeout
        ? `Request timed out after ${timeout}ms`
        : err instanceof Error
          ? err.message
          : String(err);

      logger.error("ExternalAPIAdapter call failed", err instanceof Error ? err : undefined, {
        caller: this.callerName,
        operationTag: this.operationTag,
        operationName,
        latencyMs,
        isTimeout,
        ...auditContext,
      });

      return { success: false, error: errorMessage, latencyMs };
    }
  }
}

/**
 * Factory — creates a caller-scoped adapter instance.
 * @param callerName  Human-readable name of the calling service (for audit logs).
 * @param operationTag  Short tag grouping related operations (e.g. "call-analysis").
 */
export function createExternalAPIAdapter(
  callerName: string,
  operationTag: string
): ExternalAPIAdapter {
  return new ExternalAPIAdapter(callerName, operationTag);
}

// Legacy singleton export — kept for backward compatibility.
export const externalapiadapter = new ExternalAPIAdapter();
