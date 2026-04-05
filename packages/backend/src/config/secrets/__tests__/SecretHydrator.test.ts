import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSecretMock = vi.fn()
const setSecretMock = vi.fn()
const loggerInfoMock = vi.fn()
const loggerWarnMock = vi.fn()
const loggerErrorMock = vi.fn()

vi.mock('../../../lib/env', () => ({
  getEnvVar: (key: string) => process.env[key],
}))

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
  createLogger: vi.fn(() => ({
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
    debug: vi.fn(),
  })),
}))

vi.mock('../ProviderFactory.js', () => ({
  defaultProvider: {
    getSecret: getSecretMock,
  },
}))

vi.mock('../RuntimeSecretStore.js', () => ({
  runtimeSecretStore: {
    setSecret: setSecretMock,
  },
}))

async function loadHydrator() {
  const mod = await import('../SecretHydrator.js')
  return mod.hydrateServerSecretsFromManager
}

describe('hydrateServerSecretsFromManager', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    vi.stubEnv('SECRETS_MANAGER_ENABLED', 'true')
    vi.stubEnv('SECRETS_TENANT_ID', 'platform')
    vi.stubEnv('SECRETS_PROVIDER', 'aws')

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.REDIS_URL
    delete process.env.DATABASE_URL
  })

  it('fails startup in strict environments when required secret hydration fails', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    getSecretMock.mockImplementation(async (_tenantId: string, secretKey: string) => {
      if (secretKey === 'supabase-service-key') {
        throw new Error('provider unavailable')
      }
      return { value: `resolved-${secretKey}` }
    })

    const hydrateServerSecretsFromManager = await loadHydrator()

    await expect(hydrateServerSecretsFromManager()).rejects.toThrow(
      'Secret hydration failed for required keys in production: SUPABASE_SERVICE_ROLE_KEY'
    )

    expect(setSecretMock).toHaveBeenCalledWith('REDIS_URL', 'resolved-redis-url')
    expect(setSecretMock).toHaveBeenCalledWith('DATABASE_URL', 'resolved-database-url')
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Secret hydration failures detected',
      expect.objectContaining({
        environment: 'production',
        strictHydration: true,
        failedEnvVars: ['SUPABASE_SERVICE_ROLE_KEY'],
        failureReasons: [{ envVar: 'SUPABASE_SERVICE_ROLE_KEY', reason: 'provider_error' }],
      })
    )
  })

  it('keeps non-fatal behavior for local/test environments and reports failures', async () => {
    vi.stubEnv('NODE_ENV', 'test')

    getSecretMock.mockImplementation(async (_tenantId: string, secretKey: string) => {
      if (secretKey === 'supabase-service-key') {
        throw new Error('provider unavailable')
      }
      return { value: `resolved-${secretKey}` }
    })

    const hydrateServerSecretsFromManager = await loadHydrator()

    await expect(hydrateServerSecretsFromManager()).resolves.toEqual({
      REDIS_URL: 'resolved-redis-url',
      DATABASE_URL: 'resolved-database-url',
    })

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Secret hydration failures detected',
      expect.objectContaining({
        environment: 'test',
        strictHydration: false,
        failedEnvVars: ['SUPABASE_SERVICE_ROLE_KEY'],
      })
    )
  })

  it('treats empty secret payloads as hydration failures in strict environments', async () => {
    vi.stubEnv('NODE_ENV', 'staging')

    getSecretMock.mockImplementation(async (_tenantId: string, secretKey: string) => {
      if (secretKey === 'redis-url') {
        return { value: '   ' }
      }
      return { value: `resolved-${secretKey}` }
    })

    const hydrateServerSecretsFromManager = await loadHydrator()

    await expect(hydrateServerSecretsFromManager()).rejects.toThrow(
      'Secret hydration failed for required keys in staging: REDIS_URL'
    )

    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Secret found but empty; skipping hydration',
      expect.objectContaining({
        envVar: 'REDIS_URL',
        secretKey: 'redis-url',
      })
    )
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Secret hydration failures detected',
      expect.objectContaining({
        failureReasons: [{ envVar: 'REDIS_URL', reason: 'empty_secret' }],
      })
    )
  })
})
