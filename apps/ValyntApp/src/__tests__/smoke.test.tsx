import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render } from "@testing-library/react";

// Mock dependencies that might be heavy or require browser APIs not in happy-dom
vi.mock("./services/ClientRateLimit", () => ({
  setupDefaultRateLimits: vi.fn(),
}));

vi.mock("./lib/analyticsClient", () => ({
  analyticsClient: {
    initialize: vi.fn(),
    track: vi.fn(),
  },
}));

// Mock logger to avoid clutter
vi.mock("./lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  setupMonitoring: vi.fn(),
}));

describe("Application Smoke Test", () => {
  it("should be able to import App component without crashing", async () => {
    const App = (await import("../App")).default;
    expect(App).toBeDefined();
  });

  it("should be able to import bootstrap module without crashing", async () => {
    const bootstrap = await import("../bootstrap");
    expect(bootstrap).toBeDefined();
    expect(typeof bootstrap.bootstrap).toBe("function");
  });

  it("should be able to import core utilities without crashing", async () => {
    await import("../utils/performance");
    await import("../utils/cache");
    await import("../utils/export");
    await import("../utils/settingsErrorHandler");
    expect(true).toBe(true);
  });
});
