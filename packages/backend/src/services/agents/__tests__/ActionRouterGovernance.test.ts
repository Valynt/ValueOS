import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyGovernanceObligations } from '../ActionRouterGovernance.js';

// Mock the logger
vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { logger } from '../../../lib/logger.js';

describe('ActionRouterGovernance - applyGovernanceObligations', () => {
  const baseAction = {
    type: 'invokeAgent',
    payload: {
      foo: 'bar',
      secret: 'hidden',
    },
  };

  const baseContext = {
    userId: 'user-1',
    workspaceId: 'workspace-1',
    organizationId: 'org-1',
    traceId: 'trace-1',
    sessionId: 'session-1',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return action unchanged when no obligations are provided', () => {
    const result = applyGovernanceObligations(baseAction as any, baseContext as any, []);
    expect(result).toEqual(baseAction);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should handle LOG_AUDIT obligation', () => {
    const obligations = [{ type: 'LOG_AUDIT' }];
    const result = applyGovernanceObligations(baseAction as any, baseContext as any, obligations as any);

    expect(result).toEqual(baseAction);
    expect(logger.info).toHaveBeenCalledWith('governance: audit obligation — action approved', expect.objectContaining({
      actionType: baseAction.type,
      userId: baseContext.userId,
      workspaceId: baseContext.workspaceId,
      traceId: baseContext.traceId,
    }));
  });

  it('should handle REDACT_FIELDS obligation', () => {
    const obligations = [{ type: 'REDACT_FIELDS', fields: ['secret'] }];
    const result = applyGovernanceObligations(baseAction as any, baseContext as any, obligations as any);

    expect(result).toEqual({
      ...baseAction,
      payload: { foo: 'bar' },
    });
    expect((result.payload as any).secret).toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith('governance: REDACT_FIELDS obligation applied', {
      actionType: baseAction.type,
      fields: ['secret'],
    });
  });

  it('should safely handle REDACT_FIELDS when payload is undefined or not an object', () => {
    const actionWithoutPayload = { type: 'invokeAgent' };
    const obligations = [{ type: 'REDACT_FIELDS', fields: ['secret'] }];
    const result = applyGovernanceObligations(actionWithoutPayload as any, baseContext as any, obligations as any);

    expect(result).toEqual(actionWithoutPayload);
    expect(logger.info).toHaveBeenCalled();
  });

  it('should handle REQUIRE_APPROVAL obligation', () => {
    const obligations = [{ type: 'REQUIRE_APPROVAL' }];
    const result = applyGovernanceObligations(baseAction as any, baseContext as any, obligations as any);

    expect(result).toEqual(baseAction);
    expect(logger.warn).toHaveBeenCalledWith('governance: unexpected REQUIRE_APPROVAL in applyGovernanceObligations — already handled', {
      actionType: baseAction.type,
    });
  });

  it('should handle READ_ONLY obligation', () => {
    const obligations = [{ type: 'READ_ONLY' }];
    const result = applyGovernanceObligations(baseAction as any, baseContext as any, obligations as any);

    expect(result.payload).toEqual({
      foo: 'bar',
      secret: 'hidden',
      __readOnly: true,
    });
    expect(logger.warn).toHaveBeenCalledWith('governance: READ_ONLY obligation — downgrading action', {
      actionType: baseAction.type,
      userId: baseContext.userId,
    });
  });

  it('should handle READ_ONLY obligation when payload is initially undefined', () => {
    const actionWithoutPayload = { type: 'invokeAgent' };
    const obligations = [{ type: 'READ_ONLY' }];
    const result = applyGovernanceObligations(actionWithoutPayload as any, baseContext as any, obligations as any);

    expect(result.payload).toEqual({
      __readOnly: true,
    });
  });

  it('should apply multiple obligations in sequence', () => {
    const obligations = [
      { type: 'LOG_AUDIT' },
      { type: 'REDACT_FIELDS', fields: ['secret'] },
      { type: 'READ_ONLY' }
    ];

    const result = applyGovernanceObligations(baseAction as any, baseContext as any, obligations as any);

    expect(result.payload).toEqual({
      foo: 'bar',
      __readOnly: true,
    });

    expect(logger.info).toHaveBeenCalledTimes(2); // LOG_AUDIT and REDACT_FIELDS
    expect(logger.warn).toHaveBeenCalledTimes(1); // READ_ONLY
  });
});
