/**
 * Agent Chat Service
 * 
 * Connects the chat interface to the agent orchestrator and LLM.
 * Handles:
 * - Message processing via LLM (Together.ai)
 * - Agent routing and orchestration
 * - SDUI response generation
 * - Conversation history management
 * - AI transparency (confidence, reasoning)
 */

import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { llmConfig } from '../config/llm';
import { conversationHistoryService, ConversationMessage } from './ConversationHistoryService';
import { SDUIPageDefinition } from '../sdui/schema';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import type { LifecycleStage } from '../types/vos';
import { getRelevantExamples, formatExampleForPrompt } from '../data/valueModelExamples';
import { getAllTools, createToolExecutor } from './MCPTools';
import { mcpGroundTruthService } from './MCPGroundTruthService';

// ============================================================================
// Types
// ============================================================================

export interface ChatRequest {
  query: string;
  caseId: string;
  userId: string;
  sessionId: string;
  tenantId?: string;  // For CRM tool access
  workflowState: WorkflowState;
}

export interface ChatResponse {
  message: ConversationMessage;
  sduiPage?: SDUIPageDefinition;
  nextState: WorkflowState;
  traceId: string;
}

export interface AgentThought {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
}

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a Value Engineering AI assistant helping users build business cases and ROI analyses.

You help users through the value lifecycle:
- Opportunity: Discover pain points, identify KPIs, and create value hypotheses
- Target: Build ROI models, set targets, and create business cases for stakeholders
- Realization: Track actual value delivered against targets
- Expansion: Identify upsell and growth opportunities

Always:
1. Be concise and actionable
2. Provide confidence levels for your recommendations (high/medium/low)
3. Cite sources and evidence when making claims
4. Ask clarifying questions when the request is ambiguous
5. Focus on quantifiable business outcomes

When responding, structure your output with:
- A clear recommendation or answer
- Supporting reasoning (2-3 key points)
- Suggested next actions`;

/**
 * Build context-aware prompt with relevant examples
 */
function buildPromptWithExamples(query: string, industry?: string): string {
  const examples = getRelevantExamples(query, industry, 2);
  
  if (examples.length === 0) {
    return SYSTEM_PROMPT;
  }
  
  const exampleSection = examples
    .map(ex => formatExampleForPrompt(ex))
    .join('\n\n---\n\n');
  
  return `${SYSTEM_PROMPT}

## Reference Examples
Use these examples as templates for structure and depth:

${exampleSection}

---
Now help the user with their specific request, following similar structure and rigor.`;
}

// ============================================================================
// Service
// ============================================================================

class AgentChatService {
  private llm: LLMGateway;

  constructor() {
    this.llm = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
  }

  /**
   * Process a chat message
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const traceId = uuidv4();
    
    logger.info('Processing chat request', {
      traceId,
      caseId: request.caseId,
      queryLength: request.query.length,
      stage: request.workflowState.currentStage,
    });

    try {
      // Add user message to history
      await conversationHistoryService.addMessage(request.caseId, {
        role: 'user',
        content: request.query,
      });

      // Get conversation context
      const recentMessages = await conversationHistoryService.getRecentMessages(request.caseId, 10);
      
      // Build LLM messages with relevant examples for few-shot learning
      const llmMessages = [
        { role: 'system' as const, content: this.buildSystemPrompt(request.workflowState, request.query) },
        ...conversationHistoryService.formatForLLM(recentMessages),
        { role: 'user' as const, content: request.query },
      ];

      // Check if we should use tool calling
      const needsFinancialData = mcpGroundTruthService.isAvailable() && this.queryNeedsFinancialData(request.query);
      const needsCRMData = request.tenantId && this.queryNeedsCRMData(request.query);
      const useToolCalling = needsFinancialData || needsCRMData;

      let llmResponse;
      if (useToolCalling) {
        // Get available tools (MCP + CRM if connected)
        const tools = await getAllTools(request.tenantId, request.userId);
        const toolExecutor = createToolExecutor(request.tenantId, request.userId);

        // Use tool calling - LLM decides what data it needs
        llmResponse = await this.llm.completeWithTools(
          llmMessages,
          tools,
          toolExecutor,
          { temperature: 0.7, max_tokens: 2048 },
          3 // max iterations
        );
      } else {
        // Standard completion without tools
        llmResponse = await this.llm.complete(llmMessages, {
          temperature: 0.7,
          max_tokens: 2048,
        });
      }

      // Extract confidence and reasoning from response
      const { content, confidence, reasoning } = this.parseResponse(llmResponse.content);

      // Create assistant message
      const assistantMessage = await conversationHistoryService.addMessage(request.caseId, {
        role: 'assistant',
        content,
        agentName: this.getAgentName(request.workflowState.currentStage),
        confidence,
        reasoning,
      });

      // Generate SDUI page
      const sduiPage = this.generateSDUIPage(content, confidence, reasoning, request.workflowState);

      // Update workflow state
      const nextState = this.updateWorkflowState(request.workflowState, request.query, content);

      logger.info('Chat response generated', {
        traceId,
        confidence,
        reasoningSteps: reasoning?.length,
        tokensUsed: llmResponse.tokens_used,
      });

      return {
        message: assistantMessage,
        sduiPage,
        nextState,
        traceId,
      };
    } catch (error) {
      logger.error('Error processing chat request', error instanceof Error ? error : undefined, { traceId });
      
      // Return error message
      const errorMessage = await conversationHistoryService.addMessage(request.caseId, {
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again.',
        agentName: 'System',
        confidence: 0,
      });

      return {
        message: errorMessage,
        nextState: request.workflowState,
        traceId,
      };
    }
  }

  /**
   * Build system prompt based on current stage with relevant examples
   */
  private buildSystemPrompt(state: WorkflowState, query?: string): string {
    const stageContext = {
      opportunity: 'Focus on discovering pain points, understanding the customer context, and identifying potential value drivers.',
      target: 'Focus on building quantifiable ROI models, setting realistic targets, and creating compelling business cases.',
      realization: 'Focus on tracking actual results against targets, explaining variances, and documenting achieved value.',
      expansion: 'Focus on identifying upsell opportunities, new use cases, and additional value that can be realized.',
    };

    const stage = state.currentStage as LifecycleStage;
    const stagePrompt = stageContext[stage] || stageContext.opportunity;

    // Get industry from context if available
    const industry = state.context?.industry as string | undefined;
    
    // Build prompt with relevant examples for better few-shot guidance
    const basePrompt = query 
      ? buildPromptWithExamples(query, industry)
      : SYSTEM_PROMPT;

    return `${basePrompt}\n\nCurrent Stage: ${state.currentStage}\n${stagePrompt}`;
  }

  /**
   * Get agent name based on stage
   */
  private getAgentName(stage: string): string {
    const agents: Record<string, string> = {
      opportunity: 'Opportunity Agent',
      target: 'Target Agent',
      realization: 'Realization Agent',
      expansion: 'Expansion Agent',
    };
    return agents[stage] || 'Value Agent';
  }

  /**
   * Parse LLM response to extract confidence and reasoning
   */
  private parseResponse(rawContent: string): {
    content: string;
    confidence: number;
    reasoning: string[];
  } {
    // Simple heuristic-based confidence
    // In production, this would be more sophisticated
    let confidence = 0.75;
    const reasoning: string[] = [];

    // Look for confidence indicators in the response
    const lowConfidenceIndicators = ['might', 'could be', 'possibly', 'uncertain', 'not sure'];
    const highConfidenceIndicators = ['definitely', 'certainly', 'clearly', 'based on data', 'evidence shows'];

    const lowerContent = rawContent.toLowerCase();
    
    if (highConfidenceIndicators.some(ind => lowerContent.includes(ind))) {
      confidence = 0.9;
    } else if (lowConfidenceIndicators.some(ind => lowerContent.includes(ind))) {
      confidence = 0.5;
    }

    // Extract reasoning if present (look for numbered lists or bullet points)
    const lines = rawContent.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (/^[\d•\-\*]\s*\.?\s*/.test(trimmed) && trimmed.length > 10) {
        reasoning.push(trimmed.replace(/^[\d•\-\*]\s*\.?\s*/, ''));
      }
    });

    // If no explicit reasoning found, generate from key sentences
    if (reasoning.length === 0) {
      const sentences = rawContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
      reasoning.push(...sentences.slice(0, 3).map(s => s.trim()));
    }

    return {
      content: rawContent,
      confidence,
      reasoning: reasoning.slice(0, 5),
    };
  }

  /**
   * Check if query likely needs financial data lookup
   */
  private queryNeedsFinancialData(query: string): boolean {
    const dataKeywords = [
      'revenue', 'income', 'profit', 'margin', 'earnings',
      'financial', 'roi', 'cost', 'savings', 'benchmark',
      'compare', 'industry', 'market', 'growth', 'performance',
      'competitor', 'actual', 'real',
      'sec', 'filing', 'quarterly', 'annual', 'fy', 'q1', 'q2', 'q3', 'q4'
    ];
    
    const queryLower = query.toLowerCase();
    return dataKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Check if query likely needs CRM data lookup
   */
  private queryNeedsCRMData(query: string): boolean {
    const crmKeywords = [
      'deal', 'opportunity', 'pipeline', 'salesforce', 'hubspot', 'crm',
      'contact', 'stakeholder', 'decision maker', 'champion', 'buyer',
      'account', 'prospect', 'lead', 'customer',
      'activity', 'email', 'call', 'meeting', 'last contact',
      'close date', 'stage', 'probability', 'forecast',
      'find the', 'look up', 'search for', 'get the', 'show me',
      'who is', 'when was', 'what is the status'
    ];
    
    const queryLower = query.toLowerCase();
    return crmKeywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Generate SDUI page from response
   */
  private generateSDUIPage(
    content: string,
    confidence: number,
    reasoning: string[],
    state: WorkflowState
  ): SDUIPageDefinition {
    return {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'AgentResponseCard',
          version: 1,
          props: {
            response: {
              id: uuidv4(),
              agentId: state.currentStage,
              agentName: this.getAgentName(state.currentStage),
              timestamp: new Date().toISOString(),
              content,
              confidence,
              reasoning: reasoning.map((r, i) => ({
                id: `step-${i}`,
                step: i + 1,
                description: r,
                confidence: confidence - (i * 0.05), // Slightly decreasing confidence per step
              })),
              status: 'pending' as const,
            },
            showReasoning: true,
            showActions: true,
          },
        },
      ],
    };
  }

  /**
   * Update workflow state based on conversation
   */
  private updateWorkflowState(
    currentState: WorkflowState,
    query: string,
    response: string
  ): WorkflowState {
    const nextState = { ...currentState };

    // Add to conversation history in context
    nextState.context = {
      ...nextState.context,
      lastQuery: query,
      lastResponse: response,
      lastUpdated: new Date().toISOString(),
    };

    // Check for stage transitions
    const lowerQuery = query.toLowerCase();
    const lowerResponse = response.toLowerCase();

    if (currentState.currentStage === 'opportunity') {
      if (lowerQuery.includes('roi') || lowerQuery.includes('business case') || 
          lowerResponse.includes('ready to target') || lowerResponse.includes('move to target')) {
        nextState.completedStages = [...(currentState.completedStages || []), 'opportunity'];
        nextState.currentStage = 'target';
      }
    } else if (currentState.currentStage === 'target') {
      if (lowerQuery.includes('track') || lowerQuery.includes('measure') ||
          lowerResponse.includes('ready to realize') || lowerResponse.includes('implementation')) {
        nextState.completedStages = [...(currentState.completedStages || []), 'target'];
        nextState.currentStage = 'realization';
      }
    } else if (currentState.currentStage === 'realization') {
      if (lowerQuery.includes('expand') || lowerQuery.includes('upsell') ||
          lowerResponse.includes('expansion opportunity') || lowerResponse.includes('additional value')) {
        nextState.completedStages = [...(currentState.completedStages || []), 'realization'];
        nextState.currentStage = 'expansion';
      }
    }

    return nextState;
  }
}

// Export singleton
export const agentChatService = new AgentChatService();
