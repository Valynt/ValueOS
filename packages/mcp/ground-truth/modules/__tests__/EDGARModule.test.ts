import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { EDGARModule } from '../EDGARModule';

describe('EDGARModule.extractKeywords', () => {
  const module = new EDGARModule();

  beforeEach(async () => {
    await module.initialize({ userAgent: 'ValueOS qa@valueos.ai' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts and ranks keywords deterministically', async () => {
    vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      text: async () => 'Revenue improved while margin expanded. Revenue quality and margin discipline remained strong.',
    } as Response);

    const result = await module.extractKeywords('https://www.sec.gov/Archives/test.txt', [
      'revenue',
      'margin',
      'discipline',
    ]);

    expect(result.section).toBe('keywords');
    expect(result.keywords_found).toEqual(['revenue', 'margin', 'discipline']);
    expect(result.content).toContain('revenue:2');
    expect(result.content).toContain('margin:2');
  });

  it('rejects non-url accession input', async () => {
    await expect(module.extractKeywords('0000000000-24-123456', ['risk'])).rejects.toThrow(
      'Accession number must be a filing URL for keyword extraction'
    );
  });
});
