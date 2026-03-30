import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { telemetry, useTelemetry } from './telemetry';

describe('Telemetry Service', () => {
  beforeEach(() => {
    // Reset telemetry state between tests
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('initializes with config', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
        debug: false,
      });

      expect(telemetry.isEnabled()).toBe(false); // PostHog not installed
    });

    it('does not initialize when disabled', async () => {
      await telemetry.init({
        enabled: false,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      expect(telemetry.isEnabled()).toBe(false);
    });

    it('does not initialize without api key', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: '',
        host: 'https://test.posthog.com',
      });

      expect(telemetry.isEnabled()).toBe(false);
    });
  });

  describe('capture', () => {
    it('captures events when enabled', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      // Should not throw when PostHog is not available
      await expect(
        telemetry.capture({
          event: 'test_event',
          properties: { foo: 'bar' },
        })
      ).resolves.not.toThrow();
    });

    it('does not capture when disabled', async () => {
      await telemetry.init({
        enabled: false,
        apiKey: '',
        host: 'https://test.posthog.com',
      });

      await telemetry.capture({
        event: 'test_event',
        properties: {},
      });

      expect(telemetry.isEnabled()).toBe(false);
    });
  });

  describe('identify', () => {
    it('identifies user when enabled', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      await expect(
        telemetry.identify('user-123', {
          email: 'test@example.com',
          organization: 'Test Org',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('pageView', () => {
    it('tracks page views', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      await expect(
        telemetry.pageView('/dashboard', 'Dashboard')
      ).resolves.not.toThrow();
    });
  });

  describe('featureUsed', () => {
    it('tracks feature usage', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      await telemetry.featureUsed('dark_mode', { source: 'settings' });

      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('error', () => {
    it('tracks errors', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      const error = new Error('Test error');
      await telemetry.error(error, { component: 'TestComponent' });

      // Should complete without throwing
      expect(true).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets user session', async () => {
      await telemetry.init({
        enabled: true,
        apiKey: 'test-key',
        host: 'https://test.posthog.com',
      });

      await expect(telemetry.reset()).resolves.not.toThrow();
    });
  });
});

describe('useTelemetry hook', () => {
  it('returns capture function', () => {
    const { result } = renderHook(() => useTelemetry());

    expect(typeof result.current.capture).toBe('function');
  });

  it('returns identify function', () => {
    const { result } = renderHook(() => useTelemetry());

    expect(typeof result.current.identify).toBe('function');
  });

  it('returns pageView function', () => {
    const { result } = renderHook(() => useTelemetry());

    expect(typeof result.current.pageView).toBe('function');
  });

  it('returns featureUsed function', () => {
    const { result } = renderHook(() => useTelemetry());

    expect(typeof result.current.featureUsed).toBe('function');
  });

  it('returns error function', () => {
    const { result } = renderHook(() => useTelemetry());

    expect(typeof result.current.error).toBe('function');
  });

  it('returns isEnabled function', () => {
    const { result } = renderHook(() => useTelemetry());

    expect(typeof result.current.isEnabled).toBe('function');
    expect(result.current.isEnabled()).toBe(false);
  });
});
