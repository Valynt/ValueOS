/**
 * Agent SDUI Adapter
 *
 * Converts agent outputs to SDUI schema updates.
 * This is the bridge between the Agent Fabric and the SDUI system.
 *
 * Intent-Based UI Registry Architecture:
 * - Agents emit "intents" describing what they want to display
 * - IntentRegistry resolves intents to specific React components
 * - This enables adding new agents without modifying this service
 *
 * @see src/types/intent.ts - Intent type definitions
 * @see src/services/IntentRegistry.ts - Intent resolution
 * @see src/services/AgentIntentConverter.ts - Agent output to intent conversion
 */

import { logger } from "@lib/logger";
import { SDUIUpdate } from "../types/sdui-integration";
import { AgentOutput } from "../types/agent-output";
import { AtomicUIAction, createAddAction } from "../sdui/AtomicUIActions";
import { intentRegistry } from "./IntentRegistry";
import { agentIntentConverter } from "./AgentIntentConverter";

/**
 * Agent SDUI Adapter
 */
export class AgentSDUIAdapter {
  /**
   * Process agent output using Intent-Based UI Registry
   *
   * This method converts agent outputs to UI intents, then resolves those
   * intents to specific React components using the IntentRegistry.
   *
   * @param agentId - Unique identifier for the agent
   * @param output - Agent output containing analysis results
   * @param workspaceId - Workspace/case identifier
   * @param tenantId - Optional tenant identifier for custom component resolution
   * @returns SDUI update with atomic UI actions
   */
  async processAgentOutputWithIntents(
    agentId: string,
    output: AgentOutput,
    workspaceId: string,
    tenantId?: string
  ): Promise<SDUIUpdate> {
    logger.info("Processing agent output with intents", {
      agentId,
      agentType: output.agentType,
      workspaceId,
    });

    try {
      // Step 1: Convert agent output to intents
      const intents = agentIntentConverter.convert(
        output as AgentOutput & Record<string, unknown>
      );

      if (intents.length === 0) {
        logger.warn("No intents generated from agent output", {
          agentType: output.agentType,
        });
        return {
          type: "partial_update",
          workspaceId,
          actions: [],
          timestamp: Date.now(),
          source: `agent:${agentId}`,
        };
      }

      // Step 2: Resolve intents to components
      const atomicActions: AtomicUIAction[] = [];

      for (const intent of intents) {
        const resolution = intentRegistry.resolve(intent, tenantId);

        if (resolution.resolved) {
          // Create add action for resolved component
          atomicActions.push(
            createAddAction(
              {
                component: resolution.component,
                props: resolution.props as Record<string, unknown>,
              },
              { append: true },
              `Add ${resolution.component} from ${intent.type} intent`
            )
          );
        } else if (resolution.fallback) {
          // Use fallback component
          atomicActions.push(
            createAddAction(
              {
                component: resolution.fallback,
                props: resolution.props as Record<string, unknown>,
              },
              { append: true },
              `Add fallback ${resolution.fallback} for ${intent.type}`
            )
          );
        }
      }

      logger.info("Generated SDUI update from intents", {
        agentId,
        intentCount: intents.length,
        actionCount: atomicActions.length,
      });

      return {
        type: atomicActions.length > 0 ? "atomic_actions" : "partial_update",
        workspaceId,
        actions: atomicActions,
        timestamp: Date.now(),
        source: `agent:${agentId}`,
      };
    } catch (error) {
      logger.error("Failed to process agent output with intents", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty update on error
      return {
        type: "partial_update",
        workspaceId,
        actions: [],
        timestamp: Date.now(),
        source: `agent:${agentId}`,
      };
    }
  }
}

// Singleton instance
export const agentSDUIAdapter = new AgentSDUIAdapter();
