import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

process.env.VITE_SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_KEY ||= "test-service-key";

vi.mock("../../src/config/ServiceConfigManager", () => {
  const base = {
    enabled: true,
    timeout: 30000,
    retryAttempts: 0,
    retryDelay: 100,
    healthCheckInterval: 10000,
  };

  return {
    getServiceConfigManager: () => ({
      getServiceConfig: (service: string) => {
        if (service === "eventExecutor") {
          return {
            ...base,
            kafka: {
              brokers: ["localhost:9092"],
              groupId: "test",
              topics: {
                agentRequests: "agent.requests",
                agentResponses: "agent.responses",
              },
            },
            circuitBreaker: {
              failureThreshold: 5,
              resetTimeout: 60000,
              monitoringPeriod: 300000,
            },
            agentExecution: {
              maxConcurrency: 1,
              timeout: 1000,
              retryOnFailure: false,
            },
          };
        }

        if (service === "agentMessageQueue") {
          return {
            ...base,
            redis: {
              url: "redis://localhost:6379",
              keyPrefix: "agent:queue",
            },
            queue: {
              concurrency: 1,
              rateLimitMax: 50,
              rateLimitDuration: 1000,
              jobRetention: 3600000,
            },
            scheduler: {
              enabled: false,
              checkInterval: 5000,
            },
          };
        }

        return base;
      },
    }),
    getAgentMessageQueueConfig: () => ({
      ...base,
      redis: {
        url: "redis://localhost:6379",
        keyPrefix: "agent:queue",
      },
      queue: {
        concurrency: 1,
        rateLimitMax: 50,
        rateLimitDuration: 1000,
        jobRetention: 3600000,
      },
      scheduler: {
        enabled: false,
        checkInterval: 5000,
      },
    }),
    getEventExecutorConfig: () => ({
      ...base,
      kafka: {
        brokers: ["localhost:9092"],
        groupId: "test",
        topics: {
          agentRequests: "agent.requests",
          agentResponses: "agent.responses",
        },
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 300000,
      },
      agentExecution: {
        maxConcurrency: 1,
        timeout: 1000,
        retryOnFailure: false,
      },
    }),
  };
});

vi.mock("../../src/services/CircuitBreaker", () => ({
  CircuitBreakerManager: class {
    getCircuitBreaker() {
      return {
        call: vi.fn().mockImplementation((fn) => fn()),
        on: vi.fn(),
      };
    }
  },
}));

vi.mock("../../src/services/AgentRegistry", () => ({
  AgentRegistry: class {
    getAgent() {
      return {};
    }
    listAgents() {
      return [];
    }
  },
}));
