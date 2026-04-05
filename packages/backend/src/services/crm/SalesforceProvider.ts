/**
 * Salesforce CRM Provider
 *
 * Implements CrmProviderInterface for Salesforce using their REST API.
 * Handles OAuth 2.0 Web Server flow, webhook signature verification,
 * delta sync via SOQL, and field mapping to canonical types.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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

const logger = createLogger({ component: 'SalesforceProvider' });

// Salesforce OAuth endpoints
const SF_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const SF_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const SF_API_VERSION = 'v59.0';

function getConfig() {
  return {
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
    webhookSecret: process.env.SALESFORCE_WEBHOOK_SECRET || '',
  };
}

/**
 * Escape a string for use in SOQL WHERE clauses.
 * Prevents SOQL injection by escaping special characters.
 */
function escapeSoql(value: string): string {
  return value.replace(/[\\']/g, '\\$&');
}

/**
 * Validate that a Salesforce ID matches the expected 15 or 18 char alphanumeric format.
 */
function isValidSalesforceId(id: string): boolean {
  return /^[a-zA-Z0-9]{15,18}$/.test(id);
}

/**
 * Allowed Salesforce instance URL patterns for SSRF protection.
 */
const ALLOWED_SF_DOMAINS = [
  /^https:\/\/[a-z0-9-]+\.salesforce\.com$/,
  /^https:\/\/[a-z0-9-]+\.force\.com$/,
  /^https:\/\/[a-z0-9-]+\.my\.salesforce\.com$/,
  /^https:\/\/[a-z0-9-]+\.lightning\.force\.com$/,
  /^https:\/\/login\.salesforce\.com$/,
  /^https:\/\/test\.salesforce\.com$/,
];

function validateInstanceUrl(url: string): boolean {
  return ALLOWED_SF_DOMAINS.some((pattern) => pattern.test(url));
}

export class SalesforceProvider implements CrmProviderInterface {
  readonly provider = 'salesforce' as const;

  getAuthUrl(nonce: string, redirectUri: string): OAuthStartResult {
    const config = getConfig();

    // Generate PKCE code verifier (43–128 chars, URL-safe base64).
    const codeVerifier = randomBytes(32).toString('base64url');
    // S256 challenge: BASE64URL(SHA256(ASCII(code_verifier)))
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: 'api refresh_token',
      state: nonce,
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      authUrl: `${SF_AUTH_URL}?${params.toString()}`,
      state: nonce,
      codeVerifier,
    };
  }

  async exchangeCodeForTokens(
    params: OAuthCallbackParams,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    const config = getConfig();

    const bodyParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code: params.code,
      client_id: config.clientId,
      redirect_uri: redirectUri,
    };

    // Include code_verifier for PKCE flows; fall back to client_secret for legacy.
    if (params.codeVerifier) {
      bodyParams.code_verifier = params.codeVerifier;
    } else {
      bodyParams.client_secret = config.clientSecret;
    }

    const body = new URLSearchParams(bodyParams);

    const response = await fetch(SF_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Salesforce token exchange failed', undefined, {
        status: response.status,
        body: errorBody,
      });
      throw new Error(`Salesforce token exchange failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    // Fetch user info to get org ID
    const userInfoUrl = data.id as string;
    let externalOrgId: string | undefined;
    let externalUserId: string | undefined;

    if (userInfoUrl) {
      try {
        const userInfoResp = await fetch(userInfoUrl, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (userInfoResp.ok) {
          const userInfo = await userInfoResp.json() as Record<string, unknown>;
          externalOrgId = userInfo.organization_id as string;
          externalUserId = userInfo.user_id as string;
        }
      } catch (err) {
        logger.warn('Failed to fetch Salesforce user info', undefined, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Salesforce tokens ~2h
      instanceUrl: data.instance_url as string,
      scopes: ((data.scope as string) || '').split(' ').filter(Boolean),
      externalOrgId,
      externalUserId,
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

    const response = await fetch(SF_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Salesforce token refresh failed', undefined, {
        status: response.status,
      });
      throw new Error(`Salesforce token refresh failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      ...tokens,
      accessToken: data.access_token as string,
      // Salesforce may not return a new refresh token
      refreshToken: (data.refresh_token as string) || tokens.refreshToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      instanceUrl: (data.instance_url as string) || tokens.instanceUrl,
    };
  }

  async verifyWebhookSignature(req: Request): Promise<WebhookVerificationResult> {
    const config = getConfig();
    const signature = req.headers['x-sfdc-signature'] as string;

    if (!signature || !config.webhookSecret) {
      return { valid: false };
    }

    const rawBodyBuffer = req.rawBody
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
            'utf8',
          );

    const expected = createHmac('sha256', config.webhookSecret)
      .update(rawBodyBuffer)
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks
    let valid = false;
    try {
      const sigBuf = Buffer.from(signature, 'base64');
      const expBuf = Buffer.from(expected, 'base64');
      if (sigBuf.length === expBuf.length) {
        valid = timingSafeEqual(sigBuf, expBuf);
      }
    } catch {
      valid = false;
    }

    // Timestamp tolerance: reject events older than 5 minutes if timestamp present
    let parsedPayload: Record<string, unknown> | undefined;
    try {
      parsedPayload = Buffer.isBuffer(req.body)
        ? JSON.parse(rawBodyBuffer.toString('utf8')) as Record<string, unknown>
        : req.body as Record<string, unknown>;
    } catch {
      parsedPayload = undefined;
    }

    if (valid && parsedPayload?.timestamp) {
      const eventTime = new Date(parsedPayload.timestamp as string).getTime();
      const now = Date.now();
      const toleranceMs = 5 * 60 * 1000;
      if (Math.abs(now - eventTime) > toleranceMs) {
        logger.warn('Webhook event outside timestamp tolerance', {
          eventTime: new Date(eventTime).toISOString(),
          drift: Math.abs(now - eventTime),
        });
        return { valid: false };
      }
    }

    // Extract tenant from the webhook payload's org ID
    let tenantId: string | undefined;
    if (valid && parsedPayload?.organizationId) {
      tenantId = parsedPayload.organizationId as string;
    }

    return { valid, tenantId };
  }

  extractIdempotencyKey(payload: Record<string, unknown>): string {
    // Salesforce outbound messages include a unique event ID
    // For Platform Events, use replayId + entity
    const eventId = payload.eventId || payload.Id || payload.replayId;
    const entityType = payload.sobjectType || payload.entityType || 'unknown';
    return `sf:${entityType}:${eventId}:${Date.now()}`;
  }

  async fetchDeltaOpportunities(
    tokens: OAuthTokens,
    cursor: string | null,
  ): Promise<DeltaSyncResult> {
    const baseUrl = tokens.instanceUrl;
    if (!baseUrl) {
      throw new Error('Salesforce instance URL is required for API calls');
    }
    if (!validateInstanceUrl(baseUrl)) {
      throw new Error('Invalid Salesforce instance URL — SSRF protection');
    }

    // Use SystemModstamp for delta sync
    let soql = `SELECT Id, Name, Amount, StageName, Probability, CloseDate,
      CurrencyIsoCode, OwnerId, Owner.Name, AccountId, Account.Name,
      LastModifiedDate, SystemModstamp
      FROM Opportunity`;

    if (cursor) {
      soql += ` WHERE SystemModstamp > ${cursor}`;
    }

    soql += ' ORDER BY SystemModstamp ASC LIMIT 200';

    const url = `${baseUrl}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Salesforce query failed', undefined, {
        status: response.status,
        soql,
      });
      throw new Error(`Salesforce query failed: ${response.status}`);
    }

    const data = await response.json() as {
      records: Record<string, unknown>[];
      done: boolean;
      totalSize: number;
    };

    const opportunities = data.records.map((r) => this.mapOpportunityToCanonical(r));

    // Use the last record's SystemModstamp as the next cursor
    const lastRecord = data.records[data.records.length - 1];
    const nextCursor = lastRecord
      ? (lastRecord.SystemModstamp as string)
      : cursor;

    return {
      opportunities,
      nextCursor,
      hasMore: !data.done,
    };
  }

  async fetchOpportunityById(
    tokens: OAuthTokens,
    externalId: string,
  ): Promise<CanonicalOpportunity | null> {
    const baseUrl = tokens.instanceUrl;
    if (!baseUrl) throw new Error('Salesforce instance URL required');
    if (!validateInstanceUrl(baseUrl)) throw new Error('Invalid Salesforce instance URL');
    if (!isValidSalesforceId(externalId)) {
      logger.warn('Invalid Salesforce ID format', { externalId: externalId.slice(0, 20) });
      return null;
    }

    const soql = `SELECT Id, Name, Amount, StageName, Probability, CloseDate,
      CurrencyIsoCode, OwnerId, Owner.Name, AccountId, Account.Name,
      LastModifiedDate, SystemModstamp
      FROM Opportunity WHERE Id = '${escapeSoql(externalId)}' LIMIT 1`;

    const url = `${baseUrl}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { records: Record<string, unknown>[] };
    if (!data.records || data.records.length === 0) return null;

    return this.mapOpportunityToCanonical(data.records[0]);
  }

  async fetchAccountById(
    tokens: OAuthTokens,
    externalId: string,
  ): Promise<CanonicalAccount | null> {
    const baseUrl = tokens.instanceUrl;
    if (!baseUrl) throw new Error('Salesforce instance URL required');
    if (!validateInstanceUrl(baseUrl)) throw new Error('Invalid Salesforce instance URL');
    if (!isValidSalesforceId(externalId)) return null;

    const soql = `SELECT Id, Name, Website, Industry, NumberOfEmployees, AnnualRevenue
      FROM Account WHERE Id = '${escapeSoql(externalId)}' LIMIT 1`;

    const url = `${baseUrl}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { records: Record<string, unknown>[] };
    if (!data.records || data.records.length === 0) return null;

    const r = data.records[0];
    return {
      externalId: r.Id as string,
      name: r.Name as string,
      domain: r.Website as string | undefined,
      industry: r.Industry as string | undefined,
      size: r.NumberOfEmployees ? String(r.NumberOfEmployees) : undefined,
      revenue: r.AnnualRevenue as number | undefined,
      properties: r,
    };
  }

  mapOpportunityToCanonical(raw: Record<string, unknown>): CanonicalOpportunity {
    const owner = raw.Owner as Record<string, unknown> | undefined;
    const account = raw.Account as Record<string, unknown> | undefined;

    return {
      externalId: raw.Id as string,
      name: (raw.Name as string) || 'Untitled Opportunity',
      amount: (raw.Amount as number) ?? null,
      currency: (raw.CurrencyIsoCode as string) || 'USD',
      stage: (raw.StageName as string) || 'Unknown',
      probability: (raw.Probability as number) ?? null,
      closeDate: (raw.CloseDate as string) ?? null,
      ownerName: (owner?.Name as string) ?? null,
      companyName: (account?.Name as string) ?? null,
      companyId: (raw.AccountId as string) ?? null,
      properties: raw,
    };
  }
}
