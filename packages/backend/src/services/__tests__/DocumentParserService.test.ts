import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockSecureLLMComplete } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSecureLLMComplete: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
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

vi.mock('../../lib/llm/secureLLMWrapper', () => ({
  secureLLMComplete: mockSecureLLMComplete,
}));

import { DocumentParserService } from '../domain-packs/DocumentParserService.js'

describe('DocumentParserService.parseDocument fallback', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSecureLLMComplete.mockResolvedValue({
      content: '{"painPoints":[],"stakeholders":[],"opportunities":[],"nextSteps":[],"summary":"ok"}',
    });
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

  it('passes tenant org id from session metadata to secureLLMComplete', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          id: 'session-123',
          user: {
            id: 'user-123',
            raw_user_meta_data: {
              tenant_id: 'org-tenant-123',
            },
          },
        },
      },
    });

    const svc = new DocumentParserService();
    const file = new File(['hello world'], 'notes.txt', {
      type: 'text/plain',
      lastModified: 0,
    });

    await svc.parseAndExtract(file);

    expect(mockSecureLLMComplete).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org-tenant-123',
      }),
    );
  });

  it('returns controlled error when tenant context is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          id: 'session-123',
          user: {
            id: 'user-123',
            raw_user_meta_data: {},
          },
        },
      },
    });

    const svc = new DocumentParserService();
    const file = new File(['hello world'], 'notes.txt', {
      type: 'text/plain',
      lastModified: 0,
    });

    await expect(svc.parseAndExtract(file)).rejects.toThrow(
      'DocumentParserService.extractInsights requires task context with organization_id',
    );
  });
});
