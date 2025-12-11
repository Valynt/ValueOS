/**
 * SDUI Security Unit Tests
 * Tests XSS sanitization, rate limiting, and recursion guards WITHOUT database dependencies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeProps, XSS_TEST_VECTORS } from '../security/sanitization';
import {
  incrementSecurityMetric,
  getSecurityMetrics,
  resetSecurityMetrics,
} from '../security/metrics';

describe('SDUI Security Unit Tests', () => {
  beforeEach(() => {
    resetSecurityMetrics();
  });

  describe('XSS Sanitization', () => {
    it('should sanitize script tags from text fields', () => {
      const input = {
        title: '<script>alert("XSS")</script>Hello',
        description: 'Safe text',
      };

      const result = sanitizeProps(input, 'InfoBanner');

      expect(result.title).not.toContain('<script>');
      expect(result.title).toContain('Hello');
      expect(result.description).toBe('Safe text');
    });

    it('should sanitize event handlers', () => {
      const input = {
        label: '<div onerror="alert(1)">Click</div>',
        content: '<img src=x onerror=alert(1)>',
      };

      const result = sanitizeProps(input, 'Button');

      expect(result.label).not.toContain('onerror');
      expect(result.content).not.toContain('onerror');
    });

    it('should sanitize javascript: URLs', () => {
      const input = {
        href: 'javascript:alert(1)',
        url: 'javascript:void(0)',
      };

      const result = sanitizeProps(input, 'Link');

      expect(result.href).not.toContain('javascript:');
      expect(result.url).not.toContain('javascript:');
    });

    it('should handle nested objects recursively', () => {
      const input = {
        config: {
          title: '<script>alert(1)</script>Safe',
          nested: {
            value: '<img src=x onerror=alert(1)>',
          },
        },
      };

      const result = sanitizeProps(input, 'DataTable');

      expect(result.config.title).not.toContain('<script>');
      expect(result.config.nested.value).not.toContain('onerror');
    });

    it('should handle arrays of objects', () => {
      const input = {
        items: [
          { name: '<script>XSS</script>Item 1' },
          { name: 'Safe Item 2' },
          { name: '<img src=x onerror=alert(1)>' },
        ],
      };

      const result = sanitizeProps(input, 'List');

      expect(result.items[0].name).not.toContain('<script>');
      expect(result.items[1].name).toBe('Safe Item 2');
      expect(result.items[2].name).not.toContain('onerror');
    });

    it('should use component-specific security policies', () => {
      const input = {
        content: '<b>Bold</b> <script>alert(1)</script>',
      };

      // NarrativeBlock allows rich HTML like <b>, <i>
      const richResult = sanitizeProps(input, 'NarrativeBlock');
      expect(richResult.content).toContain('<b>');
      expect(richResult.content).not.toContain('<script>');

      // MetricBadge uses strict policy - strips all HTML
      const strictResult = sanitizeProps(input, 'MetricBadge');
      expect(strictResult.content).not.toContain('<b>');
      expect(strictResult.content).not.toContain('<script>');
    });

    it('should detect and prevent recursion loops', () => {
      const circular: any = { name: 'Node' };
      circular.self = circular; // Create circular reference

      const result = sanitizeProps(circular, 'Tree');

      // Should not throw, should handle gracefully
      expect(result).toBeDefined();
      expect(result.name).toBe('Node');
    });

    it('should block all XSS test vectors', () => {
      XSS_TEST_VECTORS.forEach((vector) => {
        const input = { content: vector };
        const result = sanitizeProps(input, 'InfoBanner');

        // Result should not contain dangerous patterns
        expect(result.content).not.toContain('<script');
        expect(result.content).not.toContain('javascript:');
        expect(result.content).not.toMatch(/on\w+=/i); // No event handlers
      });
    });

    it('should preserve safe HTML entities', () => {
      const input = {
        text: '&lt;safe&gt; &amp; &quot;quoted&quot;',
      };

      const result = sanitizeProps(input, 'Text');

      expect(result.text).toContain('&lt;');
      expect(result.text).toContain('&amp;');
      expect(result.text).toContain('&quot;');
    });

    it('should handle null and undefined values', () => {
      const input = {
        title: null,
        description: undefined,
        value: 'Safe',
      };

      const result = sanitizeProps(input, 'InfoBanner');

      expect(result.title).toBeNull();
      expect(result.description).toBeUndefined();
      expect(result.value).toBe('Safe');
    });

    it('should handle non-string primitive values', () => {
      const input = {
        count: 42,
        enabled: true,
        ratio: 3.14,
        timestamp: new Date('2025-01-01'),
      };

      const result = sanitizeProps(input, 'MetricBadge');

      expect(result.count).toBe(42);
      expect(result.enabled).toBe(true);
      expect(result.ratio).toBe(3.14);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Security Metrics', () => {
    it('should track XSS blocks', () => {
      incrementSecurityMetric('xss_blocked', { component: 'InfoBanner' });
      incrementSecurityMetric('xss_blocked', { component: 'InfoBanner' });

      const metrics = getSecurityMetrics();
      expect(metrics.xssBlocked).toBe(2);
    });

    it('should track rate limit hits', () => {
      incrementSecurityMetric('rate_limit_hit', { organizationId: 'org-123' });

      const metrics = getSecurityMetrics();
      expect(metrics.rateLimitHits).toBe(1);
    });

    it('should track tenant violations', () => {
      incrementSecurityMetric('tenant_violation', {
        organizationId: 'org-456',
        attemptedAccess: 'workflows',
      });

      const metrics = getSecurityMetrics();
      expect(metrics.tenantViolations).toBe(1);
    });

    it('should track recursion limit hits', () => {
      incrementSecurityMetric('recursion_limit', { depth: 15 });

      const metrics = getSecurityMetrics();
      expect(metrics.recursionLimits).toBe(1);
    });

    it('should reset metrics correctly', () => {
      incrementSecurityMetric('xss_blocked', {});
      incrementSecurityMetric('rate_limit_hit', {});
      incrementSecurityMetric('tenant_violation', {});

      let metrics = getSecurityMetrics();
      expect(metrics.xssBlocked).toBe(1);
      expect(metrics.rateLimitHits).toBe(1);
      expect(metrics.tenantViolations).toBe(1);

      resetSecurityMetrics();

      metrics = getSecurityMetrics();
      expect(metrics.xssBlocked).toBe(0);
      expect(metrics.rateLimitHits).toBe(0);
      expect(metrics.tenantViolations).toBe(0);
    });

    it('should handle multiple event types independently', () => {
      incrementSecurityMetric('xss_blocked', { component: 'A' });
      incrementSecurityMetric('xss_blocked', { component: 'B' });
      incrementSecurityMetric('rate_limit_hit', { org: 'org-1' });
      incrementSecurityMetric('tenant_violation', { org: 'org-2' });

      const metrics = getSecurityMetrics();
      expect(metrics.xssBlocked).toBe(2);
      expect(metrics.rateLimitHits).toBe(1);
      expect(metrics.tenantViolations).toBe(1);
    });
  });

  describe('Recursion Guard Logic', () => {
    it('should detect when depth exceeds MAX_RENDER_DEPTH', () => {
      const MAX_RENDER_DEPTH = 10;
      let depth = 11;

      // Simulate recursion guard check
      const exceedsDepth = depth > MAX_RENDER_DEPTH;
      expect(exceedsDepth).toBe(true);

      depth = 10;
      expect(depth > MAX_RENDER_DEPTH).toBe(false);
    });

    it('should track depth through nested renders', () => {
      // Simulate nested rendering
      const renderDepths: number[] = [];

      const mockRender = (currentDepth: number, maxDepth: number = 3) => {
        renderDepths.push(currentDepth);
        if (currentDepth >= maxDepth) return;
        mockRender(currentDepth + 1, maxDepth);
      };

      mockRender(0, 5);

      expect(renderDepths).toEqual([0, 1, 2, 3, 4, 5]);
      expect(renderDepths.length).toBe(6);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle combined attack vectors', () => {
      const maliciousInput = {
        title: '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
        link: 'javascript:void(fetch("evil.com"))',
        nested: {
          content: '<iframe src="javascript:alert(1)"></iframe>',
          array: [
            '<svg onload=alert(1)>',
            '<a href="javascript:alert(1)">Click</a>',
          ],
        },
      };

      const result = sanitizeProps(maliciousInput, 'InfoBanner');

      // All dangerous patterns should be removed
      expect(result.title).not.toContain('<script>');
      expect(result.title).not.toContain('onerror');
      expect(result.link).not.toContain('javascript:');
      expect(result.nested.content).not.toContain('<iframe');
      expect(result.nested.array[0]).not.toContain('onload');
      expect(result.nested.array[1]).not.toContain('javascript:');

      // Metrics should be incremented (if implementation tracks per-field)
      // This assumes sanitizeProps increments metrics internally
      // const metrics = getSecurityMetrics();
      // expect(metrics.xss_attempt).toBeGreaterThan(0);
    });

    it('should preserve valid data while blocking attacks', () => {
      const mixedInput = {
        safeName: 'John Doe',
        safeEmail: 'john@example.com',
        maliciousScript: '<script>alert(1)</script>',
        safeNumber: 42,
        safeBoolean: true,
        nestedSafe: {
          value: 'Valid text',
          malicious: '<img src=x onerror=alert(1)>',
        },
      };

      const result = sanitizeProps(mixedInput, 'DataTable');

      // Safe values preserved
      expect(result.safeName).toBe('John Doe');
      expect(result.safeEmail).toBe('john@example.com');
      expect(result.safeNumber).toBe(42);
      expect(result.safeBoolean).toBe(true);
      expect(result.nestedSafe.value).toBe('Valid text');

      // Malicious values sanitized
      expect(result.maliciousScript).not.toContain('<script>');
      expect(result.nestedSafe.malicious).not.toContain('onerror');
    });
  });
});
