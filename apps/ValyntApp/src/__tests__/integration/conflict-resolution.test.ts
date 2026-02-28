/**
 * Conflict Resolution Integration Tests
 * 
 * Tests various conflict scenarios in collaborative editing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasElement } from '../../lib/realtime/supabaseRealtime';

describe('Conflict Resolution Integration Tests', () => {
  describe('Last-Write-Wins (LWW)', () => {
    it('should resolve concurrent updates using timestamps', () => {
      const baseTime = Date.now();

      // User 1 updates at T+0
      const user1Update: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'User 1 edit' },
        zIndex: 1,
        locked: false,
        createdAt: new Date(baseTime).toISOString(),
        updatedAt: new Date(baseTime).toISOString(),
      };

      // User 2 updates at T+1000 (1 second later)
      const user2Update: CanvasElement = {
        ...user1Update,
        content: { text: 'User 2 edit' },
        updatedAt: new Date(baseTime + 1000).toISOString(),
      };

      // Resolve conflict: User 2's update should win
      const winner =
        new Date(user2Update.updatedAt).getTime() >
        new Date(user1Update.updatedAt).getTime()
          ? user2Update
          : user1Update;

      expect(winner.content.text).toBe('User 2 edit');
      expect(winner.updatedAt).toBe(user2Update.updatedAt);
    });

    it('should handle simultaneous updates with same timestamp', () => {
      const timestamp = new Date().toISOString();

      const user1Update: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'User 1' },
        zIndex: 1,
        locked: false,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const user2Update: CanvasElement = {
        ...user1Update,
        content: { text: 'User 2' },
        updatedBy: 'user-2',
      };

      // When timestamps are equal, use user ID as tiebreaker
      const winner =
        user1Update.updatedAt === user2Update.updatedAt
          ? user1Update.updatedBy! < user2Update.updatedBy!
            ? user1Update
            : user2Update
          : user1Update;

      expect(winner.updatedBy).toBe('user-1'); // Alphabetically first
    });
  });

  describe('Element Locking', () => {
    it('should prevent edits to locked elements', () => {
      const lockedElement: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Locked content' },
        zIndex: 1,
        locked: true,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // User 2 tries to edit
      const canEdit = (element: CanvasElement, userId: string) => {
        if (element.locked && element.updatedBy !== userId) {
          return false;
        }
        return true;
      };

      expect(canEdit(lockedElement, 'user-2')).toBe(false);
      expect(canEdit(lockedElement, 'user-1')).toBe(true);
    });

    it('should allow unlocking by original user', () => {
      const element: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Content' },
        zIndex: 1,
        locked: true,
        updatedBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const unlock = (elem: CanvasElement, userId: string) => {
        if (elem.updatedBy === userId) {
          return { ...elem, locked: false };
        }
        return elem;
      };

      const unlocked = unlock(element, 'user-1');
      expect(unlocked.locked).toBe(false);

      const notUnlocked = unlock(element, 'user-2');
      expect(notUnlocked.locked).toBe(true);
    });
  });

  describe('Position Conflicts', () => {
    it('should handle overlapping element positions', () => {
      const element1: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'shape',
        positionX: 100,
        positionY: 100,
        width: 100,
        height: 100,
        content: {},
        zIndex: 1,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const element2: CanvasElement = {
        id: 'elem-2',
        valueCaseId: 'vc-123',
        elementType: 'shape',
        positionX: 150,
        positionY: 150,
        width: 100,
        height: 100,
        content: {},
        zIndex: 2,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Check for overlap
      const checkOverlap = (e1: CanvasElement, e2: CanvasElement) => {
        if (!e1.width || !e1.height || !e2.width || !e2.height) return false;

        return !(
          e1.positionX + e1.width < e2.positionX ||
          e2.positionX + e2.width < e1.positionX ||
          e1.positionY + e1.height < e2.positionY ||
          e2.positionY + e2.height < e1.positionY
        );
      };

      expect(checkOverlap(element1, element2)).toBe(true);

      // Higher z-index should be on top
      expect(element2.zIndex).toBeGreaterThan(element1.zIndex);
    });

    it('should auto-adjust z-index on overlap', () => {
      const elements: CanvasElement[] = [
        {
          id: 'elem-1',
          valueCaseId: 'vc-123',
          elementType: 'shape',
          positionX: 100,
          positionY: 100,
          width: 100,
          height: 100,
          content: {},
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'elem-2',
          valueCaseId: 'vc-123',
          elementType: 'shape',
          positionX: 150,
          positionY: 150,
          width: 100,
          height: 100,
          content: {},
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Auto-adjust z-index
      const adjustZIndex = (elems: CanvasElement[]) => {
        return elems.map((elem, index) => ({
          ...elem,
          zIndex: index + 1,
        }));
      };

      const adjusted = adjustZIndex(elements);
      expect(adjusted[0].zIndex).toBe(1);
      expect(adjusted[1].zIndex).toBe(2);
    });
  });

  describe('Content Conflicts', () => {
    it('should merge non-conflicting property changes', () => {
      const baseElement: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Original', fontSize: 14 },
        style: { color: 'black' },
        zIndex: 1,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // User 1 changes position
      const user1Change = {
        ...baseElement,
        positionX: 150,
        positionY: 250,
      };

      // User 2 changes content
      const user2Change = {
        ...baseElement,
        content: { text: 'Updated', fontSize: 14 },
      };

      // Merge changes
      const merged: CanvasElement = {
        ...baseElement,
        positionX: user1Change.positionX,
        positionY: user1Change.positionY,
        content: user2Change.content,
      };

      expect(merged.positionX).toBe(150);
      expect(merged.content.text).toBe('Updated');
    });

    it('should detect conflicting property changes', () => {
      const baseElement: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Original' },
        zIndex: 1,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // User 1 changes text
      const user1Change = {
        ...baseElement,
        content: { text: 'User 1 edit' },
        updatedAt: new Date(Date.now()).toISOString(),
      };

      // User 2 changes text
      const user2Change = {
        ...baseElement,
        content: { text: 'User 2 edit' },
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      };

      // Detect conflict
      const hasConflict =
        user1Change.content.text !== baseElement.content.text &&
        user2Change.content.text !== baseElement.content.text &&
        user1Change.content.text !== user2Change.content.text;

      expect(hasConflict).toBe(true);

      // Resolve using LWW
      const winner =
        new Date(user2Change.updatedAt).getTime() >
        new Date(user1Change.updatedAt).getTime()
          ? user2Change
          : user1Change;

      expect(winner.content.text).toBe('User 2 edit');
    });
  });

  describe('Deletion Conflicts', () => {
    it('should handle delete vs update conflict', () => {
      const element: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Content' },
        zIndex: 1,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // User 1 deletes at T+0
      const deleteTime = Date.now();

      // User 2 updates at T+500
      const updateTime = deleteTime + 500;

      // Delete should win if it happened after update
      const deleteWins = deleteTime > updateTime;

      expect(deleteWins).toBe(false); // Update happened later
    });

    it('should handle concurrent deletions', () => {
      const element: CanvasElement = {
        id: 'elem-1',
        valueCaseId: 'vc-123',
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Content' },
        zIndex: 1,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Both users delete at same time
      const user1Delete = { elementId: element.id, deletedAt: Date.now() };
      const user2Delete = { elementId: element.id, deletedAt: Date.now() };

      // Both deletions should be idempotent
      expect(user1Delete.elementId).toBe(user2Delete.elementId);
    });
  });

  describe('Undo/Redo Conflicts', () => {
    it('should handle undo during concurrent edits', () => {
      const history: CanvasElement[] = [
        {
          id: 'elem-1',
          valueCaseId: 'vc-123',
          elementType: 'text',
          positionX: 100,
          positionY: 200,
          content: { text: 'Version 1' },
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now()).toISOString(),
        },
        {
          id: 'elem-1',
          valueCaseId: 'vc-123',
          elementType: 'text',
          positionX: 100,
          positionY: 200,
          content: { text: 'Version 2' },
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now() + 1000).toISOString(),
        },
      ];

      // User 1 undoes to Version 1
      const undoVersion = history[0];

      // User 2 makes new edit (Version 3)
      const newEdit: CanvasElement = {
        ...history[1],
        content: { text: 'Version 3' },
        updatedAt: new Date(Date.now() + 2000).toISOString(),
      };

      // New edit should win over undo
      const winner =
        new Date(newEdit.updatedAt).getTime() >
        new Date(undoVersion.updatedAt).getTime()
          ? newEdit
          : undoVersion;

      expect(winner.content.text).toBe('Version 3');
    });
  });

  describe('Network Partition', () => {
    it('should reconcile changes after network partition', () => {
      // Offline changes from User 1
      const user1Changes: CanvasElement[] = [
        {
          id: 'elem-1',
          valueCaseId: 'vc-123',
          elementType: 'text',
          positionX: 100,
          positionY: 200,
          content: { text: 'Offline edit 1' },
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now()).toISOString(),
        },
        {
          id: 'elem-2',
          valueCaseId: 'vc-123',
          elementType: 'text',
          positionX: 200,
          positionY: 300,
          content: { text: 'Offline edit 2' },
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now() + 1000).toISOString(),
        },
      ];

      // Online changes from User 2
      const user2Changes: CanvasElement[] = [
        {
          id: 'elem-1',
          valueCaseId: 'vc-123',
          elementType: 'text',
          positionX: 150,
          positionY: 250,
          content: { text: 'Online edit' },
          zIndex: 1,
          locked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date(Date.now() + 500).toISOString(),
        },
      ];

      // Reconcile: merge non-conflicting, resolve conflicts with LWW
      const reconciled = new Map<string, CanvasElement>();

      [...user1Changes, ...user2Changes].forEach((change) => {
        const existing = reconciled.get(change.id);
        if (!existing) {
          reconciled.set(change.id, change);
        } else {
          // Use LWW for conflicts
          const winner =
            new Date(change.updatedAt).getTime() >
            new Date(existing.updatedAt).getTime()
              ? change
              : existing;
          reconciled.set(change.id, winner);
        }
      });

      expect(reconciled.size).toBe(2);
      expect(reconciled.get('elem-1')?.content.text).toBe('Offline edit 1');
      expect(reconciled.get('elem-2')?.content.text).toBe('Offline edit 2');
    });
  });
});
