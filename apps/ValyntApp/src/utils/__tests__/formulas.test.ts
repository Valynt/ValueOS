import { describe, expect, it } from 'vitest';
import { evaluateFormula } from '../formulas';

describe('evaluateFormula', () => {
  it('evaluates allowed math expressions', () => {
    const result = evaluateFormula('max(2, 5) + 3 * 2', {});
    expect(result).toBe(11);
  });

  it('supports variables and constants', () => {
    const result = evaluateFormula('PI * radius * radius', { radius: 2 });
    expect(result).toBeCloseTo(Math.PI * 4, 5);
  });

  it('blocks dangerous patterns like eval or Function', () => {
    expect(() => evaluateFormula('eval("alert(1)")', {})).toThrow(
      /Dangerous code pattern detected/
    );
    expect(() => evaluateFormula('Function("return 1")()', {})).toThrow(
      /Dangerous code pattern detected/
    );
  });

  it('rejects unsupported operators and function calls', () => {
    expect(() => evaluateFormula('2 ** 3', {})).toThrow();
    expect(() => evaluateFormula('alert(1)', {})).toThrow();
  });
});
