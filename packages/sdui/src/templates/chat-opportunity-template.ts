/**
 * Chat Opportunity Stage SDUI Template
 *
 * Template for rendering agent responses during the Opportunity stage.
 * Focus: Pain point discovery, value hypothesis creation, stakeholder mapping
 *
 * Phase 3: Stage-specific SDUI generation
 */

import type { SDUIPageDefinition } from "../schema";
import type { WorkflowState } from "@valueos/sdui-types";
import { v4 as uuidv4 } from "uuid";

export interface OpportunityTemplateContext {
  content: string;
  confidence: number;
  reasoning: string[];
  workflowState: WorkflowState;
  sessionId?: string;
  traceId?: string;
}

/**
 * Generate Opportunity stage SDUI page
 *
 * Components:
 * - AgentResponseCard: Main response with reasoning
 * - PainPointList: Extracted pain points (if any)
 * - StakeholderMap: Key stakeholders mentioned
 * - NextStepsTimeline: Suggested next actions
 */
export function generateOpportunityPage(context: OpportunityTemplateContext): SDUIPageDefinition {
  const { content, confidence, reasoning, workflowState, sessionId, traceId } = context;

  const sections: SDUIPageDefinition["sections"] = [
    {
      type: "component",
      component: "AgentResponseCard",
      version: 1,
      props: {
        response: {
          id: uuidv4(),
          agentId: "opportunity",
          agentName: "Opportunity Agent",
          timestamp: new Date().toISOString(),
          content,
          confidence,
          reasoning: reasoning.map((r, i) => ({
            id: `step-${i}`,
            step: i + 1,
            description: r,
            confidence: Math.max(0.5, confidence - i * 0.05),
          })),
          status: "pending" as const,
        },
        showReasoning: true,
        showActions: true,
        stage: "opportunity",
      },
    },
  ];

  // Heuristic: Extract hypotheses from the text content
  // Looking for patterns like "**Title**: Description" or "1. Title: Description"
  const hypothesisRegex = /(?:^|\n)(?:-|\d+\.)\s+\*\*?([^\*:]+)\*\*?:?\s+(.+)(?:\n|$)/g;
  const hypotheses: any[] = [];
  let match;

  while ((match = hypothesisRegex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      hypotheses.push({
        id: hypotheses.length + 1,
        title: match[1].trim(),
        description: match[2].trim(),
        confidence: Math.round(confidence * 100) - hypotheses.length * 5, // Decay confidence slightly
        source: "AI Inference",
        kpiImpact: "ROI Analysis required",
      });
    }
  }

  // If found, add a section for them
  if (hypotheses.length > 0) {
    hypotheses.forEach((h) => {
      sections.push({
        type: "component",
        component: "ValueHypothesisCard",
        version: 1,
        props: {
          hypothesis: h,
        },
      });
    });
  } else {
    // If no structured hypotheses found but confidence is high, show the discovery insights
    if (confidence > 0.7) {
      sections.push({
        type: "component",
        component: "DiscoveryCard", // Changed to DiscoveryCard which exists
        version: 1,
        props: {
          title: "Discovery Focus Areas",
          prompt: "Key areas to explore in this opportunity based on initial research:",
          questions: [
            "What are the specific pain points identified?",
            "Who are the key decision makers?",
            "How do we measure success?",
          ],
        },
      });
    }
  }

  return {
    type: "page",
    version: 1,
    sections,
    metadata: {
      theme: "dark",
      lifecycle_stage: "opportunity",
      case_id: workflowState.context.caseId as string,
      session_id: sessionId,
      generated_at: Date.now(),
      agent_name: "Opportunity Agent",
      confidence_score: confidence,
      priority: "normal",
      required_components: ["AgentResponseCard"],
      optional_components: ["InsightCard"],
      accessibility: {
        level: "AA",
        screen_reader_optimized: true,
        keyboard_navigation: true,
      },
      telemetry_enabled: true,
      trace_id: traceId,
    },
  };
}
