/**
 * ServiceNow Adapter
 * Integration with ServiceNow ITSM - Change Request tracking
 */

import { EnterpriseAdapter } from "../base/EnterpriseAdapter";
import type {
  AdapterConfig,
  SyncOptions,
  SyncResult,
} from "../base/IEnterpriseAdapter";
import axios, { AxiosInstance } from "axios";

export class ServiceNowAdapter extends EnterpriseAdapter {
  readonly adapterType = "servicenow";
  readonly displayName = "ServiceNow ITSM";

  private client: AxiosInstance;

  constructor(config: AdapterConfig) {
    super(config);

    const instanceUrl = config.credentials.username; // Stored in username field for simplicity

    this.client = axios.create({
      baseURL: `${instanceUrl}/api/now`,
      auth: {
        username: config.credentials.username!,
        password: config.credentials.password!,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  async authenticate(): Promise<void> {
    this.authenticated = true; // Basic auth doesn't require separate auth step
  }

  async refreshToken(): Promise<void> {
    // No refresh needed for basic auth
  }

  protected async performSync(
    direction: string,
    options?: SyncOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      status: "success",
      pullCount: 0,
      pushCount: 0,
      conflicts: [],
      errors: [],
    };

    if (direction === "pull" || direction === "bidirectional") {
      await this.rateLimiter.acquire();
      const response = await this.client.get("/table/change_request", {
        params: {
          sysparm_query: "state!=closed",
          sysparm_limit: 100,
        },
      });
      result.pullCount = response.data.result.length;
    }

    return result;
  }

  async create(entityType: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();
    const response = await this.client.post(`/table/${entityType}`, data);
    return response.data.result;
  }

  async read(entityType: string, id: string): Promise<any> {
    await this.rateLimiter.acquire();
    const response = await this.client.get(`/table/${entityType}/${id}`);
    return response.data.result;
  }

  async update(entityType: string, id: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();
    const response = await this.client.put(`/table/${entityType}/${id}`, data);
    return response.data.result;
  }

  async delete(entityType: string, id: string): Promise<void> {
    await this.rateLimiter.acquire();
    await this.client.delete(`/table/${entityType}/${id}`);
  }

  async query(entityType: string, filters: any): Promise<any[]> {
    await this.rateLimiter.acquire();

    const query = Object.entries(filters)
      .map(([key, value]) => `${key}=${value}`)
      .join("^");

    const response = await this.client.get(`/table/${entityType}`, {
      params: { sysparm_query: query },
    });

    return response.data.result;
  }
}

export default ServiceNowAdapter;
