import type { SecretValue } from './ISecretProvider.js'
import { defaultProvider } from './ProviderFactory.js'
import { logger } from '../../lib/logger.js'
import { getEnvVar, setEnvVar } from '../../lib/env';

const isServer = typeof window === 'undefined';

const SECRET_KEY_MAPPING: Record<string, string> = {
  SUPABASE_SERVICE_ROLE_KEY:
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY_SECRET_NAME') || 'supabase-service-key',
  REDIS_URL: getEnvVar('REDIS_URL_SECRET_NAME') || 'redis-url',
  DATABASE_URL: getEnvVar('DATABASE_URL_SECRET_NAME') || 'database-url',
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
