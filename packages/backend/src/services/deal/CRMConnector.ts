/**
 * CRMConnector
 *
 * Pulls opportunity metadata, account profile, and contacts from a connected
 * CRM provider (HubSpot or Salesforce) using the existing CRM provider
 * abstraction layer.
 *
 * Credentials are never hardcoded. All tokens are loaded from the encrypted
 * crm_connections table via CrmConnectionService and refreshed automatically.
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §3
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { createServerSupabaseClient } from "../../lib/supabase.js";
import { CrmConnectionService } from "../crm/CrmConnectionService.js";
import { getCrmProvider } from "../crm/CrmProviderRegistry.js";
import type { CrmProvider, OAuthTokens } from "../crm/types.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const CRMOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  amount: z.number().optional(),
  close_date: z.string().optional(),
  probability: z.number().optional(),
  owner: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }).optional(),
  custom_properties: z.record(z.unknown()).optional(),
});

export const CRMAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().optional(),
  size_employees: z.number().optional(),
  annual_revenue: z.number().optional(),
  website: z.string().optional(),
  address: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  custom_properties: z.record(z.unknown()).optional(),
});

export const CRMContactSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  role: z.enum(["economic_buyer", "champion", "technical_evaluator", "end_user", "blocker", "influencer", "unknown"]).default("unknown"),
  is_primary: z.boolean().default(false),
});

export type CRMOpportunity = z.infer<typeof CRMOpportunitySchema>;
export type CRMAccount = z.infer<typeof CRMAccountSchema>;
export type CRMContact = z.infer<typeof CRMContactSchema>;

export interface CRMFetchInput {
  tenantId: string;
  crmConnectionId: string;
  opportunityId: string;
}

export interface CRMFetchResult {
  opportunity: CRMOpportunity;
  account: CRMAccount;
  contacts: CRMContact[];
  fetchedAt: string;
  sourceType: "crm-opportunity" | "crm-account" | "crm-contact";
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class CRMFetchError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "CRMFetchError";
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// HubSpot contacts helper
// ---------------------------------------------------------------------------

const HS_API_BASE = "https://api.hubapi.com";
const CONTACT_PROPERTIES = "firstname,lastname,email,phone,jobtitle";

/**
 * Fetch contacts associated with a HubSpot deal via the associations API.
 * Returns an empty array on any non-fatal error so the overall fetch can
 * still succeed with partial data.
 */
async function fetchHubSpotContacts(
  dealId: string,
  tokens: OAuthTokens,
  signal: AbortSignal,
): Promise<CRMContact[]> {
  const assocUrl = `${HS_API_BASE}/crm/v3/objects/deals/${dealId}/associations/contacts`;

  const assocResponse = await fetch(assocUrl, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    signal,
  });

  if (!assocResponse.ok) {
    if (assocResponse.status === 404) return [];
    logger.warn("CRMConnector: failed to fetch HubSpot deal contact associations", {
      dealId,
      status: assocResponse.status,
    });
    return [];
  }

  const assocData = (await assocResponse.json()) as {
    results?: Array<{ id: string; type: string }>;
  };

  const contactIds = (assocData.results ?? [])
    .filter((r) => r.type === "deal_to_contact" || r.type === "DEAL_TO_CONTACT")
    .map((r) => r.id)
    .slice(0, 20); // cap to avoid unbounded fetches

  if (contactIds.length === 0) return [];

  const contacts: CRMContact[] = [];

  for (const contactId of contactIds) {
    const contactUrl = `${HS_API_BASE}/crm/v3/objects/contacts/${contactId}?properties=${CONTACT_PROPERTIES}`;
    const contactResponse = await fetch(contactUrl, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      signal,
    });

    if (!contactResponse.ok) continue;

    const contactData = (await contactResponse.json()) as Record<string, unknown>;
    const props = ((contactData.properties ?? {}) as Record<string, unknown>);

    contacts.push({
      id: String(contactData.id),
      first_name: (props.firstname as string) ?? "",
      last_name: (props.lastname as string) ?? "",
      email: (props.email as string) ?? undefined,
      phone: (props.phone as string) ?? undefined,
      job_title: (props.jobtitle as string) ?? undefined,
      role: "unknown",
      is_primary: contacts.length === 0,
    });
  }

  return contacts;
}

// ---------------------------------------------------------------------------
// Salesforce contacts helper
// ---------------------------------------------------------------------------

/**
 * Fetch contacts associated with a Salesforce Opportunity via
 * the OpportunityContactRole junction object.
 */
async function fetchSalesforceContacts(
  opportunityId: string,
  tokens: OAuthTokens,
  signal: AbortSignal,
): Promise<CRMContact[]> {
  const instanceUrl = tokens.instanceUrl;
  if (!instanceUrl) return [];

  const soql = encodeURIComponent(
    `SELECT ContactId, Contact.FirstName, Contact.LastName, Contact.Email, ` +
      `Contact.Phone, Contact.Title, IsPrimary, Role ` +
      `FROM OpportunityContactRole WHERE OpportunityId = '${opportunityId}' LIMIT 20`,
  );

  const url = `${instanceUrl}/services/data/v59.0/query?q=${soql}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    signal,
  });

  if (!response.ok) {
    logger.warn("CRMConnector: failed to fetch Salesforce opportunity contacts", {
      opportunityId,
      status: response.status,
    });
    return [];
  }

  const data = (await response.json()) as {
    records?: Array<Record<string, unknown>>;
  };

  return (data.records ?? []).map((r, i) => {
    const contact = ((r.Contact ?? {}) as Record<string, unknown>);
    return {
      id: String(r.ContactId ?? i),
      first_name: (contact.FirstName as string) ?? "",
      last_name: (contact.LastName as string) ?? "",
      email: (contact.Email as string) ?? undefined,
      phone: (contact.Phone as string) ?? undefined,
      job_title: (contact.Title as string) ?? undefined,
      role: "unknown" as const,
      is_primary: Boolean(r.IsPrimary),
    };
  });
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapCanonicalOpportunity(canonical: {
  externalId: string;
  name: string;
  stage: string;
  amount?: number | null;
  closeDate?: string | null;
  probability?: number | null;
  ownerName?: string | null;
  properties: Record<string, unknown>;
}): CRMOpportunity {
  return {
    id: canonical.externalId,
    name: canonical.name,
    stage: canonical.stage,
    amount: canonical.amount ?? undefined,
    close_date: canonical.closeDate ?? undefined,
    probability: canonical.probability ?? undefined,
    owner: canonical.ownerName
      ? { id: "unknown", name: canonical.ownerName, email: "" }
      : undefined,
    custom_properties: canonical.properties,
  };
}

function mapCanonicalAccount(canonical: {
  externalId: string;
  name: string;
  industry?: string;
  size?: string;
  revenue?: number;
  domain?: string;
  properties: Record<string, unknown>;
}): CRMAccount {
  return {
    id: canonical.externalId,
    name: canonical.name,
    industry: canonical.industry,
    size_employees: canonical.size ? parseInt(canonical.size, 10) || undefined : undefined,
    annual_revenue: canonical.revenue,
    website: canonical.domain,
    custom_properties: canonical.properties,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CRMConnector {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
  };

  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT_MS = 30_000;
  private readonly REQUEST_TIMEOUT_MS = 30_000;

  private readonly connectionService = new CrmConnectionService();

  /**
   * Fetch deal context from the connected CRM provider.
   *
   * Resolves the provider and tokens from the crm_connections row identified
   * by crmConnectionId, then delegates to the appropriate provider client.
   * Credentials are never hardcoded — all tokens come from encrypted storage.
   */
  async fetchDealContext(input: CRMFetchInput): Promise<CRMFetchResult> {
    logger.info("CRMConnector: fetching deal context", {
      opportunityId: input.opportunityId,
      crmConnectionId: input.crmConnectionId,
    });

    if (this.isCircuitOpen()) {
      throw new CRMFetchError("CRM circuit breaker is open — too many failures", "unknown");
    }

    try {
      const result = await this.fetchWithTimeout(input);
      this.resetCircuitBreaker();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) return false;

    if (this.circuitBreaker.lastFailure) {
      const elapsed = Date.now() - this.circuitBreaker.lastFailure;
      if (elapsed > this.RESET_TIMEOUT_MS) {
        logger.info("CRMConnector: circuit breaker reset after timeout");
        this.resetCircuitBreaker();
        return false;
      }
    }

    return true;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.FAILURE_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      logger.error("CRMConnector: circuit breaker opened due to repeated failures", {
        failures: this.circuitBreaker.failures,
      });
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.lastFailure = null;
    this.circuitBreaker.isOpen = false;
  }

  private async fetchWithTimeout(input: CRMFetchInput): Promise<CRMFetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      return await this.fetchFromProvider(input, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new CRMFetchError(
          `CRM request timed out after ${this.REQUEST_TIMEOUT_MS}ms`,
          "unknown",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Resolve the connection row, get live tokens, and fetch from the provider.
   */
  private async fetchFromProvider(
    input: CRMFetchInput,
    signal: AbortSignal,
  ): Promise<CRMFetchResult> {
    // 1. Resolve the connection row to get provider type.
    const supabase = createServerSupabaseClient();
    const { data: conn, error: connError } = await supabase
      .from("crm_connections")
      .select("provider, tenant_id")
      .eq("id", input.crmConnectionId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle();

    if (connError) {
      throw new CRMFetchError(
        `Failed to load CRM connection: ${connError.message}`,
        "unknown",
      );
    }

    if (!conn) {
      throw new CRMFetchError(
        `CRM connection not found: ${input.crmConnectionId}`,
        "unknown",
        404,
      );
    }

    const provider = conn.provider as CrmProvider;

    // 2. Get live (possibly refreshed) tokens.
    const tokens = await this.connectionService.getTokens(input.tenantId, provider);
    if (!tokens) {
      throw new CRMFetchError(
        `CRM connection is not active or tokens are expired for provider: ${provider}`,
        provider,
        401,
      );
    }

    // 3. Fetch opportunity and contacts in parallel.
    const impl = getCrmProvider(provider);

    const [canonicalOpportunity, contacts] = await Promise.all([
      impl.fetchOpportunityById(tokens, input.opportunityId),
      provider === "hubspot"
        ? fetchHubSpotContacts(input.opportunityId, tokens, signal)
        : fetchSalesforceContacts(input.opportunityId, tokens, signal),
    ]);

    if (!canonicalOpportunity) {
      throw new CRMFetchError(
        `Opportunity not found in ${provider}: ${input.opportunityId}`,
        provider,
        404,
      );
    }

    // 4. Fetch account if we have a companyId.
    let canonicalAccount: Awaited<ReturnType<typeof impl.fetchAccountById>> = null;
    if (canonicalOpportunity.companyId) {
      canonicalAccount = await impl.fetchAccountById(tokens, canonicalOpportunity.companyId);
    }

    const opportunity = mapCanonicalOpportunity(canonicalOpportunity);
    const account: CRMAccount = canonicalAccount
      ? mapCanonicalAccount(canonicalAccount)
      : {
          id: canonicalOpportunity.companyId ?? "unknown",
          name: canonicalOpportunity.companyName ?? "Unknown Account",
        };

    logger.info("CRMConnector: fetch complete", {
      provider,
      opportunityId: input.opportunityId,
      contactCount: contacts.length,
    });

    return {
      opportunity,
      account,
      contacts,
      fetchedAt: new Date().toISOString(),
      sourceType: "crm-opportunity",
    };
  }

  /**
   * Get circuit breaker status for health checks.
   */
  getCircuitStatus(): { isOpen: boolean; failures: number; lastFailure: number | null } {
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      lastFailure: this.circuitBreaker.lastFailure,
    };
  }
}
