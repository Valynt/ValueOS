import { describe, expect, it } from 'vitest';
import { validateAssumptionEvidence } from '../ActionRouterHandlers.js';

describe('validateAssumptionEvidence', () => {
  it('returns true for falsy values', () => {
    expect(validateAssumptionEvidence(null)).toBe(true);
    expect(validateAssumptionEvidence(undefined)).toBe(true);
    expect(validateAssumptionEvidence(false)).toBe(true);
    expect(validateAssumptionEvidence('')).toBe(true);
    expect(validateAssumptionEvidence(0)).toBe(true);
  });

  it('returns true for non-object values', () => {
    expect(validateAssumptionEvidence('string')).toBe(true);
    expect(validateAssumptionEvidence(123)).toBe(true);
    expect(validateAssumptionEvidence(true)).toBe(true);
  });

  it('returns true for an object without a source property', () => {
    expect(validateAssumptionEvidence({})).toBe(true);
    expect(validateAssumptionEvidence({ name: 'test' })).toBe(true);
    expect(validateAssumptionEvidence({ source: 123 })).toBe(true);
    expect(validateAssumptionEvidence({ source: null })).toBe(true);
  });

  it('returns true for a valid source string', () => {
    expect(validateAssumptionEvidence({ source: 'user-input' })).toBe(true);
    expect(validateAssumptionEvidence({ source: 'database' })).toBe(true);
    expect(validateAssumptionEvidence({ source: 'a' })).toBe(true);
  });

  it('returns false when source is "estimate"', () => {
    expect(validateAssumptionEvidence({ source: 'estimate' })).toBe(false);
  });

  it('returns false when source is an empty string', () => {
    expect(validateAssumptionEvidence({ source: '' })).toBe(false);
  });
});
