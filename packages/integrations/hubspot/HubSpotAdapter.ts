/**
 * HubSpot CRM Adapter
 */

import { Client } from "@hubspot/api-client";
import {
  AuthError,
  ConnectionError,
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
  RateLimiter,
  RateLimitError,
  ValidationError,
} from "../base/index.js";

const HUBSPOT_RATE_LIMIT = 100; // requests per 10 seconds
const SUPPORTED_ENTITY_TYPES = new Set(["contacts", "companies", "deals", "tickets"]);

type HubSpotApiResponse = {
  status: number;
  body?: {
    id?: string;
    properties?: Record<string, unknown>;
    updatedAt?: string;
    createdAt?: string;
    archived?: boolean;
    results?: Array<{
      id: string;
      properties?: Record<string, unknown>;
      updatedAt?: string;
      createdAt?: string;
      archived?: boolean;
    }>;
    paging?: {
      next?: {
        after?: string;
      };
    };
  };
  headers?: Record<string, string | number | string[]>;
};

export class HubSpotAdapter extends EnterpriseAdapter {
  readonly provider = "hubspot";

  private client: Client | null = null;

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "hubspot",
      requestsPerMinute: HUBSPOT_RATE_LIMIT * 6,
      burstLimit: HUBSPOT_RATE_LIMIT,
    }));
  }

  protected async doConnect(): Promise<void> {
    if (!this.credentials) {
      throw new ConnectionError(this.provider, "Missing integration credentials");
    }

    this.client = new Client({
      accessToken: this.credentials.accessToken,
      basePath: this.config.baseUrl,
      numberOfApiCallRetries: 0,
    });
  }

  protected async doDisconnect(): Promise<void> {
    this.client = null;
  }

  async validate(): Promise<boolean> {
    this.ensureConnected();

    try {
      await this.requestHubSpot("GET", "/crm/v3/objects/contacts", {
        limit: 1,
        properties: ["email"],
      });
      return true;
    } catch (error) {
      if (this.isAuthFailure(error) || error instanceof AuthError) {
        return false;
      }
      this.handleHubSpotError(error);
    }
  }

  async fetchEntities(
    entityType: string,
    options?: FetchOptions
  ): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    this.ensureSupportedEntityType(entityType);

    const tenantId = this.credentials?.tenantId;
    const limit = options?.limit ?? 100;
    const after = options?.offset !== undefined ? String(options.offset) : undefined;

    try {
      const response = await this.withRateLimit(this.credentials!.tenantId, () =>
        this.requestHubSpot("GET", `/crm/v3/objects/${entityType}`, {
          limit,
          after,
          properties: this.propertiesForEntityType(entityType),
          archived: false,
        })
      );

      const entities = response.body?.results ?? [];
      return entities.map((entity) => this.normalizeEntity(entityType, entity, tenantId));
    } catch (error) {
      this.handleHubSpotError(error);
    }
  }

  async fetchEntity(
    entityType: string,
    externalId: string
  ): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    this.ensureSupportedEntityType(entityType);

    try {
      const response = await this.withRateLimit(this.credentials!.tenantId, () =>
        this.requestHubSpot("GET", `/crm/v3/objects/${entityType}/${externalId}`, {
          properties: this.propertiesForEntityType(entityType),
          archived: false,
        })
      );

      if (!response.body || !response.body.id) {
        return null;
      }

      return this.normalizeEntity(entityType, {
        id: response.body.id,
        properties: response.body.properties,
        updatedAt: response.body.updatedAt,
        createdAt: response.body.createdAt,
        archived: response.body.archived,
      }, this.credentials?.tenantId);
    } catch (error) {
      if (this.isNotFound(error)) {
        return null;
      }
      this.handleHubSpotError(error);
    }
  }

  async pushUpdate(
    entityType: string,
    externalId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    this.ensureConnected();
    this.ensureSupportedEntityType(entityType);

    await this.withRateLimit(this.credentials!.tenantId, () =>
      this.withRetry(async () => {
        try {
          await this.requestHubSpot("PATCH", `/crm/v3/objects/${entityType}/${externalId}`, {
            properties: data,
          });
        } catch (error) {
          if (this.isAuthFailure(error)) {
            throw new AuthError(this.provider, "HubSpot authentication failed", this.asError(error));
          }

          if (this.isRateLimitFailure(error)) {
            throw new RateLimitError(this.provider, this.retryAfterMs(error), this.asError(error));
          }

          if (this.isValidationFailure(error)) {
            throw new ValidationError(this.provider, "HubSpot rejected update payload", this.asError(error));
          }

          throw new ConnectionError(this.provider, "Failed to update HubSpot entity", this.asError(error));
        }
      })
    );
  }

  private ensureSupportedEntityType(entityType: string): void {
    if (!SUPPORTED_ENTITY_TYPES.has(entityType)) {
      throw new ValidationError(
        this.provider,
        `Unsupported HubSpot entity type: ${entityType}. Supported types: ${Array.from(SUPPORTED_ENTITY_TYPES).join(", ")}`
      );
    }
  }

  private normalizeEntity(
    entityType: string,
    entity: {
      id: string;
      properties?: Record<string, unknown>;
      updatedAt?: string;
      createdAt?: string;
      archived?: boolean;
    },
    tenantId?: string
  ): NormalizedEntity {
    return {
      id: `${this.provider}:${entityType}:${entity.id}`,
      externalId: entity.id,
      provider: this.provider,
      type: entityType,
      data: {
        ...entity.properties,
        archived: entity.archived ?? false,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
      metadata: {
        fetchedAt: new Date(),
        version: entity.updatedAt,
        tenantId,
      },
    };
  }

  private propertiesForEntityType(entityType: string): string[] {
    switch (entityType) {
      case "contacts":
        return ["firstname", "lastname", "email", "phone", "company"];
      case "companies":
        return ["name", "domain", "industry", "numberofemployees"];
      case "deals":
        return ["dealname", "amount", "dealstage", "pipeline", "closedate"];
      case "tickets":
        return ["subject", "content", "hs_ticket_priority", "hs_pipeline_stage"];
      default:
        return [];
    }
  }

  private async requestHubSpot(
    method: "GET" | "PATCH",
    path: string,
    queryOrBody: Record<string, unknown>
  ): Promise<HubSpotApiResponse> {
    if (!this.client) {
      throw new ConnectionError(this.provider, "HubSpot client is not initialized");
    }

    const response = await this.client.apiRequest({
      method,
      path,
      ...(method === "GET" ? { qs: queryOrBody } : { body: queryOrBody }),
    });
    return response as unknown as HubSpotApiResponse;
  }

  private handleHubSpotError(error: unknown): never {
    if (this.isAuthFailure(error)) {
      throw new AuthError(this.provider, "HubSpot authentication failed", this.asError(error));
    }

    if (this.isRateLimitFailure(error)) {
      throw new RateLimitError(this.provider, this.retryAfterMs(error), this.asError(error));
    }

    if (this.isValidationFailure(error)) {
      throw new ValidationError(this.provider, "HubSpot request failed validation", this.asError(error));
    }

    throw new ConnectionError(this.provider, "HubSpot API request failed", this.asError(error));
  }

  private isAuthFailure(error: unknown): boolean {
    const statusCode = this.statusCode(error);
    return statusCode === 401 || statusCode === 403;
  }

  private isRateLimitFailure(error: unknown): boolean {
    return this.statusCode(error) === 429;
  }

  private isValidationFailure(error: unknown): boolean {
    const statusCode = this.statusCode(error);
    return statusCode === 400 || statusCode === 422;
  }

  private isNotFound(error: unknown): boolean {
    return this.statusCode(error) === 404;
  }

  private retryAfterMs(error: unknown): number {
    const rawHeaders = this.extractHeaders(error);

    if (rawHeaders && typeof rawHeaders === "object") {
      const headers = rawHeaders as Record<string, unknown>;

      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === "retry-after") {
          const parsed = this.parseRetryAfterValue(value);
          if (parsed !== undefined) {
            return parsed;
          }
        }
      }
    }

    return 1000;
  }

  private extractHeaders(error: unknown): unknown {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    // Check top-level headers first
    if ("headers" in error) {
      const headers = (error as { headers?: unknown }).headers;
      if (headers !== undefined && headers !== null) {
        return headers;
      }
    }

    // Fallback to nested response.headers
    if (
      "response" in error &&
      typeof (error as { response?: unknown }).response === "object" &&
      (error as { response: Record<string, unknown> }).response !== null
    ) {
      const response = (error as { response: Record<string, unknown> }).response;
      if ("headers" in response) {
        return response.headers;
      }
    }

    return undefined;
  }

  private parseRetryAfterValue(value: unknown): number | undefined {
    if (typeof value === "string") {
      const seconds = Number.parseInt(value, 10);
      return Number.isNaN(seconds) ? undefined : seconds * 1000;
    }
    if (typeof value === "number") {
      return value * 1000;
    }
    if (Array.isArray(value) && value.length > 0) {
      // Some HTTP clients return multi-value headers as arrays; use the first value.
      return this.parseRetryAfterValue(value[0]);
    }
    return undefined;
  }

  private statusCode(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    if ("code" in error && typeof error.code === "number") {
      return error.code;
    }

    if (
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "statusCode" in error.response &&
      typeof error.response.statusCode === "number"
    ) {
      return error.response.statusCode;
    }

    if ("statusCode" in error && typeof error.statusCode === "number") {
      return error.statusCode;
    }

    return undefined;
  }

  private asError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(typeof error === "string" ? error : "Unknown HubSpot error");
  }
}
