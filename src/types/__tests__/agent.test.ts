/**
 * Canonical Agent Types Tests
 * 
 * Tests for the IAgent interface, type definitions, and Zod schemas
 */

import { describe, it, expect } from 'vitest';
import {
  AgentType,
  LifecycleStage,
  ConfidenceLevel,
  AgentHealthStatus,
  AgentInput,
  AgentOutput,
  SecureAgentOutput,
  IAgent,
  AgentRegistration,
  AgentRecord,
  AGENT_CAPABILITIES,
  AgentInputSchema,
  AgentOutputSchema,
} from '../agent';

describe('Agent Type Definitions', () => {
  describe('AgentType', () => {
    it('should include all lifecycle agents', () => {
      const lifecycleAgents: AgentType[] = [
        'opportunity',
        'target',
        'realization',
        'expansion',
        'integrity',
      ];
      
      lifecycleAgents.forEach(agent => {
        const test: AgentType = agent;
        expect(test).toBe(agent);
      });
    });

    it('should include all analysis agents', () => {
      const analysisAgents: AgentType[] = [
        'system-mapper',
        'value-mapping',
        'company-intelligence',
      ];
      
      analysisAgents.forEach(agent => {
        const test: AgentType = agent;
        expect(test).toBe(agent);
      });
    });

    it('should include coordination agents', () => {
      const coordAgents: AgentType[] = [
        'coordinator',
        'value-eval',
        'communicator',
      ];
      
      coordAgents.forEach(agent => {
        const test: AgentType = agent;
        expect(test).toBe(agent);
      });
    });
  });

  describe('LifecycleStage', () => {
    it('should include VOS lifecycle stages', () => {
      const stages: LifecycleStage[] = [
        'opportunity',
        'target',
        'realization',
        'expansion',
        'integrity',
      ];
      
      stages.forEach(stage => {
        const test: LifecycleStage = stage;
        expect(test).toBe(stage);
      });
    });
  });

  describe('ConfidenceLevel', () => {
    it('should have three levels', () => {
      const levels: ConfidenceLevel[] = ['high', 'medium', 'low'];
      
      levels.forEach(level => {
        const test: ConfidenceLevel = level;
        expect(test).toBe(level);
      });
    });
  });

  describe('AgentHealthStatus', () => {
    it('should have three statuses', () => {
      const statuses: AgentHealthStatus[] = ['healthy', 'degraded', 'offline'];
      
      statuses.forEach(status => {
        const test: AgentHealthStatus = status;
        expect(test).toBe(status);
      });
    });
  });
});

describe('Agent Input/Output Interfaces', () => {
  describe('AgentInput', () => {
    it('should require sessionId and query', () => {
      const input: AgentInput = {
        sessionId: 'session-123',
        query: 'Test query',
      };
      
      expect(input.sessionId).toBe('session-123');
      expect(input.query).toBe('Test query');
    });

    it('should allow optional fields', () => {
      const input: AgentInput = {
        sessionId: 'session-123',
        query: 'Test query',
        userId: 'user-456',
        context: { tenantId: 'tenant-1' },
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      };
      
      expect(input.userId).toBe('user-456');
      expect(input.context?.tenantId).toBe('tenant-1');
      expect(input.conversationHistory).toHaveLength(2);
    });
  });

  describe('AgentOutput', () => {
    it('should require core fields', () => {
      const output: AgentOutput = {
        success: true,
        result: { analysis: 'test' },
        confidenceLevel: 'high',
        confidenceScore: 0.95,
      };
      
      expect(output.success).toBe(true);
      expect(output.confidenceLevel).toBe('high');
      expect(output.confidenceScore).toBe(0.95);
    });

    it('should allow error output', () => {
      const errorOutput: AgentOutput = {
        success: false,
        result: null,
        confidenceLevel: 'low',
        confidenceScore: 0,
        error: 'Something went wrong',
      };
      
      expect(errorOutput.success).toBe(false);
      expect(errorOutput.error).toBe('Something went wrong');
    });

    it('should allow evidence and assumptions', () => {
      const output: AgentOutput = {
        success: true,
        result: { data: 'test' },
        confidenceLevel: 'medium',
        confidenceScore: 0.7,
        reasoning: 'Based on historical data',
        evidence: [
          { source: 'database', description: 'Historical records', confidence: 0.9 },
        ],
        assumptions: ['Market conditions remain stable'],
        dataGaps: ['Missing Q4 data'],
      };
      
      expect(output.evidence).toHaveLength(1);
      expect(output.assumptions).toHaveLength(1);
      expect(output.dataGaps).toHaveLength(1);
    });
  });

  describe('SecureAgentOutput', () => {
    it('should extend AgentOutput with hallucination check', () => {
      const secureOutput: SecureAgentOutput = {
        success: true,
        result: { data: 'test' },
        confidenceLevel: 'high',
        confidenceScore: 0.95,
        hallucinationCheck: false,
      };
      
      expect(secureOutput.hallucinationCheck).toBe(false);
    });

    it('should allow hallucination indicators', () => {
      const secureOutput: SecureAgentOutput = {
        success: true,
        result: { data: 'test' },
        confidenceLevel: 'low',
        confidenceScore: 0.3,
        hallucinationCheck: true,
        hallucinationIndicators: [
          'Inconsistent with known data',
          'Unsupported claims',
        ],
      };
      
      expect(secureOutput.hallucinationIndicators).toHaveLength(2);
    });
  });
});

describe('Agent Registration Interfaces', () => {
  describe('AgentRegistration', () => {
    it('should require core fields', () => {
      const registration: AgentRegistration = {
        id: 'agent-123',
        name: 'Test Agent',
        lifecycleStage: 'opportunity',
        capabilities: ['analyze', 'recommend'],
      };
      
      expect(registration.id).toBe('agent-123');
      expect(registration.capabilities).toHaveLength(2);
    });

    it('should allow optional fields', () => {
      const registration: AgentRegistration = {
        id: 'agent-123',
        name: 'Test Agent',
        lifecycleStage: 'opportunity',
        capabilities: ['analyze'],
        region: 'us-east-1',
        endpoint: 'http://localhost:8080',
        metadata: { version: '1.0.0' },
      };
      
      expect(registration.region).toBe('us-east-1');
      expect(registration.endpoint).toBe('http://localhost:8080');
    });
  });

  describe('AgentRecord', () => {
    it('should extend registration with runtime state', () => {
      const record: AgentRecord = {
        id: 'agent-123',
        name: 'Test Agent',
        lifecycleStage: 'opportunity',
        capabilities: ['analyze'],
        load: 0.5,
        status: 'healthy',
        lastHeartbeat: Date.now(),
        consecutiveFailures: 0,
        stickySessions: new Set(['session-1', 'session-2']),
      };
      
      expect(record.load).toBe(0.5);
      expect(record.status).toBe('healthy');
      expect(record.stickySessions.size).toBe(2);
    });
  });
});

describe('Agent Capabilities', () => {
  it('should define discovery capabilities', () => {
    expect(AGENT_CAPABILITIES.DISCOVER_PAIN_POINTS).toBe('discover_pain_points');
    expect(AGENT_CAPABILITIES.ANALYZE_TRANSCRIPTS).toBe('analyze_transcripts');
    expect(AGENT_CAPABILITIES.MAP_PERSONAS).toBe('map_personas');
  });

  it('should define analysis capabilities', () => {
    expect(AGENT_CAPABILITIES.SYSTEM_MAPPING).toBe('system_mapping');
    expect(AGENT_CAPABILITIES.DEPENDENCY_ANALYSIS).toBe('dependency_analysis');
    expect(AGENT_CAPABILITIES.BOTTLENECK_IDENTIFICATION).toBe('bottleneck_identification');
  });

  it('should define financial capabilities', () => {
    expect(AGENT_CAPABILITIES.ROI_CALCULATION).toBe('roi_calculation');
    expect(AGENT_CAPABILITIES.SCENARIO_MODELING).toBe('scenario_modeling');
    expect(AGENT_CAPABILITIES.FINANCIAL_PROJECTION).toBe('financial_projection');
  });

  it('should define coordination capabilities', () => {
    expect(AGENT_CAPABILITIES.TASK_PLANNING).toBe('task_planning');
    expect(AGENT_CAPABILITIES.AGENT_ROUTING).toBe('agent_routing');
    expect(AGENT_CAPABILITIES.SDUI_GENERATION).toBe('sdui_generation');
  });
});

describe('Zod Schemas', () => {
  describe('AgentInputSchema', () => {
    it('should validate valid input', () => {
      const result = AgentInputSchema.safeParse({
        sessionId: 'session-123',
        query: 'Test query',
      });
      
      expect(result.success).toBe(true);
    });

    it('should reject missing sessionId', () => {
      const result = AgentInputSchema.safeParse({
        query: 'Test query',
      });
      
      expect(result.success).toBe(false);
    });

    it('should reject missing query', () => {
      const result = AgentInputSchema.safeParse({
        sessionId: 'session-123',
      });
      
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const result = AgentInputSchema.safeParse({
        sessionId: 'session-123',
        query: 'Test query',
        userId: 'user-456',
        context: { key: 'value' },
        conversationHistory: [
          { role: 'user', content: 'Hello' },
        ],
      });
      
      expect(result.success).toBe(true);
    });

    it('should validate conversation history roles', () => {
      const result = AgentInputSchema.safeParse({
        sessionId: 'session-123',
        query: 'Test',
        conversationHistory: [
          { role: 'invalid', content: 'Hello' },
        ],
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('AgentOutputSchema', () => {
    it('should validate valid output', () => {
      const result = AgentOutputSchema.safeParse({
        success: true,
        result: { data: 'test' },
        confidenceLevel: 'high',
        confidenceScore: 0.95,
      });
      
      expect(result.success).toBe(true);
    });

    it('should reject invalid confidence level', () => {
      const result = AgentOutputSchema.safeParse({
        success: true,
        result: {},
        confidenceLevel: 'very-high', // Invalid
        confidenceScore: 0.95,
      });
      
      expect(result.success).toBe(false);
    });

    it('should reject confidence score out of range', () => {
      const resultTooHigh = AgentOutputSchema.safeParse({
        success: true,
        result: {},
        confidenceLevel: 'high',
        confidenceScore: 1.5, // > 1
      });
      
      expect(resultTooHigh.success).toBe(false);

      const resultTooLow = AgentOutputSchema.safeParse({
        success: true,
        result: {},
        confidenceLevel: 'high',
        confidenceScore: -0.5, // < 0
      });
      
      expect(resultTooLow.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const result = AgentOutputSchema.safeParse({
        success: true,
        result: { data: 'test' },
        confidenceLevel: 'medium',
        confidenceScore: 0.7,
        reasoning: 'Based on analysis',
        evidence: [
          { source: 'db', description: 'Records', confidence: 0.9 },
        ],
        assumptions: ['Market stable'],
        dataGaps: ['Missing data'],
        processingTimeMs: 150,
        nextStage: 'analysis',
      });
      
      expect(result.success).toBe(true);
    });
  });
});

describe('IAgent Interface Contract', () => {
  // This test verifies the interface contract is correct
  it('should define required properties and methods', () => {
    // Create a mock implementation
    const mockAgent: IAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      lifecycleStage: 'opportunity',
      version: '1.0.0',
      capabilities: ['analyze'],
      execute: async (input: AgentInput) => ({
        success: true,
        result: {},
        confidenceLevel: 'high' as const,
        confidenceScore: 0.9,
      }),
      canHandle: (query: string) => query.includes('test'),
      getHealthStatus: async () => 'healthy' as const,
    };

    expect(mockAgent.id).toBe('test-agent');
    expect(mockAgent.lifecycleStage).toBe('opportunity');
    expect(typeof mockAgent.execute).toBe('function');
    expect(typeof mockAgent.canHandle).toBe('function');
    expect(typeof mockAgent.getHealthStatus).toBe('function');
  });

  it('should allow async execute method', async () => {
    const mockAgent: IAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      lifecycleStage: 'opportunity',
      version: '1.0.0',
      capabilities: ['analyze'],
      execute: async (input: AgentInput) => ({
        success: true,
        result: { processed: input.query },
        confidenceLevel: 'high' as const,
        confidenceScore: 0.95,
      }),
      canHandle: () => true,
      getHealthStatus: async () => 'healthy' as const,
    };

    const result = await mockAgent.execute({
      sessionId: 'test',
      query: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.result.processed).toBe('Hello');
  });
});
