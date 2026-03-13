/**
 * Agent Factory
 *
 * Creates fabric agent instances with properly injected dependencies
 * (LLMGateway, MemorySystem, CircuitBreaker). Used by both the
 * ValueLifecycleOrchestrator and UnifiedAgentAPI to avoid duplicating
 * agent construction logic.
 */

import type { GroundTruthIntegrationService } from "../../services/domain-packs/GroundTruthIntegrationService.js";
import type { AgentConfig } from "../../types/agent.js";
import type { LifecycleStage } from "@valueos/shared";
import { logger } from "../logger.js";

import { BaseAgent } from "./agents/BaseAgent.js";
import { ComplianceAuditorAgent } from "./agents/ComplianceAuditorAgent.js";
import { ExpansionAgent } from "./agents/ExpansionAgent.js";
import { FinancialModelingAgent } from "./agents/FinancialModelingAgent.js";
import { IntegrityAgent } from "./agents/IntegrityAgent.js";
import { NarrativeAgent } from "./agents/NarrativeAgent.js";
import { OpportunityAgent } from "./agents/OpportunityAgent.js";
import { RealizationAgent } from "./agents/RealizationAgent.js";
import { TargetAgent } from "./agents/TargetAgent.js";
import { CircuitBreaker } from "./CircuitBreaker.js";
import { KnowledgeFabricValidator } from "./KnowledgeFabricValidator.js";
import { LLMGateway } from "./LLMGateway.js";
import { MemorySystem } from "./MemorySystem.js";
import {
  agentLabelToLifecycleStage,
  LIFECYCLE_STAGE_TO_AGENT_LABEL,
} from "./lifecycleStageAdapter.js";

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
};

export interface AgentFactoryDeps {
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  circuitBreaker: CircuitBreaker;
  /** Optional — when provided, agents get Knowledge Fabric hallucination detection */
  groundTruthService?: GroundTruthIntegrationService;
}

/**
 * Factory for creating fabric agent instances with shared dependencies.
 *
 * Dependencies (LLMGateway, MemorySystem, CircuitBreaker) are injected
 * once at construction time and reused across all agent instantiations.
 * The organizationId is provided per-request since agents are tenant-scoped.
 */
export class AgentFactory {
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private circuitBreaker: CircuitBreaker;
  private knowledgeFabricValidator: KnowledgeFabricValidator | null;

  constructor(deps: AgentFactoryDeps) {
    this.llmGateway = deps.llmGateway;
    this.memorySystem = deps.memorySystem;
    this.circuitBreaker = deps.circuitBreaker;
    this.knowledgeFabricValidator = new KnowledgeFabricValidator(
      deps.memorySystem,
      deps.groundTruthService ?? null,
    );
  }

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

    const agent = new AgentClass(
      config,
      organizationId,
      this.memorySystem,
      this.llmGateway,
      this.circuitBreaker,
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
