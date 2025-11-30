import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock('../../lib/agent-fabric/LLMGateway', () => ({
  LLMGateway: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
  })),
}));

import { DocumentParserService } from '../DocumentParserService';

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
