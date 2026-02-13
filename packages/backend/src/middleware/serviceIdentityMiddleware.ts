import { createHash, createHmac, randomUUID as nodeRandomUUID, timingSafeEqual } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { getAutonomyConfig } from "../config/autonomy.js"
import { logger } from '../lib/logger.js';
import { NonceStoreUnavailableError, nonceStore } from './nonceStore.js'

const browserRandomUUID = (): string | null => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return null;
};

const randomUUID = (): string => browserRandomUUID() ?? nodeRandomUUID();

const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000; // 2 minutes

type HmacServiceKey = {
  serviceId: string;
  keyId: string;
  secret: string;
  audience?: string;
  status?: 'active' | 'revoked';
  notBefore?: number;
  expiresAt?: number;
};

type JwtIssuerConfig = {
  issuer: string;
  audience?: string;
  publicKey?: string;
  sharedSecret?: string;
  algorithms?: jwt.Algorithm[];
};

type ServiceIdentityConfig = {
  expectedAudience?: string;
  allowedSpiffeIds?: string[];
  jwtIssuers?: JwtIssuerConfig[];
  hmacKeys?: HmacServiceKey[];
  revokedServices?: string[];
};

type ResolvedIdentity = {
  principal: string;
  issuer: string;
  audience?: string;
  method: 'mtls' | 'jwt' | 'hmac';
  keyId?: string;
};

function parseCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseServiceIdentityConfig(): ServiceIdentityConfig {
  const raw = process.env.SERVICE_IDENTITY_CONFIG_JSON;
  if (!raw) {
    return {
      expectedAudience: process.env.SERVICE_IDENTITY_AUDIENCE || undefined,
      allowedSpiffeIds: parseCsv(process.env.SERVICE_IDENTITY_ALLOWED_SPIFFE_IDS),
      revokedServices: parseCsv(process.env.SERVICE_IDENTITY_REVOKED_SERVICES),
    };
  }

  try {
    return JSON.parse(raw) as ServiceIdentityConfig;
  } catch (error) {
    logger.error('Invalid SERVICE_IDENTITY_CONFIG_JSON', error);
    return {};
  }
}

function normalizeBody(body: unknown): string {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function bodyHashFromRequest(req: Request): string {
  return createHash('sha256').update(normalizeBody((req as any).body)).digest('hex');
}

function buildSigningPayload(req: Request, timestamp: number, nonce: string, bodyHash: string): string {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.url;
  return [method, path, bodyHash, String(timestamp), nonce].join('\n');
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBearer(req: Request): string | null {
  const auth = req.header('authorization') || req.header('x-service-jwt') || '';
  if (!auth) return null;
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return auth;
}

function getRevokedServices(config: ServiceIdentityConfig): Set<string> {
  return new Set((config.revokedServices || []).map((id) => id.toLowerCase()));
}

function verifyMtlsIdentity(req: Request, config: ServiceIdentityConfig): ResolvedIdentity | null {
  const presented = req.header('x-spiffe-id') || req.header('x-service-principal') || '';
  if (!presented) return null;

  const allowed = config.allowedSpiffeIds || [];
  if (allowed.length > 0 && !allowed.includes(presented)) {
    return null;
  }

  const audience = req.header('x-service-audience') || undefined;
  if (config.expectedAudience && audience && audience !== config.expectedAudience) {
    return null;
  }

  return {
    principal: presented,
    issuer: 'spiffe',
    audience,
    method: 'mtls',
  };
}

function verifyJwtIdentity(req: Request, config: ServiceIdentityConfig): ResolvedIdentity | null {
  const token = parseBearer(req);
  if (!token) return null;

  const issuers = config.jwtIssuers || [];
  for (const issuerConfig of issuers) {
    if (!issuerConfig.publicKey && !issuerConfig.sharedSecret) {
      continue;
    }

    try {
      const payload = jwt.verify(token, issuerConfig.publicKey || issuerConfig.sharedSecret!, {
        algorithms: issuerConfig.algorithms,
        issuer: issuerConfig.issuer,
        audience: issuerConfig.audience || config.expectedAudience,
      }) as JwtPayload;

      if (!payload.sub) {
        continue;
      }

      return {
        principal: payload.sub,
        issuer: String(payload.iss || issuerConfig.issuer),
        audience: typeof payload.aud === 'string' ? payload.aud : undefined,
        method: 'jwt',
        keyId: typeof payload.kid === 'string' ? payload.kid : undefined,
      };
    } catch {
      // Continue trying additional issuers / keys for key rotation.
    }
  }

  return null;
}

function verifyHmacIdentity(req: Request, config: ServiceIdentityConfig): ResolvedIdentity | null {
  const serviceId = req.header('x-service-id') || req.header('x-service-principal') || '';
  const keyId = req.header('x-key-id') || '';
  const signature = req.header('x-request-signature') || '';
  const bodyHashHeader = req.header('x-body-sha256') || '';
  const timestamp = Number(req.header('x-request-timestamp') || 0);
  const nonce = req.header('x-request-nonce') || '';
  const audience = req.header('x-service-audience') || undefined;

  if (!serviceId || !keyId || !signature || !timestamp || !nonce) {
    return null;
  }

  if (!bodyHashHeader || bodyHashHeader !== bodyHashFromRequest(req)) {
    return null;
  }

  const keys = config.hmacKeys || [];
  const candidate = keys.find((key) => key.serviceId === serviceId && key.keyId === keyId);
  if (!candidate || candidate.status === 'revoked') {
    return null;
  }

  const now = Date.now();
  if (candidate.notBefore && now < candidate.notBefore) {
    return null;
  }
  if (candidate.expiresAt && now > candidate.expiresAt) {
    return null;
  }

  if (candidate.audience && audience !== candidate.audience) {
    return null;
  }
  if (config.expectedAudience && audience && audience !== config.expectedAudience) {
    return null;
  }

  const signingPayload = buildSigningPayload(req, timestamp, nonce, bodyHashHeader);
  const expected = createHmac('sha256', candidate.secret).update(signingPayload).digest('hex');
  if (!secureEquals(expected, signature)) {
    return null;
  }

  return {
    principal: serviceId,
    issuer: `hmac:${keyId}`,
    audience,
    method: 'hmac',
    keyId,
  };
}

/**
 * Validates signed service identity assertions (mTLS SPIFFE, JWT SA tokens, or signed HMAC requests).
 * Enforces issuer/subject/audience checks and replay protection using nonce + timestamp.
 */
export function serviceIdentityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { serviceIdentityToken } = getAutonomyConfig();
  const config = parseServiceIdentityConfig();
  const configuredAssertions = Boolean(
    (config.allowedSpiffeIds && config.allowedSpiffeIds.length > 0) ||
    (config.jwtIssuers && config.jwtIssuers.length > 0) ||
    (config.hmacKeys && config.hmacKeys.length > 0)
  );

  if (!configuredAssertions && !serviceIdentityToken) {
    return next();
  }

  const timestamp = Number(req.header('x-request-timestamp') || 0);
  const nonce = req.header('x-request-nonce') || '';

  if (!timestamp || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) {
    logger.warn('Service identity rejected: invalid timestamp', { path: req.originalUrl || req.url });
    return res.status(401).json({ error: 'Request timestamp invalid or expired' });
  }

  if (!nonce) {
    logger.warn('Service identity rejected: missing nonce', { path: req.originalUrl || req.url });
    return res.status(401).json({ error: 'Request nonce required' });
  }

  const identity =
    verifyMtlsIdentity(req, config) ||
    verifyJwtIdentity(req, config) ||
    verifyHmacIdentity(req, config) ||
    null;

  // Legacy fallback for environments still migrating off static token.
  const legacyToken = req.header('x-service-identity') || '';
  const legacyIdentity = serviceIdentityToken && secureEquals(legacyToken, serviceIdentityToken)
    ? { principal: 'legacy-service-token', issuer: 'legacy-shared-token', method: 'hmac' as const }
    : null;

  const resolvedIdentity = identity || legacyIdentity;
  if (!resolvedIdentity) {
    logger.warn('Service identity rejected: no valid assertion', { path: req.originalUrl || req.url });
    return res.status(401).json({ error: 'Service identity verification failed' });
  }

  const revokedServices = getRevokedServices(config);
  if (revokedServices.has(resolvedIdentity.principal.toLowerCase())) {
    logger.warn('Service identity rejected: principal revoked', {
      servicePrincipal: resolvedIdentity.principal,
      issuer: resolvedIdentity.issuer,
    });
    return res.status(403).json({ error: 'Service principal revoked' });
  }

  const requireRedis = process.env.NODE_ENV === 'production';
  nonceStore.consumeOnce(`${resolvedIdentity.issuer}:${resolvedIdentity.principal}`, nonce, { requireRedis }).then((unique) => {
    if (!unique) {
      logger.warn('Service identity rejected: replay detected', {
        servicePrincipal: resolvedIdentity.principal,
        issuer: resolvedIdentity.issuer,
      });
      return res.status(401).json({ error: 'Replay detected' });
    }

    (req as any).serviceIdentityVerified = true;
    (req as any).requestNonce = nonce;
    (req as any).servicePrincipal = resolvedIdentity.principal;
    (req as any).serviceIssuer = resolvedIdentity.issuer;
    (req as any).serviceAuthMethod = resolvedIdentity.method;
    logger.info('Service identity verified', {
      servicePrincipal: resolvedIdentity.principal,
      issuer: resolvedIdentity.issuer,
      method: resolvedIdentity.method,
      keyId: resolvedIdentity.keyId,
      audience: resolvedIdentity.audience,
      path: req.originalUrl || req.url,
    });
    next();
  }).catch((error) => {
    if (error instanceof NonceStoreUnavailableError) {
      logger.error('Service identity replay protection unavailable', error, {
        servicePrincipal: resolvedIdentity.principal,
      });
      return res.status(503).json({ error: 'Replay protection unavailable' });
    }
    logger.error('Service identity nonce validation failed', error, {
      servicePrincipal: resolvedIdentity.principal,
    });
    return res.status(500).json({ error: 'Nonce validation failed' });
  });
}

/**
 * Helper to add outbound service identity assertions for internal service-to-service calls.
 */
export function addServiceIdentityHeader(
  headers: Record<string, string>,
  options: { method?: string; path?: string; body?: unknown } = {}
): Record<string, string> {
  const config = parseServiceIdentityConfig();
  const callerServiceId = process.env.SERVICE_IDENTITY_CALLER_ID;
  const selectedKeyId = process.env.SERVICE_IDENTITY_OUTBOUND_KEY_ID;

  const candidateKey = (config.hmacKeys || []).find((key) => {
    if (key.status === 'revoked') return false;
    if (callerServiceId && key.serviceId !== callerServiceId) return false;
    if (selectedKeyId && key.keyId !== selectedKeyId) return false;
    return true;
  });

  if (candidateKey) {
    const timestamp = Date.now();
    const nonce = randomUUID();
    const method = (options.method || 'POST').toUpperCase();
    const path = options.path || '/';
    const bodyHash = createHash('sha256').update(normalizeBody(options.body)).digest('hex');
    const signingPayload = [method, path, bodyHash, String(timestamp), nonce].join('\n');
    const signature = createHmac('sha256', candidateKey.secret).update(signingPayload).digest('hex');

    headers['X-Service-Id'] = candidateKey.serviceId;
    headers['X-Key-Id'] = candidateKey.keyId;
    headers['X-Service-Audience'] = candidateKey.audience || config.expectedAudience || 'internal';
    headers['X-Request-Timestamp'] = String(timestamp);
    headers['X-Request-Nonce'] = nonce;
    headers['X-Body-SHA256'] = bodyHash;
    headers['X-Request-Signature'] = signature;
    return headers;
  }

  const { serviceIdentityToken } = getAutonomyConfig();
  if (serviceIdentityToken) {
    headers['X-Service-Identity'] = serviceIdentityToken;
    headers['X-Request-Timestamp'] = Date.now().toString();
    headers['X-Request-Nonce'] = randomUUID();
  }
  return headers;
}
