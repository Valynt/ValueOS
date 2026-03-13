/**
 * ExternalAPIAdapter
 *
 * Wraps outbound HTTP calls from agent-fabric services with:
 *   - Egress allowlist enforcement (via egressFetch)
 *   - Per-request timeout
 *   - Structured response envelope { success, data, error }
 *   - Audit logging of every outbound call
 *
 * All agent-fabric code that needs to call an external API must go through
 * this adapter rather than calling fetch() directly.
 */

import { egressFetch, EgressBlockedError } from "../egressClient.js";
import { logger } from "../logger.js";

export interface ExternalAPICallOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  /** Request timeout in milliseconds. Defaults to 30 000. */
  timeout?: number;
  /** Arbitrary context included in audit log entries. */
  auditContext?: Record<string, unknown>;
}

export interface ExternalAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** HTTP status code when a response was received. */
  statusCode?: number;
}

export class ExternalAPIAdapter {
  private readonly callerName: string;
  private readonly callerRole: string;

  constructor(callerName = "unknown", callerRole = "unknown") {
    this.callerName = callerName;
    this.callerRole = callerRole;
  }

  /**
   * Make an outbound HTTP call and return a structured response envelope.
   *
   * @param operationName - Human-readable label for audit logs (e.g. "transcribe-audio")
   * @param url           - Target URL; validated against the egress allowlist
   * @param options       - Fetch options plus timeout and audit context
   */
  async call<T = unknown>(
    operationName: string,
    url: string,
    options: ExternalAPICallOptions = {},
  ): Promise<ExternalAPIResponse<T>> {
    const { method = "GET", headers = {}, body, timeout = 30_000, auditContext = {} } = options;

    logger.info("ExternalAPIAdapter: outbound call", {
      caller: this.callerName,
      role: this.callerRole,
      operation: operationName,
      url,
      method,
      ...auditContext,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await egressFetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.warn("ExternalAPIAdapter: non-OK response", {
          caller: this.callerName,
          operation: operationName,
          status: response.status,
          url,
        });
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          statusCode: response.status,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? ((await response.json()) as T)
        : ((await response.text()) as unknown as T);

      return { success: true, data, statusCode: response.status };
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof EgressBlockedError) {
        logger.error("ExternalAPIAdapter: egress blocked", {
          caller: this.callerName,
          operation: operationName,
          url,
          reason: err.reason,
        });
        return { success: false, error: `Egress blocked: ${err.reason}` };
      }

      if (err instanceof Error && err.name === "AbortError") {
        logger.warn("ExternalAPIAdapter: request timed out", {
          caller: this.callerName,
          operation: operationName,
          url,
          timeoutMs: timeout,
        });
        return { success: false, error: `Request timed out after ${timeout}ms` };
      }

      logger.error("ExternalAPIAdapter: unexpected error", {
        caller: this.callerName,
        operation: operationName,
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

/**
 * Factory used by callers that need a named adapter instance.
 */
export function createExternalAPIAdapter(
  callerName: string,
  callerRole: string,
): ExternalAPIAdapter {
  return new ExternalAPIAdapter(callerName, callerRole);
}

export const externalapiadapter = new ExternalAPIAdapter();
