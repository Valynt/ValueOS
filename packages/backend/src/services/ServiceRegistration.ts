/**
 * Service Registration
 *
 * Registers all application services with the dependency injection container.
 * This is the single place where shared infrastructure (LLMGateway,
 * MemorySystem, CircuitBreaker) and the AgentFactory are wired together.
 */

import { llmConfig } from "../config/llm.js"
import { CircuitBreaker } from "../config/secrets/CircuitBreaker";
import { AgentFactory } from "../lib/agent-fabric/AgentFactory";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem";
import { SupabaseMemoryBackend } from "../lib/agent-fabric/SupabaseMemoryBackend";
import { logger } from "../lib/logger.js"
import { getRedisClient } from "../lib/redis";
import { supabase } from "../lib/supabase.js"

import { getAgentAPI } from "./AgentAPI.js"
import { getAuditLogger } from "./AgentAuditLogger.js"
import { getAgentMessageQueue } from "./AgentMessageQueue.js"
import { getAgentRegistry } from "./AgentRegistry.js"
import { getAgentCache } from "./cache/AgentCache.js"
import {
  createServiceCollection,
  SERVICE_TOKENS,
} from "./DependencyInjectionContainer";
import { semanticMemory } from "./SemanticMemory.js";
import { getUnifiedOrchestrator } from "./UnifiedAgentOrchestrator.js"

// Create and configure the service collection
export function configureServices() {
  const services = createServiceCollection();

  // Register core infrastructure services
  services.addSingleton(SERVICE_TOKENS.LOGGER, () => logger);
  services.addSingleton(SERVICE_TOKENS.AUDIT_LOGGER, () => getAuditLogger());
  services.addSingleton(SERVICE_TOKENS.CACHE, () => getAgentCache());
  services.addSingleton(SERVICE_TOKENS.DATABASE, () => supabase);
  services.addSingleton(SERVICE_TOKENS.REDIS, () => getRedisClient());

  // Register agent services as singletons
  services.addSingleton(SERVICE_TOKENS.AGENT_REGISTRY, () =>
    getAgentRegistry()
  );
  services.addSingleton(SERVICE_TOKENS.AGENT_API, () => getAgentAPI());
  services.addSingleton(SERVICE_TOKENS.MESSAGE_QUEUE, () =>
    getAgentMessageQueue()
  );

  // --- Shared agent infrastructure ---

  // LLMGateway: centralized LLM access with circuit breaker, cost tracking, telemetry.
  // The provider string ("together", "openai", etc.) triggers the backward-compat path
  // in LLMGateway's constructor, which builds a default LLMGatewayConfig internally.
  services.addSingleton(
    SERVICE_TOKENS.LLM_GATEWAY,
    () => new LLMGateway(llmConfig.provider)
  );

  // CircuitBreaker: shared instance for agent execution resilience.
  // 5 failures within the monitoring window trips the breaker; 60s recovery timeout.
  services.addSingleton(
    SERVICE_TOKENS.CIRCUIT_BREAKER,
    () =>
      new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60_000,
        monitoringPeriod: 120_000,
        successThreshold: 2,
      })
  );

  // MemorySystem: agent memory with Supabase-backed persistence for cross-session recall.
  services.addSingleton(
    SERVICE_TOKENS.MEMORY_SYSTEM,
    () =>
      new MemorySystem(
        {
          max_memories: 1000,
          enable_persistence: true,
          vector_search_enabled: true,
        },
        new SupabaseMemoryBackend(semanticMemory),
      )
  );

  // AgentFactory: creates fabric agent instances with injected LLMGateway,
  // MemorySystem, and CircuitBreaker. Used by UnifiedAgentAPI and the
  // ValueLifecycleOrchestrator to construct agents consistently.
  services.addFactory(
    SERVICE_TOKENS.AGENT_FACTORY,
    (llmGateway: LLMGateway, memorySystem: MemorySystem, circuitBreaker: CircuitBreaker) =>
      new AgentFactory({ llmGateway, memorySystem, circuitBreaker }),
    "Singleton",
    [SERVICE_TOKENS.LLM_GATEWAY, SERVICE_TOKENS.MEMORY_SYSTEM, SERVICE_TOKENS.CIRCUIT_BREAKER]
  );

  services.addSingleton(
    SERVICE_TOKENS.UNIFIED_ORCHESTRATOR,
    (
      agentAPI: any,
      agentRegistry: any,
      cache: any,
      memorySystem: any,
      llmGateway: any,
      messageBroker: any,
      messageQueue: any
    ) =>
      getUnifiedOrchestrator({
        enableWorkflows: true,
        enableTaskPlanning: true,
        enableSDUI: true,
        enableSimulation: true,
        defaultTimeoutMs: 30000,
        maxRetryAttempts: 3,
      }),
    [
      SERVICE_TOKENS.AGENT_API,
      SERVICE_TOKENS.AGENT_REGISTRY,
      SERVICE_TOKENS.CACHE,
      SERVICE_TOKENS.MEMORY_SYSTEM,
      SERVICE_TOKENS.LLM_GATEWAY,
      SERVICE_TOKENS.MESSAGE_QUEUE, // Using message queue as message broker for now
      SERVICE_TOKENS.MESSAGE_QUEUE,
    ]
  );

  logger.info("Service container configured with all application services");

  return services;
}

// Initialize services on module load
export const serviceCollection = configureServices();
export const serviceProvider = serviceCollection.build();
