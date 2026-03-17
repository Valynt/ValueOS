/**
 * Chat Workflow Configuration
 * 
 * Defines stage transition rules for the chat-driven workflow.
 * Extracted from AgentChatService for maintainability and testability.
 * 
 * Architecture: Declarative configuration over imperative logic
 */

import type { LifecycleStage } from '../types/vos';

/**
 * Stage transition trigger
 */
export interface StageTransitionTrigger {
  /** Keywords in user query that trigger transition */
  queryKeywords: string[];
  /** Keywords in agent response that trigger transition */
  responseKeywords: string[];
  /** Minimum confidence to auto-transition (optional) */
  minConfidence?: number;
}

/**
 * Stage configuration
 */
export interface StageConfig {
  /** Stage identifier */
  stage: LifecycleStage;
  /** Display name */
  displayName: string;
  /** Description */
  description: string;
  /** Possible next stages */
  nextStages: LifecycleStage[];
  /** Transition triggers per next stage */
  transitions: Record<LifecycleStage, StageTransitionTrigger>;
}

/**
 * Chat Workflow Stages Configuration
 * 
 * Maps each lifecycle stage to its:
 * - Allowed next stages
 * - Transition triggers (keywords, phrases)
 */
export const CHAT_WORKFLOW_STAGES: Record<LifecycleStage, StageConfig> = {
  discovery: {
    stage: 'discovery',
    displayName: 'Discovery',
    description: 'Discover pain points, identify KPIs, create value hypotheses',
    nextStages: ['drafting'],
    transitions: {
      drafting: {
        queryKeywords: [
          'roi',
          'business case',
          'value model',
          'cost benefit',
          'financial analysis',
          'quantify',
          'calculate savings',
          'build case',
        ],
        responseKeywords: [
          'ready to draft',
          'move to drafting',
          'build roi model',
          'create business case',
          'quantify value',
        ],
        minConfidence: 0.7,
      },
      discovery: { queryKeywords: [], responseKeywords: [] },
      validating: { queryKeywords: [], responseKeywords: [] },
      composing: { queryKeywords: [], responseKeywords: [] },
      refining: { queryKeywords: [], responseKeywords: [] },
      realized: { queryKeywords: [], responseKeywords: [] },
      expansion: { queryKeywords: [], responseKeywords: [] },
    },
  },

  drafting: {
    stage: 'drafting',
    displayName: 'Drafting',
    description: 'Build ROI models, set targets, create business cases',
    nextStages: ['validating'],
    transitions: {
      validating: {
        queryKeywords: [
          'validate',
          'verify',
          'check',
          'review',
          'confirm',
          'integrity',
          'audit',
        ],
        responseKeywords: [
          'ready to validate',
          'validation',
          'verify assumptions',
          'integrity check',
        ],
        minConfidence: 0.7,
      },
      discovery: { queryKeywords: [], responseKeywords: [] },
      drafting: { queryKeywords: [], responseKeywords: [] },
      composing: { queryKeywords: [], responseKeywords: [] },
      refining: { queryKeywords: [], responseKeywords: [] },
      realized: { queryKeywords: [], responseKeywords: [] },
      expansion: { queryKeywords: [], responseKeywords: [] },
    },
  },

  validating: {
    stage: 'validating',
    displayName: 'Validating',
    description: 'Validate assumptions and verify the business case',
    nextStages: ['composing'],
    transitions: {
      composing: {
        queryKeywords: ['narrative', 'story', 'compose', 'write', 'present'],
        responseKeywords: ['ready to compose', 'narrative', 'business story'],
        minConfidence: 0.7,
      },
      discovery: { queryKeywords: [], responseKeywords: [] },
      drafting: { queryKeywords: [], responseKeywords: [] },
      validating: { queryKeywords: [], responseKeywords: [] },
      refining: { queryKeywords: [], responseKeywords: [] },
      realized: { queryKeywords: [], responseKeywords: [] },
      expansion: { queryKeywords: [], responseKeywords: [] },
    },
  },

  composing: {
    stage: 'composing',
    displayName: 'Composing',
    description: 'Compose the business narrative and value case',
    nextStages: ['refining'],
    transitions: {
      refining: {
        queryKeywords: ['refine', 'improve', 'adjust', 'tweak', 'update'],
        responseKeywords: ['ready to refine', 'refinement', 'adjust narrative'],
        minConfidence: 0.7,
      },
      discovery: { queryKeywords: [], responseKeywords: [] },
      drafting: { queryKeywords: [], responseKeywords: [] },
      validating: { queryKeywords: [], responseKeywords: [] },
      composing: { queryKeywords: [], responseKeywords: [] },
      realized: { queryKeywords: [], responseKeywords: [] },
      expansion: { queryKeywords: [], responseKeywords: [] },
    },
  },

  refining: {
    stage: 'refining',
    displayName: 'Refining',
    description: 'Refine and finalize the value case',
    nextStages: ['realized'],
    transitions: {
      realized: {
        queryKeywords: ['finalize', 'complete', 'done', 'approve', 'sign off'],
        responseKeywords: ['ready to realize', 'finalized', 'approved'],
        minConfidence: 0.7,
      },
      discovery: { queryKeywords: [], responseKeywords: [] },
      drafting: { queryKeywords: [], responseKeywords: [] },
      validating: { queryKeywords: [], responseKeywords: [] },
      composing: { queryKeywords: [], responseKeywords: [] },
      refining: { queryKeywords: [], responseKeywords: [] },
      expansion: { queryKeywords: [], responseKeywords: [] },
    },
  },

  realized: {
    stage: 'realized',
    displayName: 'Realized',
    description: 'Track actual value delivered against targets',
    nextStages: ['expansion'],
    transitions: {
      expansion: {
        queryKeywords: [
          'expand',
          'upsell',
          'cross-sell',
          'additional value',
          'next opportunity',
          'grow',
          'scale',
          'more departments',
        ],
        responseKeywords: [
          'expansion opportunity',
          'additional value',
          'upsell potential',
          'cross-sell',
          'scale to',
        ],
        minConfidence: 0.7,
      },
      discovery: { queryKeywords: [], responseKeywords: [] },
      drafting: { queryKeywords: [], responseKeywords: [] },
      validating: { queryKeywords: [], responseKeywords: [] },
      composing: { queryKeywords: [], responseKeywords: [] },
      refining: { queryKeywords: [], responseKeywords: [] },
      realized: { queryKeywords: [], responseKeywords: [] },
    },
  },

  expansion: {
    stage: 'expansion',
    displayName: 'Expansion',
    description: 'Identify upsell and growth opportunities',
    nextStages: [],
    transitions: {
      discovery: { queryKeywords: [], responseKeywords: [] },
      drafting: { queryKeywords: [], responseKeywords: [] },
      validating: { queryKeywords: [], responseKeywords: [] },
      composing: { queryKeywords: [], responseKeywords: [] },
      refining: { queryKeywords: [], responseKeywords: [] },
      realized: { queryKeywords: [], responseKeywords: [] },
      expansion: { queryKeywords: [], responseKeywords: [] },
    },
  },
};

/**
 * Check if stage transition should occur
 * 
 * @param currentStage Current workflow stage
 * @param query User query text
 * @param response Agent response text
 * @param confidence Agent confidence score (0-1)
 * @returns Next stage if transition triggered, otherwise null
 */
export function checkStageTransition(
  currentStage: LifecycleStage,
  query: string,
  response: string,
  confidence: number = 1.0
): LifecycleStage | null {
  const stageConfig = CHAT_WORKFLOW_STAGES[currentStage];
  
  if (!stageConfig || stageConfig.nextStages.length === 0) {
    return null; // No transitions available from this stage
  }

  const lowerQuery = query.toLowerCase();
  const lowerResponse = response.toLowerCase();

  // Check each possible next stage
  for (const nextStage of stageConfig.nextStages) {
    const trigger = stageConfig.transitions[nextStage];
    
    // Check confidence threshold
    if (trigger.minConfidence && confidence < trigger.minConfidence) {
      continue;
    }

    // Check query keywords
    const queryMatch = trigger.queryKeywords.some(keyword =>
      lowerQuery.includes(keyword.toLowerCase())
    );

    // Check response keywords
    const responseMatch = trigger.responseKeywords.some(keyword =>
      lowerResponse.includes(keyword.toLowerCase())
    );

    // Trigger if either query or response matches
    if (queryMatch || responseMatch) {
      return nextStage;
    }
  }

  return null; // No transition triggered
}

/**
 * Get stage display name
 */
export function getStageDisplayName(stage: LifecycleStage): string {
  return CHAT_WORKFLOW_STAGES[stage]?.displayName || stage;
}

/**
 * Get stage description
 */
export function getStageDescription(stage: LifecycleStage): string {
  return CHAT_WORKFLOW_STAGES[stage]?.description || '';
}

/**
 * Get possible next stages
 */
export function getPossibleNextStages(stage: LifecycleStage): LifecycleStage[] {
  return CHAT_WORKFLOW_STAGES[stage]?.nextStages || [];
}

/**
 * Validate stage exists in config
 */
export function isValidStage(stage: string): stage is LifecycleStage {
  return stage in CHAT_WORKFLOW_STAGES;
}
