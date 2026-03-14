/**
 * Salesforce Opportunity Fetcher
 *
 * High-level module for fetching and normalizing Salesforce Opportunities
 * into ValueOS value case inputs. Sits on top of SalesforceAdapter and
 * provides domain-specific transformations.
 *
 * This was explicitly deferred post-GA and is now scaffolded for
 * integration with the value case generation pipeline.
 */
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface SalesforceOpportunity {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  amount: number | null;
  stageName: string;
  probability: number | null;
  closeDate: string;
  type: string | null;
  description: string | null;
  industry: string | null;
  ownerName: string | null;
  lastModifiedDate: string;
  createdDate: string;
  isClosed: boolean;
  isWon: boolean;
  /** Custom fields mapped from Salesforce */
  customFields: Record<string, unknown>;
}

export interface OpportunityFetchOptions {
  /** Filter by stage names */
  stages?: string[];
  /** Minimum opportunity amount */
  minAmount?: number;
  /** Only fetch opportunities modified after this date */
  since?: Date;
  /** Maximum results */
  limit?: number;
  /** Include closed opportunities */
  includeClosed?: boolean;
}

export interface ValueCaseInput {
  /** Source opportunity ID in Salesforce */
  sourceOpportunityId: string;
  /** Company name from the related Account */
  companyName: string;
  /** Industry from the related Account */
  industry: string;
  /** Opportunity amount as deal size indicator */
  dealSize: number;
  /** Current stage for lifecycle mapping */
  currentStage: string;
  /** Win probability for confidence weighting */
  probability: number;
  /** Close date for timeline calculations */
  closeDate: string;
  /** Description text for NLP processing */
  description: string;
  /** Raw opportunity data for agent context */
  rawData: SalesforceOpportunity;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const OpportunityFetchOptionsSchema = z.object({
  stages: z.array(z.string()).optional(),
  minAmount: z.number().min(0).optional(),
  since: z.date().optional(),
  limit: z.number().int().min(1).max(2000).optional(),
  includeClosed: z.boolean().optional(),
});

// ============================================================================
// Fetcher Interface
// ============================================================================

/**
 * Interface for the Salesforce adapter dependency.
 * Decoupled from the concrete SalesforceAdapter to allow testing.
 */
export interface SalesforceAdapterPort {
  fetchEntities(
    entityType: string,
    options?: { limit?: number; since?: Date; filters?: Record<string, unknown> },
  ): Promise<Array<{ id: string; externalId: string; data: Record<string, unknown> }>>;
}

// ============================================================================
// Implementation
// ============================================================================

export class SalesforceOpportunityFetcher {
  constructor(private readonly adapter: SalesforceAdapterPort) {}

  /**
   * Fetch opportunities from Salesforce and normalize them.
   */
  async fetchOpportunities(
    options: OpportunityFetchOptions = {},
  ): Promise<SalesforceOpportunity[]> {
    const validated = OpportunityFetchOptionsSchema.parse(options);

    const filters: Record<string, unknown> = {};
    if (validated.stages && validated.stages.length > 0) {
      filters.StageName = validated.stages;
    }
    if (validated.minAmount !== undefined) {
      filters.Amount_gte = validated.minAmount;
    }
    if (!validated.includeClosed) {
      filters.IsClosed = false;
    }

    const entities = await this.adapter.fetchEntities("Opportunity", {
      limit: validated.limit ?? 200,
      since: validated.since,
      filters,
    });

    return entities.map((entity) => this.normalizeOpportunity(entity.data));
  }

  /**
   * Convert a Salesforce opportunity into a ValueOS value case input.
   */
  toValueCaseInput(opportunity: SalesforceOpportunity): ValueCaseInput {
    return {
      sourceOpportunityId: opportunity.id,
      companyName: opportunity.accountName,
      industry: opportunity.industry ?? "Unknown",
      dealSize: opportunity.amount ?? 0,
      currentStage: opportunity.stageName,
      probability: opportunity.probability ?? 0,
      closeDate: opportunity.closeDate,
      description: opportunity.description ?? "",
      rawData: opportunity,
    };
  }

  /**
   * Fetch opportunities and convert them all to value case inputs.
   */
  async fetchAsValueCaseInputs(
    options: OpportunityFetchOptions = {},
  ): Promise<ValueCaseInput[]> {
    const opportunities = await this.fetchOpportunities(options);
    return opportunities.map((opp) => this.toValueCaseInput(opp));
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private normalizeOpportunity(
    data: Record<string, unknown>,
  ): SalesforceOpportunity {
    // Standard Salesforce Opportunity fields
    const standardFields = new Set([
      "Id",
      "Name",
      "AccountId",
      "Account",
      "Amount",
      "StageName",
      "Probability",
      "CloseDate",
      "Type",
      "Description",
      "OwnerId",
      "Owner",
      "LastModifiedDate",
      "CreatedDate",
      "IsClosed",
      "IsWon",
    ]);

    // Extract custom fields (anything not in standardFields)
    const customFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!standardFields.has(key) && !key.startsWith("attributes")) {
        customFields[key] = value;
      }
    }

    const account = data.Account as Record<string, unknown> | undefined;
    const owner = data.Owner as Record<string, unknown> | undefined;

    return {
      id: String(data.Id ?? ""),
      name: String(data.Name ?? ""),
      accountId: String(data.AccountId ?? ""),
      accountName: String(account?.Name ?? "Unknown"),
      amount: data.Amount != null ? Number(data.Amount) : null,
      stageName: String(data.StageName ?? ""),
      probability: data.Probability != null ? Number(data.Probability) : null,
      closeDate: String(data.CloseDate ?? ""),
      type: data.Type != null ? String(data.Type) : null,
      description: data.Description != null ? String(data.Description) : null,
      industry: account?.Industry != null ? String(account.Industry) : null,
      ownerName: owner?.Name != null ? String(owner.Name) : null,
      lastModifiedDate: String(data.LastModifiedDate ?? ""),
      createdDate: String(data.CreatedDate ?? ""),
      isClosed: Boolean(data.IsClosed),
      isWon: Boolean(data.IsWon),
      customFields,
    };
  }
}
