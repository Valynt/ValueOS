/**
 * Salesforce Adapter
 * Bi-directional integration with Salesforce CRM
 * Maps Opportunities ↔ ValueOS Opportunities
 */

import { EnterpriseAdapter } from "../base/EnterpriseAdapter";
import type {
  AdapterConfig,
  SyncOptions,
  SyncResult,
  Conflict,
  SyncError,
} from "../base/IEnterpriseAdapter";
import axios, { AxiosInstance } from "axios";

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  Amount: number;
  Probability: number;
  StageName: string;
  CloseDate: string;
  AccountId: string;
  Account?: {
    Name: string;
  };
  LastModifiedDate: string;
  // Custom fields
  ValueHypothesisId__c?: string;
  ValueScore__c?: number;
}

export interface SalesforceCredentials {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: Date;
}

export class SalesforceAdapter extends EnterpriseAdapter {
  readonly adapterType = "salesforce";
  readonly displayName = "Salesforce CRM";

  private client: AxiosInstance;
  private apiVersion = "v59.0";

  constructor(config: AdapterConfig) {
    super(config);

    const creds = config.credentials as unknown as SalesforceCredentials;
    this.client = axios.create({
      baseURL: `${creds.instanceUrl}/services/data/${this.apiVersion}`,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Authenticate with Salesforce OAuth 2.0
   */
  async authenticate(): Promise<void> {
    const creds = this.config.credentials as unknown as SalesforceCredentials;

    // Check if token is expired
    if (creds.expiresAt && new Date(creds.expiresAt) > new Date()) {
      this.authenticated = true;
      return;
    }

    // Refresh token
    await this.refreshToken();
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(): Promise<void> {
    const creds = this.config.credentials as unknown as SalesforceCredentials;

    try {
      const response = await axios.post(
        `${creds.instanceUrl}/services/oauth2/token`,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: creds.refreshToken,
          client_id: process.env.SALESFORCE_CLIENT_ID!,
          client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, instance_url } = response.data;

      // Update credentials
      creds.accessToken = access_token;
      creds.instanceUrl = instance_url;
      creds.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

      // Update client headers
      this.client.defaults.baseURL = `${instance_url}/services/data/${this.apiVersion}`;
      this.client.defaults.headers.common["Authorization"] =
        `Bearer ${access_token}`;

      // Save updated credentials
      await this.updateCredentials(creds);

      this.authenticated = true;
    } catch (error) {
      this.authenticated = false;
      throw new Error(`Failed to refresh Salesforce token: ${error}`);
    }
  }

  /**
   * Perform bi-directional sync
   */
  protected async performSync(
    direction: "pull" | "push" | "bidirectional",
    options?: SyncOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      status: "success",
      pullCount: 0,
      pushCount: 0,
      conflicts: [],
      errors: [],
    };

    try {
      if (direction === "pull" || direction === "bidirectional") {
        const pullResult = await this.pullOpportunities(options);
        result.pullCount = pullResult.count;
        result.errors.push(...pullResult.errors);
      }

      if (direction === "push" || direction === "bidirectional") {
        const pushResult = await this.pushValueHypotheses(options);
        result.pushCount = pushResult.count;
        result.errors.push(...pushResult.errors);
        result.conflicts.push(...pushResult.conflicts);
      }

      if (result.errors.length > 0) {
        result.status = "partial";
      }
    } catch (error) {
      result.status = "failed";
      result.errors.push({
        entityId: "sync",
        operation: "update",
        error: error instanceof Error ? error.message : "Sync failed",
        retryable: true,
      });
    }

    return result;
  }

  /**
   * Pull opportunities from Salesforce
   */
  private async pullOpportunities(options?: SyncOptions): Promise<{
    count: number;
    errors: SyncError[];
  }> {
    const lastSyncTime =
      options?.lastSyncTime || (await this.getLastSyncTime());
    const errors: SyncError[] = [];

    // Build SOQL query
    let query = `
      SELECT Id, Name, Amount, Probability, StageName, CloseDate, 
             AccountId, Account.Name, LastModifiedDate,
             ValueHypothesisId__c, ValueScore__c
      FROM Opportunity
      WHERE IsDeleted = false
    `;

    if (lastSyncTime) {
      const isoDate = lastSyncTime.toISOString();
      query += ` AND LastModifiedDate > ${isoDate}`;
    }

    query += " ORDER BY LastModifiedDate ASC LIMIT 2000"; // Salesforce query limit

    try {
      await this.rateLimiter.acquire();
      const response = await this.client.get("/query/", {
        params: { q: query },
      });

      const opportunities: SalesforceOpportunity[] = response.data.records;

      // Transform and upsert to ValueOS
      for (const opp of opportunities) {
        try {
          await this.upsertOpportunity(opp);
        } catch (error) {
          errors.push({
            entityId: opp.Id,
            operation: "update",
            error: error instanceof Error ? error.message : "Failed to upsert",
            retryable: true,
          });
        }
      }

      return {
        count: opportunities.length - errors.length,
        errors,
      };
    } catch (error) {
      throw new Error(`Failed to pull opportunities: ${error}`);
    }
  }

  /**
   * Push value hypotheses to Salesforce
   */
  private async pushValueHypotheses(options?: SyncOptions): Promise<{
    count: number;
    errors: SyncError[];
    conflicts: Conflict[];
  }> {
    const localChanges = options?.changes || (await this.getLocalChanges());
    const errors: SyncError[] = [];
    const conflicts: Conflict[] = [];

    for (const change of localChanges) {
      try {
        // Check for conflicts
        const remote = await this.read("Opportunity", change.salesforce_id);
        const conflict = this.detectConflict(change, remote);

        if (conflict) {
          conflicts.push(conflict);

          // Resolve based on config
          if (this.config.syncConfig.conflictResolution === "local_wins") {
            await this.update("Opportunity", change.salesforce_id, change);
          } else if (this.config.syncConfig.conflictResolution === "manual") {
            continue; // Skip, requires manual resolution
          }
          // 'remote_wins' - do nothing
        } else {
          await this.update("Opportunity", change.salesforce_id, change);
        }
      } catch (error) {
        errors.push({
          entityId: change.id,
          operation: "update",
          error: error instanceof Error ? error.message : "Push failed",
          retryable: true,
        });
      }
    }

    return {
      count: localChanges.length - errors.length - conflicts.length,
      errors,
      conflicts,
    };
  }

  /**
   * Create Opportunity in Salesforce
   */
  async create(entityType: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();

    const response = await this.client.post(`/sobjects/${entityType}/`, data);
    return response.data;
  }

  /**
   * Read Opportunity from Salesforce
   */
  async read(entityType: string, id: string): Promise<any> {
    await this.rateLimiter.acquire();

    const response = await this.client.get(`/sobjects/${entityType}/${id}`);
    return response.data;
  }

  /**
   * Update Opportunity in Salesforce
   */
  async update(entityType: string, id: string, data: any): Promise<any> {
    await this.rateLimiter.acquire();

    await this.client.patch(`/sobjects/${entityType}/${id}`, data);
    return { id, ...data };
  }

  /**
   * Delete Opportunity in Salesforce
   */
  async delete(entityType: string, id: string): Promise<void> {
    await this.rateLimiter.acquire();

    await this.client.delete(`/sobjects/${entityType}/${id}`);
  }

  /**
   * Query opportunities with SOQL
   */
  async query(entityType: string, filters: any): Promise<any[]> {
    await this.rateLimiter.acquire();

    const query = this.buildSOQL(entityType, filters);
    const response = await this.client.get("/query/", {
      params: { q: query },
    });

    return response.data.records;
  }

  /**
   * Transform Salesforce Opportunity to ValueOS format
   */
  private async upsertOpportunity(sfOpp: SalesforceOpportunity): Promise<void> {
    const opportunity = {
      salesforce_id: sfOpp.Id,
      name: sfOpp.Name,
      value: sfOpp.Amount || 0,
      confidence: sfOpp.Probability || 0,
      stage: sfOpp.StageName,
      target_date: sfOpp.CloseDate,
      account_name: sfOpp.Account?.Name,
      value_hypothesis_id: sfOpp.ValueHypothesisId__c,
      last_modified: new Date(sfOpp.LastModifiedDate),
      source: "salesforce",
    };

    await this.supabase.from("opportunities").upsert(opportunity, {
      onConflict: "salesforce_id",
    });
  }

  /**
   * Helper methods
   */
  private async updateCredentials(creds: SalesforceCredentials): Promise<void> {
    await this.supabase
      .from("integration_connections")
      .update({ credentials: creds as any })
      .eq("id", this.config.connectionId);
  }

  private async getLocalChanges(): Promise<any[]> {
    const lastSync = await this.getLastSyncTime();

    const { data } = await this.supabase
      .from("value_hypotheses")
      .select("*")
      .gte("updated_at", lastSync?.toISOString() || new Date(0).toISOString())
      .not("salesforce_id", "is", null);

    return data || [];
  }

  private detectConflict(local: any, remote: any): Conflict | null {
    const localTime = new Date(local.updated_at);
    const remoteTime = new Date(remote.LastModifiedDate);

    // Conflict if both changed since last sync
    if (Math.abs(localTime.getTime() - remoteTime.getTime()) < 1000) {
      return {
        id: local.id,
        localVersion: local,
        remoteVersion: remote,
        timestamp: new Date(),
      };
    }

    return null;
  }

  private buildSOQL(entityType: string, filters: any): string {
    let query = `SELECT Id, Name FROM ${entityType} WHERE `;

    const conditions = Object.entries(filters).map(
      ([key, value]) => `${key} = '${value}'`
    );

    query += conditions.join(" AND ");
    return query;
  }
}

export default SalesforceAdapter;
