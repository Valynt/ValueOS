
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mocks outside to be used in vi.mock and tests
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockRedis = {
  initializeRedisCache: vi.fn(),
};

const mockConfig = {
  app: { env: 'development', url: 'http://localhost', apiBaseUrl: '/api' },
  agents: { apiUrl: 'http://localhost/api' },
  monitoring: { sentry: { enabled: false } },
  features: { agentFabric: false },
  database: { url: '' },
  security: { csrfEnabled: true },
  cache: { enabled: true, url: 'redis://localhost:6379', ttl: 3600 },
};

// Mock dependencies
vi.mock('../config/environment', () => ({
  getConfig: vi.fn(() => mockConfig),
  isDevelopment: vi.fn(() => true),
  isProduction: vi.fn(() => false),
  validateEnvironmentConfig: vi.fn(() => []),
}));

vi.mock('../lib/redis', () => ({
  initializeRedisCache: vi.fn((...args) => mockRedis.initializeRedisCache(...args)),
}));

vi.mock('../services/AgentInitializer', () => ({
  initializeAgents: vi.fn(),
}));

vi.mock('../security', () => ({
  initializeSecurity: vi.fn(),
  validateSecurity: vi.fn().mockReturnValue({ errors: [], warnings: [] }),
}));

vi.mock('../lib/logger', () => ({
  createLogger: vi.fn(() => mockLogger),
  logger: mockLogger,
  setupMonitoring: vi.fn(),
}));

describe('Bootstrap Redis Initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should call initializeRedisCache when cache is enabled', async () => {
    mockRedis.initializeRedisCache.mockResolvedValue({ connected: true, latency: 10 });

    // Import bootstrap dynamically to ensure mocks are used
    const { bootstrap } = await import('../bootstrap');
    await bootstrap({ skipAgentCheck: true });

    expect(mockRedis.initializeRedisCache).toHaveBeenCalledWith(mockConfig.cache);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Cache initialized'));
  });

  it('should not call initializeRedisCache when cache is disabled', async () => {
    // Override config for this test
    const configDisabled = { ...mockConfig, cache: { enabled: false } };
    vi.mocked(await import('../config/environment')).getConfig.mockReturnValue(configDisabled);

    const { bootstrap } = await import('../bootstrap');
    await bootstrap({ skipAgentCheck: true });

    expect(mockRedis.initializeRedisCache).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Cache disabled'));
  });

  it('should handle cache initialization failure', async () => {
    mockRedis.initializeRedisCache.mockResolvedValue({
      connected: false,
      latency: 0,
      error: 'Connection refused'
    });

    // Reset getConfig mock just in case previous test affected it
    vi.mocked(await import('../config/environment')).getConfig.mockReturnValue(mockConfig);

    const { bootstrap } = await import('../bootstrap');
    const result = await bootstrap({ skipAgentCheck: true });

    expect(mockRedis.initializeRedisCache).toHaveBeenCalled();
    // In dev, it's a warning
    expect(result.warnings).toContain('Cache initialization failed: Connection refused');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Cache initialization failed'));
  });

  it('should catch exceptions during initialization', async () => {
    mockRedis.initializeRedisCache.mockRejectedValue(new Error('Unexpected error'));

    vi.mocked(await import('../config/environment')).getConfig.mockReturnValue(mockConfig);

    const { bootstrap } = await import('../bootstrap');
    const result = await bootstrap({ skipAgentCheck: true });

    expect(result.warnings).toContain('Cache initialization failed: Unexpected error');
  });
});
