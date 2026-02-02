/**
 * HubSpot CRM Adapter
 */

import {
  AuthError,
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  IntegrationError,
  type NormalizedEntity,
  RateLimitError,
  RateLimiter,
} from "../base/index.js";

const HUBSPOT_RATE_LIMIT = 100; // requests per 10 seconds

export class HubSpotAdapter extends EnterpriseAdapter {
  readonly provider = "hubspot";

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "hubspot",
      requestsPerMinute: HUBSPOT_RATE_LIMIT * 6,
      burstLimit: HUBSPOT_RATE_LIMIT,
    }));
  }

  protected async doConnect(): Promise<void> {
    // TODO: Initialize HubSpot client
  }

  protected async doDisconnect(): Promise<void> {
    // TODO: Cleanup HubSpot client
  }

  async validate(): Promise<boolean> {
    this.ensureConnected();
    try {
      await this.request("/crm/v3/objects/contacts?limit=1");
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        return false;
      }
      throw error;
    }
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const baseUrl = this.config.baseUrl || "https://api.hubapi.com";
    const url = `${baseUrl}${path}`;

    if (!this.credentials?.accessToken) {
      throw new IntegrationError(
        "No access token available",
        "NO_TOKEN",
        this.provider
      );
    }

    const headers = {
      Authorization: `Bearer ${this.credentials.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.ok) {
      return response;
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        this.provider,
        `Authentication failed: ${response.statusText}`
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000;
      throw new RateLimitError(this.provider, waitMs);
    }

    throw new IntegrationError(
      `Request failed with status ${response.status}: ${response.statusText}`,
      `HTTP_${response.status}`,
      this.provider,
      response.status >= 500
    );
  }

  async fetchEntities(
    entityType: string,
    _options?: FetchOptions
  ): Promise<NormalizedEntity[]> {
    this.ensureConnected();
    // TODO: Fetch and normalize HubSpot entities
    return [];
  }

  async fetchEntity(
    entityType: string,
    externalId: string
  ): Promise<NormalizedEntity | null> {
    this.ensureConnected();
    // TODO: Fetch single HubSpot entity
    return null;
  }

  async pushUpdate(
    entityType: string,
    externalId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    this.ensureConnected();
    // TODO: Push update to HubSpot
  }
}
