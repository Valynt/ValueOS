import { describe, expect, it } from 'vitest';

import {
  ASYNC_WARM_AGENT_TYPES,
  INTERACTIVE_SYNC_AGENT_ALLOWLIST,
  SCALE_TO_ZERO_ASYNC_ONLY_AGENT_DENYLIST,
  assertInteractiveSyncAgentAllowed,
  getAgentColdStartClass,
  isInteractiveSyncAgentAllowed,
  isScaleToZeroAsyncOnlyAgent,
} from './AgentInvocationPolicy.js';
import { resolveInteractiveAgentFromIntent } from '../middleware/SemanticIntentMiddleware.js';

describe('AgentInvocationPolicy', () => {
  it('keeps the synchronous request path limited to warm interactive agents', () => {
    expect(INTERACTIVE_SYNC_AGENT_ALLOWLIST).toEqual([
      'opportunity',
      'target',
      'integrity',
      'expansion',
      'realization',
      'financial-modeling',
    ]);
  });

  it('marks scale-to-zero agents as async-only', () => {
    expect(SCALE_TO_ZERO_ASYNC_ONLY_AGENT_DENYLIST).toEqual([
      'company-intelligence',
      'value-mapping',
      'system-mapper',
      'intervention-designer',
      'outcome-engineer',
      'coordinator',
      'value-eval',
      'communicator',
      'benchmark',
      'narrative',
      'groundtruth',
    ]);

    for (const agent of SCALE_TO_ZERO_ASYNC_ONLY_AGENT_DENYLIST) {
      expect(isScaleToZeroAsyncOnlyAgent(agent)).toBe(true);
      expect(isInteractiveSyncAgentAllowed(agent)).toBe(false);
      expect(getAgentColdStartClass(agent)).toBe('async-scale-to-zero');
    }
  });

  it('tracks warmed async workers separately from interactive capacity', () => {
    expect(ASYNC_WARM_AGENT_TYPES).toEqual(['research']);
    expect(getAgentColdStartClass('research')).toBe('async-warm');
  });

  it('rejects sync invocation attempts for async-only agents', () => {
    expect(() => assertInteractiveSyncAgentAllowed('narrative', 'test')).toThrow(
      /must not run on synchronous request path/i,
    );
  });

  it('prevents semantic intent routing from resolving scale-to-zero agents on interactive paths', () => {
    expect(resolveInteractiveAgentFromIntent('narrative')).toBeNull();
    expect(resolveInteractiveAgentFromIntent('research_company')).toBeNull();
    expect(resolveInteractiveAgentFromIntent('analyze_roi')).toBe('financial-modeling');
    expect(resolveInteractiveAgentFromIntent('opportunity')).toBe('opportunity');
  });
});
