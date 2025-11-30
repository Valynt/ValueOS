/**
 * Tests for SDUI Telemetry System
 * Phase 3: SDUI Template Refactoring
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SDUITelemetry, TelemetryEventType } from '../SDUITelemetry';

describe('Phase 3: SDUI Telemetry', () => {
  let telemetry: SDUITelemetry;

  beforeEach(() => {
    telemetry = new SDUITelemetry(true);
    telemetry.clear();
  });

  describe('Event Recording', () => {
    it('should record events', () => {
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_START,
        metadata: { test: 'data' },
      });

      const events = telemetry.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe(TelemetryEventType.RENDER_START);
    });

    it('should add timestamp to events', () => {
      const before = Date.now();
      
      telemetry.recordEvent({
        type: TelemetryEventType.CHAT_REQUEST_START,
        metadata: {},
      });

      const events = telemetry.getEvents();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should respect event cap', () => {
      // Record more than 1000 events
      for (let i = 0; i < 1100; i++) {
        telemetry.recordEvent({
          type: TelemetryEventType.USER_INTERACTION,
          metadata: { index: i },
        });
      }

      const events = telemetry.getEvents();
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Span Tracking', () => {
    it('should track performance spans', (done) => {
      telemetry.startSpan('test-span', TelemetryEventType.RENDER_START);

      setTimeout(() => {
        telemetry.endSpan('test-span', TelemetryEventType.RENDER_COMPLETE);

        const events = telemetry.getEvents({ type: TelemetryEventType.RENDER_COMPLETE });
        expect(events.length).toBe(1);
        expect(events[0].duration).toBeGreaterThan(0);
        done();
      }, 10);
    });

    it('should handle missing span gracefully', () => {
      telemetry.endSpan('nonexistent', TelemetryEventType.RENDER_COMPLETE);
      
      // Should not throw, just log warning
      const events = telemetry.getEvents();
      expect(events.length).toBe(0);
    });

    it('should remove span after ending', () => {
      telemetry.startSpan('test', TelemetryEventType.RENDER_START);
      telemetry.endSpan('test', TelemetryEventType.RENDER_COMPLETE);
      
      // Ending again should warn about missing span
      telemetry.endSpan('test', TelemetryEventType.RENDER_COMPLETE);
    });
  });

  describe('Specialized Helpers', () => {
    it('should record interactions', () => {
      telemetry.recordInteraction('Button', 'click', { value: 123 });

      const events = telemetry.getEvents({ type: TelemetryEventType.USER_INTERACTION });
      expect(events.length).toBe(1);
      expect(events[0].metadata.component).toBe('Button');
      expect(events[0].metadata.action).toBe('click');
      expect(events[0].metadata.value).toBe(123);
    });

    it('should record workflow state changes', () => {
      telemetry.recordWorkflowStateChange(
        'session-123',
        'opportunity',
        'target',
        { reason: 'user request' }
      );

      const events = telemetry.getEvents({ type: TelemetryEventType.WORKFLOW_STAGE_TRANSITION });
      expect(events.length).toBe(1);
      expect(events[0].metadata.sessionId).toBe('session-123');
      expect(events[0].metadata.fromStage).toBe('opportunity');
      expect(events[0].metadata.toStage).toBe('target');
    });
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_START,
        traceId: 'trace-1',
        metadata: {},
      });
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_COMPLETE,
        traceId: 'trace-1',
        metadata: {},
      });
      telemetry.recordEvent({
        type: TelemetryEventType.CHAT_REQUEST_START,
        traceId: 'trace-2',
        metadata: {},
      });
    });

    it('should filter by type', () => {
      const events = telemetry.getEvents({ type: TelemetryEventType.RENDER_START });
      expect(events.length).toBe(1);
      expect(events[0].type).toBe(TelemetryEventType.RENDER_START);
    });

    it('should filter by traceId', () => {
      const events = telemetry.getEvents({ traceId: 'trace-1' });
      expect(events.length).toBe(2);
      expect(events.every(e => e.traceId === 'trace-1')).toBe(true);
    });

    it('should filter by timestamp', () => {
      const now = Date.now();
      
      const events = telemetry.getEvents({ since: now - 1000 });
      expect(events.length).toBe(3);
    });
  });

  describe('Performance Summary', () => {
    it('should calculate average render time', () => {
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_COMPLETE,
        duration: 100,
        metadata: {},
      });
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_COMPLETE,
        duration: 200,
        metadata: {},
      });

      const summary = telemetry.getPerformanceSummary();
      expect(summary.avgRenderTime).toBe(150);
    });

    it('should calculate error rate', () => {
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_COMPLETE,
        metadata: {},
      });
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_ERROR,
        metadata: {},
      });

      const summary = telemetry.getPerformanceSummary();
      expect(summary.errorRate).toBe(0.5);
    });

    it('should handle empty events', () => {
      const summary = telemetry.getPerformanceSummary();
      
      expect(summary.avgRenderTime).toBe(0);
      expect(summary.avgHydrationTime).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.totalEvents).toBe(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should not record when disabled', () => {
      telemetry.setEnabled(false);
      
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_START,
        metadata: {},
      });

      expect(telemetry.getEvents().length).toBe(0);
    });

    it('should resume recording when re-enabled', () => {
      telemetry.setEnabled(false);
      telemetry.setEnabled(true);
      
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_START,
        metadata: {},
      });

      expect(telemetry.getEvents().length).toBe(1);
    });
  });

  describe('Export', () => {
    it('should export events as JSON', () => {
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_START,
        metadata: { test: 'data' },
      });

      const exported = telemetry.exportEvents();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].type).toBe(TelemetryEventType.RENDER_START);
    });
  });

  describe('Clear', () => {
    it('should remove all events', () => {
      telemetry.recordEvent({
        type: TelemetryEventType.RENDER_START,
        metadata: {},
      });

      telemetry.clear();

      expect(telemetry.getEvents().length).toBe(0);
    });

    it('should clear active spans', () => {
      telemetry.startSpan('test', TelemetryEventType.RENDER_START);
      telemetry.clear();
      
      // Ending after clear should not find the span
      telemetry.endSpan('test', TelemetryEventType.RENDER_COMPLETE);
    });
  });
});
