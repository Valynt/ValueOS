/**
 * Canonical CRM contracts for MCP runtimes.
 *
 * Runtime implementations in `packages/mcp/crm` and app adapters should import
 * these shared interfaces to avoid type drift.
 */

export type CRMProvider = "hubspot" | "salesforce" | "dynamics";

export interface CRMConnection {
  id: string;
  tenantId: string;
  provider: CRMProvider;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  instanceUrl?: string;
  hubId?: string;
  scopes: string[];
  status: "active" | "expired" | "revoked" | "error";
}

export interface CRMDeal {
  id: string;
  externalId: string;
  provider: CRMProvider;
  name: string;
  amount?: number;
  currency?: string;
  stage: string;
  probability?: number;
  closeDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  ownerName?: string;
  companyId?: string;
  companyName?: string;
  properties: Record<string, unknown>;
}

export interface CRMContact {
  id: string;
  externalId: string;
  provider: CRMProvider;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  properties: Record<string, unknown>;
}

export interface CRMCompany {
  id: string;
  externalId: string;
  provider: CRMProvider;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  revenue?: number;
  properties: Record<string, unknown>;
}

export interface CRMActivity {
  id: string;
  externalId: string;
  provider: CRMProvider;
  type: "email" | "call" | "meeting" | "task" | "note";
  subject?: string;
  body?: string;
  occurredAt: Date;
  durationMinutes?: number;
  dealId?: string;
  contactIds?: string[];
  ownerId?: string;
  properties: Record<string, unknown>;
}

export interface DealSearchParams {
  query?: string;
  companyName?: string;
  stage?: string[];
  minAmount?: number;
  maxAmount?: number;
  ownerId?: string;
  closeDateAfter?: Date;
  closeDateBefore?: Date;
  limit?: number;
}

export interface DealSearchResult {
  deals: CRMDeal[];
  total: number;
  hasMore: boolean;
}

export interface MCPCRMToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    provider: CRMProvider;
    requestDurationMs: number;
    rateLimitRemaining?: number;
  };
}

export interface CRMModule {
  provider: CRMProvider;
  isConnected(): boolean;
  testConnection(): Promise<boolean>;
  searchDeals(params: DealSearchParams): Promise<DealSearchResult>;
  getDeal(dealId: string): Promise<CRMDeal | null>;
  getDealContacts(dealId: string): Promise<CRMContact[]>;
  getDealActivities(dealId: string, limit?: number): Promise<CRMActivity[]>;
  getCompany(companyId: string): Promise<CRMCompany | null>;
  searchCompanies(query: string, limit?: number): Promise<CRMCompany[]>;
  updateDealProperties(
    dealId: string,
    properties: Record<string, unknown>
  ): Promise<boolean>;
  addDealNote(dealId: string, note: string): Promise<boolean>;
}

export interface MCPCRMConfig {
  tenantId: string;
  userId: string;
  enabledProviders: CRMProvider[];
  refreshTokensAutomatically: boolean;
}
