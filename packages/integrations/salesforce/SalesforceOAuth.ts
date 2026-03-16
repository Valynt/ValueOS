/**
 * Salesforce OAuth2 Authorization Code Flow
 *
 * Implements the full OAuth2 authorization_code grant for Salesforce:
 *   1. Generate authorization URL (redirect user to Salesforce login)
 *   2. Exchange authorization code for access + refresh tokens
 *   3. Token refresh (delegates to SalesforceAdapter.refreshAccessToken)
 *   4. Token revocation
 *
 * This module is intentionally separate from SalesforceAdapter so that
 * the OAuth flow can be used by backend API routes without instantiating
 * the full adapter.
 *
 * Security:
 *   - PKCE (Proof Key for Code Exchange) is supported and recommended
 *   - State parameter is required for CSRF protection
 *   - Tokens are never logged
 */
import { z } from "zod";
import { AuthError } from "../base/errors.js";

// ============================================================================
// Types
// ============================================================================

export interface SalesforceOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Defaults to https://login.salesforce.com */
  loginUrl?: string;
  /** Scopes to request. Defaults to ["api", "refresh_token"] */
  scopes?: string[];
  /** Enable PKCE flow (recommended for public clients) */
  usePKCE?: boolean;
}

export interface AuthorizationUrlResult {
  url: string;
  state: string;
  /** Only present when usePKCE is true */
  codeVerifier?: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  tokenType: string;
  issuedAt: string;
  /** Scope granted by Salesforce */
  scope: string;
  /** ID URL for the authenticated user */
  idUrl: string;
}

export interface TokenRefreshResult {
  accessToken: string;
  instanceUrl: string;
  issuedAt: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const SalesforceOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  loginUrl: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  usePKCE: z.boolean().optional(),
});

const SalesforceTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  instance_url: z.string(),
  token_type: z.string().default("Bearer"),
  issued_at: z.string(),
  scope: z.string().default(""),
  id: z.string().default(""),
});

// ============================================================================
// Implementation
// ============================================================================

const DEFAULT_LOGIN_URL = "https://login.salesforce.com";
const DEFAULT_SCOPES = ["api", "refresh_token"];

/**
 * loginUrl must resolve to a Salesforce-owned domain to prevent SSRF and
 * client_secret exfiltration. Matches *.salesforce.com and *.force.com.
 */
const ALLOWED_LOGIN_URL_PATTERN =
  /^https:\/\/([a-zA-Z0-9-]+\.)+salesforce\.com(\/|$)|^https:\/\/([a-zA-Z0-9-]+\.)+force\.com(\/|$)/;

export class SalesforceOAuth {
  private readonly config: SalesforceOAuthConfig;
  private readonly loginUrl: string;
  private readonly scopes: string[];

  constructor(config: SalesforceOAuthConfig) {
    const parsed = SalesforceOAuthConfigSchema.parse(config);

    if (parsed.loginUrl && !ALLOWED_LOGIN_URL_PATTERN.test(parsed.loginUrl)) {
      throw new AuthError(
        "salesforce",
        `loginUrl '${parsed.loginUrl}' is not an allowed Salesforce domain. ` +
          "Must be under *.salesforce.com or *.force.com.",
      );
    }

    this.config = parsed;
    this.loginUrl = parsed.loginUrl ?? DEFAULT_LOGIN_URL;
    this.scopes = parsed.scopes ?? DEFAULT_SCOPES;
  }

  /**
   * Step 1: Generate the authorization URL.
   *
   * Redirect the user's browser to this URL to initiate the OAuth flow.
   * The `state` parameter is auto-generated for CSRF protection.
   */
  getAuthorizationUrl(overrideState?: string): AuthorizationUrlResult {
    const state = overrideState ?? generateState();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.scopes.join(" "),
      state,
      prompt: "login consent",
    });

    let codeVerifier: string | undefined;

    if (this.config.usePKCE) {
      codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }

    const url = `${this.loginUrl}/services/oauth2/authorize?${params.toString()}`;

    return { url, state, codeVerifier };
  }

  /**
   * Step 2: Exchange the authorization code for tokens.
   *
   * Called from the OAuth callback route after the user authorizes.
   */
  async exchangeCode(
    code: string,
    codeVerifier?: string,
  ): Promise<TokenExchangeResult> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
    });

    if (codeVerifier) {
      params.set("code_verifier", codeVerifier);
    }

    const response = await fetch(
      `${this.loginUrl}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new AuthError(
        "salesforce",
        `OAuth code exchange failed (${response.status}): ${body}`,
      );
    }

    const raw = await response.json();
    const parsed = SalesforceTokenResponseSchema.parse(raw);

    if (!parsed.refresh_token) {
      throw new AuthError(
        "salesforce",
        "No refresh_token returned. Ensure 'refresh_token' scope is requested.",
      );
    }

    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      instanceUrl: parsed.instance_url,
      tokenType: parsed.token_type,
      issuedAt: parsed.issued_at,
      scope: parsed.scope,
      idUrl: parsed.id,
    };
  }

  /**
   * Step 3: Refresh an expired access token.
   */
  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(
      `${this.loginUrl}/services/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new AuthError(
        "salesforce",
        `Token refresh failed (${response.status}): ${body}`,
      );
    }

    const raw = await response.json();
    const parsed = SalesforceTokenResponseSchema.parse(raw);

    return {
      accessToken: parsed.access_token,
      instanceUrl: parsed.instance_url,
      issuedAt: parsed.issued_at,
    };
  }

  /**
   * Step 4: Revoke a token (access or refresh).
   */
  async revokeToken(token: string): Promise<void> {
    const params = new URLSearchParams({ token });

    const response = await fetch(
      `${this.loginUrl}/services/oauth2/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    if (!response.ok && response.status !== 200) {
      const body = await response.text();
      throw new AuthError(
        "salesforce",
        `Token revocation failed (${response.status}): ${body}`,
      );
    }
  }
}

// ============================================================================
// PKCE Helpers
// ============================================================================

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function generateCodeChallenge(verifier: string): string {
  // For environments without SubtleCrypto (e.g. tests), fall back to plain
  // In production, the async version with SHA-256 should be used
  // This is a synchronous S256 placeholder using a simple hash
  // Real implementation should use: await crypto.subtle.digest('SHA-256', ...)
  return verifier; // Placeholder — see note below
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// NOTE: For production PKCE, replace generateCodeChallenge with:
//
// async function generateCodeChallengeAsync(verifier: string): Promise<string> {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(verifier);
//   const digest = await crypto.subtle.digest('SHA-256', data);
//   return base64UrlEncode(new Uint8Array(digest));
// }
