// computeFinancials.ts
// Extracted from FinancialModelingAgent

import { FinancialModelingOutput, ComputedModel } from './types';
import { toDecimalArray, calculateNPV, calculateIRR, calculatePayback, calculateROI, sensitivityAnalysis, roundTo } from './financial-utils';
import Decimal from 'decimal.js';

export function computeFinancials(output: FinancialModelingOutput): ComputedModel[] {
  return output.projections.map(proj => {
    const flows = toDecimalArray(proj.cash_flows);
    const rate = new Decimal(proj.discount_rate);

    // NPV via economic kernel
    const npv = calculateNPV(flows, rate);

    // IRR via Newton-Raphson
    const irrResult = calculateIRR(flows);

    // Payback period
    const paybackResult = calculatePayback(flows);

    // ROI
    const totalBenefits = new Decimal(proj.total_benefit);
    const totalCosts = new Decimal(proj.total_investment);
    let roi: Decimal;
    try {
      roi = calculateROI(totalBenefits, totalCosts);
    } catch {
      // total_investment is 0 — shouldn't happen but handle gracefully
      roi = new Decimal(0);
    }

    // Sensitivity analysis on discount rate
    const sensitivityResults: ComputedModel['sensitivity'] = [];
    if (output.sensitivity_parameters) {
      for (const param of output.sensitivity_parameters) {
        if (param.name.toLowerCase().includes('discount')) {
          const result = sensitivityAnalysis(
            param.name,
            new Decimal(param.base_value),
            param.perturbations.map(p => new Decimal(p)),
            (paramValue: Decimal) => calculateNPV(flows, paramValue),
          );
          sensitivityResults.push({
            parameter: result.parameterName,
            base_npv: Number(roundTo(result.baseOutput, 2)),
            points: result.points.map(p => ({
              multiplier: Number(p.parameterValue),
              npv: Number(roundTo(p.outputValue, 2)),
            })),
          });
        } else {
          // For non-discount parameters, scale the cash flows
          const result = sensitivityAnalysis(
            param.name,
            new Decimal(param.base_value),
            param.perturbations.map(p => new Decimal(p)),
            (multiplier: Decimal) => {
              const scaledFlows = flows.map((f, i) =>
                i === 0 ? f : f.times(multiplier),
              );
              return calculateNPV(scaledFlows, rate);
            },
          );
          sensitivityResults.push({
            parameter: result.parameterName,
            base_npv: Number(roundTo(result.baseOutput, 2)),
            points: result.points.map(p => ({
              multiplier: Number(p.parameterValue),
              npv: Number(roundTo(p.outputValue, 2)),
            })),
          });
        }
      }
    }

    return {
      model: proj.model,
      npv: Number(roundTo(npv, 2)),
      irr: irrResult.value,
      payback_period: paybackResult.period,
      roi: Number(roundTo(roi, 2)),
      confidence: proj.confidence,
      sensitivity: sensitivityResults,
    };
  });
}
