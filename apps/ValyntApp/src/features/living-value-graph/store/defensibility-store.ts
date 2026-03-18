/**
 * Defensibility Store - Zustand store for CFO-defensibility metrics
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DefensibilityIssue, DefensibilityScore, NodeDefensibility } from '../types/defensibility.types';
import { Evidence, Graph, ValueNode } from '../types/graph.types';

interface DefensibilityStore {
  // Global metrics
  globalScore: number;
  coverageByNode: Record<string, number>;
  totalBackedValue: number;
  totalValue: number;

  // Issues and warnings
  issues: DefensibilityIssue[];
  nodeDefensibility: Record<string, NodeDefensibility>;

  // Actions
  calculateScore: (graph: Graph) => void;
  getNodeCoverage: (nodeId: string) => number;
  isAboveThreshold: (threshold?: number) => boolean;
  getIssuesForNode: (nodeId: string) => DefensibilityIssue[];
  addIssue: (issue: DefensibilityIssue) => void;
  clearIssues: () => void;
}

export const useDefensibilityStore = create<DefensibilityStore>()(
  persist(
    (set, get) => ({
      globalScore: 0,
      coverageByNode: {},
      totalBackedValue: 0,
      totalValue: 0,
      issues: [],
      nodeDefensibility: {},

      calculateScore: (graph) => {
        let totalValue = 0;
        let backedValue = 0;
        const coverageByNode: Record<string, number> = {};
        const nodeDefensibility: Record<string, NodeDefensibility> = {};

        for (const node of Object.values(graph.nodes)) {
          const nodeValue = node.value || 0;
          const coverage = calculateNodeEvidenceCoverage(node);
          const defensibility = calculateNodeDefensibility(node, coverage);

          totalValue += nodeValue;
          backedValue += nodeValue * coverage;
          coverageByNode[node.id] = coverage;
          nodeDefensibility[node.id] = defensibility;
        }

        const globalScore = totalValue > 0 ? backedValue / totalValue : 0;

        set({
          globalScore,
          coverageByNode,
          totalBackedValue: backedValue,
          totalValue,
          nodeDefensibility,
        });
      },

      getNodeCoverage: (nodeId) => {
        return get().coverageByNode[nodeId] || 0;
      },

      isAboveThreshold: (threshold = 0.7) => {
        return get().globalScore >= threshold;
      },

      getIssuesForNode: (nodeId) => {
        return get().issues.filter((i) => i.nodeId === nodeId);
      },

      addIssue: (issue) => {
        set({ issues: [...get().issues, issue] });
      },

      clearIssues: () => {
        set({ issues: [] });
      },
    }),
    {
      name: 'defensibility-store',
      partialize: (state) => ({
        globalScore: state.globalScore,
        coverageByNode: state.coverageByNode,
        totalBackedValue: state.totalBackedValue,
        totalValue: state.totalValue,
      }),
    }
  )
);

// Helper functions
function calculateNodeEvidenceCoverage(node: ValueNode): number {
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

function isEvidenceValid(evidence: Evidence): boolean {
  return (
    evidence.confidence >= 0.7 &&
    !evidence.isStale &&
    evidence.hasAttribution !== false
  );
}

function calculateNodeDefensibility(node: ValueNode, coverage: number): NodeDefensibility {
  const evidence = node.evidence || [];
  const uniqueSources = new Set(evidence.map((e) => e.source)).size;

  return {
    nodeId: node.id,
    evidenceCoverage: coverage,
    sourceIndependence: uniqueSources,
    auditTrailComplete: node.metadata?.lastModified !== undefined,
    valueContribution: node.value || 0,
    threshold: 0.8,
    warnings: generateWarnings(node, coverage, uniqueSources),
  };
}

function generateWarnings(
  node: ValueNode,
  coverage: number,
  uniqueSources: number
): import('../types/defensibility.types').DefensibilityWarning[] {
  const warnings: import('../types/defensibility.types').DefensibilityWarning[] = [];

  if (coverage < 0.5) {
    warnings.push({
      type: 'low_coverage',
      severity: 'critical',
      message: 'Evidence coverage below 50%',
      remediation: 'Add high-confidence evidence sources',
    });
  } else if (coverage < 0.8) {
    warnings.push({
      type: 'low_coverage',
      severity: 'warning',
      message: 'Evidence coverage below 80%',
      remediation: 'Add additional evidence sources',
    });
  }

  if (uniqueSources === 1) {
    warnings.push({
      type: 'single_source',
      severity: 'warning',
      message: 'Only one evidence source',
      remediation: 'Add independent corroborating sources',
    });
  }

  const staleEvidence = node.evidence?.filter((e) => e.isStale) || [];
  if (staleEvidence.length > 0) {
    warnings.push({
      type: 'stale_evidence',
      severity: 'warning',
      message: `${staleEvidence.length} stale citations need refresh`,
      remediation: 'Update with latest data',
    });
  }

  return warnings;
}
