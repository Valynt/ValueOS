/**
 * CRM Provider Interface
 *
 * Abstract contract that each CRM provider (Salesforce, HubSpot) must implement.
 * Handles OAuth, webhook verification, data fetching, and field mapping.
 */

import type { Request } from 'express';
import type {
  CanonicalAccount,
  CanonicalOpportunity,
  CrmProvider,
  DeltaSyncResult,
  OAuthCallbackParams,
  OAuthStartResult,
  OAuthTokens,
  WebhookVerificationResult,
} from './types.js';

export interface CrmProviderInterface {
  readonly provider: CrmProvider;

  // OAuth flow
  getAuthUrl(tenantId: string, redirectUri: string): OAuthStartResult;
  exchangeCodeForTokens(params: OAuthCallbackParams, redirectUri: string): Promise<OAuthTokens>;
  refreshTokenIfNeeded(tokens: OAuthTokens): Promise<OAuthTokens | null>;

  // Webhook
  verifyWebhookSignature(req: Request): Promise<WebhookVerificationResult>;
  extractIdempotencyKey(payload: Record<string, unknown>): string;

  // Data fetching
  fetchDeltaOpportunities(
    tokens: OAuthTokens,
    cursor: string | null,
  ): Promise<DeltaSyncResult>;

  fetchOpportunityById(
    tokens: OAuthTokens,
    externalId: string,
  ): Promise<CanonicalOpportunity | null>;

  fetchAccountById(
    tokens: OAuthTokens,
    externalId: string,
  ): Promise<CanonicalAccount | null>;

  // Field mapping
  mapOpportunityToCanonical(raw: Record<string, unknown>): CanonicalOpportunity;
}
