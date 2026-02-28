import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditLogger } from '../../AuditLogger';
import { LLMGateway } from '../../LLMGateway';
import { MemorySystem } from '../../MemorySystem';
import { AgentConfig } from '../BaseAgent';
import { CompanyIntelligenceAgent } from '../CompanyIntelligenceAgent';

// Mock dependencies
const mockLLMGateway = {
  execute: vi.fn(),
} as unknown as LLMGateway;

const mockMemorySystem = {
  storeEpisodic: vi.fn(),
  storeSemantic: vi.fn(),
  retrieve: vi.fn(),
  search: vi.fn(),
} as unknown as MemorySystem;

const mockAuditLogger = {
  logAgentExecution: vi.fn(),
} as unknown as AuditLogger;

const mockSupabase = {
  from: vi.fn(),
} as unknown as ReturnType<typeof createClient>;

describe('CompanyIntelligenceAgent', () => {
  let agent: CompanyIntelligenceAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    const config: AgentConfig = {
      id: 'test-agent',
      organizationId: 'org-123',
      userId: 'user-123',
      sessionId: 'session-123',
      supabase: mockSupabase,
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
    };

    agent = new CompanyIntelligenceAgent(config);
  });

  it('should successfully analyze company intelligence', async () => {
    const mockResponseData = {
      company_profile: {
        name: "Test Corp",
        industry: "Tech",
        size: "Large",
        description: "A testing company"
      },
      key_stakeholders: [
        { name: "John Doe", role: "CEO", influence: "high" }
      ],
      strategic_priorities: [
        { priority: "Innovation", description: "Build new things" }
      ],
      decision_patterns: {
        style: "Data-driven"
      },
      confidence_level: "high",
      reasoning: "Analysis based on provided context.",
      hallucination_check: true
    };

    // Mock LLM response
    (mockLLMGateway.execute as any).mockResolvedValue({
      content: JSON.stringify(mockResponseData),
      tokenUsage: { input: 100, output: 100, total: 200 },
    });

    const result = await agent.execute({
        agentType: "company-intelligence" as any,
        query: "Analyze Test Corp",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponseData);
    expect(mockLLMGateway.execute).toHaveBeenCalled();

    const callArgs = (mockLLMGateway.execute as any).mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("You are a precise AI assistant");
    expect(callArgs.messages[1].content).toContain("Analyze the following company/entity");
  });

  it('should handle invalid JSON from LLM (retry logic in secureInvoke)', async () => {
     const mockResponseData = {
      company_profile: {
        name: "Test Corp",
        industry: "Tech",
        size: "Large",
        description: "A testing company"
      },
      key_stakeholders: [],
      strategic_priorities: [],
      decision_patterns: { style: "Fast" },
      confidence_level: "medium",
      reasoning: "Retry test",
      hallucination_check: true
    };

    // First call fails (invalid JSON), second succeeds
    (mockLLMGateway.execute as any)
      .mockResolvedValueOnce({
        content: "Invalid JSON",
        tokenUsage: { input: 10, output: 10, total: 20 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(mockResponseData),
        tokenUsage: { input: 100, output: 100, total: 200 },
      });

    const result = await agent.execute({
        agentType: "company-intelligence" as any,
        query: "Analyze Test Corp",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockResponseData);
    expect(mockLLMGateway.execute).toHaveBeenCalledTimes(2);
  });
});
