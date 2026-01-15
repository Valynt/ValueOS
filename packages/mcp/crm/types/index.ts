/**
 * MCP CRM Server Types
 * 
 * Type definitions for CRM integrations (HubSpot, Salesforce)
 */

// ============================================================================
// Provider Types
// ============================================================================

export type CRMProvider = 'hubspot' | 'salesforce' | 'dynamics';

export interface CRMConnection {
  id: string;
  tenantId: string;
  provider: CRMProvider;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  instanceUrl?: string;  // Salesforce
  hubId?: string;        // HubSpot
  scopes: string[];
  status: 'active' | 'expired' | 'revoked' | 'error';
}

// ============================================================================
// Deal/Opportunity Types
// ============================================================================

export interface CRMDeal {
  id: string;
  externalId: string;  // ID in the CRM system
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
  role?: string;  // Decision maker, influencer, etc.
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
  type: 'email' | 'call' | 'meeting' | 'task' | 'note';
  subject?: string;
  body?: string;
  occurredAt: Date;
  durationMinutes?: number;
  dealId?: string;
  contactIds?: string[];
  ownerId?: string;
  properties: Record<string, unknown>;
}

// ============================================================================
// Search & Query Types
// ============================================================================

export interface DealSearchParams {
  query?: string;           // Free text search
  companyName?: string;     // Filter by company
  stage?: string[];         // Filter by stage(s)
  minAmount?: number;       // Minimum deal value
  maxAmount?: number;       // Maximum deal value
  ownerId?: string;         // Filter by owner
  closeDateAfter?: Date;    // Close date range
  closeDateBefore?: Date;
  limit?: number;           // Max results (default 10)
}

export interface DealSearchResult {
  deals: CRMDeal[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Tool Result Types
// ============================================================================

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

// ============================================================================
// Module Interface
// ============================================================================

export interface CRMModule {
  provider: CRMProvider;
  
  // Connection
  isConnected(): boolean;
  testConnection(): Promise<boolean>;
  
  // Deals/Opportunities
  searchDeals(params: DealSearchParams): Promise<DealSearchResult>;
  getDeal(dealId: string): Promise<CRMDeal | null>;
  getDealContacts(dealId: string): Promise<CRMContact[]>;
  getDealActivities(dealId: string, limit?: number): Promise<CRMActivity[]>;
  
  // Companies
  getCompany(companyId: string): Promise<CRMCompany | null>;
  searchCompanies(query: string, limit?: number): Promise<CRMCompany[]>;
  
  // Sync
  updateDealProperties(dealId: string, properties: Record<string, unknown>): Promise<boolean>;
  addDealNote(dealId: string, note: string): Promise<boolean>;
}

// ============================================================================
// Server Configuration
// ============================================================================

export interface MCPCRMConfig {
  tenantId: string;
  userId: string;
  enabledProviders: CRMProvider[];
  refreshTokensAutomatically: boolean;
}
