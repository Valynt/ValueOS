import type { SecretValue } from './ISecretProvider';
import { defaultProvider } from './ProviderFactory';
import { logger } from '../../lib/logger';

const isServer = typeof window === 'undefined';

const SECRET_KEY_MAPPING: Record<string, string> = {
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY_SECRET_NAME || 'supabase-service-key',
  REDIS_URL: process.env.REDIS_URL_SECRET_NAME || 'redis-url'
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

  if (process.env.SECRETS_MANAGER_ENABLED !== 'true') {
    logger.info('Secrets manager hydration skipped (SECRETS_MANAGER_ENABLED not true)');
    return {};
  }

  const tenantId = process.env.SECRETS_TENANT_ID || 'platform';
  const hydrated: Record<string, string> = {};

  for (const [envVar, secretKey] of Object.entries(SECRET_KEY_MAPPING)) {
    if (process.env[envVar]) {
      continue;
    }

    try {
      const secretValue = await defaultProvider.getSecret(tenantId, secretKey, undefined, 'system-ci');
      const normalized = normalizeSecret(secretValue, envVar);

      if (!normalized) {
        logger.warn('Secret found but empty; skipping hydration', { envVar, secretKey, tenantId });
        continue;
      }

      process.env[envVar] = normalized;
      hydrated[envVar] = normalized;
      logger.info('Hydrated secret from manager', { envVar, tenantId, provider: process.env.SECRETS_PROVIDER || 'aws' });
    } catch (error) {
      logger.error('Failed to hydrate secret from manager', { envVar, tenantId, error });
    }
  }

  return hydrated;
}
