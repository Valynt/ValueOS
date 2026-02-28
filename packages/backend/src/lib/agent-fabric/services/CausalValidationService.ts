// CausalValidationService.ts
// Extracts causal validation logic from TargetAgent

import { getAdvancedCausalEngine } from '../../../services/reasoning/AdvancedCausalEngine.js';
import { KPIDefinition, Hypothesis, CausalTrace } from './types';

export class CausalValidationService {
  private causalEngine = getAdvancedCausalEngine();

  async validateAllCausalTraces(
    kpis: KPIDefinition[],
    hypotheses: Hypothesis[],
  ): Promise<CausalTrace[]> {
    const results: CausalTrace[] = [];
    for (const kpi of kpis) {
      const trace = await this.validateCausalTrace(kpi, hypotheses);
      results.push(trace);
    }
    return results;
  }

  async validateCausalTrace(
    kpi: KPIDefinition,
    hypotheses: Hypothesis[],
  ): Promise<CausalTrace> {
    const causalInference = await this.causalEngine.inferCausalRelationship(
      kpi,
      hypotheses,
    );
    return {
      kpi,
      hypotheses,
      verified: causalInference.verified,
      confidence: causalInference.confidence,
      effect: causalInference.effect,
      reasoning: causalInference.reasoning,
    };
  }
}
