/**
 * Defensibility Calculation Utilities
 */

import { ValueNode, Evidence } from '../types/graph.types';
import { DefensibilityScore, DefensibilityIssue } from '../types/defensibility.types';

/**
 * Calculate global defensibility score for a set of nodes
 */
export function calculateDefensibilityScore(nodes: ValueNode[]): DefensibilityScore {
  let totalValue = 0;
  let backedValue = 0;

  for (const node of nodes) {
    const nodeValue = node.value || 0;
    const coverage = calculateNodeCoverage(node);

    totalValue += nodeValue;
    backedValue += nodeValue * coverage;
  }

  const globalScore = totalValue > 0 ? backedValue / totalValue : 0;
  const threshold = 0.7;

  return {
    global: globalScore,
    breakdown: {
      backedByEvidence: backedValue,
      totalValue,
      coveragePercent: globalScore * 100,
    },
    threshold,
    isBlocking: globalScore < threshold,
  };
}

/**
 * Calculate evidence coverage for a single node
 */
export function calculateNodeCoverage(node: ValueNode): number {
  if (!node.evidence || node.evidence.length === 0) {
    return 0;
  }

  const evidence = node.evidence;
  const totalWeight = evidence.reduce((sum, e) => sum + (e.weight || 1), 0);
  const validWeight = evidence
    .filter((e) => isEvidenceValid(e))
    .reduce((sum, e) => sum + (e.weight || 1), 0);

  return totalWeight > 0 ? validWeight / totalWeight : 0;
}

/**
 * Check if evidence meets validity criteria
 */
export function isEvidenceValid(evidence: Evidence): boolean {
  return (
    evidence.confidence >= 0.7 &&
    !evidence.isStale &&
    evidence.hasAttribution !== false
  );
}

/**
 * Generate defensibility issues for a node
 */
export function generateDefensibilityIssues(
  node: ValueNode,
  allNodes: ValueNode[]
): DefensibilityIssue[] {
  const issues: DefensibilityIssue[] = [];
  const coverage = calculateNodeCoverage(node);

  // Low coverage issue
  if (coverage < 0.5) {
    issues.push({
      id: `issue-${node.id}-coverage`,
      nodeId: node.id,
      nodeName: node.label,
      type: 'evidence_gap',
      severity: 'critical',
      valueAtRisk: (node.value || 0) * (1 - coverage),
      suggestedAction: 'Add high-confidence evidence sources',
    });
  }

  // Stale evidence issue
  const staleEvidence = node.evidence?.filter((e) => e.isStale) || [];
  if (staleEvidence.length > 0) {
    issues.push({
      id: `issue-${node.id}-stale`,
      nodeId: node.id,
      nodeName: node.label,
      type: 'stale_citation',
      severity: 'warning',
      valueAtRisk: (node.value || 0) * 0.1, // Partial risk
      suggestedAction: 'Refresh stale citations',
    });
  }

  return issues;
}

/**
 * Format defensibility score as percentage
 */
export function formatDefensibilityScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get color code for defensibility score
 */
export function getDefensibilityColor(score: number): 'green' | 'amber' | 'red' {
  if (score >= 0.9) return 'green';
  if (score >= 0.7) return 'amber';
  return 'red';
}
