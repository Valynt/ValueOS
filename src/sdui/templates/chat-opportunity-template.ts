/**
 * Chat Opportunity Stage SDUI Template
 * 
 * Template for rendering agent responses during the Opportunity stage.
 * Focus: Pain point discovery, value hypothesis creation, stakeholder mapping
 * 
 * Phase 3: Stage-specific SDUI generation
 */

import type { SDUIPageDefinition } from '../schema';
import type { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { v4 as uuidv4 } from 'uuid';

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
  
  const sections: SDUIPageDefinition['sections'] = [
    {
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          id: uuidv4(),
          agentId: 'opportunity',
          agentName: 'Opportunity Agent',
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
        stage: 'opportunity',
      },
    },
  ];

  // Add pain point extraction if high confidence
  if (confidence > 0.7) {
    sections.push({
      type: 'component',
      component: 'InsightCard',
      version: 1,
      props: {
        title: 'Discovery Focus Areas',
        description: 'Key areas to explore in this opportunity',
        items: [
          { icon: 'target', label: 'Pain Points', description: 'What challenges is the customer facing?' },
          { icon: 'users', label: 'Stakeholders', description: 'Who are the key decision makers?' },
          { icon: 'trending-up', label: 'Value Metrics', description: 'How do we measure success?' },
        ],
      },
    });
  }

  return {
    type: 'page',
    version: 1,
    sections,
    metadata: {
      lifecycle_stage: 'opportunity',
      case_id: workflowState.context.caseId as string,
      session_id: sessionId,
      generated_at: Date.now(),
      agent_name: 'Opportunity Agent',
      confidence_score: confidence,
      priority: 'normal',
      required_components: ['AgentResponseCard'],
      optional_components: ['InsightCard'],
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
