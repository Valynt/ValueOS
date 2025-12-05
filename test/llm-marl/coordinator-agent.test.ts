/**
 * CoordinatorAgent Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoordinatorAgent } from '../../src/agents/CoordinatorAgent';
import type { CreateTaskIntent } from '../../src/types/Subgoal';

describe('CoordinatorAgent', () => {
  let agent: CoordinatorAgent;

  beforeEach(() => {
    agent = new CoordinatorAgent();
  });

  describe('planTask', () => {
    it('should create a task plan from intent', async () => {
      const intent: CreateTaskIntent = {
        user_id: 'user-123',
        intent_type: 'create_business_case',
        intent_description: 'Create a business case for digital transformation',
        context: {
          industry: 'manufacturing',
          size: 'enterprise',
        },
      };

      const plan = await agent.planTask(intent);

      expect(plan).toBeDefined();
      expect(plan.task_id).toBeDefined();
      expect(plan.subgoals).toBeInstanceOf(Array);
      expect(plan.subgoals.length).toBeGreaterThan(0);
      expect(plan.execution_order).toBeInstanceOf(Array);
      expect(plan.complexity_score).toBeGreaterThan(0);
      expect(plan.complexity_score).toBeLessThanOrEqual(1);
    });

    it('should generate subgoals based on task pattern', async () => {
      const intent: CreateTaskIntent = {
        user_id: 'user-123',
        intent_type: 'analyze_opportunity',
        intent_description: 'Analyze market opportunity',
      };

      const plan = await agent.planTask(intent);

      expect(plan.subgoals.length).toBeGreaterThan(0);
      
      // Should have discovery and analysis subgoals
      const types = plan.subgoals.map((sg) => sg.subgoal_type);
      expect(types).toContain('discovery');
      expect(types).toContain('analysis');
    });

    it('should resolve dependencies correctly', async () => {
      const intent: CreateTaskIntent = {
        user_id: 'user-123',
        intent_type: 'design_intervention',
        intent_description: 'Design intervention strategy',
      };

      const plan = await agent.planTask(intent);

      // Check that execution order respects dependencies
      const subgoalMap = new Map(plan.subgoals.map((sg) => [sg.id, sg]));
      
      for (const subgoalId of plan.execution_order) {
        const subgoal = subgoalMap.get(subgoalId);
        expect(subgoal).toBeDefined();
        
        // All dependencies should appear before this subgoal in execution order
        for (const depId of subgoal!.dependencies) {
          const depIndex = plan.execution_order.indexOf(depId);
          const currentIndex = plan.execution_order.indexOf(subgoalId);
          expect(depIndex).toBeLessThan(currentIndex);
        }
      }
    });

    it('should calculate complexity score', async () => {
      const simpleIntent: CreateTaskIntent = {
        user_id: 'user-123',
        intent_type: 'generate_report',
        intent_description: 'Generate simple report',
      };

      const complexIntent: CreateTaskIntent = {
        user_id: 'user-123',
        intent_type: 'create_business_case',
        intent_description: 'Create comprehensive business case',
        context: {
          stakeholders: ['team1', 'team2', 'team3'],
          requirements: ['req1', 'req2', 'req3', 'req4'],
        },
      };

      const simplePlan = await agent.planTask(simpleIntent);
      const complexPlan = await agent.planTask(complexIntent);

      expect(complexPlan.complexity_score).toBeGreaterThan(simplePlan.complexity_score);
    });

    it('should determine simulation requirement', async () => {
      const intent: CreateTaskIntent = {
        user_id: 'user-123',
        intent_type: 'create_business_case',
        intent_description: 'Create business case',
      };

      const plan = await agent.planTask(intent);

      expect(plan.requires_simulation).toBe(true);
    });
  });

  describe('generateSubgoals', () => {
    it('should generate subgoals for known pattern', async () => {
      const intent = {
        id: 'task-123',
        user_id: 'user-123',
        intent_type: 'analyze_opportunity' as const,
        intent_description: 'Analyze opportunity',
        context: {},
        created_at: new Date().toISOString(),
      };

      const subgoals = await agent.generateSubgoals(intent);

      expect(subgoals).toBeInstanceOf(Array);
      expect(subgoals.length).toBeGreaterThan(0);
      
      subgoals.forEach((sg) => {
        expect(sg.id).toBeDefined();
        expect(sg.parent_task_id).toBe(intent.id);
        expect(sg.assigned_agent).toBeDefined();
        expect(sg.status).toBe('pending');
      });
    });

    it('should throw error for unknown pattern', async () => {
      const intent = {
        id: 'task-123',
        user_id: 'user-123',
        intent_type: 'unknown_type' as any,
        intent_description: 'Unknown task',
        context: {},
        created_at: new Date().toISOString(),
      };

      await expect(agent.generateSubgoals(intent)).rejects.toThrow();
    });
  });

  describe('routeSubgoal', () => {
    it('should route subgoal to appropriate agent', async () => {
      const subgoal = {
        id: 'subgoal-123',
        parent_task_id: 'task-123',
        subgoal_type: 'analysis' as const,
        description: 'Analyze system',
        assigned_agent: 'SystemMapperAgent',
        dependencies: [],
        status: 'pending' as const,
        priority: 5,
        estimated_complexity: 0.6,
        context: {},
        created_at: new Date().toISOString(),
      };

      const routing = await agent.routeSubgoal(subgoal);

      expect(routing).toBeDefined();
      expect(routing.subgoal_id).toBe(subgoal.id);
      expect(routing.agent_name).toBe('SystemMapperAgent');
      expect(routing.confidence).toBeGreaterThan(0);
      expect(routing.confidence).toBeLessThanOrEqual(1);
      expect(routing.routing_reason).toBeDefined();
    });

    it('should provide alternative agents', async () => {
      const subgoal = {
        id: 'subgoal-123',
        parent_task_id: 'task-123',
        subgoal_type: 'validation' as const,
        description: 'Validate results',
        assigned_agent: 'ValueEvalAgent',
        dependencies: [],
        status: 'pending' as const,
        priority: 5,
        estimated_complexity: 0.4,
        context: {},
        created_at: new Date().toISOString(),
      };

      const routing = await agent.routeSubgoal(subgoal);

      expect(routing.alternative_agents).toBeInstanceOf(Array);
    });
  });

  describe('produceSDUILayout', () => {
    it('should generate SDUI layout for subgoal output', async () => {
      const subgoal = {
        id: 'subgoal-123',
        parent_task_id: 'task-123',
        subgoal_type: 'analysis' as const,
        description: 'System analysis complete',
        assigned_agent: 'SystemMapperAgent',
        dependencies: [],
        status: 'completed' as const,
        priority: 5,
        estimated_complexity: 0.6,
        context: {},
        output: {
          system_map: { id: 'map-123', entities: [], relationships: [] },
        },
        created_at: new Date().toISOString(),
      };

      const layout = await agent.produceSDUILayout(subgoal);

      expect(layout).toBeDefined();
      expect(layout.type).toBe('page');
      expect(layout.sections).toBeInstanceOf(Array);
      expect(layout.sections.length).toBeGreaterThan(0);
      
      // Should have layout directive
      const directive = layout.sections.find((s) => s.type === 'layout.directive');
      expect(directive).toBeDefined();
    });

    it('should throw error if subgoal has no output', async () => {
      const subgoal = {
        id: 'subgoal-123',
        parent_task_id: 'task-123',
        subgoal_type: 'analysis' as const,
        description: 'System analysis',
        assigned_agent: 'SystemMapperAgent',
        dependencies: [],
        status: 'pending' as const,
        priority: 5,
        estimated_complexity: 0.6,
        context: {},
        created_at: new Date().toISOString(),
      };

      await expect(agent.produceSDUILayout(subgoal)).rejects.toThrow();
    });
  });

  describe('getAgentCapabilities', () => {
    it('should return capabilities for known agent', () => {
      const capabilities = agent.getAgentCapabilities('SystemMapperAgent');

      expect(capabilities).toBeInstanceOf(Array);
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities).toContain('system_analysis');
    });

    it('should return empty array for unknown agent', () => {
      const capabilities = agent.getAgentCapabilities('UnknownAgent');

      expect(capabilities).toEqual([]);
    });
  });

  describe('getAvailableAgents', () => {
    it('should return list of available agents', () => {
      const agents = agent.getAvailableAgents();

      expect(agents).toBeInstanceOf(Array);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain('SystemMapperAgent');
      expect(agents).toContain('InterventionDesignerAgent');
    });
  });

  describe('getTaskPatterns', () => {
    it('should return list of task patterns', () => {
      const patterns = agent.getTaskPatterns();

      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).toContain('create_business_case');
      expect(patterns).toContain('analyze_opportunity');
    });
  });
});
