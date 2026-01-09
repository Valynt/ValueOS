/**
 * Customer Portal Analytics Tracking Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPortalAnalytics,
  PortalEventType,
  trackBenchmarkView,
  trackEmailShare,
  trackError,
  trackExport,
  trackMetricView,
  trackPageView,
  trackTokenExpired,
  trackTokenValidation,
} from '../customerPortalTracking';

// Mock fetch
global.fetch = vi.fn();

describe('CustomerPortalAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Session Management', () => {
    it('should initialize a session on creation', () => {
      const analytics = getPortalAnalytics();
      const sessionId = analytics.getSessionId();

      expect(sessionId).toBeTruthy();
      expect(sessionId).toMatch(/^session_/);
    });

    it('should track session start', () => {
      const analytics = getPortalAnalytics();
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/portal/event',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should calculate session duration', () => {
      const analytics = getPortalAnalytics();
      
      vi.advanceTimersByTime(5000);
      
      const duration = analytics.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Page View Tracking', () => {
    it('should track page views', () => {
      trackPageView('realization-portal', {
        valueCaseId: 'vc-123',
        companyName: 'Acme Corp',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/portal/event',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('portal_page_view'),
        })
      );
    });

    it('should track time on page', () => {
      const analytics = getPortalAnalytics();
      
      analytics.trackPageView('page1');
      vi.advanceTimersByTime(3000);
      analytics.trackPageView('page2');

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.properties.duration).toBeGreaterThanOrEqual(3000);
    });
  });

  describe('Export Tracking', () => {
    it('should track PDF exports', () => {
      trackExport('pdf', {
        valueCaseId: 'vc-123',
        companyName: 'Acme Corp',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/portal/event',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('portal_export_pdf'),
        })
      );
    });

    it('should track Excel exports', () => {
      trackExport('excel', {
        valueCaseId: 'vc-123',
        companyName: 'Acme Corp',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/portal/event',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('portal_export_excel'),
        })
      );
    });
  });

  describe('Email Share Tracking', () => {
    it('should track email shares', () => {
      trackEmailShare(3, {
        valueCaseId: 'vc-123',
        companyName: 'Acme Corp',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_share_email');
      expect(body.properties.recipientCount).toBe(3);
    });
  });

  describe('Benchmark Tracking', () => {
    it('should track benchmark views', () => {
      trackBenchmarkView('Customer Acquisition Cost', {
        valueCaseId: 'vc-123',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_benchmark_view');
      expect(body.properties.kpiName).toBe('Customer Acquisition Cost');
    });
  });

  describe('Metric Tracking', () => {
    it('should track metric views', () => {
      trackMetricView('Revenue Growth', {
        valueCaseId: 'vc-123',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_metric_view');
      expect(body.properties.metricName).toBe('Revenue Growth');
    });
  });

  describe('Error Tracking', () => {
    it('should track errors', () => {
      trackError('Failed to load data', 'API_ERROR', {
        valueCaseId: 'vc-123',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_error');
      expect(body.properties.errorMessage).toBe('Failed to load data');
      expect(body.properties.errorCode).toBe('API_ERROR');
    });
  });

  describe('Token Tracking', () => {
    it('should track successful token validation', () => {
      trackTokenValidation(true, {
        token: 'test-token',
        valueCaseId: 'vc-123',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_token_validation');
    });

    it('should track failed token validation', () => {
      trackTokenValidation(false, {
        token: 'invalid-token',
        errorMessage: 'Token not found',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_token_invalid');
    });

    it('should track token expiration', () => {
      trackTokenExpired({
        token: 'expired-token',
      });

      const calls = (global.fetch as any).mock.calls;
      const lastCall = calls[calls.length - 1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.type).toBe('portal_token_expired');
    });
  });

  describe('Analytics Control', () => {
    it('should enable and disable tracking', () => {
      const analytics = getPortalAnalytics();
      
      analytics.disable();
      expect(analytics.isEnabled()).toBe(false);
      
      const callsBefore = (global.fetch as any).mock.calls.length;
      analytics.track(PortalEventType.PAGE_VIEW, { page: 'test' });
      const callsAfter = (global.fetch as any).mock.calls.length;
      
      expect(callsAfter).toBe(callsBefore);
      
      analytics.enable();
      expect(analytics.isEnabled()).toBe(true);
    });
  });

  describe('Session Timeout', () => {
    it('should end session after timeout', () => {
      const analytics = getPortalAnalytics();
      const initialSessionId = analytics.getSessionId();

      // Advance time past session timeout (30 minutes)
      vi.advanceTimersByTime(31 * 60 * 1000);

      const newSessionId = analytics.getSessionId();
      expect(newSessionId).not.toBe(initialSessionId);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      expect(() => {
        trackPageView('test-page');
      }).not.toThrow();
    });
  });
});
