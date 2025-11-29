/**
 * Chat Expansion Stage SDUI Template
 * 
 * Template for rendering agent responses during the Expansion stage.
 * Focus: Upsell opportunities, cross-sell, additional value streams
 * 
 * Phase 3: Stage-specific SDUI generation
 */

import type { SDUIPageDefinition } from '../schema';
import type { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { v4 as uuidv4 } from 'uuid';

export interface ExpansionTemplateContext {
  content: string;
  confidence: number;
  reasoning: string[];
  workflowState: WorkflowState;
  sessionId?: string;
  traceId?: string;
}

/**
 * Generate Expansion stage SDUI page
 * 
 * Components:
 * - AgentResponseCard: Main response with reasoning
 * - OpportunityMatrix: Upsell/cross-sell mapping
 * - ROIProjection: Expansion value modeling
 * - AccountGrowthPath: Suggested expansion journey
 */
export function generateExpansionPage(context: ExpansionTemplateContext): SDUIPageDefinition {
  const { content, confidence, reasoning, workflowState, sessionId, traceId } = context;
  
  const sections: SDUIPageDefinition['sections'] = [
    {
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          id: uuidv4(),
          agentId: 'expansion',
          agentName: 'Expansion Agent',
          timestamp: new Date().toISOString(),
          content,
          confidence,
          reasoning: reasoning.map((r, i) => ({
            id: `step-${i}`,
            step: i + 1,
            description: r,
            confidence: Math.max(0.5, confidence - (i * 0.05)),
          })),
          status: 'pending' as const,
        },
        showReasoning: true,
        showActions: true,
        stage: 'expansion',
      },
    },
  ];

  // Add expansion insights if high confidence
  if (confidence > 0.7) {
    sections.push({
      type: 'component',
      component: 'InsightCard',
      version: 1,
      props: {
        title: 'Growth Opportunities',
        description: 'Paths to expand value and engagement',
        items: [
          { icon: 'arrow-up-circle', label: 'Upsell', description: 'Higher tier or additional capacity' },
          { icon: 'grid', label: 'Cross-Sell', description: 'Complementary products or services' },
          { icon: 'users', label: 'Expand Users', description: 'Additional departments or teams' },
          { icon: 'globe', label: 'New Regions', description: 'Geographic expansion opportunities' },
        ],
      },
    });
  }

  return {
    type: 'page',
    version: 1,
    sections,
    metadata: {
      lifecycle_stage: 'expansion',
      case_id: workflowState.context.caseId as string,
      session_id: sessionId,
      generated_at: Date.now(),
      agent_name: 'Expansion Agent',
      confidence_score: confidence,
      priority: 'high', // Growth opportunities are high priority
      required_components: ['AgentResponseCard'],
      optional_components: ['InsightCard', 'OpportunityMatrix', 'ROIProjection'],
      accessibility: {
        level: 'AA',
        screen_reader_optimized: true,
        keyboard_navigation: true,
      },
      telemetry_enabled: true,
      trace_id: traceId,
    },
  };
}
