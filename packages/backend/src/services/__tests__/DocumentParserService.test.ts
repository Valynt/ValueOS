import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock('../../lib/agent-fabric/LLMGateway', () => ({
  LLMGateway: vi.fn(function MockLLMGateway() {
    return {
      complete: vi.fn(),
    };
  }),
}));

import { DocumentParserService } from '../domain-packs/DocumentParserService.js'

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

  it('rejects oversized files before calling edge parser or fallback parser', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const svc = new DocumentParserService();
    const oversizedContent = 'x'.repeat(6 * 1024 * 1024);
    const oversizedTextFile = new File([oversizedContent], 'large.txt', {
      type: 'text/plain',
      lastModified: 0,
    });

    await expect(svc.parseDocument(oversizedTextFile)).rejects.toThrow(
      /too large to parse/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
