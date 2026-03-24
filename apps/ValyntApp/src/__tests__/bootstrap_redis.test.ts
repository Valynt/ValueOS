/**
 * Bootstrap Redis Initialization Tests
 *
 * The cache block in bootstrap.ts is gated by:
 *   config.cache.enabled && typeof window === "undefined" && !isDevelopment()
 *
 * In jsdom (browser-like test env), `typeof window !== "undefined"`, so the
 * cache block is skipped. These tests verify the surrounding bootstrap
 * behavior and the cache-disabled / development-mode paths that ARE reachable.
 *
 * Integration tests for the server-side cache path belong in a Node test env.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mutable flags — tests flip these before calling bootstrap
// ---------------------------------------------------------------------------
let _isDev = false;

const baseConfig = {
  app: { env: "test", url: "http://localhost", apiBaseUrl: "/api" },
  agents: { apiUrl: "http://localhost/api" },
  monitoring: {},
  features: {
    agentFabric: false,
    sduiDebug: false,
    workflow: false,
    compliance: false,
    multiTenant: false,
    usageTracking: false,
    billing: false,
  },
  database: { url: "" },
  security: { csrfEnabled: true, cspEnabled: false, httpsOnly: false },
  cache: { enabled: true, url: "redis://localhost:6379", ttl: 3600 },
};

let _config: typeof baseConfig = { ...baseConfig };

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockInitializeRedisCache = vi.fn();

vi.mock("../config/environment", () => ({
  getConfig: vi.fn(() => _config),
  isDevelopment: vi.fn(() => _isDev),
  isProduction: vi.fn(() => !_isDev),
  validateEnvironmentConfig: vi.fn(() => []),
}));

vi.mock("../lib/redis", () => ({
  initializeRedisCache: mockInitializeRedisCache,
}));

vi.mock("../lib/agentHealth", () => ({
  initializeAgents: vi.fn(),
}));

vi.mock("../security", () => ({
  initializeSecurity: vi.fn(),
  validateSecurity: vi.fn().mockReturnValue({ errors: [], warnings: [] }),
}));

vi.mock("../lib/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
  logger: mockLogger,
  setupMonitoring: vi.fn(),
}));

vi.mock("../lib/database", () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue({ connected: false, latency: 0 }),
}));

beforeEach(() => {
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockLogger.debug.mockClear();
  mockInitializeRedisCache.mockReset();
  _isDev = false;
  _config = { ...baseConfig };
});

async function runBootstrap() {
  const { bootstrap } = await import("../bootstrap");
  return bootstrap({ skipAgentCheck: true });
}

describe("Bootstrap Redis Initialization", () => {
  it("bootstrap succeeds with cache enabled (browser env skips cache block)", async () => {
    // In jsdom, typeof window !== "undefined", so the cache block is skipped.
    // Bootstrap should still succeed without errors.
    _isDev = false;
    mockInitializeRedisCache.mockResolvedValue({ connected: true, latency: 10 });

    const result = await runBootstrap();

    // Cache block is skipped in browser env — no call expected
    expect(mockInitializeRedisCache).not.toHaveBeenCalled();
    // Bootstrap itself should complete without errors
    expect(result.errors).toHaveLength(0);
  });

  it("bootstrap succeeds with cache disabled", async () => {
    _isDev = false;
    _config = { ...baseConfig, cache: { enabled: false, ttl: 3600 } };

    const result = await runBootstrap();

    expect(mockInitializeRedisCache).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(0);
  });

  it("bootstrap succeeds in development mode", async () => {
    _isDev = true;
    mockInitializeRedisCache.mockResolvedValue({ connected: true, latency: 10 });

    const result = await runBootstrap();

    // Cache block skipped in dev mode
    expect(mockInitializeRedisCache).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(0);
  });

  it("bootstrap returns success:true when no errors occur", async () => {
    _isDev = false;
    const result = await runBootstrap();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("config");
    expect(result).toHaveProperty("warnings");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("duration");
  });

  it("bootstrap returns success:false when config validation fails", async () => {
    const { validateEnvironmentConfig } = vi.mocked(
      await import("../config/environment")
    );
    validateEnvironmentConfig.mockReturnValueOnce(["Missing required env var"]);
    // failFast defaults to isProduction() = true when _isDev = false
    _isDev = false;

    const result = await runBootstrap();

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing required env var");
  });
});
