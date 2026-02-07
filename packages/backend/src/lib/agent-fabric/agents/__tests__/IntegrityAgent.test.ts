import { describe, it, expect } from 'vitest'
import { IntegrityAgent } from '../IntegrityAgent.js'

describe('IntegrityAgent veto decision helper', () => {
  it('requests re-refine when confidence < 0.85', () => {
    const res = IntegrityAgent.evaluateVetoDecision({ isValid: false, confidence: 0.6, issues: [] });
    expect(res.reRefine).toBe(true);
    expect(res.veto).toBe(false);
  });

  it('vetoes when there is a high severity data_integrity issue', () => {
    const res = IntegrityAgent.evaluateVetoDecision({ isValid: false, confidence: 0.95, issues: [{ type: 'data_integrity', severity: 'high', description: 'bad' }] });
    expect(res.veto).toBe(true);
  });
});
