/**
 * Communicator Agent
 *
 * Handles stakeholder communication, messaging, and adaptive communication strategies
 * using Multi-Agent Reinforcement Learning (MARL) for optimizing communication effectiveness.
 */

import {
  BaseAgent,
  MARLState,
  MARLAction,
  MARLInteraction,
  MARLRewardFunction,
  MARLPolicy,
} from "../BaseAgent";
import { AgentRequest, AgentResponse } from "../../../services/agents/core/IAgent";
import { AgentConfig, AgentType, ConfidenceLevel } from "../../../services/agent-types";

export interface CommunicationContext {
  stakeholderId: string;
  stakeholderType: "customer" | "partner" | "internal" | "investor" | "regulator";
  communicationChannel: "email" | "meeting" | "presentation" | "report" | "chat" | "phone";
  communicationGoal: "inform" | "persuade" | "negotiate" | "collaborate" | "resolve";
  urgency: "low" | "medium" | "high" | "critical";
  previousInteractions: CommunicationRecord[];
  stakeholderPreferences: Record<string, any>;
}

export interface CommunicationRecord {
  id: string;
  timestamp: number;
  channel: string;
  content: string;
  response?: string;
  effectiveness: number; // 0-1
  feedback?: string;
}

export interface CommunicationStrategy {
  strategyId: string;
  stakeholderId: string;
  approach: "direct" | "collaborative" | "persuasive" | "educational" | "consultative";
  tone: "formal" | "casual" | "enthusiastic" | "empathetic" | "authoritative";
  timing: "immediate" | "scheduled" | "follow_up";
  channels: string[];
  keyMessages: string[];
  expectedOutcomes: string[];
  confidence: number; // 0-1
}

export class CommunicatorAgent extends BaseAgent {
  private communicationHistory: CommunicationRecord[] = [];
  private stakeholderProfiles: Map<string, any> = new Map();

  constructor(config: AgentConfig) {
    super(config);
    this.initializeMARL();
  }

  getAgentType(): AgentType {
    return "communicator";
  }

  getCapabilities(): string[] {
    return [
      "stakeholder_communication",
      "message_crafting",
      "communication_strategy",
      "feedback_analysis",
      "adaptive_messaging",
      "channel_optimization",
    ];
  }

  async execute(
    sessionId: string,
    input: any,
    context?: Record<string, any>
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Extract communication context
      const commContext = this.extractCommunicationContext(input);

      // Generate communication strategy using MARL
      const strategy = await this.generateCommunicationStrategy(sessionId, commContext);

      // Craft message based on strategy
      const message = await this.craftMessage(strategy, commContext);

      // Store communication record
      await this.storeCommunicationRecord({
        id: `${sessionId}-${Date.now()}`,
        timestamp: Date.now(),
        channel: commContext.communicationChannel,
        content: message,
        effectiveness: strategy.confidence,
      });

      // Update MARL policy if enabled
      if (this.isMARLEnabled()) {
        await this.updateMARLFromCommunication(strategy, commContext);
      }

      return this.createResponse(
        true,
        {
          strategy,
          message,
          recommendations: this.generateCommunicationRecommendations(strategy, commContext),
        },
        strategy.confidence >= 0.8 ? "high" : strategy.confidence >= 0.6 ? "medium" : "low",
        [`Generated communication strategy with ${strategy.confidence.toFixed(2)} confidence`],
        {
          executionTime: Date.now() - startTime,
        }
      );
    } catch (error) {
      return this.handleError(error as Error, "Communication strategy generation failed");
    }
  }

  private extractCommunicationContext(input: any): CommunicationContext {
    return {
      stakeholderId: input.stakeholderId || "unknown",
      stakeholderType: input.stakeholderType || "customer",
      communicationChannel: input.communicationChannel || "email",
      communicationGoal: input.communicationGoal || "inform",
      urgency: input.urgency || "medium",
      previousInteractions: input.previousInteractions || [],
      stakeholderPreferences: input.stakeholderPreferences || {},
    };
  }

  private async generateCommunicationStrategy(
    sessionId: string,
    context: CommunicationContext
  ): Promise<CommunicationStrategy> {
    // Use MARL for strategy selection if enabled
    if (this.isMARLEnabled()) {
      const marlState: MARLState = {
        sessionId,
        agentStates: {
          [this.agentId]: {
            context,
            history: this.communicationHistory.slice(-5),
          },
        },
        sharedContext: { sessionId, context },
        interactionHistory: this.getMARLHistory(),
        timestamp: Date.now(),
      };

      const marlAction = await this.selectMARLAction(marlState);
      if (marlAction) {
        return this.actionToStrategy(marlAction, context);
      }
    }

    // Fallback to rule-based strategy generation
    return this.generateRuleBasedStrategy(context);
  }

  private generateRuleBasedStrategy(context: CommunicationContext): CommunicationStrategy {
    const strategy: CommunicationStrategy = {
      strategyId: `strat-${Date.now()}`,
      stakeholderId: context.stakeholderId,
      approach: this.selectApproach(context),
      tone: this.selectTone(context),
      timing: this.selectTiming(context),
      channels: [context.communicationChannel],
      keyMessages: this.generateKeyMessages(context),
      expectedOutcomes: this.generateExpectedOutcomes(context),
      confidence: 0.7, // Base confidence for rule-based approach
    };

    return strategy;
  }

  private selectApproach(context: CommunicationContext): CommunicationStrategy["approach"] {
    const approachMap = {
      inform: "direct" as const,
      persuade: "persuasive" as const,
      negotiate: "consultative" as const,
      collaborate: "collaborative" as const,
      resolve: "empathetic" as const,
    };
    return approachMap[context.communicationGoal] || "direct";
  }

  private selectTone(context: CommunicationContext): CommunicationStrategy["tone"] {
    const toneMap = {
      customer: "empathetic" as const,
      partner: "collaborative" as const,
      internal: "casual" as const,
      investor: "formal" as const,
      regulator: "formal" as const,
    };
    return toneMap[context.stakeholderType] || "formal";
  }

  private selectTiming(context: CommunicationContext): CommunicationStrategy["timing"] {
    const timingMap = {
      critical: "immediate" as const,
      high: "immediate" as const,
      medium: "scheduled" as const,
      low: "follow_up" as const,
    };
    return timingMap[context.urgency] || "scheduled";
  }

  private generateKeyMessages(context: CommunicationContext): string[] {
    // Generate key messages based on context
    const messages = [
      `Regarding our ${context.communicationGoal} discussion...`,
      "I wanted to provide an update on the current situation.",
      "Based on our previous interactions, here's what we've accomplished.",
    ];

    // Add goal-specific messages
    switch (context.communicationGoal) {
      case "persuade":
        messages.push("I believe this approach will deliver significant value.");
        break;
      case "negotiate":
        messages.push("Let's work together to find a mutually beneficial solution.");
        break;
      case "collaborate":
        messages.push("I'm excited about our partnership and future collaboration.");
        break;
    }

    return messages;
  }

  private generateExpectedOutcomes(context: CommunicationContext): string[] {
    const outcomes = ["Clear communication delivered"];

    switch (context.communicationGoal) {
      case "inform":
        outcomes.push("Stakeholder understands the information provided");
        break;
      case "persuade":
        outcomes.push("Stakeholder considers the proposed approach");
        break;
      case "negotiate":
        outcomes.push("Progress made toward agreement");
        break;
      case "collaborate":
        outcomes.push("Joint action items identified");
        break;
      case "resolve":
        outcomes.push("Issue addressed and resolved");
        break;
    }

    return outcomes;
  }

  private async craftMessage(
    strategy: CommunicationStrategy,
    context: CommunicationContext
  ): Promise<string> {
    // Use LLM to craft the actual message based on strategy
    const prompt = `Craft a ${strategy.tone} ${strategy.approach} message for a ${context.stakeholderType} stakeholder.

Communication Goal: ${context.communicationGoal}
Channel: ${context.communicationChannel}
Urgency: ${context.urgency}

Key Messages:
${strategy.keyMessages.map((msg) => `- ${msg}`).join("\n")}

Expected Outcomes:
${strategy.expectedOutcomes.map((outcome) => `- ${outcome}`).join("\n")}

Please craft a professional, effective message that achieves the communication goal.`;

    // Note: In a real implementation, this would call the LLM gateway
    // For now, return a placeholder
    return `Dear Stakeholder,

${strategy.keyMessages[0]}

${strategy.keyMessages.slice(1).join(" ")}

Best regards,
ValueOS Communicator Agent`;
  }

  private generateCommunicationRecommendations(
    strategy: CommunicationStrategy,
    context: CommunicationContext
  ): string[] {
    const recommendations = [
      `Use ${strategy.tone} tone for best engagement`,
      `Follow up within ${this.getFollowUpTimeframe(context.urgency)}`,
    ];

    if (strategy.confidence < 0.8) {
      recommendations.push("Consider gathering more stakeholder information for improved strategy");
    }

    if (context.previousInteractions.length > 0) {
      recommendations.push("Reference previous interactions to build continuity");
    }

    return recommendations;
  }

  private getFollowUpTimeframe(urgency: string): string {
    const timeframes = {
      critical: "1 hour",
      high: "24 hours",
      medium: "3-5 days",
      low: "1-2 weeks",
    };
    return timeframes[urgency as keyof typeof timeframes] || "3-5 days";
  }

  private async storeCommunicationRecord(record: CommunicationRecord): Promise<void> {
    this.communicationHistory.push(record);

    // Limit history size
    if (this.communicationHistory.length > 1000) {
      this.communicationHistory = this.communicationHistory.slice(-500);
    }

    // Update stakeholder profile
    this.updateStakeholderProfile(record);
  }

  private updateStakeholderProfile(record: CommunicationRecord): void {
    // Simple profile update - in real implementation, this would be more sophisticated
    const profile = this.stakeholderProfiles.get(record.id) || {};
    profile.lastInteraction = record.timestamp;
    profile.totalInteractions = (profile.totalInteractions || 0) + 1;
    profile.averageEffectiveness = record.effectiveness;
    this.stakeholderProfiles.set(record.id, profile);
  }

  private async updateMARLFromCommunication(
    strategy: CommunicationStrategy,
    context: CommunicationContext
  ): Promise<void> {
    // Create MARL interaction record for learning
    const interaction: MARLInteraction = {
      interactionId: `comm-${Date.now()}`,
      state: {
        sessionId: "current",
        agentStates: { [this.agentId]: { strategy, context } },
        sharedContext: { strategy, context },
        interactionHistory: [],
        timestamp: Date.now(),
      },
      actions: [
        {
          agentId: this.agentId,
          actionType: "generate_strategy",
          parameters: { strategy, context },
          confidence: strategy.confidence,
          timestamp: Date.now(),
        },
      ],
      rewards: { [this.agentId]: strategy.confidence }, // Reward based on confidence
      nextState: {
        sessionId: "current",
        agentStates: { [this.agentId]: { strategy, context, completed: true } },
        sharedContext: { strategy, context, completed: true },
        interactionHistory: [],
        timestamp: Date.now() + 1,
      },
      timestamp: Date.now(),
    };

    await this.updateMARLPolicy(interaction);
  }

  private actionToStrategy(
    action: MARLAction,
    context: CommunicationContext
  ): CommunicationStrategy {
    // Convert MARL action to communication strategy
    return {
      strategyId: `marl-${action.timestamp}`,
      stakeholderId: context.stakeholderId,
      approach: action.parameters.approach || "direct",
      tone: action.parameters.tone || "formal",
      timing: action.parameters.timing || "scheduled",
      channels: action.parameters.channels || [context.communicationChannel],
      keyMessages: action.parameters.keyMessages || [],
      expectedOutcomes: action.parameters.expectedOutcomes || [],
      confidence: action.confidence,
    };
  }

  private initializeMARL(): void {
    // Initialize MARL components
    const rewardFunction: MARLRewardFunction = {
      calculateReward: (state, action, nextState, agentId) => {
        // Reward based on communication effectiveness and stakeholder feedback
        const baseReward = action.confidence * 0.5;
        const contextReward = state.sharedContext.context?.urgency === "high" ? 0.2 : 0.1;
        return baseReward + contextReward;
      },
    };

    const policy: MARLPolicy = {
      selectAction: async (state, agentId) => {
        // Simple policy - in real implementation, this would use learned models
        const context = state.sharedContext.context as CommunicationContext;
        return {
          agentId,
          actionType: "generate_strategy",
          parameters: {
            approach: this.selectApproach(context),
            tone: this.selectTone(context),
            timing: this.selectTiming(context),
          },
          confidence: 0.8,
          timestamp: Date.now(),
        };
      },
      updatePolicy: async (interaction) => {
        // Policy update logic would go here
        this.logger.info("MARL policy updated", { interactionId: interaction.interactionId });
      },
    };

    this.enableMARL(policy, rewardFunction);
  }
}
