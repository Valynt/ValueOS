/**
 * Slack Adapter
 */

import {
  EnterpriseAdapter,
  type FetchOptions,
  type IntegrationConfig,
  type NormalizedEntity,
  RateLimiter,
} from "../base/index.js";

export class SlackAdapter extends EnterpriseAdapter {
  readonly provider = "slack";

  constructor(config: IntegrationConfig) {
    super(config, new RateLimiter({
      provider: "slack",
      requestsPerMinute: 50,
      burstLimit: 20,
    }));
  }

  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  async validate(): Promise<boolean> { this.ensureConnected(); return true; }
  async fetchEntities(_entityType: string, _options?: FetchOptions): Promise<NormalizedEntity[]> { this.ensureConnected(); return []; }
  async fetchEntity(_entityType: string, _externalId: string): Promise<NormalizedEntity | null> { this.ensureConnected(); return null; }
  async pushUpdate(_entityType: string, _externalId: string, _data: Record<string, unknown>): Promise<void> { this.ensureConnected(); }
}
