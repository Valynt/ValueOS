/**
 * Agent Factory
 *
 * Creates fabric agent instances with properly injected dependencies
 * (LLMGateway, MemorySystem, CircuitBreaker). Used by both the
 * ValueLifecycleOrchestrator and UnifiedAgentAPI to avoid duplicating
 * agent construction logic.
 */

import type { LifecycleStage } from "@valueos/shared";

import type { GroundTruthIntegrationService } from "../../services/domain-packs/GroundTruthIntegrationService.js";
import type { AgentConfig } from "../../types/agent.js";
import { logger } from "../logger.js";

import { BaseAgent } from "./agents/BaseAgent.js";
import { ComplianceAuditorAgent } from "./agents/ComplianceAuditorAgent.js";
import { DiscoveryAgent } from "./agents/DiscoveryAgent.js";
import { ExpansionAgent } from "./agents/ExpansionAgent.js";
import { FinancialModelingAgent } from "./agents/FinancialModelingAgent.js";
import { IntegrityAgent } from "./agents/IntegrityAgent.js";
import { NarrativeAgent } from "./agents/NarrativeAgent.js";
import { OpportunityAgent } from "./agents/OpportunityAgent.js";
import { RealizationAgent } from "./agents/RealizationAgent.js";
import { TargetAgent } from "./agents/TargetAgent.js";
import { CircuitBreaker, CircuitBreakerManager } from "./CircuitBreaker.js";
import { KnowledgeFabricValidator } from "./KnowledgeFabricValidator.js";
import {
  agentLabelToLifecycleStage,
  LIFECYCLE_STAGE_TO_AGENT_LABEL,
} from "./lifecycleStageAdapter.js";
import { LLMGateway } from "./LLMGateway.js";
import { MemorySystem } from "./MemorySystem.js";

// Maps agent types to their fabric agent classes.
const FABRIC_AGENT_CLASSES: Partial<
  Record<string, new (config: AgentConfig, organizationId: string, memorySystem: MemorySystem, llmGateway: LLMGateway, circuitBreaker: CircuitBreaker) => BaseAgent>
> = {
  opportunity: OpportunityAgent,
  "financial-modeling": FinancialModelingAgent,
  target: TargetAgent,
  expansion: ExpansionAgent,
  integrity: IntegrityAgent,
  narrative: NarrativeAgent,
  realization: RealizationAgent,
  "compliance-auditor": ComplianceAuditorAgent,
  discovery: DiscoveryAgent,
};

export interface AgentFactoryDeps {
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  /**
   * Preferred: supply a CircuitBreakerManager so each agent type gets its own
   * isolated breaker. A failure in one agent will not trip breakers for others.
   */
  circuitBreakerManager?: CircuitBreakerManager;
  /**
   * Legacy: supply a single CircuitBreaker. AgentFactory wraps it in a
   * CircuitBreakerManager internally, registering the same instance under
   * every agent type key. Behavior is identical to the previous shared-breaker
   * approach. Migrate callers to circuitBreakerManager when convenient.
   *
   * @deprecated Prefer circuitBreakerManager for per-agent isolation.
   */
  circuitBreaker?: CircuitBreaker;
  /** Optional — when provided, agents get Knowledge Fabric hallucination detection */
  groundTruthService?: GroundTruthIntegrationService;
}

/**
 * Factory for creating fabric agent instances with shared dependencies.
 *
 * Dependencies (LLMGateway, MemorySystem, CircuitBreakerManager) are injected
 * once at construction time and reused across all agent instantiations.
 * The organizationId is provided per-request since agents are tenant-scoped.
 *
 * Each agent type receives its own CircuitBreaker from the manager so a
 * failure cascade in one agent does not trip breakers for others.
 */
export class AgentFactory {
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private circuitBreakerManager: CircuitBreakerManager;
  private knowledgeFabricValidator: KnowledgeFabricValidator | null;

  constructor(deps: AgentFactoryDeps) {
    if (!deps.circuitBreakerManager && !deps.circuitBreaker) {
      throw new Error(
        "AgentFactory requires either circuitBreakerManager or circuitBreaker in deps."
      );
    }

    this.llmGateway = deps.llmGateway;
    this.memorySystem = deps.memorySystem;

    if (deps.circuitBreakerManager) {
      this.circuitBreakerManager = deps.circuitBreakerManager;
    } else {
      // Legacy path: store the single breaker and return it for every agent type
      // in create(). All agent types share the same underlying breaker instance,
      // preserving the previous behavior for callers that have not yet migrated.
      this._legacyBreaker = deps.circuitBreaker!;
      this.circuitBreakerManager = new CircuitBreakerManager();
    }

    this.knowledgeFabricValidator = new KnowledgeFabricValidator(
      deps.memorySystem,
      deps.groundTruthService ?? null,
    );
  }

  /** Holds the legacy single breaker when the caller did not supply a manager. */
  private _legacyBreaker: CircuitBreaker | undefined;

  /**
   * Check whether a given agent type has a fabric implementation.
   */
  hasFabricAgent(agentType: string): boolean {
    return agentType in FABRIC_AGENT_CLASSES;
  }

  /**
   * List all agent types that have fabric implementations.
   */
  getFabricAgentTypes(): string[] {
    return Object.keys(FABRIC_AGENT_CLASSES);
  }

  /**
   * Create a fabric agent instance for the given type and tenant.
   *
   * @param agentType - The agent type (e.g. "opportunity", "target")
   * @param organizationId - Tenant organization ID for scoping
   * @returns A BaseAgent instance ready to execute
   * @throws Error if no fabric implementation exists for the agent type
   */
  create(agentType: string, organizationId: string): BaseAgent {
    const AgentClass = FABRIC_AGENT_CLASSES[agentType];
    if (!AgentClass) {
      throw new Error(
        `No fabric agent implementation for type "${agentType}". ` +
        `Available: ${Object.keys(FABRIC_AGENT_CLASSES).join(", ")}`
      );
    }

    const lifecycleStage = agentLabelToLifecycleStage(agentType);

    const config: AgentConfig = {
      id: `${agentType}-agent`,
      name: agentType,
      type: agentType as AgentConfig["type"],
      lifecycle_stage: lifecycleStage,
      capabilities: [],
      model: {
        provider: "custom",
        model_name: "default",
      },
      prompts: {
        system_prompt: "",
        user_prompt_template: "",
      },
      parameters: {
        timeout_seconds: 30,
        max_retries: 3,
        retry_delay_ms: 1000,
        enable_caching: true,
        enable_telemetry: true,
      },
      constraints: {
        max_input_tokens: 4096,
        max_output_tokens: 4096,
        allowed_actions: [],
        forbidden_actions: [],
        required_permissions: [],
      },
    };

    logger.debug("Creating fabric agent", {
      agent_type: agentType,
      organization_id: organizationId,
    });

    // Resolve the per-agent breaker. When a manager was supplied, each agent
    // type gets its own isolated breaker. When only a legacy single breaker was
    // supplied, _legacyBreaker is returned for every type (same behavior as before).
    const breaker = this._legacyBreaker ?? this.circuitBreakerManager.getBreaker(agentType);

    const agent = new AgentClass(
      config,
      organizationId,
      this.memorySystem,
      this.llmGateway,
      breaker,
    );

    if (this.knowledgeFabricValidator) {
      agent.setKnowledgeFabricValidator(this.knowledgeFabricValidator);
    }

    return agent;
  }

  /**
   * Create a fabric agent for a lifecycle stage.
   * Convenience wrapper that maps stage names to agent types.
   */
  createForStage(stage: LifecycleStage, organizationId: string): BaseAgent {
    return this.create(LIFECYCLE_STAGE_TO_AGENT_LABEL[stage], organizationId);
  }
}

/**
 * Create an AgentFactory with the given dependencies.
 */
export function createAgentFactory(deps: AgentFactoryDeps): AgentFactory {
  return new AgentFactory(deps);
}
