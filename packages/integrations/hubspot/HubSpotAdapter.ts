/**
 * HubSpot CRM Adapter
 */

import {
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
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
    // TODO: Validate HubSpot credentials
    return true;
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
