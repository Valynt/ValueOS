import { describe, expect, it, vi } from "vitest";

// Mock the global logger from @shared/lib/logger
vi.mock("@shared/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withContext: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    })
  },
  createLogger: vi.fn()
}));

import { AgentMessageBroker, getAgentMessageBroker } from "../AgentMessageBroker";

describe("AgentMessageBroker", () => {
  describe("getAgentMessageBroker", () => {
    it("should return an instance of AgentMessageBroker", () => {
      const instance = getAgentMessageBroker();
      expect(instance).toBeInstanceOf(AgentMessageBroker);
    });

    it("should return the exact same instance on multiple calls (singleton)", () => {
      const instance1 = getAgentMessageBroker();
      const instance2 = getAgentMessageBroker();
      expect(instance1).toBe(instance2);
    });
  });
});
