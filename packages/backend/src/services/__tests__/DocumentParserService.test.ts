import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock('../../lib/agent-fabric/LLMGateway', () => ({
  LLMGateway: class MockLLMGateway {
    complete = vi.fn();
    constructor(..._args: unknown[]) {}
  },
}));

import { DocumentParserService } from '../DocumentParserService.js'

describe('DocumentParserService.parseDocument fallback', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback text when parsing non-text file fails', async () => {
    const svc = new DocumentParserService();
    const file = new File([Uint8Array.from([0, 1, 2, 3])], 'binary.bin', {
      type: 'application/pdf',
      lastModified: 0,
    });

    const result = await svc.parseDocument(file);
    expect(result.text).toContain('Unable to extract text');
    expect(result.metadata.fileName).toBe('binary.bin');
  });
});
