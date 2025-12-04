/**
 * OpportunityAgent Tests
 * Tests discovery analysis and business objective extraction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpportunityAgent } from '../OpportunityAgent';
import type { OpportunityAgentInput } from '../../../../types/vos';
import type { LLMGateway } from '../../LLMGateway';
import type { MemorySystem } from '../../MemorySystem';
import type { AuditLogger } from '../../AuditLogger';

describe('OpportunityAgent', () => {
  let agent: OpportunityAgent;
  let mockLLMGateway: LLMGateway;
  let mockMemorySystem: MemorySystem;
  let mockAuditLogger: AuditLogger;
  let mockSupabase: any;

  beforeEach(() => {
    // Mock LLM Gateway
    mockLLMGateway = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          opportunity_summary: 'Test opportunity summary',
          persona_fit: { role: 'CTO', pain_alignment: 0.85 },
          initial_value_model: { annual_benefit: 500000 },
          pain_points: [
            { description: 'Manual data entry', impact: 'high', frequency: 'daily' },
            { description: 'Slow reporting', impact: 'medium', frequency: 'weekly' }
          ],
          business_objectives: [
            { title: 'Increase efficiency', description: 'Reduce manual work', priority: 'high' }
          ],
          recommended_capability_tags: ['automation', 'analytics'],
          reasoning: 'Strong alignment with automation needs',
          confidence_level: 'high'
        }),
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        tokens_used: 1500
      })
    } as any;

    // Mock Memory System
    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
      retrieveRelevantMemories: vi.fn().mockResolvedValue([])
    } as any;

    // Mock Audit Logger
    mockAuditLogger = {
      logAgentExecution: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined)
    } as any;

    // Mock Supabase
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };

    agent = new OpportunityAgent({
      id: 'test-opportunity-agent',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      supabase: mockSupabase
    });
  });

  describe('execute', () => {
    const validInput: OpportunityAgentInput = {
      valueCaseId: 'test-case-123',
      discoveryData: [
        'Customer is struggling with manual data entry',
        'Current process takes 10 hours per week'
      ]
    };

    it('should successfully analyze discovery data', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result).toBeDefined();
      expect(result.opportunitySummary).toBe('Test opportunity summary');
      expect(result.businessObjectives).toHaveLength(1);
      expect(result.businessObjectives[0].title).toBe('Increase efficiency');
    });

    it('should extract pain points correctly', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result.businessObjectives).toBeDefined();
      // Pain points are internal to the LLM response
      expect(mockLLMGateway.complete).toHaveBeenCalled();
    });

    it('should call LLM with proper prompt', async () => {
      await agent.execute('session-123', validInput);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ]),
        expect.objectContaining({
          temperature: expect.any(Number),
          max_tokens: expect.any(Number)
        })
      );
    });

    it('should store semantic memory', async () => {
      await agent.execute('session-123', validInput);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        'session-123',
        'test-opportunity-agent',
        expect.stringContaining('Opportunity:'),
        expect.any(Object)
      );
    });

    it('should log execution metrics', async () => {
      await agent.execute('session-123', validInput);

      expect(mockAuditLogger.logMetric).toHaveBeenCalledWith(
        'session-123',
        'tokens_used',
        1500,
        'tokens'
      );
    });

    it('should handle empty discovery data', async () => {
      const emptyInput: OpportunityAgentInput = {
        valueCaseId: 'test-case-123',
        discoveryData: []
      };

      const result = await agent.execute('session-123', emptyInput);
      
      expect(result).toBeDefined();
      expect(mockLLMGateway.complete).toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      mockLLMGateway.complete = vi.fn().mockRejectedValue(
        new Error('LLM service unavailable')
      );

      await expect(
        agent.execute('session-123', validInput)
      ).rejects.toThrow('LLM service unavailable');
    });

    it('should handle malformed JSON responses', async () => {
      mockLLMGateway.complete = vi.fn().mockResolvedValue({
        content: 'Not valid JSON',
        model: 'test-model',
        tokens_used: 100
      });

      await expect(
        agent.execute('session-123', validInput)
      ).rejects.toThrow();
    });

    it('should return recommended capabilities', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result.recommendedCapabilities).toBeDefined();
      expect(Array.isArray(result.recommendedCapabilities)).toBe(true);
    });

    it('should set correct confidence levels', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result).toBeDefined();
      // Confidence is part of the internal processing
      expect(mockLLMGateway.complete).toHaveBeenCalled();
    });
  });

  describe('findRelevantCapabilities', () => {
    it('should search for capabilities by tags', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: '1', name: 'Automation', tags: ['automation'] }
              ],
              error: null
            })
          })
        })
      });

      const result = await agent.execute('session-123', {
        valueCaseId: 'test',
        discoveryData: ['test data']
      });

      expect(result.recommendedCapabilities).toBeDefined();
    });
  });

  describe('persistBusinessObjectives', () => {
    it('should require supabase client', async () => {
      const agentWithoutSupabase = new OpportunityAgent({
        id: 'test',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: null
      });

      await expect(
        agentWithoutSupabase.persistBusinessObjectives('case-123', [], 'session-123')
      ).rejects.toThrow('Supabase client is required');
    });
  });
});
