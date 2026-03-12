/**
 * ServiceNow Adapter
 *
 * Implements the Table API (REST) for incident, change, and CMDB entity access.
 * Uses basic auth (username + password) or OAuth2 bearer token.
 * All entities include tenant isolation via credentials.tenantId.
 */

import {
  AuthError,
  EnterpriseAdapter,
  IntegrationError,
  RateLimitError,
  RateLimiter,
  ValidationError,
} from "../base/index.js";
import type { FetchOptions, IntegrationConfig, NormalizedEntity } from "../base/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;
const SN_API_VERSION = "v2";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ServiceNowEntityType = "incident" | "change_request" | "cmdb_ci" | "sc_task" | "problem";

interface ServiceNowRecord {
  sys_id: string;
  sys_created_on?: string;
  sys_updated_on?: string;
  [key: string]: unknown;
}

interface ServiceNowListResponse {
  result: ServiceNowRecord[];
}

interface ServiceNowSingleResponse {
  result: ServiceNowRecord;
}

interface ServiceNowErrorResponse {
  error?: { message?: string; detail?: string };
  status?: string;
}

interface ServiceNowConfigCredentials {
  accessToken?: string;
  username?: string;
  password?: string;
  instanceUrl?: string;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class ServiceNowAdapter extends EnterpriseAdapter {
  readonly provider = "servicenow";

  private accessToken: string | null = null;
  private basicAuthHeader: string | null = null;
  private instanceUrl: string | null = null;

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "servicenow",
      requestsPerMinute: 60,
    }));
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  protected async doConnect(): Promise<void> {
    const configured = this.readConfiguredCredentials();

    this.instanceUrl = configured.instanceUrl ?? this.config.baseUrl ?? null;
    if (!this.instanceUrl) {
      throw new AuthError(this.provider, "ServiceNow instanceUrl is required in IntegrationConfig.credentials or baseUrl.");
    }

    // Prefer bearer token; fall back to basic auth
    const token = this.credentials?.accessToken ?? configured.accessToken;
    if (token) {
      this.accessToken = token;
    } else if (configured.username && configured.password) {
      this.basicAuthHeader = `Basic ${Buffer.from(`${configured.username}:${configured.password}`).toString("base64")}`;
    } else {
      throw new AuthError(this.provider, "ServiceNow requires either an accessToken or username+password.");
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.accessToken = null;
    this.basicAuthHeader = null;
    this.instanceUrl = null;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  async validate(): Promise<boolean> {
    this.ensureConnected();
    try {
      // Lightweight call: fetch one incident to confirm credentials work
      await this.request<ServiceNowListResponse>("GET", this.tableUrl("incident"), { sysparm_limit: "1" });
      return true;
    } catch (error) {
      if (error instanceof AuthError) return false;
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // fetchEntities
  // -------------------------------------------------------------------------

  async fetchEntities(entityType: string, options?: FetchOptions): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    const table = this.validateEntityType(entityType);
    const params: Record<string, string> = {
      sysparm_limit: String(options?.limit ?? 100),
    };
    if (options?.offset) params["sysparm_offset"] = String(options.offset);
    if (options?.since) params["sysparm_query"] = `sys_updated_on>=${options.since.toISOString()}`;

    const response = await this.withRateLimit(
      this.credentials?.tenantId ?? "default",
      () => this.request<ServiceNowListResponse>("GET", this.tableUrl(table), params),
    );
    return response.result.map((r) => this.normalizeRecord(table, r));
  }

  // -------------------------------------------------------------------------
  // fetchEntity
  // -------------------------------------------------------------------------

  async fetchEntity(entityType: string, externalId: string): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    const table = this.validateEntityType(entityType);
    try {
      const response = await this.withRateLimit(
        this.credentials?.tenantId ?? "default",
        () => this.request<ServiceNowSingleResponse>("GET", `${this.tableUrl(table)}/${externalId}`),
      );
      return this.normalizeRecord(table, response.result);
    } catch (error) {
      if (error instanceof IntegrationError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // pushUpdate
  // -------------------------------------------------------------------------

  async pushUpdate(entityType: string, externalId: string, data: Record<string, unknown>): Promise<void> {
    this.ensureConnected();
    const table = this.validateEntityType(entityType);
    await this.withRateLimit(
      this.credentials?.tenantId ?? "default",
      () => this.request<ServiceNowSingleResponse>("PATCH", `${this.tableUrl(table)}/${externalId}`, undefined, data),
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private tableUrl(table: ServiceNowEntityType): string {
    return `/api/now/${SN_API_VERSION}/table/${table}`;
  }

  private validateEntityType(entityType: string): ServiceNowEntityType {
    const supported: ServiceNowEntityType[] = ["incident", "change_request", "cmdb_ci", "sc_task", "problem"];
    if (!supported.includes(entityType as ServiceNowEntityType)) {
      throw new ValidationError(this.provider, `Unsupported entity type: ${entityType}. Supported: ${supported.join(", ")}`);
    }
    return entityType as ServiceNowEntityType;
  }

  private normalizeRecord(entityType: ServiceNowEntityType, record: ServiceNowRecord): NormalizedEntity {
    return {
      id: record.sys_id,
      externalId: record.sys_id,
      provider: this.provider,
      type: entityType,
      data: record,
      metadata: {
        fetchedAt: new Date(),
        version: record.sys_updated_on as string | undefined,
        tenantId: this.credentials?.tenantId,
        organizationId: this.credentials?.tenantId,
      },
    };
  }

  private async request<T>(
    method: "GET" | "PATCH" | "POST" | "DELETE",
    path: string,
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<T> {
    const base = this.instanceUrl!;
    const url = new URL(path, base);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }

    const timeoutMs = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);

    const authHeader = this.accessToken
      ? `Bearer ${this.accessToken}`
      : this.basicAuthHeader!;

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.ok) return (await response.json()) as T;
      await this.throwMappedError(response);
      throw new IntegrationError("Unexpected ServiceNow error", "UNKNOWN", this.provider, true);
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new IntegrationError("ServiceNow request timed out", "TIMEOUT", this.provider, true);
      }
      throw error;
    } finally {
      clearTimeout(handle);
    }
  }

  private async throwMappedError(response: Response): Promise<never> {
    let payload: ServiceNowErrorResponse = {};
    try { payload = (await response.json()) as ServiceNowErrorResponse; } catch { /* ignore */ }
    const message = payload.error?.message ?? `ServiceNow request failed with status ${response.status}`;

    if (response.status === 401 || response.status === 403) throw new AuthError(this.provider, message);
    if (response.status === 404) throw new IntegrationError(message, "NOT_FOUND", this.provider, false);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      throw new RateLimitError(this.provider, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
    }
    if (response.status >= 400 && response.status < 500) throw new ValidationError(this.provider, message);
    throw new IntegrationError(message, "SERVICENOW_API_ERROR", this.provider, true);
  }

  private isAbortError(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
  }

  private readConfiguredCredentials(): ServiceNowConfigCredentials {
    return (this.config.credentials ?? {}) as ServiceNowConfigCredentials;
  }
}
