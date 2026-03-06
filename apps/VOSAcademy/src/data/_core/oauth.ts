import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual } from "node:crypto";

import jwt, { type JwtPayload } from "jsonwebtoken";

import { upsertUser } from "../db";
import { getRequestAuditContext, logAuditEvent } from "../../lib/auditLogger";

import { COOKIE_NAME, getSessionCookieOptions } from "./cookies";
import { createSessionToken, parseCookies } from "./session";

interface OAuthUserInfo {
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
}

interface OAuthStatePayload {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  returnTo: string;
  createdAt: number;
}

const OAUTH_STATE_COOKIE = "vosacademy_oauth_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

function getTenantOrOrg(): string {
  return process.env.VITE_APP_ID || "unknown";
}

function base64UrlEncode(input: Buffer | string): string {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function getOAuthStateSecret(): string | null {
  return process.env.OAUTH_STATE_SECRET || process.env.VITE_APP_ID || null;
}

function signOAuthState(payload: OAuthStatePayload): string | null {
  const secret = getOAuthStateSecret();
  if (!secret) {
    console.error("[OAuth] Missing OAUTH_STATE_SECRET or VITE_APP_ID for state signing");
    return null;
  }

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyOAuthState(signed: string): OAuthStatePayload | null {
  const secret = getOAuthStateSecret();
  if (!secret) {
    console.error("[OAuth] Missing OAUTH_STATE_SECRET or VITE_APP_ID for state verification");
    return null;
  }

  const [encoded, signature] = signed.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(encoded)) as OAuthStatePayload;
  } catch (error) {
    console.error("[OAuth] Failed to decode state payload", error);
    return null;
  }
}

function buildRedirectUri(req: any): string {
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || "localhost:5173";
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  const protocol = forwardedProto || (req.socket?.encrypted ? "https" : "http");
  return `${protocol}://${host}/api/oauth/callback`;
}

function buildReturnTo(value?: string | null): string {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }
  return value;
}

function buildCodeChallenge(codeVerifier: string): string {
  const digest = createHash("sha256").update(codeVerifier).digest();
  return base64UrlEncode(digest);
}

function buildCookie(value: string, req: any, maxAgeSeconds: number): string {
  const options = getSessionCookieOptions(req);
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}; Path=${options.path || "/"}; Max-Age=${maxAgeSeconds}; HttpOnly; ${options.secure ? "Secure;" : ""} ${options.sameSite ? `SameSite=${options.sameSite};` : ""}`;
}

async function fetchOpenIdConfig(oauthPortalUrl: string): Promise<Record<string, any> | null> {
  try {
    const response = await fetch(`${oauthPortalUrl}/.well-known/openid-configuration`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, any>;
  } catch (error) {
    console.warn("[OAuth] Failed to load OpenID configuration", error);
    return null;
  }
}

async function getVerificationKey(jwksUri: string, kid?: string): Promise<ReturnType<typeof createPublicKey> | null> {
  const response = await fetch(jwksUri);
  if (!response.ok) {
    console.error("[OAuth] Failed to fetch JWKS");
    return null;
  }

  const jwks = (await response.json()) as { keys?: Array<Record<string, string>> };
  const key = jwks.keys?.find((jwk) => (kid ? jwk.kid === kid : true));
  if (!key) {
    console.error("[OAuth] No matching JWKS key found");
    return null;
  }

  try {
    return createPublicKey({ key, format: "jwk" });
  } catch (error) {
    console.error("[OAuth] Failed to create public key", error);
    return null;
  }
}

async function validateIdToken(idToken: string, issuer: string, audience: string, jwksUri: string): Promise<JwtPayload | null> {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = typeof decoded === "object" ? decoded?.header?.kid : undefined;
  const key = await getVerificationKey(jwksUri, kid);
  if (!key) {
    return null;
  }

  try {
    return jwt.verify(idToken, key, {
      issuer,
      audience,
      clockTolerance: 5,
    }) as JwtPayload;
  } catch (error) {
    console.error("[OAuth] ID token validation failed", error);
    return null;
  }
}

async function exchangeCodeForUserInfo(code: string, codeVerifier: string, redirectUri: string): Promise<OAuthUserInfo | null> {
  try {
    const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL;
    const appId = process.env.VITE_APP_ID;

    if (!oauthPortalUrl || !appId) {
      console.error("[OAuth] Missing OAuth configuration");
      return null;
    }

    const openIdConfig = await fetchOpenIdConfig(oauthPortalUrl);
    const tokenEndpoint = openIdConfig?.token_endpoint || `${oauthPortalUrl}/token`;
    const userinfoEndpoint = openIdConfig?.userinfo_endpoint || `${oauthPortalUrl}/userinfo`;
    const issuer = openIdConfig?.issuer || process.env.OAUTH_ISSUER || oauthPortalUrl;
    const jwksUri = openIdConfig?.jwks_uri || `${oauthPortalUrl}/.well-known/jwks.json`;

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: appId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    if (process.env.OAUTH_CLIENT_SECRET) {
      tokenBody.set("client_secret", process.env.OAUTH_CLIENT_SECRET);
    }

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      console.error("[OAuth] Token exchange failed", await tokenResponse.text());
      return null;
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      id_token?: string;
      token_type?: string;
    };

    if (!tokenData.access_token || !tokenData.id_token) {
      console.error("[OAuth] Token response missing access_token or id_token");
      return null;
    }

    const idTokenPayload = await validateIdToken(tokenData.id_token, issuer, process.env.OAUTH_AUDIENCE || appId, jwksUri);
    if (!idTokenPayload) {
      return null;
    }

    const userInfoResponse = await fetch(userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error("[OAuth] Failed to fetch user info", await userInfoResponse.text());
      return null;
    }

    const userInfo = (await userInfoResponse.json()) as {
      sub?: string;
      name?: string;
      email?: string;
    };

    return {
      openId: userInfo.sub || (idTokenPayload.sub as string),
      name: userInfo.name || (idTokenPayload.name as string),
      email: userInfo.email || (idTokenPayload.email as string),
      loginMethod: "oauth",
    };
  } catch (error) {
    console.error("[OAuth] Failed to exchange code:", error);
    return null;
  }
}

export async function handleOAuthLogin(req: any, res: any): Promise<{ success: boolean; redirectUrl: string }> {
  try {
    const oauthPortalUrl = process.env.VITE_OAUTH_PORTAL_URL;
    const appId = process.env.VITE_APP_ID;

    if (!oauthPortalUrl || !appId) {
      console.error("[OAuth] Missing OAuth configuration");
      return { success: false, redirectUrl: "/?error=oauth_config" };
    }

    const redirectUri = buildRedirectUri(req);
    const url = new URL(req.url || "", redirectUri);
    const returnTo = buildReturnTo(url.searchParams.get("returnTo"));

    const codeVerifier = base64UrlEncode(randomBytes(64));
    const state = base64UrlEncode(randomBytes(32));
    const codeChallenge = buildCodeChallenge(codeVerifier);

    const signedState = signOAuthState({
      state,
      codeVerifier,
      redirectUri,
      returnTo,
      createdAt: Date.now(),
    });

    if (!signedState) {
      return { success: false, redirectUrl: "/?error=oauth_state" };
    }

    res.setHeader("Set-Cookie", buildCookie(signedState, req, OAUTH_STATE_MAX_AGE_SECONDS));

    const authUrl = new URL(`${oauthPortalUrl}/app-auth`);
    authUrl.searchParams.set("appId", appId);
    authUrl.searchParams.set("redirectUri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("type", "signIn");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return { success: true, redirectUrl: authUrl.toString() };
  } catch (error) {
    console.error("[OAuth] Login handling failed:", error);
    return { success: false, redirectUrl: "/?error=server_error" };
  }
}

export async function handleOAuthCallback(
  code: string,
  state: string,
  req: any,
  res: any
): Promise<{ success: boolean; redirectUrl: string }> {
  const requestContext = getRequestAuditContext(req);
  const tenantOrOrg = getTenantOrOrg();

  try {
    if (!code || !state) {
      await logAuditEvent({
        timestamp: new Date().toISOString(),
        actor: "anonymous",
        tenantOrOrg,
        action: "oauth.callback",
        result: "failure",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        details: { reason: "missing_code_or_state" },
      });
      return { success: false, redirectUrl: "/?error=oauth_failed" };
    }

    const cookies = parseCookies(req.headers?.cookie);
    const signedState = cookies[OAUTH_STATE_COOKIE];
    if (!signedState) {
      await logAuditEvent({
        timestamp: new Date().toISOString(),
        actor: "anonymous",
        tenantOrOrg,
        action: "oauth.callback",
        result: "failure",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        details: { reason: "missing_state_cookie" },
      });
      return { success: false, redirectUrl: "/?error=oauth_state" };
    }

    const statePayload = verifyOAuthState(signedState);
    if (!statePayload || statePayload.state !== state) {
      await logAuditEvent({
        timestamp: new Date().toISOString(),
        actor: "anonymous",
        tenantOrOrg,
        action: "oauth.callback",
        result: "failure",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        details: { reason: "state_mismatch" },
      });
      return { success: false, redirectUrl: "/?error=oauth_state" };
    }

    if (Date.now() - statePayload.createdAt > OAUTH_STATE_MAX_AGE_SECONDS * 1000) {
      await logAuditEvent({
        timestamp: new Date().toISOString(),
        actor: "anonymous",
        tenantOrOrg,
        action: "oauth.callback",
        result: "failure",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        details: { reason: "state_expired" },
      });
      return { success: false, redirectUrl: "/?error=oauth_state" };
    }

    const userInfo = await exchangeCodeForUserInfo(code, statePayload.codeVerifier, statePayload.redirectUri);

    if (!userInfo?.openId) {
      await logAuditEvent({
        timestamp: new Date().toISOString(),
        actor: "anonymous",
        tenantOrOrg,
        action: "oauth.callback",
        result: "failure",
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        details: { reason: "user_info_exchange_failed" },
      });
      return {
        success: false,
        redirectUrl: "/?error=oauth_failed",
      };
    }

    await upsertUser({
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod,
      lastSignedIn: new Date(),
    });

    const sessionToken = createSessionToken(userInfo.openId);

    const cookieOptions = getSessionCookieOptions(req);
    const sessionCookie = `${COOKIE_NAME}=${sessionToken}; Path=${cookieOptions.path || "/"}; Max-Age=${cookieOptions.maxAge}; HttpOnly; ${cookieOptions.secure ? "Secure;" : ""} ${cookieOptions.sameSite ? `SameSite=${cookieOptions.sameSite};` : ""}`;
    const clearOAuthCookie = buildCookie("", req, 0);

    res.setHeader("Set-Cookie", [sessionCookie, clearOAuthCookie]);

    await logAuditEvent({
      timestamp: new Date().toISOString(),
      actor: userInfo.openId,
      tenantOrOrg,
      action: "oauth.callback",
      result: "success",
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      details: { returnTo: statePayload.returnTo || "/dashboard" },
    });

    return {
      success: true,
      redirectUrl: statePayload.returnTo || "/dashboard",
    };
  } catch (error) {
    console.error("[OAuth] Callback handling failed:", error);
    await logAuditEvent({
      timestamp: new Date().toISOString(),
      actor: "anonymous",
      tenantOrOrg,
      action: "oauth.callback",
      result: "failure",
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      details: {
        reason: "exception",
        message: error instanceof Error ? error.message : "unknown_error",
      },
    });
    return {
      success: false,
      redirectUrl: "/?error=server_error",
    };
  }
}
