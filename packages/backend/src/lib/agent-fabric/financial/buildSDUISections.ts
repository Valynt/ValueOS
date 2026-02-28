// buildSDUISections.ts
// Extracted from FinancialModelingAgent

import { ComputedModel, FinancialModelingOutput } from './types';

export function buildSDUISections(
  models: ComputedModel[],
  llmOutput: FinancialModelingOutput,
): Array<Record<string, unknown>> {
  const sections: Array<Record<string, unknown>> = [];

  const totalNPV = models.reduce((sum, m) => sum + m.npv, 0);
  const avgConfidence = models.reduce((sum, m) => sum + m.confidence, 0) / models.length;
  const positiveCount = models.filter(m => m.npv > 0).length;

  // Summary card
  sections.push({
    type: 'component',
    component: 'AgentResponseCard',
    version: 1,
    props: {
      response: {
        agentId: 'financial_modeling',
        agentName: 'Financial Modeling Agent',
        timestamp: new Date().toISOString(),
        content: `${llmOutput.portfolio_summary}\n\nTotal portfolio NPV: $${Math.round(totalNPV).toLocaleString()}. ` +
          `${positiveCount}/${models.length} models have positive NPV.`,
        confidence: avgConfidence,
        status: 'completed',
      },
      showReasoning: true,
      showActions: true,
      stage: 'modeling',
    },
  });

  // Value tree chart — NPV per model
  sections.push({
    type: 'component',
    component: 'InteractiveChart',
    version: 1,
    props: {
      type: 'bar',
      data: models.map(m => ({ label: m.model, value: m.npv })),
      title: 'NPV by Model',
    },
  });

  // Additional SDUI sections can be added here

  return sections;
}
