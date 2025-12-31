import { describe, expect, it } from 'vitest';
import { ROIFormulaInterpreter } from '../../services/ROIFormulaInterpreter';
import { createBoltClientMock } from '../utils/mockSupabaseClient';

const supabase = createBoltClientMock();
const interpreter = new ROIFormulaInterpreter(supabase as any);

describe('ROIFormulaInterpreter', () => {
  it('executes formulas with variables and built-in functions', () => {
    const context = {
      variables: {
        revenue: { name: 'revenue', value: 100000 },
        margin: { name: 'margin', value: 0.2 },
      },
      functions: {},
    };

    const result = interpreter.executeFormula('revenue * margin + ROUND(10.5, 0)', context, true);
    expect(result.value).toBe(20011);
    expect(result.intermediateSteps?.length).toBeGreaterThan(0);
  });

  it('performs sensitivity analysis on variable adjustments', () => {
    const context = {
      variables: {
        baseline: { name: 'baseline', value: 1000 },
      },
      functions: {},
    };

    const analysis = interpreter.performSensitivityAnalysis(
      'baseline * 1.1',
      context,
      'baseline',
      [
        { label: 'Increase 10%', adjustment: 10, adjustmentType: 'percentage' },
        { label: 'Absolute +50', adjustment: 50, adjustmentType: 'absolute' },
      ]
    );

    expect(analysis.baseline).toBe(1100);
    expect(analysis.scenarios[0].result).toBeCloseTo(1210);
    expect(analysis.scenarios[1].variance).toBe(55);
  });
});
