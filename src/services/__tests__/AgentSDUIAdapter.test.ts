/**
 * Unit tests for AgentSDUIAdapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSDUIAdapter } from '../AgentSDUIAdapter';
import {
  SystemMapperOutput,
  TargetOutput,
  RealizationOutput,
  IntegrityOutput,
} from '../../types/agent-output';
import { canvasSchemaService } from '../CanvasSchemaService';

// Mock dependencies
vi.mock('../CanvasSchemaService');
vi.mock('../../lib/logger');

describe('AgentSDUIAdapter', () => {
  let adapter: AgentSDUIAdapter;

  beforeEach(() => {
    adapter = new AgentSDUIAdapter();
    vi.clearAllMocks();
  });

  describe('processAgentOutput', () => {
    it('should process SystemMapperAgent output', async () => {
      const output: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: {
          id: 'map-1',
          name: 'Test System Map',
        } as any,
        entities: [{ id: 'e1', name: 'Entity 1' }],
        relationships: [{ id: 'r1', source: 'e1', target: 'e2' }],
        leveragePoints: [{ id: 'lp1', type: 'information_flow' }],
        constraints: [],
        insights: ['Insight 1'],
      };

      vi.spyOn(canvasSchemaService, 'getCachedSchema').mockReturnValue(null);

      const update = await adapter.processAgentOutput(
        'system-mapper-1',
        output,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.workspaceId).toBe('workspace-1');
      expect(update.source).toBe('agent:system-mapper-1');
      expect(update.actions).toBeDefined();
    });

    it('should process TargetAgent output', async () => {
      const output: TargetOutput = {
        agentId: 'intervention-designer-1',
        agentType: 'TargetAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'target',
        success: true,
        interventions: [
          {
            id: 'int-1',
            name: 'Intervention 1',
          } as any,
        ],
        recommendations: ['Recommendation 1'],
        feasibilityScores: { 'int-1': 0.8 },
      };

      vi.spyOn(canvasSchemaService, 'getCachedSchema').mockReturnValue(null);

      const update = await adapter.processAgentOutput(
        'intervention-designer-1',
        output,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.actions).toBeDefined();
      expect(update.actions!.length).toBeGreaterThan(0);
    });

    it('should process RealizationAgent output', async () => {
      const output: RealizationOutput = {
        agentId: 'realization-loop-1',
        agentType: 'RealizationAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'realization',
        success: true,
        feedbackLoops: [
          {
            id: 'loop-1',
            loop_type: 'reinforcing',
          } as any,
        ],
        metrics: [{ id: 'm1', value: 100 }],
        behaviorChanges: [],
        realizationStatus: 'on_track',
      };

      vi.spyOn(canvasSchemaService, 'getCachedSchema').mockReturnValue(null);

      const update = await adapter.processAgentOutput(
        'realization-loop-1',
        output,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.actions).toBeDefined();
    });

    it('should process IntegrityAgent output', async () => {
      const output: IntegrityOutput = {
        agentId: 'value-eval-1',
        agentType: 'IntegrityAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'expansion',
        success: true,
        scores: {
          revenue: 0.85,
          cost: 0.72,
          risk: 0.65,
        },
        recommendations: ['Recommendation 1'],
        risks: [],
        opportunities: [],
      };

      vi.spyOn(canvasSchemaService, 'getCachedSchema').mockReturnValue(null);

      const update = await adapter.processAgentOutput(
        'value-eval-1',
        output,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.actions).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const output: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: false,
        error: 'Test error',
        systemMap: null as any,
        entities: [],
        relationships: [],
        leveragePoints: [],
        constraints: [],
        insights: [],
      };

      vi.spyOn(canvasSchemaService, 'getCachedSchema').mockImplementation(() => {
        throw new Error('Test error');
      });

      const update = await adapter.processAgentOutput(
        'system-mapper-1',
        output,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.type).toBe('partial_update');
      expect(update.actions).toEqual([]);
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze SystemMapperAgent impact', () => {
      const output: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: { id: 'map-1' } as any,
        entities: [],
        relationships: [],
        leveragePoints: [{ id: 'lp1' }] as any,
        constraints: [],
        insights: [],
      };

      const impacts = adapter.analyzeImpact(output, null);

      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts.some((i) => i.componentType === 'SystemMapCanvas')).toBe(true);
      expect(impacts.some((i) => i.componentType === 'LeveragePointsList')).toBe(true);
    });

    it('should analyze TargetAgent impact', () => {
      const output: TargetOutput = {
        agentId: 'intervention-designer-1',
        agentType: 'TargetAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'target',
        success: true,
        interventions: [{ id: 'int-1' }] as any,
        recommendations: [],
        feasibilityScores: {},
      };

      const impacts = adapter.analyzeImpact(output, null);

      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts.some((i) => i.componentType === 'InterventionDesigner')).toBe(true);
    });

    it('should analyze RealizationAgent impact', () => {
      const output: RealizationOutput = {
        agentId: 'realization-loop-1',
        agentType: 'RealizationAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'realization',
        success: true,
        feedbackLoops: [{ id: 'loop-1' }] as any,
        metrics: [{ id: 'm1' }] as any,
        behaviorChanges: [],
        realizationStatus: 'on_track',
      };

      const impacts = adapter.analyzeImpact(output, null);

      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts.some((i) => i.componentType === 'FeedbackLoopViewer')).toBe(true);
      expect(impacts.some((i) => i.componentType === 'RealizationDashboard')).toBe(true);
    });

    it('should analyze IntegrityAgent impact', () => {
      const output: IntegrityOutput = {
        agentId: 'value-eval-1',
        agentType: 'IntegrityAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'expansion',
        success: true,
        scores: {
          revenue: 0.85,
          cost: 0.72,
        },
        recommendations: [],
        risks: [],
        opportunities: [],
      };

      const impacts = adapter.analyzeImpact(output, null);

      expect(impacts.length).toBeGreaterThan(0);
      expect(impacts.every((i) => i.componentType === 'MetricBadge')).toBe(true);
    });
  });

  describe('generateAtomicActions', () => {
    it('should generate add actions for SystemMapCanvas', () => {
      const output: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: { id: 'map-1' } as any,
        entities: [{ id: 'e1' }] as any,
        relationships: [{ id: 'r1' }] as any,
        leveragePoints: [],
        constraints: [],
        insights: [],
      };

      const impacts = [
        {
          componentId: 'system-map-canvas',
          componentType: 'SystemMapCanvas',
          impactType: 'add' as const,
          reason: 'Test',
          priority: 'high' as const,
        },
      ];

      const actions = adapter.generateAtomicActions(output, impacts);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('add_component');
    });

    it('should generate update actions for MetricBadge', () => {
      const output: IntegrityOutput = {
        agentId: 'value-eval-1',
        agentType: 'IntegrityAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'expansion',
        success: true,
        scores: {
          revenue: 0.85,
        },
        recommendations: [],
        risks: [],
        opportunities: [],
      };

      const impacts = [
        {
          componentId: 'metric-badge-revenue',
          componentType: 'MetricBadge',
          impactType: 'update' as const,
          reason: 'Test',
          priority: 'medium' as const,
        },
      ];

      const actions = adapter.generateAtomicActions(output, impacts);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('mutate_component');
    });
  });
});
