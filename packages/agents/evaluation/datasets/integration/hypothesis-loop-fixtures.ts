/**
 * Integration Test Fixtures: HypothesisLoop
 *
 * Pre-wired mock agent configurations for end-to-end HypothesisLoop testing.
 * Each fixture bundles the mock responses for all 5 agents plus the expected
 * loop outcome (state transitions, revision count, final state).
 */

import type { RedTeamOutput } from '../../../orchestration/agents/RedTeamAgent.js';
import { saassDsoReductionScenario } from '../ground-truth/saas-dso-reduction.js';
import { manufacturingYieldScenario } from '../ground-truth/manufacturing-yield.js';

// ============================================================================
// Types
// ============================================================================

export interface LoopFixture {
  id: string;
  name: string;
  valueCaseId: string;
  tenantId: string;
  correlationId: string;
  /** Mock responses keyed by tenantId */
  agentResponses: {
    opportunity: {
      opportunities: Array<{
        title: string;
        description: string;
        confidence: number;
        category: string;
        estimatedValue?: number;
      }>;
      analysis: string;
    };
    financialModeling: {
      financial_models: Array<{
        title: string;
        description: string;
        confidence: number;
        category: string;
        model_type: string;
        priority: string;
      }>;
      analysis: string;
    };
    groundtruth: {
      groundtruths: Array<{
        title: string;
        description: string;
        confidence: number;
        category: string;
        verification_type: string;
        priority: string;
      }>;
      analysis: string;
    };
    narrative: {
      narratives: Array<{
        title: string;
        description: string;
        confidence: number;
        category: string;
        narrative_type: string;
        priority: string;
      }>;
      analysis: string;
    };
    redTeam: RedTeamOutput;
  };
  /** Expected outcome */
  expected: {
    success: boolean;
    finalState: string;
    revisionCount: number;
    minHypotheses: number;
    hasValueTree: boolean;
    hasNarrative: boolean;
    hasObjections: boolean;
  };
}

// ============================================================================
// Fixture: Happy Path (no critical objections)
// ============================================================================

const s1 = saassDsoReductionScenario;

export const happyPathFixture: LoopFixture = {
  id: 'loop-happy-001',
  name: 'SaaS DSO — happy path, no revision',
  valueCaseId: s1.valueCaseId,
  tenantId: s1.tenantId,
  correlationId: s1.correlationId,
  agentResponses: {
    opportunity: {
      opportunities: s1.hypotheses.map((h) => ({
        title: h.description.substring(0, 50),
        description: h.description,
        confidence: h.confidence,
        category: h.category,
        estimatedValue: h.estimatedValue,
      })),
      analysis: 'Identified 3 value drivers for DSO reduction.',
    },
    financialModeling: {
      financial_models: s1.valueTree.nodes[0]!.children!.map((n) => ({
        title: n.label,
        description: n.formula ?? n.label,
        confidence: n.confidenceScore,
        category: 'Financial',
        model_type: 'Value Tree Node',
        priority: n.confidenceScore >= 0.75 ? 'High' : 'Medium',
      })),
      analysis: `Total modeled value: $${(s1.valueTree.totalValue / 1_000_000).toFixed(1)}M`,
    },
    groundtruth: {
      groundtruths: s1.evidenceBundle.items.map((item) => ({
        title: `Evidence: ${item.sourceName}`,
        description: item.content.substring(0, 200),
        confidence: item.weight,
        category: 'Verification',
        verification_type: 'Fact Checking',
        priority: item.tier === 1 ? 'High' : 'Medium',
      })),
      analysis: 'Evidence verified across Tier 1 and Tier 2 sources.',
    },
    narrative: {
      narratives: s1.narrativeBlock.sections.map((sec) => ({
        title: sec.heading,
        description: sec.content,
        confidence: sec.confidenceScore,
        category: 'Narrative',
        narrative_type: 'Executive Summary',
        priority: sec.confidenceScore >= 0.75 ? 'High' : 'Medium',
      })),
      analysis: s1.narrativeBlock.executiveSummary,
    },
    redTeam: {
      objections: s1.objections,
      summary: 'No critical objections. Value case is directionally sound.',
      hasCritical: false,
      timestamp: '2026-01-25T14:00:00Z',
    },
  },
  expected: {
    success: true,
    finalState: 'FINALIZED',
    revisionCount: 0,
    minHypotheses: 2,
    hasValueTree: true,
    hasNarrative: true,
    hasObjections: true,
  },
};

// ============================================================================
// Fixture: Revision Path (critical objection triggers re-draft)
// ============================================================================

const s2 = manufacturingYieldScenario;

export const revisionPathFixture: LoopFixture = {
  id: 'loop-revision-001',
  name: 'Manufacturing yield — critical objection triggers revision',
  valueCaseId: s2.valueCaseId,
  tenantId: s2.tenantId,
  correlationId: s2.correlationId,
  agentResponses: {
    opportunity: {
      opportunities: s2.hypotheses.map((h) => ({
        title: h.description.substring(0, 50),
        description: h.description,
        confidence: h.confidence,
        category: h.category,
        estimatedValue: h.estimatedValue,
      })),
      analysis: 'Identified 3 value drivers for quality improvement.',
    },
    financialModeling: {
      financial_models: s2.valueTree.nodes[0]!.children!.map((n) => ({
        title: n.label,
        description: n.formula ?? n.label,
        confidence: n.confidenceScore,
        category: 'Quality',
        model_type: 'Value Tree Node',
        priority: n.confidenceScore >= 0.70 ? 'High' : 'Medium',
      })),
      analysis: `Total modeled value: $${(s2.valueTree.totalValue / 1_000_000).toFixed(1)}M`,
    },
    groundtruth: {
      groundtruths: s2.evidenceBundle.items.map((item) => ({
        title: `Evidence: ${item.sourceName}`,
        description: item.content.substring(0, 200),
        confidence: item.weight,
        category: 'Verification',
        verification_type: 'Fact Checking',
        priority: item.tier === 1 ? 'High' : 'Medium',
      })),
      analysis: 'Evidence verified. Warranty reduction evidence is weak.',
    },
    narrative: {
      narratives: s2.narrativeBlock.sections.map((sec) => ({
        title: sec.heading,
        description: sec.content,
        confidence: sec.confidenceScore,
        category: 'Narrative',
        narrative_type: 'Executive Summary',
        priority: sec.confidenceScore >= 0.70 ? 'High' : 'Medium',
      })),
      analysis: s2.narrativeBlock.executiveSummary,
    },
    redTeam: {
      objections: s2.objections,
      summary: 'Critical: warranty reduction assumes full defect coverage but material defects are upstream.',
      hasCritical: true,
      timestamp: '2026-01-25T16:00:00Z',
    },
  },
  expected: {
    success: true,
    finalState: 'FINALIZED',
    revisionCount: 1,
    minHypotheses: 2,
    hasValueTree: true,
    hasNarrative: true,
    hasObjections: true,
  },
};

// ============================================================================
// Fixture: Agent Failure (tests DLQ routing)
// ============================================================================

export const failureFixture: LoopFixture = {
  id: 'loop-failure-001',
  name: 'Agent failure — tests compensation and DLQ',
  valueCaseId: '550e8400-e29b-41d4-a716-446655440099',
  tenantId: 'tenant-failure-test',
  correlationId: '660e8400-e29b-41d4-a716-446655440099',
  agentResponses: {
    opportunity: {
      opportunities: [
        {
          title: 'Test Opportunity',
          description: 'This opportunity will succeed.',
          confidence: 0.80,
          category: 'Test',
        },
      ],
      analysis: 'Test analysis.',
    },
    // Financial modeling will throw — simulated by the test harness
    financialModeling: {
      financial_models: [],
      analysis: 'SIMULATE_ERROR: LLM provider timeout after 3 retries',
    },
    groundtruth: {
      groundtruths: [],
      analysis: 'Should not be reached.',
    },
    narrative: {
      narratives: [],
      analysis: 'Should not be reached.',
    },
    redTeam: {
      objections: [],
      summary: 'Should not be reached.',
      hasCritical: false,
      timestamp: '2026-01-25T18:00:00Z',
    },
  },
  expected: {
    success: false,
    finalState: 'FAILED',
    revisionCount: 0,
    minHypotheses: 1,
    hasValueTree: false,
    hasNarrative: false,
    hasObjections: false,
  },
};

// ============================================================================
// All Fixtures
// ============================================================================

export const ALL_LOOP_FIXTURES: LoopFixture[] = [
  happyPathFixture,
  revisionPathFixture,
  failureFixture,
];
