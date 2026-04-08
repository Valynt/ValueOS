/**
 * IntegrationAssistantAgent
 *
 * AI agent for parsing natural language integration intents and guiding users
 * through the integration setup wizard. Provides intelligent entity extraction
 * and next-step recommendations.
 *
 * Sprint 1: Agent scaffold for AI-enhanced integrations.
 */

import { z } from "zod";

import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";
import { BaseAgent } from "./BaseAgent.js";

// ---------------------------------------------------------------------------
// Types and Schemas
// ---------------------------------------------------------------------------

export type IntegrationIntentType =
  | "connect"
  | "configure"
  | "test"
  | "diagnose"
  | "disconnect"
  | "unknown";

export interface IntegrationIntent {
  intent: IntegrationIntentType;
  provider?: string;
  entities: {
    provider?: string;
    instanceUrl?: string;
    emailDomain?: string;
    scope?: string;
  };
  confidence: number;
  suggestedActions: string[];
  rawInput: string;
}

export interface ProviderDiscoverySuggestion {
  provider: string;
  url: string;
  confidence: number;
  reasoning: string;
}

// Zod schema for LLM output validation
const IntegrationIntentSchema = z.object({
  intent: z.enum(["connect", "configure", "test", "diagnose", "disconnect", "unknown"]),
  provider: z.string().optional(),
  entities: z.object({
    provider: z.string().optional(),
    instanceUrl: z.string().optional(),
    emailDomain: z.string().optional(),
    scope: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1),
  suggestedActions: z.array(z.string()),
});

const ProviderDiscoverySchema = z.object({
  suggestions: z.array(
    z.object({
      provider: z.string(),
      url: z.string(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    })
  ),
});

// Input schemas for agent execution
const ParseIntentInputSchema = z.object({
  userInput: z.string().min(1),
  currentProvider: z.string().optional(),
  tenantContext: z.object({
    emailDomain: z.string().optional(),
    existingProviders: z.array(z.string()).optional(),
  }).optional(),
});

const DiscoverProvidersInputSchema = z.object({
  emailDomain: z.string(),
  knownProviders: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Agent Implementation
// ---------------------------------------------------------------------------

export class IntegrationAssistantAgent extends BaseAgent {
  public override readonly version = "1.0.0";
  public override readonly lifecycleStage = "expansion";
  public override readonly agentType = "integration-assistant";

  constructor(
    config: AgentConfig,
    organizationId: string,
    memorySystem: MemorySystem,
    llmGateway: LLMGateway,
    circuitBreaker: CircuitBreaker
  ) {
    super(config, organizationId, memorySystem, llmGateway, circuitBreaker);
  }

  /**
   * Validate input context for integration assistant execution.
   */
  override async validateInput(context: LifecycleContext): Promise<boolean> {
    const baseValid = await super.validateInput(context);
    if (!baseValid) return false;

    const { user_inputs } = context;
    if (!user_inputs) {
      this.logValidationError("Missing user_inputs in context");
      return false;
    }

    // Check for required action type
    const action = user_inputs.action as string | undefined;
    if (!action) {
      this.logValidationError("Missing action in user_inputs");
      return false;
    }

    // Validate action type
    const validActions = ["parse_intent", "discover_providers", "get_wizard_step"];
    if (!validActions.includes(action)) {
      this.logValidationError(`Invalid action: ${action}. Expected one of: ${validActions.join(", ")}`);
      return false;
    }

    return true;
  }

  /**
   * Main execution entry point required by BaseAgent.
   * Routes to appropriate handler based on action type.
   */
  async _execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const action = context.user_inputs?.action as string;

    try {
      switch (action) {
        case "parse_intent":
          return await this.handleParseIntent(context, startTime);
        case "discover_providers":
          return await this.handleDiscoverProviders(context, startTime);
        case "get_wizard_step":
          return await this.handleGetWizardStep(context, startTime);
        default:
          return this.buildOutput(
            { error: `Unhandled action: ${action}` },
            "failure",
            "low",
            startTime
          );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.buildOutput(
        { error: errorMessage },
        "failure",
        "low",
        startTime,
        { reasoning: `Execution failed: ${errorMessage}` }
      );
    }
  }

  /**
   * Parse natural language intent into structured action.
   */
  async parseIntent(
    userInput: string,
    context?: {
      currentProvider?: string;
      emailDomain?: string;
      existingProviders?: string[];
    }
  ): Promise<IntegrationIntent> {
    const sessionId = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const prompt = this.buildIntentParsingPrompt(userInput, context);

    const result = await this.secureInvoke(
      sessionId,
      prompt,
      IntegrationIntentSchema,
      {
        userId: this.organizationId,
        context: {
          action: "parse_intent",
          input_length: userInput.length,
        },
      }
    );

    return {
      intent: result.intent,
      provider: result.provider,
      entities: result.entities,
      confidence: result.confidence,
      suggestedActions: result.suggestedActions,
      rawInput: userInput,
    };
  }

  /**
   * Discover potential CRM organizations from email domain.
   */
  async discoverProviders(
    emailDomain: string,
    knownProviders?: string[]
  ): Promise<ProviderDiscoverySuggestion[]> {
    const sessionId = `discovery_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const prompt = this.buildDiscoveryPrompt(emailDomain, knownProviders);

    const result = await this.secureInvoke(
      sessionId,
      prompt,
      ProviderDiscoverySchema,
      {
        userId: this.organizationId,
        context: {
          action: "discover_providers",
          email_domain: emailDomain,
        },
      }
    );

    return result.suggestions;
  }

  /**
   * Get next wizard step based on current state and intent.
   */
  async getWizardStep(
    currentStep: string,
    intent: IntegrationIntent,
    formData?: Record<string, unknown>
  ): Promise<{
    nextStep: string;
    prefillData: Record<string, unknown>;
    guidance: string;
  }> {
    // Define wizard flow
    const wizardFlow: Record<string, { next: string; prefill: string[] }> = {
      intent: { next: "discovery", prefill: ["provider"] },
      discovery: { next: "credentials", prefill: ["instanceUrl"] },
      credentials: { next: "confirm", prefill: [] },
      confirm: { next: "complete", prefill: [] },
    };

    const flowStep = wizardFlow[currentStep];
    if (!flowStep) {
      return {
        nextStep: "complete",
        prefillData: {},
        guidance: "Wizard complete",
      };
    }

    // Build prefill data from intent entities
    const prefillData: Record<string, unknown> = {};
    for (const key of flowStep.prefill) {
      if (key === "provider" && intent.entities.provider) {
        prefillData.provider = intent.entities.provider;
      }
      if (key === "instanceUrl" && intent.entities.instanceUrl) {
        prefillData.instanceUrl = intent.entities.instanceUrl;
      }
    }

    // Generate guidance based on intent
    const guidance = this.generateStepGuidance(currentStep, intent);

    return {
      nextStep: flowStep.next,
      prefillData,
      guidance,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Handlers
  // ---------------------------------------------------------------------------

  private async handleParseIntent(
    context: LifecycleContext,
    startTime: number
  ): Promise<AgentOutput> {
    const validation = ParseIntentInputSchema.safeParse(context.user_inputs);
    if (!validation.success) {
      return this.buildOutput(
        { error: "Invalid parse_intent input", details: validation.error.errors },
        "failure",
        "low",
        startTime
      );
    }

    const { userInput, currentProvider, tenantContext } = validation.data;

    const intent = await this.parseIntent(userInput, {
      currentProvider,
      emailDomain: tenantContext?.emailDomain,
      existingProviders: tenantContext?.existingProviders,
    });

    return this.buildOutput(
      { intent },
      "success",
      this.toConfidenceLevel(intent.confidence),
      startTime,
      {
        reasoning: `Parsed intent: ${intent.intent} for provider: ${intent.provider || "unknown"}`,
        suggested_next_actions: intent.suggestedActions,
      }
    );
  }

  private async handleDiscoverProviders(
    context: LifecycleContext,
    startTime: number
  ): Promise<AgentOutput> {
    const validation = DiscoverProvidersInputSchema.safeParse(context.user_inputs);
    if (!validation.success) {
      return this.buildOutput(
        { error: "Invalid discover_providers input", details: validation.error.errors },
        "failure",
        "low",
        startTime
      );
    }

    const { emailDomain, knownProviders } = validation.data;

    const suggestions = await this.discoverProviders(emailDomain, knownProviders);

    return this.buildOutput(
      { suggestions },
      "success",
      suggestions.length > 0 ? "high" : "medium",
      startTime,
      {
        reasoning: `Discovered ${suggestions.length} potential CRM instances for domain ${emailDomain}`,
      }
    );
  }

  private async handleGetWizardStep(
    context: LifecycleContext,
    startTime: number
  ): Promise<AgentOutput> {
    const { currentStep, intent, formData } = context.user_inputs as {
      currentStep: string;
      intent: IntegrationIntent;
      formData?: Record<string, unknown>;
    };

    if (!currentStep || !intent) {
      return this.buildOutput(
        { error: "Missing currentStep or intent in user_inputs" },
        "failure",
        "low",
        startTime
      );
    }

    const wizardStep = await this.getWizardStep(currentStep, intent, formData);

    return this.buildOutput(
      { wizardStep },
      "success",
      "high",
      startTime,
      {
        reasoning: `Progressed wizard from ${currentStep} to ${wizardStep.nextStep}`,
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Prompt Builders
  // ---------------------------------------------------------------------------

  private buildIntentParsingPrompt(
    userInput: string,
    context?: {
      currentProvider?: string;
      emailDomain?: string;
      existingProviders?: string[];
    }
  ): string {
    return `Parse the following user input into a structured integration intent.

User input: "${userInput}"

${context?.currentProvider ? `Current provider context: ${context.currentProvider}` : ""}
${context?.emailDomain ? `User email domain: ${context.emailDomain}` : ""}
${context?.existingProviders?.length ? `Existing integrations: ${context.existingProviders.join(", ")}` : ""}

Available integration providers: hubspot, salesforce, servicenow, sharepoint, slack

Analyze the input and extract:
1. The primary intent (connect, configure, test, diagnose, disconnect, or unknown)
2. Any mentioned provider
3. Key entities: instance URL, email domain, scope/permissions mentioned
4. Confidence score (0-1)
5. Suggested next actions for the user

Respond in JSON format matching this schema:
{
  "intent": "connect|configure|test|diagnose|disconnect|unknown",
  "provider": "provider name or undefined",
  "entities": {
    "provider": "extracted provider or undefined",
    "instanceUrl": "URL if mentioned or undefined",
    "emailDomain": "domain if mentioned or undefined",
    "scope": "scope/permissions if mentioned or undefined"
  },
  "confidence": 0.0-1.0,
  "suggestedActions": ["action 1", "action 2"]
}

Guidelines:
- "connect" intent: user wants to set up a new integration
- "configure" intent: user wants to modify existing integration settings
- "test" intent: user wants to verify connection is working
- "diagnose" intent: user is experiencing issues and wants help
- "disconnect" intent: user wants to remove an integration
- Map common terms: "hook up", "link", "integrate" → "connect"
- Map "salesforce sandbox" → provider: "salesforce" with instanceUrl pattern detection`;
  }

  private buildDiscoveryPrompt(emailDomain: string, knownProviders?: string[]): string {
    return `Given a user's email domain, suggest likely CRM instance URLs they might want to connect.

Email domain: "${emailDomain}"
${knownProviders?.length ? `Already known to use: ${knownProviders.join(", ")}` : ""}

Common patterns:
- HubSpot: Usually no instance URL needed (oauth-based)
- Salesforce: https://[company].my.salesforce.com or https://[company]--[sandbox].sandbox.my.salesforce.com
- ServiceNow: https://[company].service-now.com

Respond in JSON format:
{
  "suggestions": [
    {
      "provider": "provider name",
      "url": "suggested URL or empty string",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}

Only suggest providers that match the domain context. If the domain is clearly a consumer domain (gmail.com, yahoo.com, etc.), suggest an empty list with low confidence.`;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private generateStepGuidance(currentStep: string, intent: IntegrationIntent): string {
    const guidanceMap: Record<string, Record<string, string>> = {
      intent: {
        connect: "Great! Let's connect your CRM. I'll help you find the right configuration.",
        configure: "Let's update your integration settings.",
        test: "I'll help you verify your connection is working properly.",
        diagnose: "Let's diagnose the issue with your integration.",
        disconnect: "I'll help you safely disconnect this integration.",
        unknown: "I want to make sure I understand. Are you trying to connect, configure, or troubleshoot an integration?",
      },
      discovery: {
        connect: intent.entities.provider
          ? `I found a potential ${intent.entities.provider} instance. Is this correct?`
          : "What CRM system would you like to connect?",
        default: "Let me check what CRM systems are available.",
      },
      credentials: {
        connect: "Please enter your credentials. These will be encrypted and stored securely.",
        default: "Please review and update your credentials.",
      },
    };

    const stepGuidance = guidanceMap[currentStep];
    if (!stepGuidance) return "Please continue with the setup.";

    return stepGuidance[intent.intent] || stepGuidance.default || stepGuidance.connect || "";
  }

  private logValidationError(message: string): void {
    console.error(`[IntegrationAssistantAgent] Validation error: ${message}`);
  }
}
