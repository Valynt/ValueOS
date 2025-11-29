/**
 * Tests for Chat SDUI Templates
 * Phase 3: SDUI Template Refactoring
 */

import { describe, it, expect } from 'vitest';
import {
  generateChatSDUIPage,
  hasTemplateForStage,
  getAvailableStages,
  CHAT_TEMPLATES,
} from '../chat-templates';
import type { WorkflowState } from '../../../repositories/WorkflowStateRepository';

const createMockWorkflowState = (stage: string): WorkflowState => ({
  currentStage: stage,
  status: 'in_progress',
  completedStages: [],
  context: {
    caseId: 'test-case-123',
    company: 'Test Company',
  },
});

describe('Phase 3: Chat SDUI Templates', () => {
  describe('CHAT_TEMPLATES', () => {
    it('should have templates for all lifecycle stages', () => {
      expect(CHAT_TEMPLATES).toHaveProperty('opportunity');
      expect(CHAT_TEMPLATES).toHaveProperty('target');
      expect(CHAT_TEMPLATES).toHaveProperty('realization');
      expect(CHAT_TEMPLATES).toHaveProperty('expansion');
    });

    it('should have callable generator functions', () => {
      Object.values(CHAT_TEMPLATES).forEach(generator => {
        expect(typeof generator).toBe('function');
      });
    });
  });

  describe('generateChatSDUIPage', () => {
    it('should generate opportunity page', () => {
      const page = generateChatSDUIPage('opportunity', {
        content: 'Test response',
        confidence: 0.85,
        reasoning: ['Step 1', 'Step 2'],
        workflowState: createMockWorkflowState('opportunity'),
        sessionId: 'session-123',
        traceId: 'trace-456',
      });

      expect(page.type).toBe('page');
      expect(page.version).toBe(1);
      expect(page.sections.length).toBeGreaterThan(0);
      expect(page.metadata?.lifecycle_stage).toBe('opportunity');
      expect(page.metadata?.confidence_score).toBe(0.85);
      expect(page.metadata?.session_id).toBe('session-123');
      expect(page.metadata?.trace_id).toBe('trace-456');
    });

    it('should generate target page', () => {
      const page = generateChatSDUIPage('target', {
        content: 'ROI analysis',
        confidence: 0.9,
        reasoning: ['Calculate savings'],
        workflowState: createMockWorkflowState('target'),
      });

      expect(page.metadata?.lifecycle_stage).toBe('target');
      expect(page.metadata?.priority).toBe('high');
    });

    it('should generate realization page', () => {
      const page = generateChatSDUIPage('realization', {
        content: 'Value tracking',
        confidence: 0.88,
        reasoning: ['Monitor KPIs'],
        workflowState: createMockWorkflowState('realization'),
      });

      expect(page.metadata?.lifecycle_stage).toBe('realization');
      expect(page.metadata?.priority).toBe('critical');
      expect(page.metadata?.accessibility?.high_contrast_mode).toBe(true);
    });

    it('should generate expansion page', () => {
      const page = generateChatSDUIPage('expansion', {
        content: 'Growth opportunities',
        confidence: 0.82,
        reasoning: ['Identify upsells'],
        workflowState: createMockWorkflowState('expansion'),
      });

      expect(page.metadata?.lifecycle_stage).toBe('expansion');
      expect(page.metadata?.priority).toBe('high');
    });

    it('should include AgentResponseCard component', () => {
      const page = generateChatSDUIPage('opportunity', {
        content: 'Test',
        confidence: 0.8,
        reasoning: [],
        workflowState: createMockWorkflowState('opportunity'),
      });

      const hasAgentCard = page.sections.some(
        s => s.type === 'component' && s.component === 'AgentResponseCard'
      );
      expect(hasAgentCard).toBe(true);
    });

    it('should include InsightCard when confidence is high', () => {
      const page = generateChatSDUIPage('opportunity', {
        content: 'Test',
        confidence: 0.85,  // Above 0.7 threshold
        reasoning: [],
        workflowState: createMockWorkflowState('opportunity'),
      });

      expect(page.sections.length).toBeGreaterThan(1);
    });

    it('should not include InsightCard when confidence is low', () => {
      const page = generateChatSDUIPage('opportunity', {
        content: 'Test',
        confidence: 0.6,  // Below 0.7 threshold
        reasoning: [],
        workflowState: createMockWorkflowState('opportunity'),
      });

      expect(page.sections.length).toBe(1);
    });

    it('should set telemetry_enabled in metadata', () => {
      const page = generateChatSDUIPage('target', {
        content: 'Test',
        confidence: 0.8,
        reasoning: [],
        workflowState: createMockWorkflowState('target'),
      });

      expect(page.metadata?.telemetry_enabled).toBe(true);
    });

    it('should set accessibility level to AA', () => {
      const page = generateChatSDUIPage('opportunity', {
        content: 'Test',
        confidence: 0.8,
        reasoning: [],
        workflowState: createMockWorkflowState('opportunity'),
      });

      expect(page.metadata?.accessibility?.level).toBe('AA');
      expect(page.metadata?.accessibility?.screen_reader_optimized).toBe(true);
    });
  });

  describe('hasTemplateForStage', () => {
    it('should return true for valid stages', () => {
      expect(hasTemplateForStage('opportunity')).toBe(true);
      expect(hasTemplateForStage('target')).toBe(true);
      expect(hasTemplateForStage('realization')).toBe(true);
      expect(hasTemplateForStage('expansion')).toBe(true);
    });

    it('should return false for invalid stages', () => {
      expect(hasTemplateForStage('invalid')).toBe(false);
      expect(hasTemplateForStage('')).toBe(false);
    });
  });

  describe('getAvailableStages', () => {
    it('should return all lifecycle stages', () => {
      const stages = getAvailableStages();
      
      expect(stages).toContain('opportunity');
      expect(stages).toContain('target');
      expect(stages).toContain('realization');
      expect(stages).toContain('expansion');
      expect(stages.length).toBe(4);
    });
  });
});
