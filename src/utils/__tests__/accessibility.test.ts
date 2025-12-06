import { describe, it, expect } from 'vitest';
import { getContrastRatio, isColorContrastCompliant, generateA11yId } from '../accessibility';

describe('getContrastRatio', () => {
  it('calculates contrast ratio between black and white correctly', () => {
    const ratio = getContrastRatio('#000000', '#ffffff');
    
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('calculates contrast ratio between same colors as 1:1', () => {
    const ratio = getContrastRatio('#ff0000', '#ff0000');
    
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('calculates contrast ratio for typical text colors', () => {
    const ratio = getContrastRatio('#333333', '#ffffff');
    
    expect(ratio).toBeGreaterThan(4.5);
  });

  it('handles colors in different order consistently', () => {
    const ratio1 = getContrastRatio('#000000', '#ffffff');
    const ratio2 = getContrastRatio('#ffffff', '#000000');
    
    expect(ratio1).toBeCloseTo(ratio2, 1);
  });

  it('calculates contrast for medium gray colors', () => {
    const ratio = getContrastRatio('#808080', '#ffffff');
    
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(21);
  });
});

describe('isColorContrastCompliant', () => {
  it('validates WCAG AA compliance for normal text', () => {
    const isCompliant = isColorContrastCompliant('#000000', '#ffffff', 'AA', 'normal');
    
    expect(isCompliant).toBe(true);
  });

  it('rejects insufficient contrast for AA normal text', () => {
    const isCompliant = isColorContrastCompliant('#777777', '#888888', 'AA', 'normal');
    
    expect(isCompliant).toBe(false);
  });

  it('validates WCAG AAA compliance for large text', () => {
    const isCompliant = isColorContrastCompliant('#595959', '#ffffff', 'AAA', 'large');
    
    expect(isCompliant).toBe(true);
  });
});

describe('generateA11yId', () => {
  it('generates unique IDs with given prefix', () => {
    const id1 = generateA11yId('button');
    const id2 = generateA11yId('button');
    
    expect(id1).toMatch(/^button-[a-z0-9]+$/);
    expect(id2).toMatch(/^button-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('includes the prefix in the generated ID', () => {
    const id = generateA11yId('modal');
    
    expect(id).toContain('modal-');
  });
});
