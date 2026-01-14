import { vi } from "vitest";

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

vi.mock("../../src/services/EventProducer", () => {
  return {
    getEventProducer: () => ({
      publish: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
  };
});
