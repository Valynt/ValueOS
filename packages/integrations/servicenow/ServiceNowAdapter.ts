/**
 * ServiceNow Adapter
 *
 * NOT_IMPLEMENTED — scaffolded for future integration.
 * Salesforce covers the enterprise CRM requirement for beta.
 * See DEBT-008 in .ona/context/debt.md.
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

  protected async doConnect(): Promise<void> {
    throw new Error("ServiceNowAdapter: not implemented. See DEBT-008.");
  }
  protected async doDisconnect(): Promise<void> {
    throw new Error("ServiceNowAdapter: not implemented. See DEBT-008.");
  }
  async validate(): Promise<boolean> {
    throw new Error("ServiceNowAdapter: not implemented. See DEBT-008.");
  }
  async fetchEntities(_entityType: string, _options?: FetchOptions): Promise<NormalizedEntity[]> {
    throw new Error("ServiceNowAdapter: not implemented. See DEBT-008.");
  }
  async fetchEntity(_entityType: string, _externalId: string): Promise<NormalizedEntity | null> {
    throw new Error("ServiceNowAdapter: not implemented. See DEBT-008.");
  }
  async pushUpdate(_entityType: string, _externalId: string, _data: Record<string, unknown>): Promise<void> {
    throw new Error("ServiceNowAdapter: not implemented. See DEBT-008.");
  }
}
