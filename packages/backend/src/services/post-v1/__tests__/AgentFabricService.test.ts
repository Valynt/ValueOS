// @vitest-environment node
/**
 * AgentFabricService — tenant isolation tests
 *
 * Verifies that getValueCaseById returns null when the value_case exists
 * but belongs to a different organization.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock supabase before importing the service
const mockSingle = vi.fn();

const buildChain = () => {
  const chain: Record<string, unknown> = {};
  chain['select'] = vi.fn(() => chain);
  chain['eq'] = vi.fn(() => chain);
  chain['single'] = mockSingle;
  chain['order'] = vi.fn(() => chain);
  chain['neq'] = vi.fn(() => chain);
  return chain;
};

vi.mock('../../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => buildChain()),
  },
}));

import { agentFabricService } from '../AgentFabricService.js';
import { supabase } from '../../../lib/supabase.js';

describe('AgentFabricService.getValueCaseById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the value_case does not belong to the given organization', async () => {
    // Supabase returns null data when the row is not found for this org
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain['select'] = vi.fn(() => chain);
      chain['eq'] = vi.fn(() => chain);
      chain['single'] = vi.fn().mockResolvedValue({ data: null, error: null });
      chain['order'] = vi.fn(() => chain);
      chain['neq'] = vi.fn(() => chain);
      return chain;
    });

    const result = await agentFabricService.getValueCaseById('case-123', 'org-other');
    expect(result).toBeNull();
  });

  it('passes organization_id as a filter on the value_cases query', async () => {
    const eqSpy = vi.fn().mockReturnThis();
    const singleSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      single: singleSpy,
      order: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    }));

    await agentFabricService.getValueCaseById('case-abc', 'org-xyz');

    // The first .eq call on value_cases must include organization_id
    const eqCalls = eqSpy.mock.calls as [string, string][];
    const hasOrgFilter = eqCalls.some(
      ([col, val]) => col === 'organization_id' && val === 'org-xyz',
    );
    expect(hasOrgFilter).toBe(true);
  });
});
