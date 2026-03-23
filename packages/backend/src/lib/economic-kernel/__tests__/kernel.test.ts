import { describe, it, expect } from 'vitest';
import { EconomicKernel, FinancialDecimal as Decimal } from '../index';

describe('EconomicKernel', () => {
  const kernel = new EconomicKernel();

  it('calculates NPV correctly', () => {
    const cashFlows = ['-1000', '300', '400', '400', '300'].map(v => new Decimal(v));
    const npv = kernel.calculateNPV(cashFlows, new Decimal('0.1'));
    expect(npv.toNumber()).toBeCloseTo(108.74, 2);
  });

  it('calculates IRR correctly', () => {
    const cashFlows = ['-1000', '300', '400', '400', '300'].map(v => new Decimal(v));
    const irr = kernel.calculateIRR(cashFlows);
    expect(irr).toBeDefined();
    expect(irr!.toNumber()).toBeGreaterThan(0.14);
    expect(irr!.toNumber()).toBeLessThan(0.15);
  });

  it('calculates ROI correctly', () => {
    const roi = kernel.calculateROI(new Decimal('1000'), new Decimal('1500'));
    expect(roi.toNumber()).toBeCloseTo(50, 2);
  });

  it('calculates payback at correct month', () => {
    const payback = kernel.calculatePayback(['-1000', '400', '400', '400'].map(v => new Decimal(v)));
    // Cumulative: -1000 (m0), -600 (m1), -200 (m2), +200 (m3) -> pays back at m2.5 (halfway through m3)
    expect(payback).toBeCloseTo(2.5, 1);
  });

  it('uses Decimal precision (no floating point errors)', () => {
    const result = new Decimal('0.1').plus('0.2');
    expect(result.toString()).toBe('0.3');
  });

  it('generates three scenarios', () => {
    const base = { initialInvestment: new Decimal('1000'), annualSavings: new Decimal('500'), timeframeYears: new Decimal('3') };
    const ranges = new Map([['annualSavings', { low: new Decimal('400'), base: new Decimal('500'), high: new Decimal('650') }]]);
    const scenarios = kernel.generateScenarios(base, ranges, new Decimal('0.1'));
    expect(scenarios).toHaveLength(3);
  });

  it('returns -1 for empty cash flows in payback', () => {
    expect(kernel.calculatePayback([])).toBe(-1);
  });

  it('returns -1 for all-positive cash flows (no investment)', () => {
    const payback = kernel.calculatePayback(['500', '500', '500'].map(v => new Decimal(v)));
    expect(payback).toBe(-1);
  });

  it('does not mutate global Decimal precision', () => {
    // Importing the kernel uses Decimal.clone(), so the base constructor is untouched
    const { default: GlobalDecimal } = require('decimal.js');
    expect(GlobalDecimal.precision).toBe(20); // decimal.js default
  });
});
