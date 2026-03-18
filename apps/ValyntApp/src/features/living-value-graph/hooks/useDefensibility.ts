/**
 * useDefensibility Hook - Access defensibility metrics and calculations
 */

import { useEffect } from 'react';
import { useDefensibilityStore } from '../store/defensibility-store';
import { Graph } from '../types/graph.types';

export function useDefensibility(graph?: Graph) {
  const {
    globalScore,
    coverageByNode,
    totalBackedValue,
    totalValue,
    issues,
    nodeDefensibility,
    calculateScore,
    getNodeCoverage,
    isAboveThreshold,
    getIssuesForNode,
  } = useDefensibilityStore();

  // Recalculate when graph changes
  useEffect(() => {
    if (graph) {
      calculateScore(graph);
    }
  }, [graph, calculateScore]);

  return {
    // Global metrics
    globalScore,
    totalBackedValue,
    totalValue,
    coveragePercent: totalValue > 0 ? (totalBackedValue / totalValue) * 100 : 0,

    // Node-level
    coverageByNode,
    nodeDefensibility,
    getNodeCoverage,
    getIssuesForNode,

    // Checks
    isAboveThreshold,
    isBlocking: !isAboveThreshold(0.7),

    // Issues
    issues,
    criticalIssues: issues.filter((i) => i.severity === 'critical'),
    warningIssues: issues.filter((i) => i.severity === 'warning'),
  };
}
