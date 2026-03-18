/**
 * Salesforce CRM Module
 *
 * Implements CRM operations for Salesforce via their REST API.
 * Uses OAuth tokens stored at tenant level.
 */

import { logger } from "../../lib/logger";
import {
  CRMActivity,
  CRMCompany,
  CRMConnection,
  CRMContact,
  CRMDeal,
  CRMModule,
  DealSearchParams,
  DealSearchResult,
} from "../types";

// ============================================================================
// Salesforce API Types
// ============================================================================

interface SalesforceOpportunity {
  Id: string;
  Name: string;
  Amount?: number;
  StageName: string;
  CloseDate?: string;
  Probability?: number;
  OwnerId?: string;
  Owner?: { Name: string };
  AccountId?: string;
  Account?: { Name: string };
  CreatedDate: string;
  LastModifiedDate: string;
  Description?: string;
  [key: string]: unknown;
}

interface SalesforceContact {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  AccountId?: string;
  Account?: { Name: string };
  [key: string]: unknown;
}

interface SalesforceAccount {
  Id: string;
  Name: string;
  Website?: string;
  Industry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  [key: string]: unknown;
}

interface SalesforceTask {
  Id: string;
  Subject?: string;
  Description?: string;
  ActivityDate?: string;
  Status: string;
  Type?: string;
  WhatId?: string;
  WhoId?: string;
  OwnerId?: string;
  CreatedDate: string;
  [key: string]: unknown;
}

interface SalesforceEvent {
  Id: string;
  Subject?: string;
  Description?: string;
  StartDateTime?: string;
  EndDateTime?: string;
  DurationInMinutes?: number;
  WhatId?: string;
  WhoId?: string;
  OwnerId?: string;
  CreatedDate: string;
  [key: string]: unknown;
}

interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

// ============================================================================
// Salesforce Module Implementation
// ============================================================================

export class SalesforceModule implements CRMModule {
  readonly provider = "salesforce" as const;
  private connection: CRMConnection | null = null;

  constructor(connection?: CRMConnection) {
    if (connection) {
      this.setConnection(connection);
    }
  }

  setConnection(connection: CRMConnection): void {
    if (connection.provider !== "salesforce") {
      throw new Error("Invalid connection provider for Salesforce module");
    }
    if (!connection.instanceUrl) {
      throw new Error("Salesforce connection requires instanceUrl");
    }
    this.connection = connection;
  }

  isConnected(): boolean {
    return this.connection !== null && this.connection.status === "active";
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiRequest("/services/data/v59.0/limits");
      return response.ok;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Deals (Opportunities)
  // ==========================================================================

  async searchDeals(params: DealSearchParams): Promise<DealSearchResult> {
    const limit = Math.min(params.limit || 10, 100); // Cap at 100 for safety
    const conditions: string[] = [];

    if (params.query) {
      // Validate and escape search query
      const escapedQuery = this.escapeSOQL(this.validateString(params.query));
      conditions.push(`Name LIKE '%${escapedQuery}%'`);
    }

    if (params.companyName) {
      const escapedCompany = this.escapeSOQL(
        this.validateString(params.companyName)
      );
      conditions.push(`Account.Name LIKE '%${escapedCompany}%'`);
    }

    if (params.stage && params.stage.length > 0) {
      const escapedStages = params.stage
        .map((s) => `'${this.escapeSOQL(this.validateString(s))}'`)
        .join(",");
      conditions.push(`StageName IN (${escapedStages})`);
    }

    if (params.minAmount !== undefined) {
      const amount = this.validateNumber(params.minAmount);
      conditions.push(`Amount >= ${amount}`);
    }

    if (params.maxAmount !== undefined) {
      const amount = this.validateNumber(params.maxAmount);
      conditions.push(`Amount <= ${amount}`);
    }

    if (params.closeDateAfter) {
      const dateStr = this.formatDateForSOQL(params.closeDateAfter);
      conditions.push(`CloseDate >= ${dateStr}`);
    }

    if (params.closeDateBefore) {
      const dateStr = this.formatDateForSOQL(params.closeDateBefore);
      conditions.push(`CloseDate <= ${dateStr}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT Id, Name, Amount, StageName, CloseDate, Probability,
             OwnerId, Owner.Name, AccountId, Account.Name,
             CreatedDate, LastModifiedDate
      FROM Opportunity
      ${whereClause}
      ORDER BY LastModifiedDate DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.soqlQuery<SalesforceOpportunity>(query);

      return {
        deals: result.records.map((opp) => this.mapOpportunity(opp)),
        total: result.totalSize,
        hasMore: !result.done,
      };
    } catch (error) {
      logger.error(
        "Salesforce searchDeals failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return { deals: [], total: 0, hasMore: false };
    }
  }

  async getDeal(dealId: string): Promise<CRMDeal | null> {
    const validatedId = this.validateSalesforceId(dealId);
    const query = `
      SELECT Id, Name, Amount, StageName, CloseDate, Probability,
             OwnerId, Owner.Name, AccountId, Account.Name,
             CreatedDate, LastModifiedDate, Description
      FROM Opportunity
      WHERE Id = '${validatedId}'
    `;

    try {
      const result = await this.soqlQuery<SalesforceOpportunity>(query);
      if (result.records.length === 0) return null;
      return this.mapOpportunity(result.records[0]);
    } catch (error) {
      logger.error(
        "Salesforce getDeal failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return null;
    }
  }

  async getDealContacts(dealId: string): Promise<CRMContact[]> {
    // Get contacts via OpportunityContactRole
    const validatedId = this.validateSalesforceId(dealId);
    const query = `
      SELECT ContactId, Contact.Id, Contact.FirstName, Contact.LastName,
             Contact.Email, Contact.Phone, Contact.Title,
             Contact.AccountId, Contact.Account.Name, Role
      FROM OpportunityContactRole
      WHERE OpportunityId = '${validatedId}'
    `;

    try {
      const result = await this.soqlQuery<{
        ContactId: string;
        Contact: SalesforceContact;
        Role?: string;
      }>(query);

      return result.records.map((ocr) => ({
        ...this.mapContact(ocr.Contact),
        role: ocr.Role,
      }));
    } catch (error) {
      logger.error(
        "Salesforce getDealContacts failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return [];
    }
  }

  async getDealActivities(dealId: string, limit = 20): Promise<CRMActivity[]> {
    const activities: CRMActivity[] = [];
    const validatedId = this.validateSalesforceId(dealId);
    const safeLimit = Math.min(Math.max(1, limit), 100); // Cap between 1 and 100

    // Get Tasks
    const taskQuery = `
      SELECT Id, Subject, Description, ActivityDate, Status, Type, CreatedDate
      FROM Task
      WHERE WhatId = '${validatedId}'
      ORDER BY CreatedDate DESC
      LIMIT ${Math.floor(safeLimit / 2)}
    `;

    // Get Events
    const eventQuery = `
      SELECT Id, Subject, Description, StartDateTime, EndDateTime, DurationInMinutes, CreatedDate
      FROM Event
      WHERE WhatId = '${validatedId}'
      ORDER BY CreatedDate DESC
      LIMIT ${Math.floor(safeLimit / 2)}
    `;

    try {
      const [taskResult, eventResult] = await Promise.all([
        this.soqlQuery<SalesforceTask>(taskQuery),
        this.soqlQuery<SalesforceEvent>(eventQuery),
      ]);

      activities.push(...taskResult.records.map((t) => this.mapTask(t)));
      activities.push(...eventResult.records.map((e) => this.mapEvent(e)));

      // Sort by date
      activities.sort(
        (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
      );

      return activities.slice(0, limit);
    } catch (error) {
      logger.error(
        "Salesforce getDealActivities failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return [];
    }
  }

  // ==========================================================================
  // Companies (Accounts)
  // ==========================================================================

  async getCompany(companyId: string): Promise<CRMCompany | null> {
    const validatedId = this.validateSalesforceId(companyId);
    const query = `
      SELECT Id, Name, Website, Industry, NumberOfEmployees, AnnualRevenue
      FROM Account
      WHERE Id = '${validatedId}'
    `;

    try {
      const result = await this.soqlQuery<SalesforceAccount>(query);
      if (result.records.length === 0) return null;
      return this.mapAccount(result.records[0]);
    } catch (error) {
      logger.error(
        "Salesforce getCompany failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return null;
    }
  }

  async searchCompanies(
    searchQuery: string,
    limit = 10
  ): Promise<CRMCompany[]> {
    const validatedQuery = this.validateString(searchQuery);
    const safeLimit = Math.min(Math.max(1, limit), 100); // Cap between 1 and 100
    const escapedQuery = this.escapeSOQL(validatedQuery);

    const query = `
      SELECT Id, Name, Website, Industry, NumberOfEmployees, AnnualRevenue
      FROM Account
      WHERE Name LIKE '%${escapedQuery}%'
      ORDER BY LastModifiedDate DESC
      LIMIT ${safeLimit}
    `;

    try {
      const result = await this.soqlQuery<SalesforceAccount>(query);
      return result.records.map((a) => this.mapAccount(a));
    } catch (error) {
      logger.error(
        "Salesforce searchCompanies failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return [];
    }
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  async updateDealProperties(
    dealId: string,
    properties: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await this.apiRequest(
        `/services/data/v59.0/sobjects/Opportunity/${dealId}`,
        {
          method: "PATCH",
          body: JSON.stringify(properties),
        }
      );

      return response.ok || response.status === 204;
    } catch (error) {
      logger.error(
        "Salesforce updateDealProperties failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return false;
    }
  }

  async addDealNote(dealId: string, note: string): Promise<boolean> {
    try {
      // Create a Note (ContentNote) and link to Opportunity
      const noteResponse = await this.apiRequest(
        "/services/data/v59.0/sobjects/ContentNote",
        {
          method: "POST",
          body: JSON.stringify({
            Title: "ValueCanvas Insight",
            Content: Buffer.from(note).toString("base64"),
          }),
        }
      );

      if (!noteResponse.ok) {
        // Fallback to Task
        const taskResponse = await this.apiRequest(
          "/services/data/v59.0/sobjects/Task",
          {
            method: "POST",
            body: JSON.stringify({
              Subject: "ValueCanvas Insight",
              Description: note,
              WhatId: dealId,
              Status: "Completed",
              Priority: "Normal",
            }),
          }
        );
        return taskResponse.ok;
      }

      const noteData = await noteResponse.json();

      // Link note to opportunity
      await this.apiRequest(
        "/services/data/v59.0/sobjects/ContentDocumentLink",
        {
          method: "POST",
          body: JSON.stringify({
            ContentDocumentId: noteData.id,
            LinkedEntityId: dealId,
            ShareType: "V",
          }),
        }
      );

      return true;
    } catch (error) {
      logger.error(
        "Salesforce addDealNote failed",
        error instanceof Error ? { error: error.message, stack: error.stack } : undefined
      );
      return false;
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async apiRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.connection?.accessToken || !this.connection?.instanceUrl) {
      throw new Error("Salesforce not connected");
    }

    const makeRequest = (token: string) => {
      const url = `${this.connection!.instanceUrl}${path}`;
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    };

    // Initial request
    let response = await makeRequest(this.connection.accessToken);

    // If we get a 401, try to refresh the token once
    if (response.status === 401 && this.connection.refreshToken) {
      try {
        logger.info("Salesforce token expired, attempting refresh");

        // Attempt to refresh token via the edge function
        // Note: We use the refresh_token for authentication, not the expired access_token
        const refreshResponse = await fetch("/api/crm-oauth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Refresh-Token": this.connection.refreshToken,
          },
          body: JSON.stringify({
            provider: "salesforce",
            refresh_token: this.connection.refreshToken,
          }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.access_token) {
            // Update connection with new token
            this.connection.accessToken = refreshData.access_token;
            if (refreshData.refresh_token) {
              this.connection.refreshToken = refreshData.refresh_token;
            }
            if (refreshData.instance_url) {
              this.connection.instanceUrl = refreshData.instance_url;
            }

            // Retry the original request with new token
            response = await makeRequest(this.connection.accessToken);
            logger.info("Salesforce token refreshed successfully");
          }
        }
      } catch (refreshError) {
        logger.error(
          "Failed to refresh Salesforce token",
          refreshError instanceof Error ? { error: refreshError.message, stack: refreshError.stack } : undefined
        );
        // Continue with the original 401 response
      }
    }

    return response;
  }

  private async soqlQuery<T>(query: string): Promise<SalesforceQueryResult<T>> {
    const encodedQuery = encodeURIComponent(query.trim().replace(/\s+/g, " "));
    const response = await this.apiRequest(
      `/services/data/v59.0/query?q=${encodedQuery}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SOQL query failed: ${error}`);
    }

    return response.json();
  }

  private validateString(value: string): string {
    if (typeof value !== "string") {
      throw new Error("Expected string value");
    }
    // Remove any null bytes and limit length
    return value.replace(/\0/g, "").substring(0, 1000);
  }

  private validateNumber(value: number): number {
    if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
      throw new Error("Expected valid number");
    }
    return value;
  }

  private validateSalesforceId(id: string): string {
    const validated = this.validateString(id);
    // Salesforce IDs are 15 or 18 character alphanumeric strings
    if (!/^[a-zA-Z0-9]{15,18}$/.test(validated)) {
      throw new Error("Invalid Salesforce ID format");
    }
    return validated;
  }

  private formatDateForSOQL(date: Date): string {
    // Format as YYYY-MM-DD for SOQL date literals
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private escapeSOQL(value: string): string {
    // Escape special SOQL characters
    return value
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }

  private mapOpportunity(opp: SalesforceOpportunity): CRMDeal {
    return {
      id: opp.Id,
      externalId: opp.Id,
      provider: "salesforce",
      name: opp.Name,
      amount: opp.Amount,
      stage: opp.StageName,
      probability: opp.Probability,
      closeDate: opp.CloseDate ? new Date(opp.CloseDate) : undefined,
      createdAt: new Date(opp.CreatedDate),
      updatedAt: new Date(opp.LastModifiedDate),
      ownerId: opp.OwnerId,
      ownerName: opp.Owner?.Name,
      companyId: opp.AccountId,
      companyName: opp.Account?.Name,
      properties: opp,
    };
  }

  private mapContact(c: SalesforceContact): CRMContact {
    return {
      id: c.Id,
      externalId: c.Id,
      provider: "salesforce",
      firstName: c.FirstName,
      lastName: c.LastName,
      email: c.Email,
      phone: c.Phone,
      title: c.Title,
      companyId: c.AccountId,
      companyName: c.Account?.Name,
      properties: c,
    };
  }

  private mapAccount(a: SalesforceAccount): CRMCompany {
    return {
      id: a.Id,
      externalId: a.Id,
      provider: "salesforce",
      name: a.Name,
      domain: a.Website,
      industry: a.Industry,
      size: a.NumberOfEmployees?.toString(),
      revenue: a.AnnualRevenue,
      properties: a,
    };
  }

  private mapTask(t: SalesforceTask): CRMActivity {
    const typeMap: Record<string, CRMActivity["type"]> = {
      Call: "call",
      Email: "email",
      Meeting: "meeting",
    };

    return {
      id: t.Id,
      externalId: t.Id,
      provider: "salesforce",
      type: typeMap[t.Type || ""] || "task",
      subject: t.Subject,
      body: t.Description,
      occurredAt: new Date(t.ActivityDate || t.CreatedDate),
      dealId: t.WhatId,
      properties: t,
    };
  }

  private mapEvent(e: SalesforceEvent): CRMActivity {
    return {
      id: e.Id,
      externalId: e.Id,
      provider: "salesforce",
      type: "meeting",
      subject: e.Subject,
      body: e.Description,
      occurredAt: new Date(e.StartDateTime || e.CreatedDate),
      durationMinutes: e.DurationInMinutes,
      dealId: e.WhatId,
      properties: e,
    };
  }
}
