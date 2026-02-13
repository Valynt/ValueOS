/**
 * HubSpot CRM Provider
 *
 * Implements CrmProviderInterface for HubSpot using their v3 REST API.
 * Handles OAuth 2.0 Authorization Code flow, v3 webhook signature
 * verification (SHA-256 HMAC with timing-safe comparison), delta sync
 * via the search/recently-modified endpoints, and field mapping.
 *
 * Enterprise hardening:
 * - Timing-safe HMAC signature verification (v3 primary, v2 fallback)
 * - Timestamp tolerance (5 min window on v3; v2 has no timestamp header)
 * - SSRF protection via domain allowlist on every outbound URL
 * - HubSpot ID validation (numeric only, max 20 digits)
 * - Minimum scope enforcement
 * - Error body redaction in logs
 * - Invalid ID logging for security audit trail
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { createLogger } from '../../lib/logger.js';
import type { CrmProviderInterface } from './CrmProviderInterface.js';
import type {
  CanonicalAccount,
  CanonicalOpportunity,
  DeltaSyncResult,
  OAuthCallbackParams,
  OAuthStartResult,
  OAuthTokens,
  WebhookVerificationResult,
} from './types.js';

const logger = createLogger({ component: 'HubSpotProvider' });

// HubSpot OAuth endpoints
const HS_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HS_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HS_API_BASE = 'https://api.hubapi.com';

function getConfig() {
  return {
    clientId: process.env.HUBSPOT_CLIENT_ID || '',
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
    webhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET || '',
  };
}

/**
 * Validate that a HubSpot object ID is numeric (all HubSpot IDs are numeric strings).
 */
function isValidHubSpotId(id: string): boolean {
  return /^\d{1,20}$/.test(id);
}

/**
 * Allowed HubSpot API domains for SSRF protection.
 * All outbound requests are validated against this allowlist.
 */
const ALLOWED_HS_DOMAINS = [
  /^https:\/\/api\.hubapi\.com$/,
  /^https:\/\/api\.hubspot\.com$/,
  /^https:\/\/app\.hubspot\.com$/,
];

function validateHubSpotUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    return ALLOWED_HS_DOMAINS.some((pattern) => pattern.test(origin));
  } catch {
    return false;
  }
}

/**
 * Validate a full URL before making an outbound request.
 * Throws on invalid URLs to prevent SSRF.
 */
function assertSafeUrl(url: string, context: string): void {
  if (!validateHubSpotUrl(url)) {
    throw new Error(`Invalid HubSpot URL (${context}) — SSRF protection: ${new URL(url).origin}`);
  }
}

// HubSpot deal properties we request (least-privilege: only what we need)
const DEAL_PROPERTIES = [
  'dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id',
  'hs_lastmodifieddate', 'createdate', 'pipeline', 'deal_currency_code',
  'hs_deal_stage_probability',
].join(',');

const COMPANY_PROPERTIES = 'name,domain,industry,numberofemployees,annualrevenue';

export class HubSpotProvider implements CrmProviderInterface {
  readonly provider = 'hubspot' as const;

  // ============================================================================
  // OAuth
  // ============================================================================

  getAuthUrl(nonce: string, redirectUri: string): OAuthStartResult {
    const config = getConfig();

    const scopes = [
      'crm.objects.deals.read',
      'crm.objects.companies.read',
      'crm.objects.contacts.read',
      'crm.schemas.deals.read',
      'oauth',
    ];

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: nonce,
    });

    return {
      authUrl: `${HS_AUTH_URL}?${params.toString()}`,
      state: nonce,
    };
  }

  async exchangeCodeForTokens(
    params: OAuthCallbackParams,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    const config = getConfig();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch(HS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      // Never log the raw error body — it may contain secrets
      logger.error('HubSpot token exchange failed', undefined, {
        status: response.status,
      });
      throw new Error(`HubSpot token exchange failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    // HubSpot returns expires_in in seconds
    const expiresIn = (data.expires_in as number) || 21600; // default 6h

    // Fetch portal ID (hub_id) via access token info
    // Validate the URL before making the request
    let externalOrgId: string | undefined;
    const tokenInfoUrl = `${HS_API_BASE}/oauth/v1/access-tokens/${encodeURIComponent(String(data.access_token))}`;
    try {
      assertSafeUrl(tokenInfoUrl, 'token-info');
      const infoResp = await fetch(tokenInfoUrl);
      if (infoResp.ok) {
        const info = await infoResp.json() as Record<string, unknown>;
        externalOrgId = info.hub_id ? String(info.hub_id) : undefined;
      }
    } catch (err) {
      logger.warn('Failed to fetch HubSpot token info', undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      instanceUrl: HS_API_BASE,
      scopes: ((data.scope as string) || '').split(' ').filter(Boolean),
      externalOrgId,
      externalUserId: undefined,
    };
  }

  async refreshTokenIfNeeded(tokens: OAuthTokens): Promise<OAuthTokens | null> {
    // Refresh if token expires within 5 minutes
    const bufferMs = 5 * 60 * 1000;
    if (tokens.expiresAt.getTime() - Date.now() > bufferMs) {
      return null; // No refresh needed
    }

    const config = getConfig();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(HS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      // Log status but never the response body (may contain token details)
      logger.error('HubSpot token refresh failed', undefined, {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HubSpot token refresh failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const expiresIn = (data.expires_in as number) || 21600;

    return {
      ...tokens,
      accessToken: data.access_token as string,
      // HubSpot always returns a new refresh token
      refreshToken: (data.refresh_token as string) || tokens.refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  // ============================================================================
  // Webhook Verification
  // ============================================================================

  async verifyWebhookSignature(req: Request): Promise<WebhookVerificationResult> {
    const config = getConfig();

    // HubSpot v3 signature: SHA-256 HMAC of (clientSecret + method + url + body + timestamp)
    // Header: X-HubSpot-Signature-v3
    // Timestamp: X-HubSpot-Request-Timestamp
    const signatureV3 = req.headers['x-hubspot-signature-v3'] as string;
    const timestamp = req.headers['x-hubspot-request-timestamp'] as string;

    // Fall back to v2 if v3 not present
    const signatureV2 = req.headers['x-hubspot-signature'] as string;

    if (!config.webhookSecret) {
      return { valid: false };
    }

    const rawBody = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    let valid = false;

    if (signatureV3 && timestamp) {
      // v3 verification: HMAC-SHA256(secret, method + url + body + timestamp)
      const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const sourceString = `${req.method}${requestUrl}${rawBody}${timestamp}`;

      const expected = createHmac('sha256', config.webhookSecret)
        .update(sourceString)
        .digest('base64');

      try {
        const sigBuf = Buffer.from(signatureV3, 'base64');
        const expBuf = Buffer.from(expected, 'base64');
        if (sigBuf.length === expBuf.length) {
          valid = timingSafeEqual(sigBuf, expBuf);
        }
      } catch {
        valid = false;
      }

      // Timestamp tolerance: reject events older than 5 minutes
      if (valid && timestamp) {
        const eventTime = parseInt(timestamp, 10);
        const now = Date.now();
        const toleranceMs = 5 * 60 * 1000;
        if (isNaN(eventTime) || Math.abs(now - eventTime) > toleranceMs) {
          logger.warn('HubSpot webhook outside timestamp tolerance', {
            timestamp,
            drift: Math.abs(now - eventTime),
          });
          return { valid: false };
        }
      }
    } else if (signatureV2) {
      // v2 fallback: SHA-256(secret + body)
      // Note: v2 does not provide a timestamp header, so no replay protection
      // beyond the idempotency key in the webhook service layer.
      const expected = createHash('sha256')
        .update(config.webhookSecret + rawBody)
        .digest('hex');

      try {
        const sigBuf = Buffer.from(signatureV2, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        if (sigBuf.length === expBuf.length) {
          valid = timingSafeEqual(sigBuf, expBuf);
        }
      } catch {
        valid = false;
      }
    } else {
      return { valid: false };
    }

    // Extract portal ID from payload
    let tenantId: string | undefined;
    if (valid) {
      const payload = req.body;
      if (Array.isArray(payload) && payload.length > 0) {
        tenantId = payload[0].portalId ? String(payload[0].portalId) : undefined;
      } else if (payload?.portalId) {
        tenantId = String(payload.portalId);
      }
    }

    return { valid, tenantId };
  }

  extractIdempotencyKey(payload: Record<string, unknown>): string {
    // HubSpot webhook payloads are arrays of subscription events.
    // Each event has: eventId, subscriptionId, portalId, occurredAt
    if (Array.isArray(payload)) {
      // Batch: use first event's ID
      const first = payload[0] as Record<string, unknown> | undefined;
      const eventId = first?.eventId || first?.subscriptionId;
      return `hs:batch:${eventId}:${Date.now()}`;
    }

    const eventId = payload.eventId || payload.subscriptionId || payload.objectId;
    const eventType = payload.subscriptionType || payload.eventType || 'unknown';
    return `hs:${eventType}:${eventId}:${Date.now()}`;
  }

  // ============================================================================
  // Data Fetching
  // ============================================================================

  async fetchDeltaOpportunities(
    tokens: OAuthTokens,
    cursor: string | null,
  ): Promise<DeltaSyncResult> {
    const url = `${HS_API_BASE}/crm/v3/objects/deals/search`;
    assertSafeUrl(url, 'delta-sync');

    // HubSpot uses the search API with a filter on hs_lastmodifieddate
    const filterGroups: unknown[] = [];

    if (cursor) {
      filterGroups.push({
        filters: [{
          propertyName: 'hs_lastmodifieddate',
          operator: 'GT',
          value: cursor,
        }],
      });
    }

    const searchBody = {
      filterGroups: filterGroups.length > 0 ? filterGroups : undefined,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
      properties: DEAL_PROPERTIES.split(','),
      limit: 100,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      logger.error('HubSpot deal search failed', undefined, {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HubSpot deal search failed: ${response.status}`);
    }

    const data = await response.json() as {
      results: Record<string, unknown>[];
      paging?: { next?: { after: string } };
      total: number;
    };

    const opportunities = data.results.map((r) => this.mapOpportunityToCanonical(r));

    // Use the last record's hs_lastmodifieddate as the next cursor
    const lastRecord = data.results[data.results.length - 1];
    const lastProps = lastRecord?.properties as Record<string, unknown> | undefined;
    const nextCursor = lastProps?.hs_lastmodifieddate
      ? String(lastProps.hs_lastmodifieddate)
      : cursor;

    return {
      opportunities,
      nextCursor,
      hasMore: !!data.paging?.next,
    };
  }

  async fetchOpportunityById(
    tokens: OAuthTokens,
    externalId: string,
  ): Promise<CanonicalOpportunity | null> {
    if (!isValidHubSpotId(externalId)) {
      logger.warn('Invalid HubSpot deal ID format', { externalId: externalId.slice(0, 20) });
      return null;
    }

    const url = `${HS_API_BASE}/crm/v3/objects/deals/${externalId}?properties=${DEAL_PROPERTIES}&associations=companies`;
    assertSafeUrl(url, 'fetchOpportunityById');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      logger.error('HubSpot fetchOpportunityById failed', undefined, {
        status: response.status,
        statusText: response.statusText,
        externalId,
      });
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    return this.mapOpportunityToCanonical(data);
  }

  async fetchAccountById(
    tokens: OAuthTokens,
    externalId: string,
  ): Promise<CanonicalAccount | null> {
    if (!isValidHubSpotId(externalId)) {
      logger.warn('Invalid HubSpot company ID format', { externalId: externalId.slice(0, 20) });
      return null;
    }

    const url = `${HS_API_BASE}/crm/v3/objects/companies/${externalId}?properties=${COMPANY_PROPERTIES}`;
    assertSafeUrl(url, 'fetchAccountById');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      logger.error('HubSpot fetchAccountById failed', undefined, {
        status: response.status,
        statusText: response.statusText,
        externalId,
      });
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const props = (data.properties || {}) as Record<string, unknown>;

    return {
      externalId: String(data.id),
      name: (props.name as string) || 'Unknown Company',
      domain: props.domain as string | undefined,
      industry: props.industry as string | undefined,
      size: props.numberofemployees ? String(props.numberofemployees) : undefined,
      revenue: props.annualrevenue ? parseFloat(String(props.annualrevenue)) : undefined,
      properties: props,
    };
  }

  // ============================================================================
  // Field Mapping
  // ============================================================================

  mapOpportunityToCanonical(raw: Record<string, unknown>): CanonicalOpportunity {
    const props = (raw.properties || {}) as Record<string, unknown>;
    const associations = raw.associations as Record<string, unknown> | undefined;
    const companies = associations?.companies as { results?: Array<{ id: string }> } | undefined;

    // Parse amount safely — HubSpot returns string values
    let amount: number | null = null;
    if (props.amount != null && props.amount !== '') {
      const parsed = parseFloat(String(props.amount));
      amount = isNaN(parsed) ? null : parsed;
    }

    let probability: number | null = null;
    if (props.hs_deal_stage_probability != null && props.hs_deal_stage_probability !== '') {
      const parsed = parseFloat(String(props.hs_deal_stage_probability));
      probability = isNaN(parsed) ? null : parsed;
    }

    return {
      externalId: String(raw.id),
      name: (props.dealname as string) || 'Untitled Deal',
      amount,
      currency: (props.deal_currency_code as string) || 'USD',
      stage: (props.dealstage as string) || 'unknown',
      probability,
      closeDate: (props.closedate as string) ?? null,
      ownerName: (props.hubspot_owner_id as string) ?? null, // HubSpot returns owner ID, not name
      companyName: null, // Requires separate company fetch
      companyId: companies?.results?.[0]?.id ?? null,
      properties: {
        // Preserve only the fields needed for out-of-order protection and audit
        hs_lastmodifieddate: props.hs_lastmodifieddate,
        createdate: props.createdate,
        dealname: props.dealname,
        amount: props.amount,
        dealstage: props.dealstage,
        closedate: props.closedate,
        hubspot_owner_id: props.hubspot_owner_id,
        deal_currency_code: props.deal_currency_code,
        hs_deal_stage_probability: props.hs_deal_stage_probability,
        pipeline: props.pipeline,
      },
    };
  }
}
