import { readFileSync } from 'node:fs';

import { Redis } from 'ioredis';

import { createLogger } from './logger.js';

const logger = createLogger({ component: 'redis-client' });

let client: Redis | null = null;

const REDIS_URL_FALLBACK = 'redis://localhost:6379';

function isNonDevEnvironment(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'staging' || nodeEnv === 'production';
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return undefined;
}

function loadRedisTlsCa(): string | undefined {
  const caCertPath = process.env.REDIS_TLS_CA_CERT_PATH?.trim();
  if (caCertPath) {
    return readFileSync(caCertPath, 'utf8');
  }

  return process.env.REDIS_TLS_CA_CERT?.trim() || undefined;
}

function buildRedisConnectionConfig(): { url: string; tls?: { servername: string; ca: string; rejectUnauthorized: boolean } } {
  const nodeEnv = process.env.NODE_ENV;
  const requireSecureTransport = isNonDevEnvironment(nodeEnv);
  const redisUrl = process.env.REDIS_URL ?? REDIS_URL_FALLBACK;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error(`Invalid REDIS_URL: ${redisUrl}`);
  }

  if (requireSecureTransport && parsedUrl.protocol !== 'rediss:') {
    throw new Error(
      `In ${nodeEnv}, REDIS_URL must use rediss:// transport. Received: ${redisUrl}`,
    );
  }

  const tlsServername = process.env.REDIS_TLS_SERVERNAME?.trim();
  const tlsCa = loadRedisTlsCa();
  const tlsRejectUnauthorized = parseBooleanEnv(process.env.REDIS_TLS_REJECT_UNAUTHORIZED);

  if (!requireSecureTransport) {
    if (parsedUrl.protocol !== 'rediss:') {
      return { url: redisUrl };
    }

    return {
      url: redisUrl,
      tls:
        tlsServername && tlsCa && tlsRejectUnauthorized !== undefined
          ? {
              servername: tlsServername,
              ca: tlsCa,
              rejectUnauthorized: tlsRejectUnauthorized,
            }
          : undefined,
    };
  }

  if (!tlsServername) {
    throw new Error(`In ${nodeEnv}, REDIS_TLS_SERVERNAME is required for secure Redis connections.`);
  }

  if (!tlsCa) {
    throw new Error(
      `In ${nodeEnv}, set REDIS_TLS_CA_CERT_PATH or REDIS_TLS_CA_CERT for secure Redis connections.`,
    );
  }

  if (tlsRejectUnauthorized !== true) {
    throw new Error(
      `In ${nodeEnv}, REDIS_TLS_REJECT_UNAUTHORIZED must be explicitly set to true for secure Redis connections.`,
    );
  }

  return {
    url: redisUrl,
    tls: {
      servername: tlsServername,
      ca: tlsCa,
      rejectUnauthorized: true,
    },
  };
}

export function getRedisClient(): Redis {
  if (!client) {
    const { url, tls } = buildRedisConnectionConfig();
    client = tls ? new Redis(url, { tls }) : new Redis(url);

    client.on('error', (err: Error) => {
      logger.error('Redis client error', err);
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  return client;
}
