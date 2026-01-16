/**
 * Tests for PlaygroundSessionService
 */

import { PlaygroundSessionService } from '../PlaygroundSessionService';
import { SDUIPageDefinition } from '../../sdui/schema';
import { createPropertyUpdate } from '../../sdui/AtomicUIActions';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    sAdd: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    multi: jest.fn(() => ({
      sAdd: jest.fn(),
      sRem: jest.fn(),
      exec: jest.fn(),
    })),
    on: jest.fn(),
  })),
}));

describe('PlaygroundSessionService', () => {
  let service: PlaygroundSessionService;
  let mockLayout: SDUIPageDefinition;

  beforeEach(() => {
    service = new PlaygroundSessionService({
      ttl: 3600,
      maxHistorySize: 50,
      maxCheckpoints: 10,
      autoSaveEnabled: true,
      autoSaveInterval: 30000,
      idleTimeout: 300000,
    });

    mockLayout = {
      type: 'page',
      version: 1,
      sections: [
        {
          component: 'StatCard',
          version: '1.0',
          props: {
            label: 'Revenue',
            value: '$1M',
          },
        },
      ],
      metadata: {},
    };
  });

  describe('createSession', () => {
    it('should create new session', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.organizationId).toBe('org-456');
      expect(session.status).toBe('active');
      expect(session.currentLayout).toEqual(mockLayout);
      expect(session.initialLayout).toEqual(mockLayout);
      expect(session.history).toHaveLength(0);
      expect(session.historyIndex).toBe(-1);
    });

    it('should set metadata correctly', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      expect(session.metadata.createdAt).toBeDefined();
      expect(session.metadata.updatedAt).toBeDefined();
      expect(session.metadata.expiresAt).toBeDefined();
      expect(session.metadata.operationCount).toBe(0);
      expect(session.metadata.undoCount).toBe(0);
      expect(session.metadata.redoCount).toBe(0);
      expect(session.metadata.autoSaveEnabled).toBe(true);
    });

    it('should accept custom context', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
        context: {
          projectName: 'Q4 QBR',
          customField: 'value',
        },
      });

      expect(session.context).toEqual({
        projectName: 'Q4 QBR',
        customField: 'value',
      });
    });

    it('should link to artifact if provided', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
        artifactId: 'artifact-789',
      });

      expect(session.artifactId).toBe('artifact-789');
    });
  });

  describe('updateSession', () => {
    it('should update layout', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const newLayout = {
        ...mockLayout,
        sections: [
          {
            component: 'StatCard',
            version: '1.0',
            props: {
              label: 'Revenue',
              value: '$2M',
            },
          },
        ],
      };

      const updated = await service.updateSession(session.sessionId, {
        layout: newLayout,
      });

      expect(updated?.currentLayout).toEqual(newLayout);
    });

    it('should add operation to history', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const newLayout = {
        ...mockLayout,
        sections: [
          {
            component: 'StatCard',
            version: '1.0',
            props: {
              label: 'Revenue',
              value: '$2M',
            },
          },
        ],
      };

      const updated = await service.updateSession(session.sessionId, {
        layout: newLayout,
        operation: {
          type: 'mutation',
          before: mockLayout,
          after: newLayout,
          description: 'Updated revenue',
          actor: { type: 'user', id: 'user-123' },
        },
      });

      expect(updated?.history).toHaveLength(1);
      expect(updated?.historyIndex).toBe(0);
      expect(updated?.metadata.operationCount).toBe(1);
    });

    it('should truncate history at max size', async () => {
      const smallService = new PlaygroundSessionService({
        maxHistorySize: 3,
      });

      const session = await smallService.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      // Add 5 operations (should keep only last 3)
      for (let i = 0; i < 5; i++) {
        await smallService.updateSession(session.sessionId, {
          operation: {
            type: 'mutation',
            before: mockLayout,
            after: mockLayout,
            description: `Operation ${i}`,
            actor: { type: 'user', id: 'user-123' },
          },
        });
      }

      const updated = await smallService.loadSession(session.sessionId);
      expect(updated?.history).toHaveLength(3);
    });

    it('should truncate forward history on new operation', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      // Add 3 operations
      for (let i = 0; i < 3; i++) {
        await service.updateSession(session.sessionId, {
          operation: {
            type: 'mutation',
            before: mockLayout,
            after: mockLayout,
            description: `Operation ${i}`,
            actor: { type: 'user', id: 'user-123' },
          },
        });
      }

      // Undo twice
      await service.undo(session.sessionId);
      await service.undo(session.sessionId);

      // Add new operation (should truncate forward history)
      await service.updateSession(session.sessionId, {
        operation: {
          type: 'mutation',
          before: mockLayout,
          after: mockLayout,
          description: 'New operation',
          actor: { type: 'user', id: 'user-123' },
        },
      });

      const updated = await service.loadSession(session.sessionId);
      expect(updated?.history).toHaveLength(2); // First op + new op
    });
  });

  describe('undo/redo', () => {
    it('should undo operation', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const newLayout = {
        ...mockLayout,
        sections: [
          {
            component: 'StatCard',
            version: '1.0',
            props: {
              label: 'Revenue',
              value: '$2M',
            },
          },
        ],
      };

      await service.updateSession(session.sessionId, {
        layout: newLayout,
        operation: {
          type: 'mutation',
          before: mockLayout,
          after: newLayout,
          description: 'Updated revenue',
          actor: { type: 'user', id: 'user-123' },
        },
      });

      const undone = await service.undo(session.sessionId);

      expect(undone?.currentLayout).toEqual(mockLayout);
      expect(undone?.historyIndex).toBe(-1);
      expect(undone?.metadata.undoCount).toBe(1);
    });

    it('should redo operation', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const newLayout = {
        ...mockLayout,
        sections: [
          {
            component: 'StatCard',
            version: '1.0',
            props: {
              label: 'Revenue',
              value: '$2M',
            },
          },
        ],
      };

      await service.updateSession(session.sessionId, {
        layout: newLayout,
        operation: {
          type: 'mutation',
          before: mockLayout,
          after: newLayout,
          description: 'Updated revenue',
          actor: { type: 'user', id: 'user-123' },
        },
      });

      await service.undo(session.sessionId);
      const redone = await service.redo(session.sessionId);

      expect(redone?.currentLayout).toEqual(newLayout);
      expect(redone?.historyIndex).toBe(0);
      expect(redone?.metadata.redoCount).toBe(1);
    });

    it('should not undo when at start', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const undone = await service.undo(session.sessionId);

      expect(undone?.historyIndex).toBe(-1);
      expect(undone?.currentLayout).toEqual(mockLayout);
    });

    it('should not redo when at end', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      await service.updateSession(session.sessionId, {
        operation: {
          type: 'mutation',
          before: mockLayout,
          after: mockLayout,
          description: 'Operation',
          actor: { type: 'user', id: 'user-123' },
        },
      });

      const redone = await service.redo(session.sessionId);

      expect(redone?.historyIndex).toBe(0);
    });
  });

  describe('checkpoints', () => {
    it('should create checkpoint', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      await service.updateSession(session.sessionId, {
        createCheckpoint: true,
      });

      const updated = await service.loadSession(session.sessionId);
      expect(updated?.checkpoints).toHaveLength(1);
      expect(updated?.metadata.lastAutoSaveAt).toBeDefined();
    });

    it('should truncate checkpoints at max', async () => {
      const smallService = new PlaygroundSessionService({
        maxCheckpoints: 3,
      });

      const session = await smallService.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      // Create 5 checkpoints
      for (let i = 0; i < 5; i++) {
        await smallService.updateSession(session.sessionId, {
          createCheckpoint: true,
        });
      }

      const updated = await smallService.loadSession(session.sessionId);
      expect(updated?.checkpoints).toHaveLength(3);
    });

    it('should restore from checkpoint', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const newLayout = {
        ...mockLayout,
        sections: [
          {
            component: 'StatCard',
            version: '1.0',
            props: {
              label: 'Revenue',
              value: '$2M',
            },
          },
        ],
      };

      // Update and create checkpoint
      await service.updateSession(session.sessionId, {
        layout: newLayout,
        createCheckpoint: true,
      });

      const updated = await service.loadSession(session.sessionId);
      const checkpointId = updated!.checkpoints[0].id;

      // Make more changes
      await service.updateSession(session.sessionId, {
        layout: {
          ...newLayout,
          sections: [
            {
              component: 'StatCard',
              version: '1.0',
              props: {
                label: 'Revenue',
                value: '$3M',
              },
            },
          ],
        },
      });

      // Restore from checkpoint
      const restored = await service.restoreCheckpoint(session.sessionId, checkpointId);

      expect(restored?.currentLayout).toEqual(newLayout);
    });
  });

  describe('session status', () => {
    it('should discard session', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      await service.discardSession(session.sessionId);

      const updated = await service.loadSession(session.sessionId);
      expect(updated?.status).toBe('discarded');
    });
  });

  describe('statistics', () => {
    it('should calculate session stats', async () => {
      const session = await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      // Add operations
      await service.updateSession(session.sessionId, {
        operation: {
          type: 'mutation',
          before: mockLayout,
          after: mockLayout,
          description: 'Mutation',
          actor: { type: 'user', id: 'user-123' },
        },
      });

      await service.updateSession(session.sessionId, {
        operation: {
          type: 'agent_action',
          before: mockLayout,
          after: mockLayout,
          description: 'Agent action',
          actor: { type: 'agent', id: 'agent-456' },
        },
      });

      await service.undo(session.sessionId);
      await service.redo(session.sessionId);

      const stats = await service.getSessionStats(session.sessionId);

      expect(stats).toBeDefined();
      expect(stats!.totalOperations).toBe(2);
      expect(stats!.operationsByType.mutation).toBe(1);
      expect(stats!.operationsByType.agent_action).toBe(1);
      expect(stats!.undoCount).toBe(1);
      expect(stats!.redoCount).toBe(1);
    });
  });

  describe('session lists', () => {
    it('should list user sessions', async () => {
      await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const sessions = await service.listUserSessions('user-123');
      expect(sessions).toHaveLength(2);
    });

    it('should list org sessions', async () => {
      await service.createSession({
        userId: 'user-123',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      await service.createSession({
        userId: 'user-789',
        organizationId: 'org-456',
        initialLayout: mockLayout,
      });

      const sessions = await service.listOrgSessions('org-456');
      expect(sessions).toHaveLength(2);
    });
  });
});
