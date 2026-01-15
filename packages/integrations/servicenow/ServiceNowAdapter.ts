/**
 * ServiceNow Adapter
 */

import {
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
  RateLimiter,
} from "../base/index.js";

export class ServiceNowAdapter extends EnterpriseAdapter {
  readonly provider = "servicenow";

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "servicenow",
      requestsPerMinute: 60,
    }));
  }

  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  async validate(): Promise<boolean> { this.ensureConnected(); return true; }
  async fetchEntities(_entityType: string, _options?: FetchOptions): Promise<NormalizedEntity[]> { this.ensureConnected(); return []; }
  async fetchEntity(_entityType: string, _externalId: string): Promise<NormalizedEntity | null> { this.ensureConnected(); return null; }
  async pushUpdate(_entityType: string, _externalId: string, _data: Record<string, unknown>): Promise<void> { this.ensureConnected(); }
}
