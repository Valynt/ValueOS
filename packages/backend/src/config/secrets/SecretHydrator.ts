import { getEnvVar, setEnvVar } from '../../lib/env';
import { logger } from '../../lib/logger.js'

import type { SecretValue } from './ISecretProvider.js'
import { defaultProvider } from './ProviderFactory.js'

const isServer = typeof window === 'undefined';

const SECRET_KEY_MAPPING: Record<string, string> = {
  DATABASE_URL:
    getEnvVar('DATABASE_URL_SECRET_NAME') || 'database-url',
  SUPABASE_SERVICE_ROLE_KEY:
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME') || 'supabase-service-key',
  REDIS_URL: getEnvVar('REDIS_URL_SECRET_NAME') || 'redis-url',
  JWT_SECRET: getEnvVar('JWT_SECRET_SECRET_NAME') || 'jwt-secret',
  ENCRYPTION_KEY:
    getEnvVar('ENCRYPTION_KEY_SECRET_NAME') || 'encryption-key',
  TOGETHER_API_KEY:
    getEnvVar('TOGETHER_API_KEY_SECRET_NAME') || 'together-api-key',
  OPENAI_API_KEY:
    getEnvVar('OPENAI_API_KEY_SECRET_NAME') || 'openai-api-key',
  APPROVAL_ACTION_SECRET:
    getEnvVar('APPROVAL_ACTION_SECRET_SECRET_NAME') || 'approval-action-secret',
  APPROVAL_WEBHOOK_SECRET:
    getEnvVar('APPROVAL_WEBHOOK_SECRET_SECRET_NAME') || 'approval-webhook-secret',
  STRIPE_SECRET_KEY:
    getEnvVar('STRIPE_SECRET_KEY_SECRET_NAME') || 'stripe-secret-key',
  STRIPE_WEBHOOK_SECRET:
    getEnvVar('STRIPE_WEBHOOK_SECRET_SECRET_NAME') || 'stripe-webhook-secret',
  WEB_SCRAPER_ENCRYPTION_KEY:
    getEnvVar('WEB_SCRAPER_ENCRYPTION_KEY_SECRET_NAME') || 'web-scraper-encryption-key',
  TCT_SECRET:
    getEnvVar('TCT_SECRET_SECRET_NAME') || 'tct-secret',
  SUPABASE_KEY:
    getEnvVar('SUPABASE_KEY_SECRET_NAME') || 'supabase-key',
  SENTRY_DSN: getEnvVar('SENTRY_DSN_SECRET_NAME') || 'sentry-dsn',
};

const assertNoDeprecatedSecretAliases = (): void => {
  if (getEnvVar('SUPABASE_SERVICE_KEY_SECRET_NAME')) {
    throw new Error(
      'SUPABASE_SERVICE_KEY_SECRET_NAME is deprecated. Use SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME instead.'
    );
  }
};

function normalizeSecret(secret: SecretValue, envKey: string): string | undefined {
  const preferredOrder = ['value', 'secret', envKey.toLowerCase()];
  for (const candidate of preferredOrder) {
    const value = secret[candidate];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

export async function hydrateServerSecretsFromManager(): Promise<Record<string, string>> {
  if (!isServer) {
    return {};
  }

  assertNoDeprecatedSecretAliases();

  if (getEnvVar('SECRETS_MANAGER_ENABLED') !== 'true') {
    logger.info('Secrets manager hydration skipped (SECRETS_MANAGER_ENABLED not true)');
    return {};
  }

  const tenantId = getEnvVar('SECRETS_TENANT_ID') || 'platform';
  const hydrated: Record<string, string> = {};

  for (const [envVar, secretKey] of Object.entries(SECRET_KEY_MAPPING)) {
    if (getEnvVar(envVar)) {
      continue;
    }

    try {
      const secretValue = await defaultProvider.getSecret(tenantId, secretKey, undefined, 'system-ci');
      const normalized = normalizeSecret(secretValue, envVar);

      if (!normalized) {
        logger.warn('Secret found but empty; skipping hydration', { envVar, secretKey, tenantId });
        continue;
      }

      setEnvVar(envVar, normalized);
      hydrated[envVar] = normalized;
      logger.info('Hydrated secret from manager', {
        envVar,
        tenantId,
        provider: getEnvVar('SECRETS_PROVIDER') || 'aws',
      });
    } catch (error) {
      logger.error('Failed to hydrate secret from manager', { envVar, tenantId, error });
    }
  }

  return hydrated;
}
