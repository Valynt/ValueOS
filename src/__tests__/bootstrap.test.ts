import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "../app/bootstrap/init";
import * as environment from "../config/environment";
import * as security from "../security";
import * as agentInitializer from "../services/AgentInitializer";

// Mock dependencies
vi.mock("../config/environment", () => ({
  getConfig: vi.fn(),
  validateEnvironmentConfig: vi.fn(() => []),
  isDevelopment: vi.fn(() => true),
  isProduction: vi.fn(() => false),
}));

vi.mock("../security", () => ({
  initializeSecurity: vi.fn(),
  validateSecurity: vi.fn(() => ({ errors: [], warnings: [] })),
}));

vi.mock("../services/AgentInitializer", () => ({
  initializeAgents: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  setupMonitoring: vi.fn(),
}));

describe("Bootstrap Process", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mocks for environment
    (environment.isDevelopment as any).mockReturnValue(true);
    (environment.isProduction as any).mockReturnValue(false);
    (environment.validateEnvironmentConfig as any).mockReturnValue([]);

    // Default success mocks
    (environment.getConfig as any).mockReturnValue({
      app: {
        env: "development",
        url: "http://localhost:5173",
        apiBaseUrl: "/api",
      },
      agents: { apiUrl: "http://localhost:8000" },
      security: { csrfEnabled: true, cspEnabled: true, httpsOnly: false },
      monitoring: { sentry: { enabled: false } },
      features: { agentFabric: true },
      database: { url: "mock" },
      cache: { enabled: false },
    });

    (security.validateSecurity as any).mockReturnValue({
      errors: [],
      warnings: [],
    });

    (agentInitializer.initializeAgents as any).mockResolvedValue({
      healthy: true,
      totalAgents: 8,
      availableAgents: 8,
      unavailableAgents: 0,
      averageResponseTime: 100,
    });
  });

  it("should complete full 8-step bootstrap sequence successfully when all features enabled", async () => {
    const onProgress = vi.fn();
    // Force skipAgentCheck to false to ensure Step 6 is called
    const result = await bootstrap({ onProgress, skipAgentCheck: false });

    expect(result.success).toBe(true);

    // Verify specific steps are called in order
    const progressCalls = onProgress.mock.calls.map((call) => call[0]);
    expect(progressCalls).toContain("Loading environment configuration...");
    expect(progressCalls).toContain("Validating configuration...");
    expect(progressCalls).toContain("Checking feature flags...");
    expect(progressCalls).toContain("Initializing security...");
    expect(progressCalls).toContain("Checking agent health..."); // Step 6
    expect(progressCalls).toContain("Checking database connection..."); // Step 7

    expect(security.initializeSecurity).toHaveBeenCalled();
    expect(agentInitializer.initializeAgents).toHaveBeenCalled();
  });

  it("should fail fast if configuration validation fails in production", async () => {
    (environment.isProduction as any).mockReturnValue(true);
    (environment.validateEnvironmentConfig as any).mockReturnValue([
      "Invalid API Key",
    ]);

    // failFast defaults to isProduction() which we mocked as true
    const result = await bootstrap();

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Invalid API Key");
    expect(security.initializeSecurity).not.toHaveBeenCalled();
  });

  it("should continue with warnings if agents are unavailable in development", async () => {
    (environment.isDevelopment as any).mockReturnValue(true);
    (environment.isProduction as any).mockReturnValue(false);

    (agentInitializer.initializeAgents as any).mockResolvedValue({
      healthy: false,
      totalAgents: 8,
      availableAgents: 0,
      unavailableAgents: 8,
      averageResponseTime: 0,
    });

    const onWarning = vi.fn();
    // Ensure Step 6 is called and failFast is false (default in dev)
    const result = await bootstrap({
      onWarning,
      skipAgentCheck: false,
      failFast: false,
    });

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.includes("agents unavailable"))).toBe(
      true
    );
    expect(onWarning).toHaveBeenCalled();
  });

  it("should handle unhandled exceptions in security initialization gracefully", async () => {
    (security.initializeSecurity as any).mockImplementation(() => {
      throw new Error("Security Crash");
    });

    const result = await bootstrap({ failFast: true });

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Security Crash"))).toBe(true);
  });
});
