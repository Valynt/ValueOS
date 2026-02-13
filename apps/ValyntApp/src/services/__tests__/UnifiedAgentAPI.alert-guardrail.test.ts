import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/env', () => ({
  env: { isProduction: false },
  getEnvVar: vi.fn().mockReturnValue(undefined),
  getGroundtruthConfig: vi.fn().mockReturnValue({
    apiUrl: '',
    apiKey: '',
    timeoutMs: 5000,
  }),
}));

vi.mock('../CircuitBreaker', () => ({
  CircuitBreakerManager: class {
    execute = vi.fn().mockImplementation((_key, fn) => fn());
    getState = vi.fn().mockReturnValue({ state: 'closed', failure_count: 0 });
    reset = vi.fn();
    exportState = vi.fn().mockReturnValue({});
  },
}));

vi.mock('../AgentRegistry', () => ({
  AgentRegistry: class {
    registerAgent = vi.fn();
    getAgent = vi.fn().mockReturnValue(null);
  },
}));

vi.mock('../AgentAuditLogger', () => ({
  getAuditLogger: vi.fn().mockReturnValue(null),
  logAgentResponse: vi.fn(),
}));

vi.mock('../GroundtruthAPI', () => ({
  default: class {
    isConfigured() {
      return false;
    }
  },
}));

import { UnifiedAgentAPI } from '../UnifiedAgentAPI';

describe('UnifiedAgentAPI alert-details guardrail', () => {
  it('short-circuits invalid alert payload before executeAgentRequest', async () => {
    const api = new UnifiedAgentAPI();
    const executeSpy = vi.spyOn(api as any, 'executeAgentRequest');

    const result = await api.invoke({
      agent: 'opportunity',
      query: 'Analyze this alert',
      tenantId: 'tenant-abc-1234',
      context: {
        caseId: 'case-xyz-5678',
        alertDetails: {
          alertId: 'alert-1',
          caseId: 'case-xyz-5678',
          tenantId: 'tenant-abc-1234',
          title: 'Suspicious login',
          summary: 'Repeated failed attempts',
          severity: 'urgent',
          source: 'siem',
          detectedAt: 'not-a-date',
        },
      },
    });

    expect(executeSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.payload).toMatchObject({
      errorType: 'InputGuardrailTripwire',
      code: 'ALERT_DETAILS_VALIDATION_FAILED',
    });
    expect((result.payload as any).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'severity' }),
        expect.objectContaining({ path: 'detectedAt' }),
      ])
    );
  });
});
