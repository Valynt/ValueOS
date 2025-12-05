/**
 * Tests for Chat Workflow Configuration
 * Phase 2: Workflow State Persistence
 */

import { describe, it, expect } from 'vitest';
import {
  checkStageTransition,
  getStageDisplayName,
  getPossibleNextStages,
  isValidStage,
  CHAT_WORKFLOW_STAGES,
} from '../chatWorkflowConfig';

describe('Phase 2: Chat Workflow Configuration', () => {
  describe('CHAT_WORKFLOW_STAGES', () => {
    it('should have all lifecycle stages defined', () => {
      expect(CHAT_WORKFLOW_STAGES).toHaveProperty('opportunity');
      expect(CHAT_WORKFLOW_STAGES).toHaveProperty('target');
      expect(CHAT_WORKFLOW_STAGES).toHaveProperty('realization');
      expect(CHAT_WORKFLOW_STAGES).toHaveProperty('expansion');
    });

    it('should have valid stage configurations', () => {
      Object.values(CHAT_WORKFLOW_STAGES).forEach(stage => {
        expect(stage).toHaveProperty('stage');
        expect(stage).toHaveProperty('displayName');
        expect(stage).toHaveProperty('description');
        expect(stage).toHaveProperty('nextStages');
        expect(stage).toHaveProperty('transitions');
      });
    });
  });

  describe('checkStageTransition', () => {
    it('should transition from opportunity to target with ROI keywords', () => {
      const result = checkStageTransition(
        'opportunity',
        'help me build an roi model',
        'ready to move to target stage',
        0.9
      );

      expect(result).toBe('target');
    });

    it('should transition from target to realization with tracking keywords', () => {
      const result = checkStageTransition(
        'target',
        'start tracking value delivery',
        'ready to realize the value',
        0.85
      );

      expect(result).toBe('realization');
    });

    it('should transition from realization to expansion with growth keywords', () => {
      const result = checkStageTransition(
        'realization',
        'what upsell opportunities exist?',
        'expansion opportunity identified',
        0.8
      );

      expect(result).toBe('expansion');
    });

    it('should not transition without matching keywords', () => {
      const result = checkStageTransition(
        'opportunity',
        'tell me about this company',
        'here is some information',
        0.9
      );

      expect(result).toBeNull();
    });

    it('should not transition with low confidence', () => {
      const result = checkStageTransition(
        'opportunity',
        'roi business case',
        'ready to target',
        0.5  // Below threshold
      );

      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result = checkStageTransition(
        'opportunity',
        'BUILD ROI MODEL',
        'READY TO TARGET',
        0.9
      );

      expect(result).toBe('target');
    });

    it('should return null for expansion stage (no next stages)', () => {
      const result = checkStageTransition(
        'expansion',
        'anything',
        'anything',
        1.0
      );

      expect(result).toBeNull();
    });
  });

  describe('getStageDisplayName', () => {
    it('should return correct display names', () => {
      expect(getStageDisplayName('opportunity')).toBe('Opportunity');
      expect(getStageDisplayName('target')).toBe('Target');
      expect(getStageDisplayName('realization')).toBe('Realization');
      expect(getStageDisplayName('expansion')).toBe('Expansion');
    });

    it('should return stage ID for unknown stages', () => {
      expect(getStageDisplayName('unknown' as any)).toBe('unknown');
    });
  });

  describe('getPossibleNextStages', () => {
    it('should return correct next stages', () => {
      expect(getPossibleNextStages('opportunity')).toEqual(['target']);
      expect(getPossibleNextStages('target')).toEqual(['realization']);
      expect(getPossibleNextStages('realization')).toEqual(['expansion']);
      expect(getPossibleNextStages('expansion')).toEqual([]);
    });
  });

  describe('isValidStage', () => {
    it('should validate known stages', () => {
      expect(isValidStage('opportunity')).toBe(true);
      expect(isValidStage('target')).toBe(true);
      expect(isValidStage('realization')).toBe(true);
      expect(isValidStage('expansion')).toBe(true);
    });

    it('should reject unknown stages', () => {
      expect(isValidStage('invalid')).toBe(false);
      expect(isValidStage('')).toBe(false);
    });
  });
});
