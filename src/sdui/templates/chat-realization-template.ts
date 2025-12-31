/**
 * Chat Realization Stage SDUI Template
 * 
 * Template for rendering agent responses during the Realization stage.
 * Focus: Value tracking, outcome measurement, success validation
 * 
 * Phase 3: Stage-specific SDUI generation
 */

import type { SDUIPageDefinition } from '../schema';
import type { WorkflowState } from '../../repositories/WorkflowStateRepository';
import { v4 as uuidv4 } from 'uuid';

export interface RealizationTemplateContext {
  content: string;
  confidence: number;
  reasoning: string[];
  workflowState: WorkflowState;
  sessionId?: string;
  traceId?: string;
}

/**
 * Generate Realization stage SDUI page
 * 
 * Components:
 * - AgentResponseCard: Main response with reasoning
 * - ValueTracker: Actual vs. target KPIs
 * - MilestoneTimeline: Progress tracking
 * - RiskIndicators: At-risk value streams
 */
export function generateRealizationPage(context: RealizationTemplateContext): SDUIPageDefinition {
  const { content, confidence, reasoning, workflowState, sessionId, traceId } = context;
  
  const sections: SDUIPageDefinition['sections'] = [
    {
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          id: uuidv4(),
          agentId: 'realization',
          agentName: 'Realization Agent',
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
        stage: 'realization',
      },
    },
  ];

  // Add value tracking insights if high confidence
  if (confidence > 0.7) {
    sections.push({
      type: 'component',
      component: 'InsightCard',
      version: 1,
      props: {
        title: 'Value Realization Focus',
        description: 'Key areas to track and measure',
        items: [
          { icon: 'activity', label: 'KPI Tracking', description: 'Monitor actual vs. target metrics' },
          { icon: 'check-circle', label: 'Milestones', description: 'Track delivery progress' },
          { icon: 'alert-triangle', label: 'Risk Flags', description: 'Identify value at risk' },
          { icon: 'refresh-cw', label: 'Adjustments', description: 'Course corrections needed' },
        ],
      },
    });
  }

  return {
    type: 'page',
    version: 1,
    sections,
    metadata: {
      lifecycle_stage: 'realization',
      case_id: workflowState.context.caseId as string,
      session_id: sessionId,
      generated_at: Date.now(),
      agent_name: 'Realization Agent',
      confidence_score: confidence,
      priority: 'critical', // Actual value tracking is critical
      required_components: ['AgentResponseCard'],
      optional_components: ['InsightCard', 'ValueTracker', 'MilestoneTimeline'],
      accessibility: {
        level: 'AA',
        screen_reader_optimized: true,
        keyboard_navigation: true,
        high_contrast_mode: true, // Important for data viz
      },
      telemetry_enabled: true,
      trace_id: traceId,
    },
  };
}
