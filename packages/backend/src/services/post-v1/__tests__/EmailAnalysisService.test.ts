// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type TaskContext from '../../../lib/agent-fabric/TaskContext';
import { createTaskContext } from '../../../lib/agent-fabric/TaskContext';
import { ValidationError } from '../../../lib/errors.js';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('../../../lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/supabase')>('../../../lib/supabase');
  return {
    assertNotTestEnv: vi.fn(),
    ...actual,
    createServerSupabaseClient: () => ({
      auth: {
        getSession: getSessionMock,
      },
    }),
  };
});

vi.mock('../../../lib/llm/secureLLMWrapper.js', () => ({
  secureLLMComplete: vi.fn(),
}));

import { secureLLMComplete } from '../../../lib/llm/secureLLMWrapper.js';
import { emailAnalysisService } from '../EmailAnalysisService';

const RAW_THREAD = `From: Seller <seller@example.com>\nTo: Buyer <buyer@example.com>\nSubject: Follow-up\n\nCan we review pricing this week?`;

const MOCK_LLM_RESPONSE = {
  content: JSON.stringify({
    threadSummary: 'summary',
    sentiment: 'neutral',
  }),
};

describe('EmailAnalysisService.analyzeThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(secureLLMComplete).mockResolvedValue(MOCK_LLM_RESPONSE);
  });

  it('propagates organizationId and userId from canonical TaskContext into secureLLMComplete options', async () => {
    const taskContext: TaskContext = createTaskContext({
      task_id: 'task-1',
      workspace_id: 'workspace-1',
      organization_id: 'org-123',
      user_id: 'user-123',
      input: {},
      correlation_id: 'corr-1',
    });

    await emailAnalysisService.analyzeThread(RAW_THREAD, taskContext);

    expect(secureLLMComplete).toHaveBeenCalledOnce();
    expect(secureLLMComplete).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Array),
      expect.objectContaining({
        organizationId: 'org-123',
        userId: 'user-123',
        serviceName: 'EmailAnalysisService',
        operation: 'analyzeThread',
      }),
    );
  });

  it('constructs canonical TaskContext from session and propagates identifiers to secureLLMComplete', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-session-1',
            user_metadata: {
              organization_id: 'org-session-1',
            },
            app_metadata: {},
          },
        },
      },
    });

    await emailAnalysisService.analyzeThread(RAW_THREAD);

    expect(secureLLMComplete).toHaveBeenCalledOnce();
    const options = vi.mocked(secureLLMComplete).mock.calls[0]?.[2];
    expect(options).toEqual(expect.objectContaining({
      organizationId: 'org-session-1',
      userId: 'user-session-1',
    }));
  });

  it('returns a typed ValidationError when organization_id is missing', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-session-2',
            user_metadata: {},
            app_metadata: {},
          },
        },
      },
    });

    const analysisPromise = emailAnalysisService.analyzeThread(RAW_THREAD);

    await expect(analysisPromise).rejects.toBeInstanceOf(ValidationError);
    await expect(analysisPromise).rejects.toMatchObject({
      message: 'organization_id is required for EmailAnalysisService.llmAnalyze()',
    });
    expect(secureLLMComplete).not.toHaveBeenCalled();
  });
});
