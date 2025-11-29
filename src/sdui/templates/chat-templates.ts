/**
 * Chat SDUI Templates Index
 * 
 * Central export for all chat stage-specific SDUI templates.
 * Provides template selection logic based on lifecycle stage.
 * 
 * Phase 3: SDUI Template System
 */

import type { SDUIPageDefinition } from '../schema';
import type { WorkflowState } from '../../repositories/WorkflowStateRepository';
import type { LifecycleStage } from '../../types/vos';

import { generateOpportunityPage, type OpportunityTemplateContext } from './chat-opportunity-template';
import { generateTargetPage, type TargetTemplateContext } from './chat-target-template';
import { generateRealizationPage, type RealizationTemplateContext } from './chat-realization-template';
import { generateExpansionPage, type ExpansionTemplateContext } from './chat-expansion-template';

/**
 * Common template context for all stages
 */
export interface ChatTemplateContext {
  content: string;
  confidence: number;
  reasoning: string[];
  workflowState: WorkflowState;
  sessionId?: string;
  traceId?: string;
}

/**
 * Template generator function type
 */
export type TemplateGenerator = (context: ChatTemplateContext) => SDUIPageDefinition;

/**
 * Template registry mapping lifecycle stages to generators
 */
export const CHAT_TEMPLATES: Record<LifecycleStage, TemplateGenerator> = {
  opportunity: generateOpportunityPage,
  target: generateTargetPage,
  realization: generateRealizationPage,
  expansion: generateExpansionPage,
};

/**
 * Generate SDUI page using stage-specific template
 * 
 * @param stage Lifecycle stage
 * @param context Template context
 * @returns Generated SDUI page definition
 */
export function generateChatSDUIPage(
  stage: LifecycleStage,
  context: ChatTemplateContext
): SDUIPageDefinition {
  const generator = CHAT_TEMPLATES[stage];
  
  if (!generator) {
    throw new Error(`No template found for stage: ${stage}`);
  }

  return generator(context);
}

/**
 * Check if template exists for stage
 */
export function hasTemplateForStage(stage: string): stage is LifecycleStage {
  return stage in CHAT_TEMPLATES;
}

/**
 * Get all available template stages
 */
export function getAvailableStages(): LifecycleStage[] {
  return Object.keys(CHAT_TEMPLATES) as LifecycleStage[];
}
