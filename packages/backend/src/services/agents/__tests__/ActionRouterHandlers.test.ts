import { describe, it, expect } from 'vitest';
import { validateValueTreeStructure } from '../ActionRouterHandlers.js';

describe('validateValueTreeStructure', () => {
  it('returns true for falsy values', () => {
    expect(validateValueTreeStructure(null)).toBe(true);
    expect(validateValueTreeStructure(undefined)).toBe(true);
    expect(validateValueTreeStructure(0)).toBe(true);
    expect(validateValueTreeStructure('')).toBe(true);
    expect(validateValueTreeStructure(false)).toBe(true);
  });

  it('returns true for non-object types', () => {
    expect(validateValueTreeStructure('string')).toBe(true);
    expect(validateValueTreeStructure(123)).toBe(true);
    expect(validateValueTreeStructure(true)).toBe(true);
  });

  it('returns true for objects without a structure property', () => {
    expect(validateValueTreeStructure({})).toBe(true);
    expect(validateValueTreeStructure({ otherProp: 'value' })).toBe(true);
  });

  it('returns true for objects where structure is not an object', () => {
    expect(validateValueTreeStructure({ structure: 'string' })).toBe(true);
    expect(validateValueTreeStructure({ structure: 123 })).toBe(true);
    expect(validateValueTreeStructure({ structure: null })).toBe(true);
  });

  it('returns true when structure has capabilities, outcomes, and kpis', () => {
    expect(
      validateValueTreeStructure({
        structure: {
          capabilities: [],
          outcomes: [],
          kpis: [],
        },
      })
    ).toBe(true);
  });

  it('returns false when structure is missing capabilities', () => {
    expect(
      validateValueTreeStructure({
        structure: {
          outcomes: [],
          kpis: [],
        },
      })
    ).toBe(false);
  });

  it('returns false when structure is missing outcomes', () => {
    expect(
      validateValueTreeStructure({
        structure: {
          capabilities: [],
          kpis: [],
        },
      })
    ).toBe(false);
  });

  it('returns false when structure is missing kpis', () => {
    expect(
      validateValueTreeStructure({
        structure: {
          capabilities: [],
          outcomes: [],
        },
      })
    ).toBe(false);
  });

  it('returns false when structure is empty', () => {
    expect(
      validateValueTreeStructure({
        structure: {},
      })
    ).toBe(false);
  });
});
