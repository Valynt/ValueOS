/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionRouter } from '../ActionRouter.js'
import { workspaceStateService } from '../WorkspaceStateService.js'
import * as ExportUtils from '../../utils/export';

// Mock dependencies
vi.mock('../WorkspaceStateService', () => ({
  workspaceStateService: {
    getState: vi.fn(),
  },
}));

vi.mock('../../utils/export', () => ({
  exportToPDF: vi.fn(),
  exportToPNG: vi.fn(),
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  downloadBlob: vi.fn(),
  generateFilename: vi.fn((base, ext) => `${base}.${ext}`),
}));

// Mock logger
vi.mock('../../lib/logger', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return {
    logger: mockLogger,
    createLogger: () => mockLogger,
  };
});

// Mock other dependencies of ActionRouter constructor
vi.mock('../AuditLogService');
vi.mock('../UnifiedAgentOrchestrator');
vi.mock('../AgentAPI');
vi.mock('../ComponentMutationService');
vi.mock('../ManifestoEnforcer', () => ({
  manifestoEnforcer: {
    checkAction: vi.fn().mockResolvedValue({ allowed: true, violations: [], warnings: [] }),
    requestOverride: vi.fn(),
    decideOverride: vi.fn(),
  },
}));
vi.mock('../AtomicActionExecutor');
vi.mock('../CanvasSchemaService');
vi.mock('../../lib/rules', () => ({
  enforceRules: vi.fn().mockResolvedValue({
    allowed: true,
    violations: [],
    warnings: [],
    metadata: { globalRulesChecked: 0, localRulesChecked: 0 }
  }),
}));

describe('ActionRouter - exportArtifact', () => {
  let router: ActionRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new ActionRouter();
  });

  it('should return error if not running in browser', async () => {
    // Temporarily remove window/document
    const spyWindow = vi.spyOn(global, 'window', 'get').mockReturnValue(undefined as any);
    const spyDocument = vi.spyOn(global, 'document', 'get').mockReturnValue(undefined as any);

    const result = await router.routeAction(
      { type: 'exportArtifact', artifactType: 'test', format: 'pdf' },
      { workspaceId: 'ws-1', userId: 'user-1', timestamp: Date.now(), execution: {} as any }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('only supported in browser');

    // Restore
    spyWindow.mockRestore();
    spyDocument.mockRestore();
  });

  it('should export PDF successfully', async () => {
    // Mock exportToPDF
    const mockBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
    vi.mocked(ExportUtils.exportToPDF).mockResolvedValue(mockBlob);

    const result = await router.routeAction(
      { type: 'exportArtifact', artifactType: 'my-element', format: 'pdf' },
      { workspaceId: 'ws-1', userId: 'user-1', timestamp: Date.now(), execution: {} as any }
    );

    expect(result.success).toBe(true);
    expect(ExportUtils.exportToPDF).toHaveBeenCalledWith('my-element', { format: 'pdf', filename: 'my-element.pdf' });
    expect(ExportUtils.downloadBlob).toHaveBeenCalledWith(mockBlob, 'my-element.pdf');
  });

  it('should export Excel successfully with data from state', async () => {
    // Mock state
    vi.mocked(workspaceStateService.getState).mockResolvedValue({
      workspaceId: 'ws-1',
      lifecycleStage: 'opportunity',
      data: {
        'my-data': [{ id: 1, name: 'Test' }]
      },
      metadata: {},
      lastUpdated: Date.now(),
      version: 1,
    } as any);

    const mockBlob = new Blob(['excel-content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    vi.mocked(ExportUtils.exportToExcel).mockResolvedValue(mockBlob);

    const result = await router.routeAction(
      { type: 'exportArtifact', artifactType: 'my-data', format: 'excel' },
      { workspaceId: 'ws-1', userId: 'user-1', timestamp: Date.now(), execution: {} as any }
    );

    expect(result.success).toBe(true);
    expect(workspaceStateService.getState).toHaveBeenCalledWith('ws-1');
    expect(ExportUtils.exportToExcel).toHaveBeenCalledWith([{ id: 1, name: 'Test' }], { format: 'excel', sheetName: 'my-data' });
    expect(ExportUtils.downloadBlob).toHaveBeenCalledWith(mockBlob, 'my-data.excel');
  });

  it('should handle missing data gracefully', async () => {
    // Mock empty state
    vi.mocked(workspaceStateService.getState).mockResolvedValue({
      workspaceId: 'ws-1',
      lifecycleStage: 'opportunity',
      data: {},
      metadata: {},
      lastUpdated: Date.now(),
      version: 1,
    } as any);

    const result = await router.routeAction(
      { type: 'exportArtifact', artifactType: 'missing-data', format: 'excel' },
      { workspaceId: 'ws-1', userId: 'user-1', timestamp: Date.now(), execution: {} as any }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No data found');
  });

  it('should default to full state export if specific key not found but data exists', async () => {
    // Mock state with some data but not the specific key
    const mockData = { 'other-data': 'value' };
    vi.mocked(workspaceStateService.getState).mockResolvedValue({
      workspaceId: 'ws-1',
      lifecycleStage: 'opportunity',
      data: mockData,
      metadata: {},
      lastUpdated: Date.now(),
      version: 1,
    } as any);

    const mockBlob = new Blob(['excel-content'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    vi.mocked(ExportUtils.exportToExcel).mockResolvedValue(mockBlob);

    const result = await router.routeAction(
      { type: 'exportArtifact', artifactType: 'missing-key', format: 'excel' },
      { workspaceId: 'ws-1', userId: 'user-1', timestamp: Date.now(), execution: {} as any }
    );

    expect(result.success).toBe(true);
    // Should fallback to wrapping the whole data object
    expect(ExportUtils.exportToExcel).toHaveBeenCalledWith([mockData], { format: 'excel', sheetName: 'missing-key' });
  });

  it('should export CSV successfully', async () => {
    // Mock state
    vi.mocked(workspaceStateService.getState).mockResolvedValue({
      workspaceId: 'ws-1',
      lifecycleStage: 'opportunity',
      data: {
        'my-data': [{ id: 1, name: 'Test' }]
      },
      metadata: {},
      lastUpdated: Date.now(),
      version: 1,
    } as any);

    const mockBlob = new Blob(['csv-content'], { type: 'text/csv' });
    vi.mocked(ExportUtils.exportToCSV).mockResolvedValue(mockBlob);

    const result = await router.routeAction(
      { type: 'exportArtifact', artifactType: 'my-data', format: 'csv' },
      { workspaceId: 'ws-1', userId: 'user-1', timestamp: Date.now(), execution: {} as any }
    );

    expect(result.success).toBe(true);
    expect(workspaceStateService.getState).toHaveBeenCalledWith('ws-1');
    expect(ExportUtils.exportToCSV).toHaveBeenCalledWith([{ id: 1, name: 'Test' }], { format: 'excel' });
    expect(ExportUtils.downloadBlob).toHaveBeenCalledWith(mockBlob, 'my-data.csv');
  });
});
