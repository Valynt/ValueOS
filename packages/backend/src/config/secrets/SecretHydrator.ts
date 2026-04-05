import { getEnvVar } from '../../lib/env';
import { logger } from '../../lib/logger.js'

import type { SecretValue } from './ISecretProvider.js'
import { defaultProvider } from './ProviderFactory.js'
import { runtimeSecretStore } from './RuntimeSecretStore.js'

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

interface HydrationFailure {
  envVar: string;
  secretKey: string;
  reason: 'provider_error' | 'empty_secret';
}

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

function resolveRuntimeEnvironment(): string {
  const candidates = [getEnvVar('NODE_ENV'), getEnvVar('APP_ENV')]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (candidate === 'prod') {
      return 'production'
    }
    if (candidate === 'stage') {
      return 'staging'
    }
    return candidate
  }

  return 'development'
}

function isStrictHydrationEnvironment(environment: string): boolean {
  return environment === 'staging' || environment === 'production'
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
  const environment = resolveRuntimeEnvironment();
  const strictHydration = isStrictHydrationEnvironment(environment)
  const hydrated: Record<string, string> = {};
  const failedHydrations: HydrationFailure[] = [];

  for (const [envVar, secretKey] of Object.entries(SECRET_KEY_MAPPING)) {
    if (getEnvVar(envVar)) {
      continue;
    }

    try {
      const secretValue = await defaultProvider.getSecret(tenantId, secretKey, undefined, 'system-ci');
      const normalized = normalizeSecret(secretValue, envVar);

      if (!normalized) {
        logger.warn('Secret found but empty; skipping hydration', { envVar, secretKey, tenantId });
        failedHydrations.push({ envVar, secretKey, reason: 'empty_secret' });
        continue;
      }

      runtimeSecretStore.setSecret(envVar, normalized);
      hydrated[envVar] = normalized;
      logger.info('Hydrated secret from manager', {
        envVar,
        tenantId,
        provider: getEnvVar('SECRETS_PROVIDER') || 'aws',
      });
    } catch (error) {
      failedHydrations.push({ envVar, secretKey, reason: 'provider_error' });
      logger.error('Failed to hydrate secret from manager', { envVar, tenantId, error });
    }
  }

  if (failedHydrations.length > 0) {
    logger.error('Secret hydration failures detected', {
      tenantId,
      environment,
      strictHydration,
      failedCount: failedHydrations.length,
      failedEnvVars: failedHydrations.map((failure) => failure.envVar),
      failureReasons: failedHydrations.map((failure) => ({
        envVar: failure.envVar,
        reason: failure.reason,
      })),
      provider: getEnvVar('SECRETS_PROVIDER') || 'aws',
    });
  }

  if (strictHydration && failedHydrations.length > 0) {
    throw new Error(
      `Secret hydration failed for required keys in ${environment}: ${failedHydrations
        .map((failure) => failure.envVar)
        .join(', ')}`
    )
  }

  return hydrated;
}
