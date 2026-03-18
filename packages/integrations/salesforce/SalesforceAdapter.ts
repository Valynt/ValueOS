/**
 * Salesforce Adapter
 *
 * 4-layer integration architecture:
 *   1. Client layer  — OAuth2 token refresh + REST API calls to /services/data/vXX.0/
 *   2. Adapter layer — maps Salesforce Opportunity/Account/Contact to ValueOS domain types
 *   3. Webhook layer — handles Outbound Message / Change Data Capture events
 *   4. Health        — exposes connection health for the integration health registry
 *
 * All queries include tenant isolation via credentials.tenantId.
 */

import {
  AuthError,
  EnterpriseAdapter,
  IntegrationError,
  RateLimiter,
  RateLimitError,
  ValidationError,
} from "../base/index.js";
import type { FetchOptions, IntegrationConfig, NormalizedEntity } from "../base/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SF_LOGIN_URL = "https://login.salesforce.com";
const SF_API_VERSION = "v59.0";
const SF_RATE_LIMIT_PER_MINUTE = 100;
const DEFAULT_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SalesforceEntityType = "Opportunity" | "Account" | "Contact" | "Task";

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
}

interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

interface SalesforceErrorItem {
  message?: string;
  errorCode?: string;
}

interface SalesforceConfigCredentials {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  instanceUrl?: string;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class SalesforceAdapter extends EnterpriseAdapter {
  readonly provider = "salesforce";

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private instanceUrl: string | null = null;
  private readonly loginBaseUrl: string;

  constructor(config: IntegrationConfig) {
    super(
      config,
      new RateLimiter({
        provider: "salesforce",
        requestsPerMinute: SF_RATE_LIMIT_PER_MINUTE,
      }),
    );
    this.loginBaseUrl = config.baseUrl ?? DEFAULT_SF_LOGIN_URL;
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  protected async doConnect(): Promise<void> {
    const configured = this.readConfiguredCredentials();

    this.accessToken = this.credentials?.accessToken ?? configured.accessToken ?? null;
    this.refreshToken = this.credentials?.refreshToken ?? configured.refreshToken ?? null;
    this.instanceUrl = configured.instanceUrl ?? null;

    if (!this.accessToken) {
      throw new AuthError(
        this.provider,
        "Salesforce access token is required. Provide it via connect() credentials or IntegrationConfig.credentials.",
      );
    }

    // Validate the token; refresh if expired
    const valid = await this.validate();
    if (!valid) {
      await this.refreshAccessToken();
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.instanceUrl = null;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  async validate(): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.request<Record<string, unknown>>("GET", "/services/oauth2/userinfo");
      return true;
    } catch (error) {
      if (error instanceof AuthError) return false;
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // fetchEntities — generic list
  // -------------------------------------------------------------------------

  async fetchEntities(entityType: string, options?: FetchOptions): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    const sfType = this.validateEntityType(entityType);
    const soql = this.buildSOQL(sfType, options);
    const response = await this.query<Record<string, unknown>>(soql);
    return response.records.map((r) => this.normalizeRecord(sfType, r));
  }

  // -------------------------------------------------------------------------
  // fetchEntity — single record
  // -------------------------------------------------------------------------

  async fetchEntity(entityType: string, externalId: string): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    const sfType = this.validateEntityType(entityType);
    try {
      const record = await this.request<Record<string, unknown>>(
        "GET",
        `/services/data/${SF_API_VERSION}/sobjects/${sfType}/${externalId}`,
      );
      return this.normalizeRecord(sfType, record);
    } catch (error) {
      if (error instanceof IntegrationError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // pushUpdate — patch a record
  // -------------------------------------------------------------------------

  async pushUpdate(
    entityType: string,
    externalId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.ensureConnected();
    const sfType = this.validateEntityType(entityType);
    await this.request<void>(
      "PATCH",
      `/services/data/${SF_API_VERSION}/sobjects/${sfType}/${externalId}`,
      data,
    );
  }

  // -------------------------------------------------------------------------
  // Domain-specific operations
  // -------------------------------------------------------------------------

  /** Fetch open opportunities for a tenant. */
  async getOpportunities(
    tenantId: string,
    filters?: { stage?: string; ownerId?: string; since?: Date },
  ): Promise<NormalizedEntity[]> {
    this.ensureConnected();

    const conditions: string[] = ["IsClosed = false"];
    if (filters?.stage) conditions.push(`StageName = '${this.escapeSoql(filters.stage)}'`);
    if (filters?.ownerId) conditions.push(`OwnerId = '${this.escapeSoql(filters.ownerId)}'`);
    if (filters?.since) conditions.push(`LastModifiedDate >= ${filters.since.toISOString()}`);

    const soql =
      `SELECT Id, Name, StageName, Amount, CloseDate, AccountId, OwnerId, ` +
      `Description, Probability, CreatedDate, LastModifiedDate ` +
      `FROM Opportunity WHERE ${conditions.join(" AND ")} ORDER BY LastModifiedDate DESC LIMIT 200`;

    const response = await this.query<Record<string, unknown>>(soql);
    return response.records.map((r) => this.normalizeRecord("Opportunity", r, tenantId));
  }

  /** Fetch a single account by Salesforce ID. */
  async getAccount(accountId: string, tenantId: string): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    try {
      const record = await this.request<Record<string, unknown>>(
        "GET",
        `/services/data/${SF_API_VERSION}/sobjects/Account/${accountId}`,
      );
      return this.normalizeRecord("Account", record, tenantId);
    } catch (error) {
      if (error instanceof IntegrationError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  }

  /**
   * Push value case data to a Salesforce Opportunity.
   * Maps ValueOS fields to standard Opportunity fields.
   */
  async syncValueCase(
    caseId: string,
    opportunityId: string,
    caseData: {
      title?: string;
      confidence?: number;
      estimatedValue?: number;
      stage?: string;
    },
  ): Promise<void> {
    this.ensureConnected();

    const patch: Record<string, unknown> = {
      Description: `ValueOS Case: ${caseId}`,
    };
    if (caseData.title) patch["Name"] = caseData.title;
    if (caseData.estimatedValue !== undefined) patch["Amount"] = caseData.estimatedValue;
    if (caseData.stage) patch["StageName"] = caseData.stage;
    if (caseData.confidence !== undefined) {
      patch["Probability"] = Math.round(caseData.confidence * 100);
    }

    await this.request<void>(
      "PATCH",
      `/services/data/${SF_API_VERSION}/sobjects/Opportunity/${opportunityId}`,
      patch,
    );
  }

  /** Log an activity (Task) against a Salesforce Opportunity. */
  async createActivity(
    opportunityId: string,
    activity: { subject: string; description?: string; dueDate?: string },
  ): Promise<string> {
    this.ensureConnected();

    const body: Record<string, unknown> = {
      Subject: activity.subject,
      WhatId: opportunityId,
      Status: "Completed",
    };
    if (activity.description) body["Description"] = activity.description;
    if (activity.dueDate) body["ActivityDate"] = activity.dueDate;

    const result = await this.request<{ id: string; success: boolean }>(
      "POST",
      `/services/data/${SF_API_VERSION}/sobjects/Task`,
      body,
    );

    if (!result.success) {
      throw new IntegrationError(
        "Failed to create Salesforce Task",
        "CREATE_FAILED",
        this.provider,
        true,
      );
    }

    return result.id;
  }

  // -------------------------------------------------------------------------
  // Webhook handler
  // -------------------------------------------------------------------------

  /**
   * Process an inbound Salesforce webhook payload.
   * Supports Change Data Capture events and Outbound Messages.
   */
  handleWebhookPayload(
    payload: Record<string, unknown>,
    tenantId: string,
  ): NormalizedEntity | null {
    // Change Data Capture
    if (payload["changeType"] && payload["recordIds"]) {
      const entityType = (payload["entityName"] as string | undefined) ?? "Unknown";
      const recordIds = payload["recordIds"] as string[];
      const id = recordIds[0] ?? "unknown";
      return {
        id,
        externalId: id,
        provider: this.provider,
        type: entityType,
        data: payload,
        metadata: { fetchedAt: new Date(), tenantId, version: SF_API_VERSION },
      };
    }

    // Outbound Message
    if (payload["sObject"]) {
      const sObject = payload["sObject"] as Record<string, unknown>;
      const type = (sObject["type"] as string | undefined) ?? "Unknown";
      return this.normalizeRecord(type as SalesforceEntityType, sObject, tenantId);
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------------

  async getHealthStatus(): Promise<{
    healthy: boolean;
    provider: string;
    instanceUrl: string | null;
    apiVersion: string;
    checkedAt: string;
  }> {
    let healthy = false;
    try {
      healthy = await this.validate();
    } catch {
      healthy = false;
    }
    return {
      healthy,
      provider: this.provider,
      instanceUrl: this.instanceUrl,
      apiVersion: SF_API_VERSION,
      checkedAt: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // OAuth2 token refresh
  // -------------------------------------------------------------------------

  private async refreshAccessToken(): Promise<void> {
    const configured = this.readConfiguredCredentials();
    const { clientId, clientSecret } = configured;
    const refreshToken = this.refreshToken ?? configured.refreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new AuthError(
        this.provider,
        "Cannot refresh token: clientId, clientSecret, and refreshToken are required.",
      );
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(`${this.loginBaseUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as SalesforceErrorItem;
      throw new AuthError(
        this.provider,
        `Token refresh failed: ${body.message ?? response.statusText}`,
      );
    }

    const token = (await response.json()) as SalesforceTokenResponse;
    this.accessToken = token.access_token;
    if (token.refresh_token) this.refreshToken = token.refresh_token;
    if (token.instance_url) this.instanceUrl = token.instance_url;
  }

  // -------------------------------------------------------------------------
  // SOQL helpers
  // -------------------------------------------------------------------------

  private buildSOQL(entityType: SalesforceEntityType, options?: FetchOptions): string {
    const fields = this.defaultFields(entityType);
    const conditions: string[] = [];

    if (options?.since) {
      conditions.push(`LastModifiedDate >= ${options.since.toISOString()}`);
    }
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (typeof value === "string") {
          conditions.push(`${key} = '${this.escapeSoql(value)}'`);
        } else if (typeof value === "number" || typeof value === "boolean") {
          conditions.push(`${key} = ${value}`);
        }
      }
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    const limit = options?.limit ?? 200;
    const offset = options?.offset ? ` OFFSET ${options.offset}` : "";

    return `SELECT ${fields} FROM ${entityType}${where} ORDER BY LastModifiedDate DESC LIMIT ${limit}${offset}`;
  }

  private defaultFields(entityType: SalesforceEntityType): string {
    const map: Record<SalesforceEntityType, string> = {
      Opportunity:
        "Id, Name, StageName, Amount, CloseDate, AccountId, OwnerId, Description, Probability, CreatedDate, LastModifiedDate",
      Account:
        "Id, Name, Industry, AnnualRevenue, NumberOfEmployees, Website, BillingCity, BillingCountry, CreatedDate, LastModifiedDate",
      Contact:
        "Id, FirstName, LastName, Email, Title, AccountId, Phone, CreatedDate, LastModifiedDate",
      Task: "Id, Subject, Description, Status, WhatId, WhoId, ActivityDate, CreatedDate",
    };
    return map[entityType] ?? "Id, Name, CreatedDate, LastModifiedDate";
  }

  private escapeSoql(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  // -------------------------------------------------------------------------
  // Normalisation
  // -------------------------------------------------------------------------

  private normalizeRecord(
    entityType: string,
    record: Record<string, unknown>,
    tenantId?: string,
  ): NormalizedEntity {
    const id = (record["Id"] as string | undefined) ?? "unknown";
    return {
      id,
      externalId: id,
      provider: this.provider,
      type: entityType,
      data: record,
      metadata: {
        fetchedAt: new Date(),
        version: SF_API_VERSION,
        tenantId: tenantId ?? this.credentials?.tenantId,
      },
    };
  }

  private validateEntityType(entityType: string): SalesforceEntityType {
    const supported: SalesforceEntityType[] = ["Opportunity", "Account", "Contact", "Task"];
    if (!supported.includes(entityType as SalesforceEntityType)) {
      throw new ValidationError(
        this.provider,
        `Unsupported entity type: ${entityType}. Supported: ${supported.join(", ")}`,
      );
    }
    return entityType as SalesforceEntityType;
  }

  // -------------------------------------------------------------------------
  // HTTP client
  // -------------------------------------------------------------------------

  private async query<T>(soql: string): Promise<SalesforceQueryResponse<T>> {
    const encoded = encodeURIComponent(soql);
    return this.request<SalesforceQueryResponse<T>>(
      "GET",
      `/services/data/${SF_API_VERSION}/query?q=${encoded}`,
    );
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.accessToken) {
      throw new AuthError(this.provider, "No access token available.");
    }

    const baseUrl = this.instanceUrl ?? this.loginBaseUrl;
    const url = `${baseUrl}${path}`;
    const timeoutMs = this.config.timeout ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Transparent token refresh on 401
      if (response.status === 401 && this.refreshToken) {
        await this.refreshAccessToken();
        return this.request<T>(method, path, body);
      }

      if (response.ok || response.status === 204) {
        if (response.status === 204) return undefined as unknown as T;
        return (await response.json()) as T;
      }

      await this.throwMappedError(response);
      throw new IntegrationError("Unexpected Salesforce error", "UNKNOWN", this.provider, true);
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new IntegrationError("Salesforce request timed out", "TIMEOUT", this.provider, true);
      }
      throw error;
    } finally {
      clearTimeout(handle);
    }
  }

  private async throwMappedError(response: Response): Promise<never> {
    let payload: SalesforceErrorItem = {};
    try {
      const body = await response.json();
      payload = Array.isArray(body)
        ? (body[0] as SalesforceErrorItem)
        : (body as SalesforceErrorItem);
    } catch {
      // ignore parse failure
    }

    const message = payload.message ?? `Salesforce request failed with status ${response.status}`;

    if (response.status === 401 || response.status === 403) throw new AuthError(this.provider, message);
    if (response.status === 404) throw new IntegrationError(message, "NOT_FOUND", this.provider, false);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      throw new RateLimitError(this.provider, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
    }
    if (response.status >= 400 && response.status < 500) throw new ValidationError(this.provider, message);

    throw new IntegrationError(message, "SALESFORCE_API_ERROR", this.provider, true);
  }

  private isAbortError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "AbortError"
    );
  }

  private readConfiguredCredentials(): SalesforceConfigCredentials {
    return (this.config.credentials ?? {}) as SalesforceConfigCredentials;
  }
}
