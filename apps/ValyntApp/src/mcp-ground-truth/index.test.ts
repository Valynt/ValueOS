import { beforeEach, describe, expect, it, vi } from "vitest";

const createMCPServerMock = vi.fn();
const createDevServerMock = vi.fn();

vi.mock("../../../../packages/mcp/ground-truth/index.ts", () => ({
  createMCPServer: createMCPServerMock,
  createDevServer: createDevServerMock,
}));

describe("ValyntApp mcp-ground-truth compatibility layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALPHA_VANTAGE_API_KEY;
  });

  it("delegates createMCPServer to the canonical package runtime", async () => {
    const runtime = { executeTool: vi.fn() };
    createMCPServerMock.mockResolvedValue(runtime);

    const { createMCPServer } = await import("./index");
    const config = {
      industryBenchmark: { enableStaticData: true },
      marketData: {
        provider: "polygon" as const,
        apiKey: "explicit-key",
      },
    };

    const result = await createMCPServer(config);

    expect(result).toBe(runtime);
    expect(createMCPServerMock).toHaveBeenCalledWith(config);
  });

  it("injects compatibility marketData defaults when apiKey is omitted", async () => {
    const runtime = { executeTool: vi.fn() };
    createMCPServerMock.mockResolvedValue(runtime);

    const { createMCPServer } = await import("./index");

    await createMCPServer({
      industryBenchmark: { enableStaticData: true },
    });

    expect(createMCPServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        industryBenchmark: { enableStaticData: true },
        marketData: {
          provider: "alphavantage",
          rateLimit: 5,
          apiKey: "demo",
        },
      })
    );
  });

  it("passes through canonical errors for createMCPServer", async () => {
    const expected = new Error("canonical runtime unavailable");
    createMCPServerMock.mockRejectedValue(expected);

    const { createMCPServer } = await import("./index");

    await expect(createMCPServer({})).rejects.toBe(expected);
  });

  it("delegates createDevServer to canonical package implementation", async () => {
    const runtime = { executeTool: vi.fn() };
    createDevServerMock.mockResolvedValue(runtime);

    const { createDevServer } = await import("./index");

    const result = await createDevServer();

    expect(result).toBe(runtime);
    expect(createDevServerMock).toHaveBeenCalledTimes(1);
  });
});
