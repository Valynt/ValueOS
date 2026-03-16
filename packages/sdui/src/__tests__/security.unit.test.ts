/**
 * SDUI Security Unit Tests (No Database Required)
 * 
 * Tests XSS sanitization, metrics, and basic security features
 * without requiring database integration.
 */

import { beforeEach, describe, it } from 'vitest';

import {
  checkCriticalThresholds,
  getMetricSummary,
  getSecurityMetrics,
  incrementSecurityMetric,
  resetSecurityMetrics,
} from '../security/metrics';
import {
  getXSSStats,
  resetXSSStats,
  runSanitizationSelfTest,
  sanitizeProps,
  sanitizeString,
  XSS_TEST_VECTORS,
} from '../security/sanitization';

describe('XSS Sanitization', () => {
  beforeEach(() => {
    resetXSSStats();
  });

  it('should remove script tags', () => {
    const input = '<script>alert("XSS")</script>Hello';
    const output = sanitizeString(input);
    
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('alert');
    expect(output).toContain('Hello');
  });

  it('should remove event handlers', () => {
    const input = '<img src=x onerror="alert(1)">';
    const output = sanitizeString(input);
    
    expect(output).not.toContain('onerror=');
    expect(output).not.toContain('alert');
  });

  it('should block javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const output = sanitizeString(input);
    
    expect(output).not.toContain('javascript:');
  });

  it('should track XSS attempts', () => {
    const before = getXSSStats();
    sanitizeString('<script>alert(1)</script>');
    const after = getXSSStats();
    
    expect(after.blocked).toBeGreaterThan(before.blocked);
  });

  it('should pass all test vectors', () => {
    const result = runSanitizationSelfTest();
    
    expect(result.passed).toBe(true);
    
    if (!result.passed) {
      console.error('Failed tests:', result.results.filter(r => r.startsWith('FAIL')));
    }
  });

  it('should sanitize nested objects', () => {
    const input = {
      title: '<script>alert(1)</script>Title',
      data: {
        items: [
          { name: '<b>Bold</b>' },
          { name: '<script>XSS</script>' }
        ]
      }
    };
    
    const output = sanitizeProps(input);
    
    expect(output.title).not.toContain('<script>');
    expect(output.data.items[1].name).not.toContain('<script>');
  });

  it('should sanitize arrays of strings', () => {
    const input = {
      tags: ['safe', '<script>alert(1)</script>', 'also-safe']
    };
    
    const output = sanitizeProps(input);
    
    expect(output.tags[0]).toBe('safe');
    expect(output.tags[1]).not.toContain('<script>');
    expect(output.tags[2]).toBe('also-safe');
  });

  it('should apply strict policy', () => {
    const input = '<b>Bold</b> text';
    const output = sanitizeString(input, 'strict');
    
    // Strict removes ALL HTML
    expect(output).not.toContain('<b>');
    expect(output).toContain('Bold');
    expect(output).toContain('text');
  });

  it('should apply standard policy', () => {
    const input = '<p><b>Bold</b> and <i>italic</i></p>';
    const output = sanitizeString(input, 'standard');
    
    // Standard allows safe HTML
    expect(output).toContain('<p>');
    expect(output).toContain('<b>');
    expect(output).toContain('<i>');
  });

  it('should prevent infinite recursion in sanitization', () => {
    let nested: Record<string, unknown> = { value: '<script>alert(1)</script>' };
    
    // Create deeply nested structure (15 levels)
    for (let i = 0; i < 15; i++) {
      nested = { child: nested };
    }
    
    const input = { data: nested };
    
    // Should not crash
    expect(() => sanitizeProps(input)).not.toThrow();
  });

  it('should handle null and undefined values', () => {
    const input = {
      title: 'Hello',
      description: null,
      content: undefined,
      data: { value: null }
    };
    
    const output = sanitizeProps(input);
    
    expect(output.title).toBe('Hello');
    expect(output.description).toBeNull();
    expect(output.content).toBeUndefined();
    expect(output.data.value).toBeNull();
  });

  it('should preserve numbers and booleans', () => {
    const input = {
      count: 42,
      enabled: true,
      ratio: 3.14,
      disabled: false
    };
    
    const output = sanitizeProps(input);
    
    expect(output.count).toBe(42);
    expect(output.enabled).toBe(true);
    expect(output.ratio).toBe(3.14);
    expect(output.disabled).toBe(false);
  });

  it('should use component-specific policies', () => {
    const input = { content: '<h1>Title</h1><script>alert(1)</script>' };
    
    // MetricBadge uses strict policy
    const strict = sanitizeProps(input, 'MetricBadge');
    expect(strict.content).not.toContain('<h1>');
    expect(strict.content).not.toContain('<script>');
    
    // NarrativeBlock uses rich policy
    const rich = sanitizeProps(input, 'NarrativeBlock');
    expect(rich.content).toContain('<h1>'); // Allowed
    expect(rich.content).not.toContain('<script>'); // Blocked
  });
});

describe('Security Metrics', () => {
  beforeEach(() => {
    resetSecurityMetrics();
  });

  it('should track XSS blocks', () => {
    incrementSecurityMetric('xss_blocked', { component: 'TestComponent' });
    
    const metrics = getSecurityMetrics();
    expect(metrics.xssBlocked).toBe(1);
  });

  it('should track rate limit hits', () => {
    incrementSecurityMetric('rate_limit_hit', { org: 'org_123' });
    incrementSecurityMetric('rate_limit_hit', { org: 'org_456' });
    
    const metrics = getSecurityMetrics();
    expect(metrics.rateLimitHits).toBe(2);
  });

  it('should track tenant violations', () => {
    incrementSecurityMetric('tenant_violation', {
      requestedTenant: 'org_123',
      actualTenant: 'org_456'
    });
    
    const metrics = getSecurityMetrics();
    expect(metrics.tenantViolations).toBe(1);
  });

  it('should track recursion limits', () => {
    incrementSecurityMetric('recursion_limit', { depth: 15 });
    
    const metrics = getSecurityMetrics();
    expect(metrics.recursionLimits).toBe(1);
  });

  it('should track invalid schemas', () => {
    incrementSecurityMetric('invalid_schema', { errors: ['Missing sections'] });
    
    const metrics = getSecurityMetrics();
    expect(metrics.invalidSchemas).toBe(1);
  });

  it('should track component not found', () => {
    incrementSecurityMetric('component_not_found', { component: 'UnknownWidget' });
    
    const metrics = getSecurityMetrics();
    expect(metrics.componentNotFound).toBe(1);
  });

  it('should track binding errors', () => {
    incrementSecurityMetric('binding_error', { source: 'invalid_source' });
    
    const metrics = getSecurityMetrics();
    expect(metrics.bindingErrors).toBe(1);
  });

  it('should reset metrics', () => {
    incrementSecurityMetric('xss_blocked');
    incrementSecurityMetric('rate_limit_hit');
    
    resetSecurityMetrics();
    
    const metrics = getSecurityMetrics();
    expect(metrics.xssBlocked).toBe(0);
    expect(metrics.rateLimitHits).toBe(0);
  });

  it('should generate metric summary', () => {
    incrementSecurityMetric('xss_blocked');
    incrementSecurityMetric('rate_limit_hit');
    incrementSecurityMetric('tenant_violation');
    
    const summary = getMetricSummary();
    
    expect(summary).toContain('XSS Blocked: 1');
    expect(summary).toContain('Rate Limits: 1');
    expect(summary).toContain('Tenant Violations: 1');
  });

  it('should detect critical thresholds for tenant violations', () => {
    incrementSecurityMetric('tenant_violation');
    
    const { critical, alerts } = checkCriticalThresholds();
    
    expect(critical).toBe(true);
    expect(alerts.some(a => a.includes('CRITICAL') && a.includes('tenant'))).toBe(true);
  });

  it('should detect critical thresholds for high XSS attempts', () => {
    for (let i = 0; i < 51; i++) {
      incrementSecurityMetric('xss_blocked');
    }
    
    const { critical, alerts } = checkCriticalThresholds();
    
    expect(critical).toBe(true);
    expect(alerts.some(a => a.includes('CRITICAL') && a.includes('XSS'))).toBe(true);
  });

  it('should detect warning thresholds', () => {
    for (let i = 0; i < 101; i++) {
      incrementSecurityMetric('rate_limit_hit');
    }
    
    const { alerts } = checkCriticalThresholds();
    
    expect(alerts.some(a => a.includes('WARNING') && a.includes('rate limit'))).toBe(true);
  });

  it('should include timestamp in metrics', () => {
    const metrics = getSecurityMetrics();
    
    expect(metrics.sinceTimestamp).toBeLessThanOrEqual(Date.now());
    expect(metrics.sinceTimestamp).toBeGreaterThan(Date.now() - 1000);
  });
});

describe('XSS Test Vectors', () => {
  it('should have comprehensive test vectors', () => {
    expect(XSS_TEST_VECTORS.length).toBeGreaterThan(10);
    
    // Check for common attack patterns
    const vectors = XSS_TEST_VECTORS.join(' ');
    expect(vectors).toContain('<script>');
    expect(vectors).toContain('onerror=');
    expect(vectors).toContain('javascript:');
    expect(vectors).toContain('<iframe');
  });

  it('should block all test vectors', () => {
    for (const vector of XSS_TEST_VECTORS) {
      const sanitized = sanitizeString(vector);
      
      // No dangerous patterns should remain
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).not.toContain('onload=');
      expect(sanitized).not.toContain('onfocus=');
    }
  });
});
