/**
 * Service Registration
 *
 * Registers all application services with the dependency injection container
 */

import {
  createServiceCollection,
  SERVICE_TOKENS,
  Lifetime,
} from "./DependencyInjectionContainer";
import { logger } from "../lib/logger.js"
import { getAuditLogger } from "./AgentAuditLogger.js"
import { getAgentCache } from "./cache/AgentCache.js"
import { getAgentRegistry } from "./AgentRegistry.js"
import { getAgentAPI } from "./AgentAPI.js"
import { getAgentMessageQueue } from "./AgentMessageQueue.js"
import { supabase } from "../lib/supabase.js"
import { getRedisClient } from "../lib/redis";
import { getUnifiedOrchestrator } from "./UnifiedAgentOrchestrator.js"
import { LLMGateway } from "../lib/agent-fabric/LLMGateway";
import { llmConfig } from "../config/llm.js"
import { MemorySystem } from "../lib/agent-fabric/MemorySystem";

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

  // Register business services with dependencies
  services.addSingleton(
    SERVICE_TOKENS.LLM_GATEWAY,
    () => new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled)
  );

  services.addSingleton(
    SERVICE_TOKENS.MEMORY_SYSTEM,
    (supabaseClient: any, llmGateway: any) =>
      new MemorySystem(supabaseClient, llmGateway),
    [SERVICE_TOKENS.DATABASE, SERVICE_TOKENS.LLM_GATEWAY]
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
