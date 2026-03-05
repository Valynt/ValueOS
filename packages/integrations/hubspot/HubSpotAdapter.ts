/**
 * HubSpot CRM Adapter
 */

import {
  AuthError,
  EnterpriseAdapter,
  IntegrationError,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
  RateLimitError,
  RateLimiter,
  ValidationError,
} from "../base/index.js";

const HUBSPOT_RATE_LIMIT = 100; // requests per 10 seconds
const DEFAULT_HUBSPOT_BASE_URL = "https://api.hubapi.com";

type HubSpotSupportedEntityType = "contacts" | "companies" | "deals" | "tickets";

type HubSpotConfigCredentials = {
  accessToken: string;
};

type HubSpotRequestMethod = "GET" | "PATCH";

type HubSpotApiErrorResponse = {
  category?: string;
  message?: string;
};

type HubSpotObject = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  properties?: Record<string, string | null>;
};

type HubSpotCollectionResponse = {
  results: HubSpotObject[];
};

type HubSpotSingleResponse = HubSpotObject;


export class HubSpotAdapter extends EnterpriseAdapter {
  readonly provider = "hubspot";
  private accessToken: string | null = null;
  private readonly baseUrl: string;

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "hubspot",
      requestsPerMinute: HUBSPOT_RATE_LIMIT * 6,
      burstLimit: HUBSPOT_RATE_LIMIT,
    }));
    this.baseUrl = config.baseUrl ?? DEFAULT_HUBSPOT_BASE_URL;
  }

  protected async doConnect(): Promise<void> {
    const configuredToken = this.readConfiguredAccessToken();
    const runtimeToken = this.credentials?.accessToken;
    this.accessToken = runtimeToken ?? configuredToken ?? null;

    if (!this.accessToken) {
      throw new AuthError(
        this.provider,
        "HubSpot access token is required in connect credentials or IntegrationConfig.credentials"
      );
    }
  }

  protected async doDisconnect(): Promise<void> {
    this.accessToken = null;
  }

  async validate(): Promise<boolean> {
    this.ensureConnected();

    try {
      await this.request<HubSpotCollectionResponse>(
        "GET",
        "/crm/v3/objects/contacts",
        { limit: 1 }
      );
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        return false;
      }
      throw error;
    }
  }

  async fetchEntities(
    entityType: string,
    options?: FetchOptions
  ): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    const supportedType = this.toSupportedEntityType(entityType);
    const queryParams: Record<string, string | number | boolean> = {
      limit: options?.limit ?? 100,
      archived: false,
    };

    if (options?.offset !== undefined) {
      queryParams.after = options.offset;
    }

    const response = await this.request<HubSpotCollectionResponse>(
      "GET",
      this.objectEndpoint(supportedType),
      queryParams
    );

    return response.results.map((entity) => this.normalizeEntity(supportedType, entity));
  }

  async fetchEntity(
    entityType: string,
    externalId: string
  ): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    const supportedType = this.toSupportedEntityType(entityType);

    try {
      const response = await this.request<HubSpotSingleResponse>(
        "GET",
        `${this.objectEndpoint(supportedType)}/${encodeURIComponent(externalId)}`,
        { archived: false }
      );
      return this.normalizeEntity(supportedType, response);
    } catch (error) {
      if (error instanceof IntegrationError && error.code === "NOT_FOUND") {
        return null;
      }
      throw error;
    }
  }

  async pushUpdate(
    entityType: string,
    externalId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    this.ensureConnected();
    const supportedType = this.toSupportedEntityType(entityType);

    const properties = this.toHubSpotProperties(data);
    if (Object.keys(properties).length === 0) {
      throw new ValidationError(
        this.provider,
        "HubSpot updates require at least one serializable property"
      );
    }

    const attempts = this.config.retryAttempts ?? 3;
    for (let index = 0; index < attempts; index++) {
      try {
        await this.request(
          "PATCH",
          `${this.objectEndpoint(supportedType)}/${encodeURIComponent(externalId)}`,
          undefined,
          { properties }
        );
        return;
      } catch (error) {
        const isFinalAttempt = index === attempts - 1;
        if (error instanceof AuthError || error instanceof ValidationError || isFinalAttempt) {
          throw error;
        }

        if (error instanceof RateLimitError) {
          await this.wait(error.retryAfter);
          continue;
        }

        if (error instanceof IntegrationError && !error.retryable) {
          throw error;
        }

        await this.wait(Math.pow(2, index) * 1000);
      }
    }
  }

  private toSupportedEntityType(entityType: string): HubSpotSupportedEntityType {
    const normalizedType = entityType.toLowerCase();
    if (
      normalizedType === "contacts"
      || normalizedType === "companies"
      || normalizedType === "deals"
      || normalizedType === "tickets"
    ) {
      return normalizedType;
    }

    throw new ValidationError(
      this.provider,
      `Unsupported HubSpot entity type: ${entityType}`
    );
  }

  private normalizeEntity(
    entityType: HubSpotSupportedEntityType,
    entity: HubSpotObject
  ): NormalizedEntity {
    const tenantId = this.credentials?.tenantId;

    return {
      id: `${this.provider}:${entityType}:${entity.id}`,
      externalId: entity.id,
      provider: this.provider,
      type: entityType,
      data: {
        ...(entity.properties ?? {}),
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        archived: entity.archived ?? false,
      },
      metadata: {
        fetchedAt: new Date(),
        version: entity.updatedAt,
        tenantId,
        organizationId: tenantId,
      },
    };
  }

  private toHubSpotProperties(
    data: Record<string, unknown>
  ): Record<string, string | number | boolean | null> {
    const properties: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(data)) {
      if (
        typeof value === "string"
        || typeof value === "number"
        || typeof value === "boolean"
        || value === null
      ) {
        properties[key] = value;
      }
    }

    return properties;
  }

  private objectEndpoint(entityType: HubSpotSupportedEntityType): string {
    return `/crm/v3/objects/${entityType}`;
  }

  private async request<T>(
    method: HubSpotRequestMethod,
    path: string,
    query?: Record<string, string | number | boolean>,
    body?: unknown
  ): Promise<T> {
    this.ensureConnected();
    const token = this.accessToken;
    const tenantId = this.credentials?.tenantId;

    if (!token || !tenantId) {
      throw new AuthError(this.provider, "HubSpot adapter is not connected with valid credentials");
    }

    const url = new URL(path, this.baseUrl);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    return this.withRateLimit(tenantId, async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      await this.throwMappedError(response);
      throw new IntegrationError("Unexpected HubSpot error", "UNKNOWN_ERROR", this.provider, true);
    });
  }

  private async throwMappedError(response: Response): Promise<never> {
    const payload = await this.parseErrorResponse(response);
    const message = payload.message ?? `HubSpot request failed with status ${response.status}`;

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(this.provider, message);
    }

    if (response.status === 404) {
      throw new IntegrationError(message, "NOT_FOUND", this.provider, false);
    }

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "1");
      throw new RateLimitError(
        this.provider,
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000
      );
    }

    if (response.status >= 400 && response.status < 500) {
      throw new ValidationError(this.provider, message);
    }

    throw new IntegrationError(message, "HUBSPOT_API_ERROR", this.provider, true);
  }

  private async parseErrorResponse(response: Response): Promise<HubSpotApiErrorResponse> {
    try {
      return (await response.json()) as HubSpotApiErrorResponse;
    } catch {
      return {};
    }
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private readConfiguredAccessToken(): string | undefined {
    const credentials = this.config.credentials;
    if (!credentials) {
      return undefined;
    }

    const maybeCredentials = credentials as Partial<HubSpotConfigCredentials>;
    if (typeof maybeCredentials.accessToken === "string") {
      return maybeCredentials.accessToken;
    }

    return undefined;
  }
}
