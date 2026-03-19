import {
  CANONICAL_SLO_THRESHOLDS,
  classifyLatencyClass,
  resolveSLOThresholds,
} from '../slo';

describe('slo config', () => {
  it('keeps the production split-latency contract', () => {
    expect(CANONICAL_SLO_THRESHOLDS.interactiveLatencyP95Ms).toBe(200);
    expect(CANONICAL_SLO_THRESHOLDS.orchestrationTtfbP95Ms).toBe(200);
    expect(CANONICAL_SLO_THRESHOLDS.orchestrationCompletionP95Ms).toBe(3000);
  });

  it('supports split-latency environment overrides', () => {
    const thresholds = resolveSLOThresholds('staging', {
      SLO_STAGING_INTERACTIVE_LATENCY_P95_MS: '240',
      SLO_STAGING_ORCHESTRATION_TTFB_P95_MS: '260',
      SLO_STAGING_ORCHESTRATION_COMPLETION_P95_MS: '4200',
    } as NodeJS.ProcessEnv);

    expect(thresholds.interactiveLatencyP95Ms).toBe(240);
    expect(thresholds.orchestrationTtfbP95Ms).toBe(260);
    expect(thresholds.orchestrationCompletionP95Ms).toBe(4200);
  });

  it('classifies orchestration and interactive routes consistently', () => {
    expect(classifyLatencyClass('/api/llm/chat')).toBe('orchestration');
    expect(classifyLatencyClass('/api/billing/summary')).toBe('orchestration');
    expect(classifyLatencyClass('/api/health/ready')).toBe('interactive');
    expect(classifyLatencyClass('/api/customer/value-case/123')).toBe('interactive');
  });
});
