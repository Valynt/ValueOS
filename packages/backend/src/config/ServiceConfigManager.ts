/**
 * Service Configuration Manager
 *
 * Centralized configuration management for all agent layer services
 * with environment-based loading, validation, and hot reloading.
 */

import { z } from "zod";

import { logger } from "../lib/logger.js"

// Base service configuration schema
const BaseServiceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().min(1000).max(300000).default(30000), // 30 seconds
  retryAttempts: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(100).max(10000).default(1000),
  healthCheckInterval: z.number().min(1000).max(60000).default(10000),
});

// Agent API configuration
const AgentAPIConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  maxConcurrentRequests: z.number().min(1).max(100).default(10),
  rateLimitWindow: z.number().min(1000).max(3600000).default(60000), // 1 minute
  rateLimitMax: z.number().min(1).max(10000).default(100),
  tenantIsolation: z.boolean().default(true),
  requestValidation: z.boolean().default(true),
  auditLogging: z.boolean().default(true),
});

// Event Executor configuration
const EventExecutorConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  enabled: z.boolean().default(false),
  kafka: z
    .object({
      brokers: z.array(z.string()).default(["localhost:9093"]),
      groupId: z.string().default("agent-executor"),
      topics: z.object({
        agentRequests: z.string().default("agent.requests"),
        agentResponses: z.string().default("agent.responses"),
      }),
    })
    .default({
      brokers: ["localhost:9093"],
      groupId: "agent-executor",
      topics: {
        agentRequests: "agent.requests",
        agentResponses: "agent.responses",
      },
    }),
  circuitBreaker: z
    .object({
      failureThreshold: z.number().min(1).max(100).default(5),
      resetTimeout: z.number().min(1000).max(300000).default(60000),
      monitoringPeriod: z.number().min(1000).max(300000).default(300000),
    })
    .default({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000,
    }),
  agentExecution: z
    .object({
      maxConcurrency: z.number().min(1).max(50).default(10),
      timeout: z.number().min(5000).max(300000).default(30000),
      retryOnFailure: z.boolean().default(true),
    })
    .default({
      maxConcurrency: 10,
      timeout: 30000,
      retryOnFailure: true,
    }),
});

// Agent Message Queue configuration
const AgentMessageQueueConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  redis: z
    .object({
      url: z.string().default("redis://localhost:6379"),
      keyPrefix: z.string().default("agent:queue"),
    })
    .default({
      url: "redis://localhost:6379",
      keyPrefix: "agent:queue",
    }),
  queue: z
    .object({
      concurrency: z.number().min(1).max(50).default(10),
      rateLimitMax: z.number().min(1).max(1000).default(50),
      rateLimitDuration: z.number().min(100).max(60000).default(1000),
      jobRetention: z.number().min(1000).max(86400000).default(3600000), // 1 hour
    })
    .default({
      concurrency: 10,
      rateLimitMax: 50,
      rateLimitDuration: 1000,
      jobRetention: 3600000,
    }),
  scheduler: z
    .object({
      enabled: z.boolean().default(true),
      checkInterval: z.number().min(1000).max(60000).default(5000),
    })
    .default({
      enabled: true,
      checkInterval: 5000,
    }),
});

// Secure Message Bus configuration
const SecureMessageBusConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  crypto: z
    .object({
      keyRotationInterval: z
        .number()
        .min(3600000)
        .max(2592000000)
        .default(604800000), // 7 days
      signatureAlgorithm: z.enum(["Ed25519", "RSA"]).default("Ed25519"),
      encryptionAlgorithm: z
        .enum(["AES-256-GCM", "ChaCha20-Poly1305"])
        .default("AES-256-GCM"),
    })
    .default({
      keyRotationInterval: 604800000,
      signatureAlgorithm: "Ed25519",
      encryptionAlgorithm: "AES-256-GCM",
    }),
  rateLimiting: z
    .object({
      maxMessagesPerSecond: z.number().min(1).max(1000).default(10),
      maxMessagesPerMinute: z.number().min(10).max(10000).default(100),
      burstLimit: z.number().min(1).max(100).default(20),
    })
    .default({
      maxMessagesPerSecond: 10,
      maxMessagesPerMinute: 100,
      burstLimit: 20,
    }),
  circuitBreaker: z
    .object({
      failureThreshold: z.number().min(1).max(50).default(5),
      resetTimeout: z.number().min(1000).max(300000).default(60000),
    })
    .default({
      failureThreshold: 5,
      resetTimeout: 60000,
    }),
  replayProtection: z
    .object({
      nonceTTL: z.number().min(1000).max(3600000).default(300000), // 5 minutes
      cleanupInterval: z.number().min(10000).max(300000).default(60000), // 1 minute
    })
    .default({
      nonceTTL: 300000,
      cleanupInterval: 60000,
    }),
});

// Circuit Breaker configuration
const CircuitBreakerConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  failureThreshold: z.number().min(1).max(100).default(5),
  resetTimeout: z.number().min(1000).max(300000).default(60000),
  monitoringPeriod: z.number().min(1000).max(300000).default(300000),
  halfOpenSuccessThreshold: z.number().min(1).max(50).default(2),
  rollingWindowSize: z.number().min(5).max(1000).default(10),
  failureRateThreshold: z.number().min(0).max(1).default(0.5),
  latencyThresholdMs: z.number().min(100).max(300000).default(2000),
  minimumSamples: z.number().min(1).max(100).default(5),
});

// Rate Limiter configuration
const RateLimiterConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  redis: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      keyPrefix: z.string().default("ratelimit"),
      retryAttempts: z.number().min(0).max(5).default(3),
    })
    .default({
      enabled: false,
      keyPrefix: "ratelimit",
      retryAttempts: 3,
    }),
  tiers: z
    .object({
      strict: z.object({
        windowMs: z.number().default(60000),
        max: z.number().default(5),
      }),
      standard: z.object({
        windowMs: z.number().default(60000),
        max: z.number().default(60),
      }),
      loose: z.object({
        windowMs: z.number().default(60000),
        max: z.number().default(300),
      }),
    })
    .default({
      strict: {
        windowMs: 60000,
        max: 5,
      },
      standard: {
        windowMs: 60000,
        max: 60,
      },
      loose: {
        windowMs: 60000,
        max: 300,
      },
    }),
});

// Event Sourcing configuration
const EventSourcingConfigSchema = z.object({
  ...BaseServiceConfigSchema.shape,
  database: z
    .object({
      tableName: z.string().default("event_store"),
      projectionTableName: z.string().default("projections"),
      maxConnections: z.number().min(1).max(50).default(10),
    })
    .default({
      tableName: "event_store",
      projectionTableName: "projections",
      maxConnections: 10,
    }),
  projections: z
    .object({
      enabled: z.boolean().default(true),
      updateBatchSize: z.number().min(1).max(100).default(10),
      rebuildOnStartup: z.boolean().default(false),
    })
    .default({
      enabled: true,
      updateBatchSize: 10,
      rebuildOnStartup: false,
    }),
  audit: z
    .object({
      retentionDays: z.number().min(1).max(3650).default(365),
      compression: z.boolean().default(true),
      encryption: z.boolean().default(true),
    })
    .default({
      retentionDays: 365,
      compression: true,
      encryption: true,
    }),
});

// Master configuration schema
const ServiceConfigurationSchema = z.object({
  agentAPI: AgentAPIConfigSchema,
  eventExecutor: EventExecutorConfigSchema,
  agentMessageQueue: AgentMessageQueueConfigSchema,
  secureMessageBus: SecureMessageBusConfigSchema,
  circuitBreaker: CircuitBreakerConfigSchema,
  rateLimiter: RateLimiterConfigSchema,
  eventSourcing: EventSourcingConfigSchema,
});

export type ServiceConfiguration = z.infer<typeof ServiceConfigurationSchema>;

// Default configurations
const DEFAULT_CONFIG: ServiceConfiguration = {
  agentAPI: AgentAPIConfigSchema.parse({}),
  eventExecutor: EventExecutorConfigSchema.parse({}),
  agentMessageQueue: AgentMessageQueueConfigSchema.parse({}),
  secureMessageBus: SecureMessageBusConfigSchema.parse({}),
  circuitBreaker: CircuitBreakerConfigSchema.parse({}),
  rateLimiter: RateLimiterConfigSchema.parse({}),
  eventSourcing: EventSourcingConfigSchema.parse({}),
};

export class ServiceConfigManager {
  private config: ServiceConfiguration = DEFAULT_CONFIG;
  private configWatchers: Map<string, (config: ServiceConfiguration[keyof ServiceConfiguration]) => void> = new Map();
  private hotReloadEnabled = false;

  constructor() {
    this.loadConfiguration();
    this.setupHotReload();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): void {
    try {
      const envConfig = this.loadFromEnvironment();
      this.config = ServiceConfigurationSchema.parse({
        ...DEFAULT_CONFIG,
        ...envConfig,
      });

      logger.info("Service configuration loaded successfully");
    } catch (error) {
      logger.error("Failed to load service configuration", error as Error);
      // Continue with defaults
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): Partial<ServiceConfiguration> {
    const env = process.env;

    const agentAPIEnv: Partial<ServiceConfiguration["agentAPI"]> = {
      enabled: env.AGENT_API_ENABLED !== "false",
      ...(env.AGENT_API_TIMEOUT && {
        timeout: parseInt(env.AGENT_API_TIMEOUT),
      }),
      ...(env.AGENT_API_MAX_CONCURRENT && {
        maxConcurrentRequests: parseInt(env.AGENT_API_MAX_CONCURRENT),
      }),
      ...(env.AGENT_API_RATE_LIMIT_WINDOW && {
        rateLimitWindow: parseInt(env.AGENT_API_RATE_LIMIT_WINDOW),
      }),
      ...(env.AGENT_API_RATE_LIMIT_MAX && {
        rateLimitMax: parseInt(env.AGENT_API_RATE_LIMIT_MAX),
      }),
    };

    const eventExecutorEnv: Partial<ServiceConfiguration["eventExecutor"]> = {
      enabled: env.EVENT_EXECUTOR_ENABLED === "true",
      kafka: {
        ...(env.KAFKA_BROKERS && { brokers: env.KAFKA_BROKERS.split(",") }),
        ...(env.KAFKA_GROUP_ID && { groupId: env.KAFKA_GROUP_ID }),
        topics: {
          ...(env.KAFKA_TOPIC_AGENT_REQUESTS && {
            agentRequests: env.KAFKA_TOPIC_AGENT_REQUESTS,
          }),
          ...(env.KAFKA_TOPIC_AGENT_RESPONSES && {
            agentResponses: env.KAFKA_TOPIC_AGENT_RESPONSES,
          }),
        },
      } as Partial<ServiceConfiguration["eventExecutor"]["kafka"]>,
      circuitBreaker: {
        ...(env.EXECUTOR_CB_FAILURE_THRESHOLD && {
          failureThreshold: parseInt(env.EXECUTOR_CB_FAILURE_THRESHOLD),
        }),
        ...(env.EXECUTOR_CB_RESET_TIMEOUT && {
          resetTimeout: parseInt(env.EXECUTOR_CB_RESET_TIMEOUT),
        }),
      } as Partial<ServiceConfiguration["eventExecutor"]["circuitBreaker"]>,
    };

    const agentMessageQueueEnv: Partial<
      ServiceConfiguration["agentMessageQueue"]
    > = {
      enabled: env.AGENT_QUEUE_ENABLED !== "false",
      redis: {
        ...(env.AGENT_QUEUE_REDIS_URL && { url: env.AGENT_QUEUE_REDIS_URL }),
      } as Partial<ServiceConfiguration["agentMessageQueue"]["redis"]>,
      queue: {
        ...(env.AGENT_QUEUE_CONCURRENCY && {
          concurrency: parseInt(env.AGENT_QUEUE_CONCURRENCY),
        }),
        ...(env.AGENT_QUEUE_RATE_LIMIT_MAX && {
          rateLimitMax: parseInt(env.AGENT_QUEUE_RATE_LIMIT_MAX),
        }),
      } as Partial<ServiceConfiguration["agentMessageQueue"]["queue"]>,
    };

    const rateLimiterEnv: Partial<ServiceConfiguration["rateLimiter"]> = {
      redis: {
        enabled: env.RATE_LIMITER_REDIS_ENABLED === "true",
        ...(env.RATE_LIMITER_REDIS_URL && { url: env.RATE_LIMITER_REDIS_URL }),
      } as Partial<ServiceConfiguration["rateLimiter"]["redis"]>,
    };

    const eventSourcingEnv: Partial<ServiceConfiguration["eventSourcing"]> = {
      enabled: env.EVENT_SOURCING_ENABLED !== "false",
      database: {
        ...(env.EVENT_SOURCING_MAX_CONNECTIONS && {
          maxConnections: parseInt(env.EVENT_SOURCING_MAX_CONNECTIONS),
        }),
      } as Partial<ServiceConfiguration["eventSourcing"]["database"]>,
    };

    return {
      agentAPI: agentAPIEnv as Partial<ServiceConfiguration["agentAPI"]>,
      eventExecutor: eventExecutorEnv as Partial<ServiceConfiguration["eventExecutor"]>,
      agentMessageQueue: agentMessageQueueEnv as Partial<ServiceConfiguration["agentMessageQueue"]>,
      rateLimiter: rateLimiterEnv as Partial<ServiceConfiguration["rateLimiter"]>,
      eventSourcing: eventSourcingEnv as Partial<ServiceConfiguration["eventSourcing"]>,
    };
  }

  /**
   * Setup hot reload for configuration changes
   */
  private setupHotReload(): void {
    if (typeof process !== "undefined" && process.on) {
      process.on("SIGHUP", () => {
        logger.info("Received SIGHUP, reloading configuration");
        this.loadConfiguration();
        this.notifyWatchers();
      });
    }
  }

  /**
   * Get configuration for a specific service
   */
  getServiceConfig<T extends keyof ServiceConfiguration>(
    service: T
  ): ServiceConfiguration[T] {
    return this.config[service];
  }

  /**
   * Update configuration for a service
   */
  updateServiceConfig<T extends keyof ServiceConfiguration>(
    service: T,
    updates: Partial<ServiceConfiguration[T]>
  ): void {
    try {
      const current = this.config[service];
      const updated = { ...current, ...updates };

      // Validate the updated configuration
      const schema = this.getServiceSchema(service);
      const validated = schema.parse(updated) as ServiceConfiguration[T];

      this.config[service] = validated;

      // Notify watchers
      const watcher = this.configWatchers.get(service);
      if (watcher) {
        watcher(validated);
      }

      logger.info(`Service configuration updated: ${service}`);
    } catch (error) {
      logger.error(
        `Failed to update service configuration: ${service}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Watch for configuration changes
   */
  watchServiceConfig<T extends keyof ServiceConfiguration>(
    service: T,
    callback: (config: ServiceConfiguration[T]) => void
  ): void {
    this.configWatchers.set(service, callback as (config: ServiceConfiguration[keyof ServiceConfiguration]) => void);
  }

  /**
   * Get validation schema for a service
   */
  private getServiceSchema<T extends keyof ServiceConfiguration>(
    service: T
  ): z.ZodType<ServiceConfiguration[T]> {
    const schemas = {
      agentAPI: AgentAPIConfigSchema,
      eventExecutor: EventExecutorConfigSchema,
      agentMessageQueue: AgentMessageQueueConfigSchema,
      secureMessageBus: SecureMessageBusConfigSchema,
      circuitBreaker: CircuitBreakerConfigSchema,
      rateLimiter: RateLimiterConfigSchema,
      eventSourcing: EventSourcingConfigSchema,
    } as const;

    return schemas[service] as unknown as z.ZodType<ServiceConfiguration[T]>;
  }

  /**
   * Validate entire configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    try {
      ServiceConfigurationSchema.parse(this.config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        );
        return { valid: false, errors };
      }
      return { valid: false, errors: ["Unknown validation error"] };
    }
  }

  /**
   * Get complete configuration
   */
  getConfiguration(): ServiceConfiguration {
    return { ...this.config };
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = DEFAULT_CONFIG;
    this.notifyWatchers();
    logger.info("Configuration reset to defaults");
  }

  /**
   * Notify all watchers of configuration changes
   */
  private notifyWatchers(): void {
    for (const [service, watcher] of this.configWatchers.entries()) {
      try {
        watcher(this.config[service as keyof ServiceConfiguration]);
      } catch (error) {
        logger.error(
          `Error notifying watcher for service: ${service}`,
          error as Error
        );
      }
    }
  }

  /**
   * Export configuration as environment variables
   */
  exportAsEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};

    // Agent API
    env.AGENT_API_ENABLED = this.config.agentAPI.enabled.toString();
    env.AGENT_API_TIMEOUT = this.config.agentAPI.timeout.toString();
    env.AGENT_API_MAX_CONCURRENT =
      this.config.agentAPI.maxConcurrentRequests.toString();

    // Event Executor
    env.EVENT_EXECUTOR_ENABLED = this.config.eventExecutor.enabled.toString();
    env.KAFKA_BROKERS = this.config.eventExecutor.kafka.brokers.join(",");
    env.KAFKA_TOPIC_AGENT_REQUESTS =
      this.config.eventExecutor.kafka.topics.agentRequests;

    // Agent Message Queue
    env.AGENT_QUEUE_ENABLED = this.config.agentMessageQueue.enabled.toString();
    env.AGENT_QUEUE_REDIS_URL = this.config.agentMessageQueue.redis.url;
    env.AGENT_QUEUE_CONCURRENCY =
      this.config.agentMessageQueue.queue.concurrency.toString();

    // Rate Limiter
    env.RATE_LIMITER_REDIS_ENABLED =
      this.config.rateLimiter.redis.enabled.toString();
    env.RATE_LIMITER_REDIS_URL = this.config.rateLimiter.redis.url || "";

    return env;
  }
}

// Singleton instance
let serviceConfigManager: ServiceConfigManager | null = null;

export function getServiceConfigManager(): ServiceConfigManager {
  if (!serviceConfigManager) {
    serviceConfigManager = new ServiceConfigManager();
  }
  return serviceConfigManager;
}

// Convenience functions for common configurations
export function getAgentAPIConfig() {
  return getServiceConfigManager().getServiceConfig("agentAPI");
}

export function getEventExecutorConfig() {
  return getServiceConfigManager().getServiceConfig("eventExecutor");
}

export function getAgentMessageQueueConfig() {
  return getServiceConfigManager().getServiceConfig("agentMessageQueue");
}

export function getCircuitBreakerConfig() {
  return getServiceConfigManager().getServiceConfig("circuitBreaker");
}

export function getRateLimiterConfig() {
  return getServiceConfigManager().getServiceConfig("rateLimiter");
}
