/**
 * Unit tests for CanvasSchemaService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasSchemaService } from '../CanvasSchemaService';
import { WorkspaceContext } from '../../types/sdui-integration';
import { CacheService } from '../CacheService';
import { ValueFabricService } from '../ValueFabricService';
import { logger } from '../../lib/logger';

// Mock dependencies
vi.mock('../CacheService');
vi.mock('../ValueFabricService');
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })
}));

// Mock supabase
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        })),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  }))
}));

vi.mock('../../lib/supabase', () => {
  return {
    getSupabaseClient: () => mockSupabase,
    supabase: mockSupabase,
    createServerSupabaseClient: () => mockSupabase
  };
});

describe('CanvasSchemaService', () => {
  let service: CanvasSchemaService;
  let mockCacheService: CacheService;
  let mockValueFabricService: ValueFabricService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService = new CacheService();
    mockValueFabricService = new ValueFabricService(null as any);
    service = new CanvasSchemaService(mockCacheService, mockValueFabricService);
  });

  describe('generateSchema', () => {
    it('should generate schema for opportunity stage', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'opportunity',
      };

      const schema = await service.generateSchema('workspace-1', context);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
      expect(schema.sections).toBeDefined();
      expect(schema.sections.length).toBeGreaterThan(0);
    });

    it('should fetch and include business case data', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'opportunity',
      };

      // Mock business case response
      const mockBusinessCase = {
        id: 'workspace-1',
        name: 'Test Business Case',
        client: 'Test Client',
        description: 'Test Description',
        status: 'in-progress',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        metadata: { stage: 'opportunity' },
        owner_id: 'user-1'
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'business_cases') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockBusinessCase, error: null })
                })),
                maybeSingle: vi.fn().mockResolvedValue({ data: mockBusinessCase, error: null })
              }))
            }))
          } as any;
        }
        if (table === 'value_trees') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [{
                  id: 'vt-1',
                  compliance_metadata: {
                    results: [{ rule_id: 'r1', passed: true, message: 'passed' }]
                  }
                }],
                error: null
              }))
            }))
          } as any;
        }
        if (table === 'roi_models') {
           return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                data: [{
                  id: 'roi-1',
                  compliance_metadata: {
                    results: [{ rule_id: 'r2', passed: false, message: 'failed' }]
                  }
                }],
                error: null
              }))
            }))
          } as any;
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              eq: vi.fn(() => ({ data: [], error: null }))
            })),
            in: vi.fn(() => ({ data: [], error: null }))
          }))
        } as any;
      });

      const schema = await service.generateSchema('workspace-1', context);

      if (schema.sections[0]?.component === 'InfoBanner') {
        // Inspect logger errors if fallback occurred
        const errorCalls = (logger.error as any).mock.calls;
        console.log('Logger Errors:', JSON.stringify(errorCalls, null, 2));
      }

      // Check if sections exists (based on passing tests)
      expect(schema.sections).toBeDefined();

      const header = schema.sections.find((c: any) =>
        c.type === 'PageHeader' ||
        (c.type === 'component' && c.component === 'PageHeader')
      ) as any;

      expect(header).toBeDefined();
      expect(header.props.breadcrumbs[2].label).toBe('Test Business Case');
    });

    it('should generate schema for target stage', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'target',
      };

      const schema = await service.generateSchema('workspace-1', context);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
    });

    it('should fetch manifesto results correctly', async () => {
      // Access private method via any cast or just trust generateSchema calls it
      // But let's verify fetchWorkspaceData logic which calls fetchManifestoResults
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'integrity',
      };

      // Spy on fetchManifestoResults to ensure it's called
      const fetchManifestoSpy = vi.spyOn(service as any, 'fetchManifestoResults');

      await service.generateSchema('workspace-1', context);

      expect(fetchManifestoSpy).toHaveBeenCalledWith('workspace-1');

      // Verify the result of the spy call
      const results = await fetchManifestoSpy.mock.results[0].value;
      expect(results).toHaveLength(2); // 1 from value_trees, 1 from roi_models based on our mock
      expect(results[0].rule_id).toBe('r1');
      expect(results[1].rule_id).toBe('r2');
    });

    it('should generate schema for expansion stage', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'expansion',
      };

      const schema = await service.generateSchema('workspace-1', context);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
    });

    it('should generate schema for integrity stage', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'integrity',
      };

      const schema = await service.generateSchema('workspace-1', context);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
    });

    it('should generate schema for realization stage', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'realization',
      };

      const schema = await service.generateSchema('workspace-1', context);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
    });

    it('should return cached schema if available', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'opportunity',
      };

      // First call - generates and caches
      const schema1 = await service.generateSchema('workspace-1', context);

      // Mock cache to return the schema
      vi.spyOn(mockCacheService, 'get').mockReturnValue({
        schema: schema1,
        timestamp: Date.now(),
        ttl: 300,
        workspaceId: 'workspace-1',
        version: 1,
      });

      // Second call - should use cache
      const schema2 = await service.generateSchema('workspace-1', context);

      expect(schema2).toEqual(schema1);
    });

    it('should return fallback schema on error', async () => {
      const context: WorkspaceContext = {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        lifecycleStage: 'opportunity',
      };

      // Force an error by providing invalid context
      vi.spyOn(service as any, 'detectWorkspaceState').mockRejectedValue(
        new Error('Test error')
      );

      const schema = await service.generateSchema('workspace-1', context);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
      expect(schema.sections.length).toBeGreaterThan(0);
      expect(schema.sections[0].component).toBe('InfoBanner');
    });
  });

  describe('updateSchema', () => {
    it('should use schema update from action result', async () => {
      const action = {
        type: 'navigateToStage' as const,
        stage: 'target' as const,
      };

      const result = {
        success: true,
        schemaUpdate: {
          type: 'page' as const,
          version: 1,
          sections: [
            {
              type: 'component' as const,
              component: 'InfoBanner',
              version: 1,
              props: { title: 'Updated' },
            },
          ],
        },
      };

      const schema = await service.updateSchema('workspace-1', action, result);

      expect(schema).toEqual(result.schemaUpdate);
    });

    it('should regenerate schema if no update provided', async () => {
      const action = {
        type: 'saveWorkspace' as const,
        workspaceId: 'workspace-1',
      };

      const result = {
        success: true,
      };

      const schema = await service.updateSchema('workspace-1', action, result);

      expect(schema).toBeDefined();
      expect(schema.type).toBe('page');
    });

    it('should return cached schema on error', async () => {
      const cachedSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Cached' },
          },
        ],
      };

      vi.spyOn(mockCacheService, 'get').mockReturnValue({
        schema: cachedSchema,
        timestamp: Date.now(),
        ttl: 300,
        workspaceId: 'workspace-1',
        version: 1,
      });

      const action = {
        type: 'saveWorkspace' as const,
        workspaceId: 'workspace-1',
      };

      const result = {
        success: false,
        error: 'Test error',
      };

      // Force error in regeneration
      vi.spyOn(service as any, 'generateSchema').mockRejectedValue(
        new Error('Test error')
      );

      const schema = await service.updateSchema('workspace-1', action, result);

      expect(schema).toEqual(cachedSchema);
    });
  });

  describe('getCachedSchema', () => {
    it('should return cached schema if valid', async () => {
      const cachedSchema = {
        type: 'page' as const,
        version: 1,
        sections: [],
      };

      vi.spyOn(mockCacheService, 'get').mockReturnValue({
        schema: cachedSchema,
        timestamp: Date.now(),
        ttl: 300,
        workspaceId: 'workspace-1',
        version: 1,
      });

      const schema = await service.getCachedSchema('workspace-1');

      expect(schema).toEqual(cachedSchema);
    });

    it('should return null if cache expired', async () => {
      vi.spyOn(mockCacheService, 'get').mockReturnValue({
        schema: { type: 'page' as const, version: 1, sections: [] },
        timestamp: Date.now() - 400000, // 400 seconds ago
        ttl: 300, // 5 minutes TTL
        workspaceId: 'workspace-1',
        version: 1,
      });

      const schema = await service.getCachedSchema('workspace-1');

      expect(schema).toBeNull();
    });

    it('should return null if no cache exists', async () => {
      vi.spyOn(mockCacheService, 'get').mockReturnValue(null);

      const schema = await service.getCachedSchema('workspace-1');

      expect(schema).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache for workspace', () => {
      const deleteSpy = vi.spyOn(mockCacheService, 'delete');

      service.invalidateCache('workspace-1');

      expect(deleteSpy).toHaveBeenCalledWith('sdui:schema:workspace-1');
    });
  });
});
