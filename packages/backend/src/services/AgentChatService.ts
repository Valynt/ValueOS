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

import { logger } from "../lib/logger.js"
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway";
import { llmConfig } from "../config/llm.js"
import {
  conversationHistoryService,
  ConversationMessage,
} from "./ConversationHistoryService";
import { SDUIPageDefinition } from "@sdui/schema";
import {
  WorkflowState,
  WorkflowStateRepository,
} from "../repositories/WorkflowStateRepository";
import type { LifecycleStage } from "../types/vos";
import {
  formatExampleForPrompt,
  getRelevantExamples,
} from "../data/valueModelExamples";
import { createToolExecutor, getAllTools } from "./MCPTools.js"
import { checkStageTransition } from "../config/chatWorkflowConfig.js"
import {
  generateChatSDUIPage,
  hasTemplateForStage,
} from "@sdui/templates/chat-templates";
import { contextFabric } from "../lib/agent-fabric/ContextFabric";
import { detectIndustry } from "../data/industryTemplates";
import { geminiProxyService } from "./GeminiProxyService.js"
import { FallbackAIService } from "./FallbackAIService.js"
import { RetryService } from "./RetryService.js"

// ============================================================================
// Type-Safe Schemas with Zod
// ============================================================================

const ValueHypothesisSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.enum(["High", "Medium", "Low"]),
  confidence: z.number().min(0).max(100),
});

const KeyMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  trend: z.enum(["up", "down", "neutral"]),
});

export const AIResponseSchema = z.object({
  analysisSummary: z.string(),
  identifiedIndustry: z.string(),
  valueHypotheses: z.array(ValueHypothesisSchema),
  keyMetrics: z.array(KeyMetricSchema),
  recommendedActions: z.array(z.string()),
});

export type AIResponseSchema = z.infer<typeof AIResponseSchema>;

// ============================================================================
// Types
// ============================================================================

export interface ChatRequest {
  query: string;
  caseId: string;
  userId: string;
  sessionId: string;
  tenantId?: string; // For CRM tool access
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
    .map((ex) => formatExampleForPrompt(ex))
    .join("\n\n---\n\n");

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

export class AgentChatService {
  private llm: LLMGateway;
  private stateRepo?: WorkflowStateRepository;

  constructor(stateRepository?: WorkflowStateRepository) {
    this.llm = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
    this.stateRepo = stateRepository;
  }

  /**
   * Process a chat message
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const traceId = uuidv4();
    const query = request.query;

    logger.info("Processing chat request via Intelligence Engine", {
      traceId,
      caseId: request.caseId,
      queryLength: query.length,
      stage: request.workflowState.currentStage,
    });

    try {
      // 1. Detect Industry Context
      const richContext = await contextFabric.buildContext(
        request.userId,
        request.tenantId || "default",
        request.workflowState
      );

      const combinedContext = `${query} ${JSON.stringify(richContext)}`;
      const template = detectIndustry(combinedContext);

      logger.info(`Detected Industry Persona: ${template.role}`, {
        industry: template.name,
      });

      // 2. Construct the System Prompt
      let systemPrompt = `
        You are an expert ${template.role}.

        Your goal is to analyze the user's input and generate a Strategic Value Map.

        CONTEXT:
        The user is working on a deal or project in the "${template.name}" sector.

        FOCUS AREAS:
        Focus your analysis on: ${template.focusAreas.join(", ")}.

        METRICS:
        Prioritize these metrics: ${template.metrics.join(", ")}.

        PAIN POINTS TO LOOK FOR:
        ${template.typicalPainPoints.join(", ")}.

        SCHEMAS AND DEFINITONS:
        Output MUST be valid JSON matching the schema below. Do not include markdown formatting like \`\`\`json.

        SCHEMA:
        {
          "analysisSummary": "Brief executive summary...",
          "identifiedIndustry": "The industry you detected",
          "valueHypotheses": [
            { "title": "Hypothesis Headline", "description": "Detail...", "impact": "High/Med/Low", "confidence": 85 }
          ],
          "keyMetrics": [
            { "label": "Metric Name", "value": "Projected Value", "trend": "up/down" }
          ],
          "recommendedActions": ["Action 1", "Action 2"]
        }
      `;

      // Phase 5: Refinement Loop Injection
      // If we have prior analysis, inject it so the agent can "edit" it.
      const lastAnalysis = request.workflowState.context?.lastAnalysis;
      if (lastAnalysis) {
        systemPrompt += `

          CURRENT DASHBOARD STATE (JSON):
          ${JSON.stringify(lastAnalysis)}

          REFINEMENT INSTRUCTIONS:
          The user is likely asking to UPDATE or REFINE the above state.
          - If they say "Make it more aggressive", adjust the metrics and confidence up.
          - If they say "Add a hypothesis about X", keep existing ones and ADD the new one.
          - Return the FULL JSON with your modifications applied.
          `;
      }

      // 3. Call Gemini API through secure proxy with sophisticated retry
      let parsedData: AIResponseSchema;

      const apiCall = async () => {
        return await geminiProxyService.generateContent({
          contents: [{ parts: [{ text: query }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
      };

      const retryResult = await RetryService.executeWithRetry(
        apiCall,
        {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 60000,
          context: {
            serviceId: 'gemini-proxy',
            operation: 'generateContent',
            caseId: request.caseId,
            sessionId: request.sessionId,
            traceId
          },
          onRetry: (attempt, error, delay) => {
            logger.warn(`Gemini API attempt ${attempt} failed, retrying in ${delay}ms`, {
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delay,
              traceId
            });
          }
        }
      );

      if (retryResult.success && retryResult.result) {
        const textResponse = retryResult.result;
        parsedData = AIResponseSchema.parse(JSON.parse(textResponse));

        // Cache successful analysis for fallback use
        FallbackAIService.cacheAnalysis(request.caseId, parsedData);

        logger.info('Gemini API call succeeded after retries', {
          attempts: retryResult.attempts,
          totalDelay: retryResult.totalDelay,
          traceId
        });

      } else {
        // Handle retry failure
        const apiError = retryResult.error;
        logger.error("Gemini API retries exhausted, attempting fallback", {
          error: apiError instanceof Error ? apiError : new Error(String(apiError)),
          attempts: retryResult.attempts,
          totalDelay: retryResult.totalDelay,
          circuitBreakerTripped: retryResult.circuitBreakerTripped,
          traceId
        });

        // Check if we should use fallback service
        if (FallbackAIService.shouldUseFallback(apiError)) {
          // Try to get cached analysis first
          const cachedAnalysis = FallbackAIService.getCachedAnalysis(request.caseId);
          if (cachedAnalysis) {
            parsedData = cachedAnalysis;
            logger.info("Using cached analysis as fallback", { traceId });
          } else {
            // Generate rule-based fallback
            parsedData = FallbackAIService.generateFallbackAnalysis(query, {
              industry: template.name,
              stage: request.workflowState.currentStage
            });
            logger.info("Using rule-based fallback analysis", { traceId });
          }
        } else {
          // Re-throw if it's not a fallback-worthy error
          throw apiError;
        }
      }

      // 4. Transform AI JSON to SDUI Page Definition
      const sduiPage = this.transformToSDUI(
        parsedData,
        request.workflowState,
        traceId,
        request.sessionId
      );

      // Create assistant message
      const assistantMessage = await conversationHistoryService.addMessage(
        request.caseId,
        {
          role: "assistant",
          content: parsedData.analysisSummary,
          agentName: template.role,
          confidence: 0.9,
          reasoning: parsedData.recommendedActions,
        }
      );

      // Update workflow state
      const nextState = this.updateWorkflowState(
        request.workflowState,
        query,
        parsedData.analysisSummary,
        0.9,
        parsedData // Pass the full JSON to be saved as context
      );

      return {
        message: assistantMessage,
        sduiPage,
        nextState,
        traceId,
      };
    } catch (error) {
      logger.error("Agent Error:", error instanceof Error ? error : new Error(String(error)));
      // Fallback SDUI if API fails
      return {
        message: {
          role: "assistant",
          content: "Error processing request",
          timestamp: Date.now(),
        } as any,
        sduiPage: this.getErrorSDUI(),
        nextState: request.workflowState,
        traceId,
      };
    }
  }

  // --- Transformation Layer ---
  // Converts the clean AI JSON into our robust Component Schema
  private transformToSDUI(
    data: AIResponseSchema,
    workflowState: WorkflowState,
    traceId: string,
    sessionId: string
  ): SDUIPageDefinition {
    return {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "TextBlock", // Using TextBlock for summary
          version: 1,
          props: {
            text: `### Strategy: ${data.identifiedIndustry}\n\n${data.analysisSummary}`,
            className: "mb-6 prose dark:prose-invert",
          },
        },
        {
          type: "layout",
          layout: "Grid",
          props: { columns: 2, gap: 4, className: "mb-6" },
          children: data.keyMetrics.map((m: any, _i: number) => ({
            type: "component",
            component: "MetricBadge", // Using MetricBadge mapping
            version: 1,
            props: {
              label: m.label,
              value: m.value,
              trend: m.trend,
              color: m.trend === "up" ? "green" : "red",
            },
          })),
        },
        {
          type: "component",
          component: "TextBlock",
          version: 1,
          props: {
            text: "**Strategic Value Hypotheses**",
            className: "text-lg font-semibold mb-4 mt-2",
          },
        },
        {
          type: "layout",
          layout: "Grid", // Stack via 1 col grid
          props: { columns: 1, gap: 4 },
          children: data.valueHypotheses.map((h: any, i: number) => ({
            type: "component",
            component: "ValueHypothesisCard",
            version: 1,
            props: {
              hypothesis: {
                id: `hypo-${i}`,
                title: h.title,
                description: h.description,
                confidence: h.confidence,
                source: "AI Model",
                kpiImpact: h.impact,
              },
            },
          })),
        },
      ],
      metadata: {
        case_id: workflowState.context.caseId as string,
        session_id: sessionId,
        trace_id: traceId,
        generated_at: Date.now(),
        priority: "high",
      },
    };
  }

  private getErrorSDUI(): SDUIPageDefinition {
    return {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "AgentResponseCard",
          version: 1,
          props: {
            response: {
              id: "err",
              agentId: "sys",
              agentName: "System",
              timestamp: new Date().toISOString(),
              content:
                "I could not reach the intelligence engine. Please check your connection or API key.",
              status: "error",
              confidence: 0,
              reasoning: [],
            },
            showActions: false,
          },
        },
      ],
      metadata: {},
    };
  }

  /**
   * Build system prompt based on current stage with relevant examples
   */
  /**
   * Build system prompt based on current stage with relevant examples
   */
  private buildSystemPrompt(
    state: WorkflowState,
    query?: string,
    contextPrompt?: string
  ): string {
    const stageContext = {
      opportunity:
        "Focus on discovering pain points, understanding the customer context, and identifying potential value drivers.",
      target:
        "Focus on building quantifiable ROI models, setting realistic targets, and creating compelling business cases.",
      realization:
        "Focus on tracking actual results against targets, explaining variances, and documenting achieved value.",
      expansion:
        "Focus on identifying upsell opportunities, new use cases, and additional value that can be realized.",
    };

    const stage = state.currentStage as LifecycleStage;
    const stagePrompt = stageContext[stage] || stageContext.opportunity;

    // Get industry from context if available
    const industry = state.context?.industry as string | undefined;

    // Build prompt with relevant examples for better few-shot guidance
    const basePrompt = query
      ? buildPromptWithExamples(query, industry)
      : SYSTEM_PROMPT;

    // Combine Base + Context + Stage
    return `${basePrompt}

${contextPrompt || ""}

Current Stage: ${state.currentStage}
${stagePrompt}`;
  }

  /**
   * Get agent name based on stage
   */
  private getAgentName(stage: string): string {
    const agents: Record<string, string> = {
      opportunity: "Opportunity Agent",
      target: "Target Agent",
      realization: "Realization Agent",
      expansion: "Expansion Agent",
    };
    return agents[stage] || "Value Agent";
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
    const lowConfidenceIndicators = [
      "might",
      "could be",
      "possibly",
      "uncertain",
      "not sure",
    ];
    const highConfidenceIndicators = [
      "definitely",
      "certainly",
      "clearly",
      "based on data",
      "evidence shows",
    ];

    const lowerContent = rawContent.toLowerCase();

    if (highConfidenceIndicators.some((ind) => lowerContent.includes(ind))) {
      confidence = 0.9;
    } else if (
      lowConfidenceIndicators.some((ind) => lowerContent.includes(ind))
    ) {
      confidence = 0.5;
    }

    // Extract reasoning if present (look for numbered lists or bullet points)
    const lines = rawContent.split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (/^[\d•\-\*]\s*\.?\s*/.test(trimmed) && trimmed.length > 10) {
        reasoning.push(trimmed.replace(/^[\d•\-\*]\s*\.?\s*/, ""));
      }
    });

    // If no explicit reasoning found, generate from key sentences
    if (reasoning.length === 0) {
      const sentences = rawContent
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 20);
      reasoning.push(...sentences.slice(0, 3).map((s) => s.trim()));
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
      "revenue",
      "income",
      "profit",
      "margin",
      "earnings",
      "financial",
      "roi",
      "cost",
      "savings",
      "benchmark",
      "compare",
      "industry",
      "market",
      "growth",
      "performance",
      "competitor",
      "actual",
      "real",
      "sec",
      "filing",
      "quarterly",
      "annual",
      "fy",
      "q1",
      "q2",
      "q3",
      "q4",
    ];

    const queryLower = query.toLowerCase();
    return dataKeywords.some((keyword) => queryLower.includes(keyword));
  }

  /**
   * Check if query likely needs CRM data lookup
   */
  private queryNeedsCRMData(query: string): boolean {
    const crmKeywords = [
      "deal",
      "opportunity",
      "pipeline",
      "salesforce",
      "hubspot",
      "crm",
      "contact",
      "stakeholder",
      "decision maker",
      "champion",
      "buyer",
      "account",
      "prospect",
      "lead",
      "customer",
      "activity",
      "email",
      "call",
      "meeting",
      "last contact",
      "close date",
      "stage",
      "probability",
      "forecast",
      "find the",
      "look up",
      "search for",
      "get the",
      "show me",
      "who is",
      "when was",
      "what is the status",
    ];

    const queryLower = query.toLowerCase();
    return crmKeywords.some((keyword) => queryLower.includes(keyword));
  }

  /**
   * Generate SDUI page from response
   *
   * Phase 3: Refactored to use stage-specific templates
   * Maintains backward compatibility with fallback to generic page
   */
  private generateSDUIPage(
    content: string,
    confidence: number,
    reasoning: string[],
    state: WorkflowState,
    sessionId?: string,
    traceId?: string
  ): SDUIPageDefinition {
    const stage = state.currentStage as LifecycleStage;

    // Use stage-specific template if available
    if (hasTemplateForStage(stage)) {
      logger.debug("Using stage-specific template", { stage });

      return generateChatSDUIPage(stage, {
        content,
        confidence,
        reasoning,
        workflowState: state,
        sessionId,
        traceId,
      });
    }

    // Fallback to generic template for backward compatibility
    logger.warn("No template found for stage, using fallback", { stage });

    return {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "AgentResponseCard",
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
                confidence: confidence - i * 0.05,
              })),
              status: "pending" as const,
            },
            showReasoning: true,
            showActions: true,
          },
        },
      ],
      metadata: {
        lifecycle_stage: state.currentStage,
        case_id: state.context.caseId as string,
        session_id: sessionId,
        generated_at: Date.now(),
        agent_name: this.getAgentName(state.currentStage),
        confidence_score: confidence,
        telemetry_enabled: true,
        trace_id: traceId,
      },
    };
  }

  /**
   * Update workflow state based on conversation
   *
   * Uses chatWorkflowConfig for stage transition logic
   */
  private updateWorkflowState(
    currentState: WorkflowState,
    query: string,
    response: string,
    confidence: number,
    analysisData?: any // Phase 5: Capture structured data
  ): WorkflowState {
    const nextState = { ...currentState };

    // Add to conversation history in context
    nextState.context = {
      ...nextState.context,
      lastQuery: query,
      lastResponse: response,
      lastUpdated: new Date().toISOString(),
      // Phase 5: Persist the structured analysis for the Refinement Loop
      ...(analysisData ? { lastAnalysis: analysisData } : {}),
    };

    // Check for stage transitions using config
    const transitionStage = checkStageTransition(
      currentState.currentStage as LifecycleStage,
      query,
      response,
      confidence
    );

    if (transitionStage && transitionStage !== currentState.currentStage) {
      logger.info("Stage transition triggered", {
        from: currentState.currentStage,
        to: transitionStage,
        query: query.substring(0, 50),
      });

      // Mark current stage as completed
      if (!currentState.completed_steps?.includes(currentState.currentStage)) {
        nextState.completed_steps = [
          ...(currentState.completed_steps || []),
          currentState.currentStage,
        ];
      }

      // Transition to new stage
      nextState.currentStage = transitionStage;
    }

    return nextState;
  }
}

// Export singleton
export const agentChatService = new AgentChatService();
