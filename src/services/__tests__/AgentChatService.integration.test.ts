import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentChatService } from '../AgentChatService';
import { WorkflowStateRepository } from '../../repositories/WorkflowStateRepository';

// Mocks
vi.mock('../../lib/agent-fabric/LLMGateway', () => ({
  LLMGateway: vi.fn().mockImplementation(() => ({
    complete: vi.fn().mockResolvedValue({ content: 'High confidence response.\n- Reason 1' }),
    completeWithTools: vi.fn().mockResolvedValue({ content: 'Tool response' }),
  })),
}));

vi.mock('../ConversationHistoryService', () => ({
  conversationHistoryService: {
    addMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    formatForLLM: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../MCPGroundTruthService', () => ({
  mcpGroundTruthService: { isAvailable: vi.fn().mockReturnValue(false) },
}));

vi.mock('../MCPTools', () => ({
  getAllTools: vi.fn(),
  createToolExecutor: vi.fn(),
}));

vi.mock('../../sdui/templates/chat-templates', () => ({
  generateChatSDUIPage: vi.fn().mockReturnValue({
    type: 'page',
    version: 1,
    sections: [{ type: 'component', component: 'InfoBanner', version: 1, props: { title: 'Hello' } }],
  }),
  hasTemplateForStage: vi.fn().mockReturnValue(true),
}));

describe('AgentChatService integration path', () => {
  const stateRepo = {
    saveState: vi.fn().mockResolvedValue(undefined),
  } as unknown as WorkflowStateRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SDUI page and persists next state', async () => {
    const service = new AgentChatService(stateRepo);

    const response = await service.chat({
      query: 'Help with ROI',
      caseId: 'case-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      workflowState: {
        currentStage: 'opportunity',
        status: 'in_progress',
        completedStages: [],
        context: { caseId: 'case-1' },
      },
    });

    expect(response.sduiPage).toBeDefined();
    expect(response.nextState.currentStage).toBeDefined();
    expect(stateRepo.saveState).toHaveBeenCalledWith('sess-1', expect.any(Object));
  });
});
