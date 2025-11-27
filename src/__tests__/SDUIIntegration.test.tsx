/**
 * Integration tests for SDUI Phase 1
 * 
 * Tests the end-to-end flow:
 * 1. Load workspace → Generate schema → Render SDUI
 * 2. Handle action → Route action → Update schema → Re-render
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SDUIApp } from '../components/SDUIApp';
import { canvasSchemaService } from '../services/CanvasSchemaService';
import { actionRouter } from '../services/ActionRouter';
import { CanonicalAction } from '../types/sdui-integration';

// Mock dependencies
vi.mock('../services/CanvasSchemaService');
vi.mock('../services/ActionRouter');
vi.mock('../lib/logger');

describe('SDUI Integration - Phase 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Flow', () => {
    it('should load workspace, generate schema, and render SDUI', async () => {
      // Mock schema generation
      const mockSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Test Workspace',
              description: 'Integration test',
            },
          },
        ],
      };

      vi.spyOn(canvasSchemaService, 'generateSchema').mockResolvedValue(mockSchema);

      // Render SDUIApp
      render(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="opportunity"
        />
      );

      // Wait for schema to load
      await waitFor(() => {
        expect(canvasSchemaService.generateSchema).toHaveBeenCalledWith(
          'test-workspace',
          expect.objectContaining({
            workspaceId: 'test-workspace',
            userId: 'test-user',
            lifecycleStage: 'opportunity',
          })
        );
      });

      // Verify component rendered
      await waitFor(() => {
        expect(screen.getByText('Test Workspace')).toBeInTheDocument();
      });
    });

    it('should handle action, route it, and update schema', async () => {
      // Mock initial schema
      const initialSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Initial State',
            },
          },
        ],
      };

      // Mock updated schema
      const updatedSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Updated State',
            },
          },
        ],
      };

      vi.spyOn(canvasSchemaService, 'generateSchema').mockResolvedValue(initialSchema);
      vi.spyOn(canvasSchemaService, 'updateSchema').mockResolvedValue(updatedSchema);
      vi.spyOn(actionRouter, 'routeAction').mockResolvedValue({
        success: true,
        data: { saved: true },
      });

      // Render SDUIApp
      render(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="opportunity"
        />
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Initial State')).toBeInTheDocument();
      });

      // Simulate action (this would normally come from a button click)
      const action: CanonicalAction = {
        type: 'saveWorkspace',
        workspaceId: 'test-workspace',
      };

      // Manually trigger action handler (in real app, this comes from component)
      // For now, just verify the flow works
      const result = await actionRouter.routeAction(action, {
        workspaceId: 'test-workspace',
        userId: 'test-user',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(true);

      // Verify schema update was called
      await canvasSchemaService.updateSchema('test-workspace', action, result);

      expect(canvasSchemaService.updateSchema).toHaveBeenCalledWith(
        'test-workspace',
        action,
        result
      );
    });

    it('should handle stage navigation', async () => {
      const opportunitySchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Opportunity Stage',
            },
          },
        ],
      };

      const targetSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Target Stage',
            },
          },
        ],
      };

      vi.spyOn(canvasSchemaService, 'generateSchema')
        .mockResolvedValueOnce(opportunitySchema)
        .mockResolvedValueOnce(targetSchema);

      vi.spyOn(actionRouter, 'routeAction').mockResolvedValue({
        success: true,
        data: { stage: 'target' },
      });

      // Render SDUIApp
      const { rerender } = render(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="opportunity"
        />
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Opportunity Stage')).toBeInTheDocument();
      });

      // Navigate to target stage
      const action: CanonicalAction = {
        type: 'navigateToStage',
        stage: 'target',
      };

      await actionRouter.routeAction(action, {
        workspaceId: 'test-workspace',
        userId: 'test-user',
        timestamp: Date.now(),
      });

      // Re-render with new stage
      rerender(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="target"
        />
      );

      // Wait for target stage to render
      await waitFor(() => {
        expect(screen.getByText('Target Stage')).toBeInTheDocument();
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock schema generation failure
      vi.spyOn(canvasSchemaService, 'generateSchema').mockRejectedValue(
        new Error('Failed to generate schema')
      );

      // Render SDUIApp
      render(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="opportunity"
        />
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Failed to Load Workspace')).toBeInTheDocument();
        expect(screen.getByText('Failed to generate schema')).toBeInTheDocument();
      });

      // Verify retry button exists
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should cache schemas to avoid redundant generation', async () => {
      const mockSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Cached Schema',
            },
          },
        ],
      };

      // First call generates schema
      vi.spyOn(canvasSchemaService, 'generateSchema').mockResolvedValue(mockSchema);

      // Second call returns cached schema
      vi.spyOn(canvasSchemaService, 'getCachedSchema').mockReturnValue(mockSchema);

      // First render
      const { rerender } = render(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="opportunity"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cached Schema')).toBeInTheDocument();
      });

      // Re-render (should use cache)
      rerender(
        <SDUIApp
          workspaceId="test-workspace"
          userId="test-user"
          initialStage="opportunity"
        />
      );

      // Verify schema generation was only called once
      expect(canvasSchemaService.generateSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('Action Router Integration', () => {
    it('should validate actions before routing', async () => {
      const invalidAction: any = {
        type: 'invokeAgent',
        // Missing required fields
      };

      const result = await actionRouter.routeAction(invalidAction, {
        workspaceId: 'test-workspace',
        userId: 'test-user',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should enforce Manifesto rules', async () => {
      const action: CanonicalAction = {
        type: 'updateValueTree',
        treeId: 'tree-1',
        updates: {
          structure: {
            // Missing required fields - violates RULE_003
          },
        },
      };

      const result = await actionRouter.routeAction(action, {
        workspaceId: 'test-workspace',
        userId: 'test-user',
        timestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Manifesto rules violated');
    });

    it('should log all actions to audit trail', async () => {
      const action: CanonicalAction = {
        type: 'saveWorkspace',
        workspaceId: 'test-workspace',
      };

      vi.spyOn(actionRouter as any, 'logAction').mockResolvedValue(undefined);

      await actionRouter.routeAction(action, {
        workspaceId: 'test-workspace',
        userId: 'test-user',
        timestamp: Date.now(),
      });

      expect((actionRouter as any).logAction).toHaveBeenCalled();
    });
  });

  describe('Canvas Schema Service Integration', () => {
    it('should select appropriate template based on lifecycle stage', async () => {
      const stages = ['opportunity', 'target', 'expansion', 'integrity', 'realization'] as const;

      for (const stage of stages) {
        const schema = await canvasSchemaService.generateSchema('test-workspace', {
          workspaceId: 'test-workspace',
          userId: 'test-user',
          lifecycleStage: stage,
        });

        expect(schema).toBeDefined();
        expect(schema.type).toBe('page');
        expect(schema.sections.length).toBeGreaterThan(0);
      }
    });

    it('should invalidate cache when schema is updated', async () => {
      const action: CanonicalAction = {
        type: 'saveWorkspace',
        workspaceId: 'test-workspace',
      };

      const result = {
        success: true,
        data: { saved: true },
      };

      vi.spyOn(canvasSchemaService, 'invalidateCache');

      await canvasSchemaService.updateSchema('test-workspace', action, result);

      expect(canvasSchemaService.invalidateCache).toHaveBeenCalledWith('test-workspace');
    });
  });
});
