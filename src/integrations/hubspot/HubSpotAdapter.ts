/**
 * HubSpot Adapter
 * Integration with HubSpot CRM - Deal sync
 */

import { EnterpriseAdapter } from "../base/EnterpriseAdapter";
import type {
  AdapterConfig,
  SyncOptions,
  SyncResult,
} from "../base/IEnterpriseAdapter";
import axios, { AxiosInstance } from "axios";

export class HubSpotAdapter extends EnterpriseAdapter {
  readonly adapterType = "hubspot";
  readonly displayName = "HubSpot CRM";

  private client: AxiosInstance;

  constructor(config: AdapterConfig) {
    super(config);

    this.client = axios.create({
      baseURL: "https://api.hubapi.com",
      headers: {
        Authorization: `Bearer ${config.credentials.apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  async authenticate(): Promise<void> {
    this.authenticated = true; // Private app token doesn't expire
  }

  async refreshToken(): Promise<void> {
    // No refresh needed for private app tokens
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
      const response = await this.client.get("/crm/v3/objects/deals", {
        params: {
          properties: "dealname,amount,probability,dealstage,closedate",
          limit: 100,
        },
      });
      result.pullCount = response.data.results.length;
    }

    return result;
  }

  async create(entityType: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();
    const response = await this.client.post(`/crm/v3/objects/${entityType}`, {
      properties: data,
    });
    return response.data;
  }

  async read(entityType: string, id: string): Promise<any> {
    await this.rateLimiter.acquire();
    const response = await this.client.get(
      `/crm/v3/objects/${entityType}/${id}`
    );
    return response.data;
  }

  async update(entityType: string, id: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();
    await this.client.patch(`/crm/v3/objects/${entityType}/${id}`, {
      properties: data,
    });
    return { id, ...data };
  }

  async delete(entityType: string, id: string): Promise<void> {
    await this.rateLimiter.acquire();
    await this.client.delete(`/crm/v3/objects/${entityType}/${id}`);
  }

  async query(entityType: string, filters: any): Promise<any[]> {
    await this.rateLimiter.acquire();
    const response = await this.client.post(
      `/crm/v3/objects/${entityType}/search`,
      {
        filterGroups: [
          {
            filters: Object.entries(filters).map(([property, value]) => ({
              propertyName: property,
              operator: "EQ",
              value,
            })),
          },
        ],
      }
    );
    return response.data.results;
  }
}

export default HubSpotAdapter;
