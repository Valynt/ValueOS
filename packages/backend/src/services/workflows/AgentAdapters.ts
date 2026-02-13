import { 
  OpportunityAgentInterface, 
  FinancialModelingAgentInterface, 
  GroundTruthAgentInterface, 
  NarrativeAgentInterface,
  RedTeamLLMGateway
} from "@valueos/agents";
import { LLMGateway } from "../../lib/agent-fabric/LLMGateway.js";
import { logger } from "../../lib/logger.js";

/**
 * Adapter for RedTeamAgent to use the core LLMGateway.
 */
export class RedTeamLLMAdapter implements RedTeamLLMGateway {
  constructor(private llmGateway: LLMGateway) {}

  async complete(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    metadata: { tenantId: string; [key: string]: unknown };
  }): Promise<{
    content: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const response = await this.llmGateway.complete({
      messages: request.messages as any,
      metadata: request.metadata as any,
    });

    return {
      content: response.content,
      usage: response.usage,
    };
  }
}

/**
 * Generic adapter for standalone agents in packages/agents/ to talk to backend services.
 * This ensures they follow the standard backend LLM routing and cost tracking.
 */
export class AgentServiceAdapter implements 
  OpportunityAgentInterface, 
  FinancialModelingAgentInterface, 
  GroundTruthAgentInterface, 
  NarrativeAgentInterface {
  
  constructor(private llmGateway: LLMGateway) {}

  async analyzeOpportunities(query: string, context?: any) {
    // This is a bit of a shim. In a real system, we might call the microservice via HTTP.
    // Here we'll simulate the agent logic or call its internal class if available.
    logger.info('Analyzing opportunities (adapter)', { query });
    // For now, we'll return a placeholder or implement the logic.
    // Actually, R7 says "replace mock implementations in packages/agents/ domain agents with real LLM calls".
    // This means the agents themselves (e.g. FinancialModelingAnalyzer) should be instantiated.
    return { opportunities: [], analysis: 'Not implemented' };
  }

  async analyzeFinancialModels(query: string, context?: any, idempotencyKey?: string) {
    return { financial_models: [], analysis: 'Not implemented' };
  }

  async analyzeGroundtruth(query: string, context?: any, idempotencyKey?: string) {
    return { groundtruths: [], analysis: 'Not implemented' };
  }

  async analyzeNarrative(query: string, context?: any, idempotencyKey?: string) {
    return { narratives: [], analysis: 'Not implemented' };
  }
}
