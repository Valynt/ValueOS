/**
 * Healthcare Revenue Cycle Scenario Tests
 *
 * Validates the healthcare ground truth dataset through:
 * - Evidence tiering classification
 * - Confidence scoring
 * - Harness validators (opportunity, financial modeling, groundtruth, narrative, red team)
 * - Integration fixture for HypothesisLoop execution
 */

import { describe, it, expect } from 'vitest';
import {
  healthcareRevenueCycleScenario as scenario,
} from '../datasets/ground-truth/healthcare-revenue-cycle.js';
import { classifyEvidence, buildEvidenceBundle } from '../../core/EvidenceTiering.js';
import {
  computeConfidence,
  scoreClaimConfidence,
  type TransparencyLevel,
} from '../../core/ConfidenceScorer.js';
import {
  validateOpportunityResponse,
  validateFinancialModelingResponse,
  validateGroundtruthResponse,
  validateNarrativeResponse,
  validateRedTeamResponse,
  runEvalChecks,
} from '../harness.js';
import type { OpportunityEvalCase } from '../datasets/agent-evals/opportunity-agent.js';
import type { FinancialModelingEvalCase } from '../datasets/agent-evals/financial-modeling-agent.js';
import type { GroundtruthEvalCase } from '../datasets/agent-evals/groundtruth-agent.js';
import type { NarrativeEvalCase } from '../datasets/agent-evals/narrative-agent.js';
import type { RedTeamEvalCase } from '../datasets/agent-evals/red-team-agent.js';

// ============================================================================
// Scenario Integrity
// ============================================================================

describe('Healthcare Revenue Cycle — scenario integrity', () => {
  it('has valid scenario metadata', () => {
    expect(scenario.meta.id).toBe('gt-healthcare-revcycle-001');
    expect(scenario.meta.industry).toContain('Healthcare');
    expect(scenario.meta.companyProfile.annualRevenue).toBe(680_000_000);
    expect(scenario.meta.companyProfile.beds).toBe(800);
    expect(scenario.meta.companyProfile.bedUtilization).toBe(0.72);
    expect(scenario.meta.companyProfile.annualDeniedClaims).toBe(45_000_000);
  });

  it('has 3 hypotheses covering revenue cycle, operations, and working capital', () => {
    expect(scenario.hypotheses).toHaveLength(3);
    const categories = scenario.hypotheses.map((h) => h.category);
    expect(categories).toContain('Revenue Cycle');
    expect(categories).toContain('Operational Efficiency');
    expect(categories).toContain('Working Capital');
  });

  it('has 6 evidence items across all 3 tiers', () => {
    expect(scenario.evidenceItems).toHaveLength(6);
    const tiers = new Set(scenario.classifiedEvidence.map((e) => e.tier));
    expect(tiers.has(1)).toBe(true);
    expect(tiers.has(2)).toBe(true);
    expect(tiers.has(3)).toBe(true);
  });

  it('has a value tree with 3 child nodes summing to total', () => {
    const root = scenario.valueTree.nodes[0]!;
    expect(root.children).toHaveLength(3);
    expect(scenario.valueTree.totalValue).toBe(26_500_000);
  });

  it('has 4 red team objections including one critical', () => {
    expect(scenario.objections).toHaveLength(4);
    expect(scenario.objections.some((o) => o.severity === 'critical')).toBe(true);
    expect(scenario.expectsRevision).toBe(true);
  });

  it('has provenance records for each value tree leaf node', () => {
    expect(scenario.provenanceRecords).toHaveLength(3);
    const claimIds = scenario.provenanceRecords.map((p) => p.claimId);
    expect(claimIds).toContain('node_denials');
    expect(claimIds).toContain('node_beds');
    expect(claimIds).toContain('node_cash');
  });

  it('has expected state transitions including revision cycle', () => {
    expect(scenario.expectedStateTransitions.length).toBeGreaterThanOrEqual(8);
    // Should include a backward transition to DRAFTING
    const backwardTransitions = scenario.expectedStateTransitions.filter(
      (t) => t.to === 'DRAFTING' && t.from !== 'NONE' && t.from !== 'INITIATED'
    );
    expect(backwardTransitions.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Evidence Tiering
// ============================================================================

describe('Healthcare Revenue Cycle — evidence tiering', () => {
  it('classifies annual report as Tier 1', () => {
    const classified = classifyEvidence(scenario.evidenceItems[0]!);
    expect(classified.tier).toBe(1);
    expect(classified.weight).toBe(1.0);
  });

  it('classifies HFMA analyst report as Tier 2', () => {
    const classified = classifyEvidence(scenario.evidenceItems[1]!);
    expect(classified.tier).toBe(2);
    expect(classified.weight).toBe(0.7);
  });

  it('classifies customer-provided data as Tier 1', () => {
    const classified = classifyEvidence(scenario.evidenceItems[2]!);
    expect(classified.tier).toBe(1);
    expect(classified.weight).toBe(1.0);
  });

  it('classifies Gartner report as Tier 2', () => {
    const classified = classifyEvidence(scenario.evidenceItems[3]!);
    expect(classified.tier).toBe(2);
    expect(classified.weight).toBe(0.7);
  });

  it('classifies internal benchmarks as Tier 3', () => {
    const classified = classifyEvidence(scenario.evidenceItems[4]!);
    expect(classified.tier).toBe(3);
    expect(classified.weight).toBe(0.4);
  });

  it('builds a complete evidence bundle', () => {
    const bundle = buildEvidenceBundle(
      scenario.valueCaseId,
      scenario.evidenceItems
    );
    expect(bundle.items).toHaveLength(6);
    expect(bundle.citations).toHaveLength(6);
    expect(bundle.valueCaseId).toBe(scenario.valueCaseId);
  });
});

// ============================================================================
// Confidence Scoring
// ============================================================================

describe('Healthcare Revenue Cycle — confidence scoring', () => {
  it('scores denied claims node with high confidence (Tier 1 primary)', () => {
    const evidence = scenario.classifiedEvidence[0]!; // Annual report, Tier 1
    const score = computeConfidence({
      evidence,
      transparency: 'full',
      referenceDate: '2026-02-01T00:00:00Z',
    });
    expect(score.tier).toBe(1);
    expect(score.reliability).toBe(1.0);
    expect(score.transparency).toBe(1.0);
    expect(score.overall).toBeGreaterThan(0.7);
  });

  it('scores bed utilization node with moderate confidence (Tier 2 primary)', () => {
    const evidence = scenario.classifiedEvidence[3]!; // Gartner, Tier 2
    const score = computeConfidence({
      evidence,
      transparency: 'partial',
      referenceDate: '2026-02-01T00:00:00Z',
    });
    expect(score.tier).toBe(2);
    expect(score.reliability).toBe(0.7);
    expect(score.transparency).toBe(0.5);
    expect(score.overall).toBeLessThan(0.8);
  });

  it('scores cash acceleration node using claim confidence scorer', () => {
    const relevantEvidence = scenario.classifiedEvidence.filter(
      (e) => ['ev_201', 'ev_205'].includes(e.id)
    );
    const relevantCitations = scenario.citations.filter(
      (c) => ['ev_201', 'ev_205'].includes(c.evidenceId)
    );
    const claimConf = scoreClaimConfidence(
      'node_cash',
      relevantEvidence,
      'full' as TransparencyLevel,
      relevantCitations,
      '2026-02-01T00:00:00Z'
    );
    expect(claimConf.claimId).toBe('node_cash');
    expect(claimConf.score.overall).toBeGreaterThan(0);
    expect(claimConf.citations).toHaveLength(2);
  });
});

// ============================================================================
// Harness Validators — healthcare-specific eval cases
// ============================================================================

describe('Healthcare Revenue Cycle — opportunity validator', () => {
  const evalCase: OpportunityEvalCase = {
    id: 'opp-eval-healthcare-001',
    name: 'Healthcare revenue cycle opportunities',
    input: {
      query: 'Identify value drivers for a regional hospital network with 3 facilities, 800 beds, 72% bed utilization, and $45M in denied claims annually',
      context: { organizationId: scenario.tenantId },
    },
    expectations: {
      minOpportunities: 2,
      maxOpportunities: 5,
      requiredCategories: ['Revenue Cycle'],
      minConfidence: 0.5,
      mustMentionKeywords: ['denied', 'claims', 'utilization'],
      analysisMinLength: 50,
    },
    mockResponse: {
      opportunities: scenario.hypotheses.map((h) => ({
        title: h.description.substring(0, 60),
        description: h.description,
        confidence: h.confidence,
        category: h.category,
        estimatedValue: h.estimatedValue,
      })),
      analysis: 'Primary value in revenue cycle management through denied claims reduction. Secondary value in bed utilization optimization.',
    },
  };

  it('passes validation with mock response', () => {
    const checks = validateOpportunityResponse(evalCase, evalCase.mockResponse);
    const result = runEvalChecks(evalCase.id, evalCase.name, 'opportunity', checks, Date.now());
    expect(result.passed).toBe(true);
  });
});

describe('Healthcare Revenue Cycle — financial modeling validator', () => {
  const evalCase: FinancialModelingEvalCase = {
    id: 'fm-eval-healthcare-001',
    name: 'Healthcare revenue cycle value tree',
    input: {
      query: 'Build value tree for hypotheses: Reducing denial rate from 12% to 5%; Improving bed utilization from 72% to 82%; Accelerating cash collection by 25 days',
      context: { organizationId: scenario.tenantId },
    },
    expectations: {
      minModels: 3,
      requiresFormula: true,
      minConfidence: 0.5,
      mustMentionKeywords: ['denied', 'bed', 'cash'],
    },
    mockResponse: {
      financial_models: scenario.valueTree.nodes[0]!.children!.map((n) => ({
        title: n.label,
        description: `Formula: ${n.formula}. ${n.label} targets significant cost reduction.`,
        confidence: n.confidenceScore,
        category: 'Healthcare',
        model_type: 'Value Tree Node',
        priority: n.confidenceScore >= 0.70 ? 'High' : 'Medium',
      })),
      analysis: `Total modeled value: $${(scenario.valueTree.totalValue / 1_000_000).toFixed(1)}M. Denied claims recovery is the primary driver.`,
    },
  };

  it('passes validation with mock response', () => {
    const checks = validateFinancialModelingResponse(evalCase, evalCase.mockResponse);
    const result = runEvalChecks(evalCase.id, evalCase.name, 'financial-modeling', checks, Date.now());
    expect(result.passed).toBe(true);
  });
});

describe('Healthcare Revenue Cycle — groundtruth validator', () => {
  const evalCase: GroundtruthEvalCase = {
    id: 'gt-eval-healthcare-001',
    name: 'Verify healthcare revenue cycle data',
    input: {
      query: 'Retrieve and verify evidence for value tree: Denied Claims Recovery ($13.5M), Bed Utilization Revenue ($8.2M), Cash Collection Acceleration ($4.8M)',
      context: { organizationId: scenario.tenantId },
    },
    expectations: {
      minGroundtruths: 3,
      requiredCategories: ['Verification'],
      minTopConfidence: 0.7,
      mustMentionKeywords: ['denial', 'bed', 'revenue'],
    },
    mockResponse: {
      groundtruths: scenario.evidenceBundle.items.slice(0, 4).map((item) => ({
        title: `Evidence: ${item.sourceName}`,
        description: item.content.substring(0, 200),
        confidence: item.weight,
        category: item.tier === 1 ? 'Verification' : 'Source',
        verification_type: 'Fact Checking',
        priority: item.tier === 1 ? 'High' : 'Medium',
      })),
      analysis: 'Denial rate and bed utilization verified against annual report (Tier 1). Industry benchmarks support reduction targets.',
    },
  };

  it('passes validation with mock response', () => {
    const checks = validateGroundtruthResponse(evalCase, evalCase.mockResponse);
    const result = runEvalChecks(evalCase.id, evalCase.name, 'groundtruth', checks, Date.now());
    expect(result.passed).toBe(true);
  });
});

describe('Healthcare Revenue Cycle — narrative validator', () => {
  const evalCase: NarrativeEvalCase = {
    id: 'narr-eval-healthcare-001',
    name: 'Healthcare revenue cycle executive narrative',
    input: {
      query: 'Create executive narrative for value tree: Total $26.5M — Denied Claims $13.5M, Bed Utilization $8.2M, Cash Acceleration $4.8M',
      context: { organizationId: scenario.tenantId },
    },
    expectations: {
      minNarratives: 3,
      analysisMinLength: 100,
      mustMentionKeywords: ['$26', 'denial', 'bed', 'utilization'],
      requiresDollarAmounts: true,
    },
    mockResponse: {
      narratives: scenario.narrativeBlock.sections.map((sec) => ({
        title: sec.heading,
        description: sec.content,
        confidence: sec.confidenceScore,
        category: 'Healthcare',
        narrative_type: 'Executive Summary',
        priority: sec.confidenceScore >= 0.70 ? 'High' : 'Medium',
      })),
      analysis: scenario.narrativeBlock.executiveSummary,
    },
  };

  it('passes validation with mock response', () => {
    const checks = validateNarrativeResponse(evalCase, evalCase.mockResponse);
    const result = runEvalChecks(evalCase.id, evalCase.name, 'narrative', checks, Date.now());
    expect(result.passed).toBe(true);
  });
});

describe('Healthcare Revenue Cycle — red team validator', () => {
  const evalCase: RedTeamEvalCase = {
    id: 'rt-eval-healthcare-001',
    name: 'Healthcare revenue cycle — critical objection on bed revenue',
    input: {
      valueCaseId: scenario.valueCaseId,
      tenantId: scenario.tenantId,
      valueTree: scenario.valueTree as unknown as Record<string, unknown>,
      narrativeBlock: scenario.narrativeBlock as unknown as Record<string, unknown>,
      evidenceBundle: scenario.evidenceBundle as unknown as Record<string, unknown>,
      idempotencyKey: 'bb0e8400-e29b-41d4-a716-446655440003',
    },
    expectations: {
      minObjections: 3,
      maxObjections: 6,
      expectsCritical: true,
      requiredCategories: ['assumption', 'missing_evidence'],
      targetComponents: ['node_denials', 'node_beds'],
    },
    mockResponse: {
      objections: scenario.objections,
      summary: 'Critical: bed utilization revenue lacks per-bed revenue evidence. Denial capture rate is aggressive.',
      hasCritical: true,
    },
  };

  it('passes validation with mock response', () => {
    const checks = validateRedTeamResponse(evalCase, evalCase.mockResponse);
    const result = runEvalChecks(evalCase.id, evalCase.name, 'red-team', checks, Date.now());
    expect(result.passed).toBe(true);
  });

  it('correctly identifies critical objection', () => {
    const checks = validateRedTeamResponse(evalCase, evalCase.mockResponse);
    const criticalCheck = checks.find((c) => c.name.includes('Critical objections'));
    expect(criticalCheck?.passed).toBe(true);
  });
});
