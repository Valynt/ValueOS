/**
 * SDUI Security Test Suite
 * 
 * Comprehensive security tests for XSS, rate limiting, tenant isolation,
 * recursion depth, and other security measures.
 */

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataBindingResolver } from '../DataBindingResolver';
import { DataSourceContext } from '../DataBindingSchema';
import { SDUIRenderer } from '../renderer';
import { getSecurityMetrics, incrementSecurityMetric, resetSecurityMetrics } from '../security/metrics';
import { runSanitizationSelfTest, sanitizeProps, sanitizeString, XSS_TEST_VECTORS } from '../security/sanitization';
import { TenantContext } from '../TenantContext';

describe('SDUI Security - XSS Protection', () => {
  beforeEach(() => {
    resetSecurityMetrics();
  });

  it('should sanitize script tags in component props', () => {
    const maliciousProps = {
      title: '<script>alert("XSS")</script>Hello',
      content: 'Safe content',
    };

    const sanitized = sanitizeProps(maliciousProps, 'NarrativeBlock');

    expect(sanitized.title).not.toContain('<script>');
    expect(sanitized.title).not.toContain('alert');
    expect(sanitized.title).toContain('Hello');
  });

  it('should sanitize event handlers in props', () => {
    const maliciousProps = {
      content: '<img src=x onerror="alert(1)">',
    };

    const sanitized = sanitizeProps(maliciousProps, 'InfoBanner');

    expect(sanitized.content).not.toContain('onerror=');
    expect(sanitized.content).not.toContain('alert');
  });

  it('should sanitize javascript: URLs', () => {
    const maliciousProps = {
      link: 'javascript:alert(1)',
    };

    const sanitized = sanitizeProps(maliciousProps);

    expect(sanitized.link).not.toContain('javascript:');
  });

  it('should handle nested object sanitization', () => {
    const maliciousProps = {
      data: {
        items: [
          { name: '<script>alert(1)</script>Item 1' },
          { name: 'Safe Item 2' },
        ],
      },
    };

    const sanitized = sanitizeProps(maliciousProps);

    expect(sanitized.data.items[0].name).not.toContain('<script>');
    expect(sanitized.data.items[0].name).toContain('Item 1');
    expect(sanitized.data.items[1].name).toBe('Safe Item 2');
  });

  it('should sanitize array of strings', () => {
    const maliciousProps = {
      tags: [
        'safe-tag',
        '<script>alert("XSS")</script>',
        'another-safe-tag',
      ],
    };

    const sanitized = sanitizeProps(maliciousProps);

    expect(sanitized.tags[0]).toBe('safe-tag');
    expect(sanitized.tags[1]).not.toContain('<script>');
    expect(sanitized.tags[2]).toBe('another-safe-tag');
  });

  it('should track XSS attempts in metrics', () => {
    const maliciousString = '<script>alert("XSS")</script>';
    
    const before = getSecurityMetrics();
    sanitizeString(maliciousString);
    const after = getSecurityMetrics();

    expect(after.xssBlocked).toBeGreaterThan(before.xssBlocked);
  });

  it('should pass all XSS test vectors', () => {
    const result = runSanitizationSelfTest();
    
    expect(result.passed).toBe(true);
    if (!result.passed) {
      console.error('Failed XSS tests:', result.results.filter(r => r.startsWith('FAIL')));
    }
  });

  it('should use strict policy for MetricBadge', () => {
    const props = {
      label: '<b>Bold Label</b>',
      value: '<script>alert(1)</script>123',
    };

    const sanitized = sanitizeProps(props, 'MetricBadge');

    // Strict policy removes ALL HTML tags
    expect(sanitized.label).not.toContain('<b>');
    expect(sanitized.label).toContain('Bold Label');
    expect(sanitized.value).not.toContain('<script>');
  });

  it('should use rich policy for NarrativeBlock', () => {
    const props = {
      content: '<h2>Title</h2><p>Paragraph with <b>bold</b> text</p>',
    };

    const sanitized = sanitizeProps(props, 'NarrativeBlock');

    // Rich policy allows safe HTML
    expect(sanitized.content).toContain('<h2>');
    expect(sanitized.content).toContain('<p>');
    expect(sanitized.content).toContain('<b>');
  });

  it('should prevent recursive sanitization loops', () => {
    // Create deeply nested object
    let nested: any = { value: '<script>alert(1)</script>' };
    for (let i = 0; i < 15; i++) {
      nested = { child: nested };
    }

    const props = { data: nested };
    
    // Should not crash, should stop at max depth
    expect(() => sanitizeProps(props)).not.toThrow();
  });

  it('should render SDUI with sanitized props', () => {
    const maliciousSchema = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          version: 1,
          props: {
            title: '<script>alert("XSS")</script>Alert',
            description: 'Safe description',
          },
        },
      ],
    };

    const { container } = render(<SDUIRenderer schema={maliciousSchema} />);

    // Script tags should be removed
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).not.toContain('alert("XSS")');
    expect(container.innerHTML).toContain('Alert');
  });
});

describe('SDUI Security - Rate Limiting', () => {
  let resolver: DataBindingResolver;
  const mockContext: DataSourceContext = {
    organizationId: 'org_test_123',
    userId: 'user_test',
    sessionId: 'session_test',
    tenantId: 'tenant_test',
  };

  beforeEach(() => {
    resolver = new DataBindingResolver();
    resetSecurityMetrics();
  });

  afterEach(() => {
    resolver.destroy();
  });

  it('should enforce rate limits on data bindings', async () => {
    const binding = {
      $source: 'realization_engine' as const,
      $bind: 'test',
      $fallback: null,
    };

    // Mock the resolver to return quickly
    vi.spyOn(resolver as any, 'resolveFromSupabase').mockResolvedValue({ data: 'test' });

    // Make requests up to the limit (should succeed)
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(resolver.resolve(binding, mockContext));
    }
    
    await Promise.all(promises);

    // 101st request should fail with rate limit error
    await expect(
      resolver.resolve(binding, mockContext)
    ).rejects.toThrow(/Rate limit exceeded/);
  });

  it('should track rate limit violations in metrics', async () => {
    const binding = {
      $source: 'realization_engine' as const,
      $bind: 'test',
      $fallback: null,
    };

    vi.spyOn(resolver as any, 'resolveFromSupabase').mockResolvedValue({ data: 'test' });

    // Exceed rate limit
    const promises = [];
    for (let i = 0; i < 105; i++) {
      promises.push(
        resolver.resolve(binding, mockContext).catch(() => {}) // Ignore errors
      );
    }
    
    await Promise.allSettled(promises);

    const metrics = getSecurityMetrics();
    expect(metrics.rateLimitHits).toBeGreaterThan(0);
  });

  it('should reset rate limits after time window', async () => {
    const binding = {
      $source: 'system_mapper' as const,
      $bind: 'test',
      $fallback: null,
    };

    vi.spyOn(resolver as any, 'resolveFromSupabase').mockResolvedValue({ data: 'test' });

    // Make requests up to limit
    for (let i = 0; i < 100; i++) {
      await resolver.resolve(binding, mockContext);
    }

    // Wait for rate limit window to reset (mock time)
    vi.useFakeTimers();
    vi.advanceTimersByTime(61000); // 61 seconds
    vi.useRealTimers();

    // Should be able to make requests again
    await expect(
      resolver.resolve(binding, mockContext)
    ).resolves.toBeDefined();
  });

  it('should enforce concurrency limits', async () => {
    const binding = {
      $source: 'semantic_memory' as const,
      $bind: 'test',
      $fallback: null,
    };

    let concurrentRequests = 0;
    let maxConcurrent = 0;

    vi.spyOn(resolver as any, 'semanticMemory', 'get').mockReturnValue({
      searchSimilar: vi.fn(async () => {
        concurrentRequests++;
        maxConcurrent = Math.max(maxConcurrent, concurrentRequests);
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrentRequests--;
        return [];
      }),
    });

    // Try to make 20 concurrent requests
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(resolver.resolve(binding, mockContext));
    }

    await Promise.allSettled(promises);

    // Max concurrent should be limited to 5
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });
});

describe('SDUI Security - Recursion Guards', () => {
  it('should prevent infinite recursion in deeply nested layouts', () => {
    // Create schema with 15 levels of nesting (exceeds max of 10)
    let deeplyNested: any = {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: { title: 'Deep' },
    };

    for (let i = 0; i < 15; i++) {
      deeplyNested = {
        type: 'VerticalSplit',
        ratios: [1],
        children: [deeplyNested],
      };
    }

    const schema = {
      type: 'page',
      version: 1,
      sections: [deeplyNested],
    };

    const { container } = render(<SDUIRenderer schema={schema} />);

    // Should render error message instead of crashing
    expect(container.textContent).toContain('Layout too deeply nested');
  });

  it('should track recursion limit hits in metrics', () => {
    let deeplyNested: any = {
      type: 'component',
      component: 'InfoBanner',
      version: 1,
      props: { title: 'Deep' },
    };

    for (let i = 0; i < 12; i++) {
      deeplyNested = {
        type: 'Grid',
        columns: 1,
        children: [deeplyNested],
      };
    }

    const schema = {
      type: 'page',
      version: 1,
      sections: [deeplyNested],
    };

    resetSecurityMetrics();
    render(<SDUIRenderer schema={schema} />);

    const metrics = getSecurityMetrics();
    expect(metrics.recursionLimits).toBeGreaterThan(0);
  });

  it('should handle circular references gracefully', () => {
    // Note: Schema validation should prevent this, but test defense in depth
    const section1: any = {
      type: 'VerticalSplit',
      ratios: [1],
      children: [],
    };
    
    const section2: any = {
      type: 'HorizontalSplit',
      ratios: [1],
      children: [section1],
    };
    
    // Create circular reference
    section1.children = [section2];

    const schema = {
      type: 'page',
      version: 1,
      sections: [section1],
    };

    // Should not crash with stack overflow
    expect(() => render(<SDUIRenderer schema={schema} />)).not.toThrow();
  });
});

describe('SDUI Security - Tenant Isolation', () => {
  let resolver: DataBindingResolver;

  beforeEach(() => {
    resolver = new DataBindingResolver();
    resetSecurityMetrics();
  });

  afterEach(() => {
    resolver.destroy();
  });

  it('should prevent cross-tenant data access', async () => {
    const binding = {
      $source: 'realization_engine' as const,
      $bind: 'feedback_loops',
      $fallback: null,
      $tenantId: 'org_123', // Different tenant
    };

    const context: DataSourceContext = {
      organizationId: 'org_456', // User's actual org
      userId: 'user_test',
      sessionId: 'session_test',
      tenantId: 'org_456',
    };

    // Import validateTenantBinding for testing
    const { validateTenantBinding } = await import('../TenantAwareDataBinding');
    
    // Should throw tenant isolation error
    expect(() => {
      validateTenantBinding(binding, context as TenantContext);
    }).toThrow(/Tenant isolation violation/);
  });

  it('should track tenant violations in metrics', async () => {
    const binding = {
      $source: 'system_mapper' as const,
      $bind: 'entities',
      $fallback: null,
      $tenantId: 'org_attacker',
    };

    const context: DataSourceContext & TenantContext = {
      organizationId: 'org_victim',
      userId: 'user_test',
      sessionId: 'session_test',
      tenantId: 'org_victim',
      permissions: ['data:system:read'],
    };

    const { validateTenantBinding } = await import('../TenantAwareDataBinding');
    
    try {
      validateTenantBinding(binding, context);
    } catch {
      // Expected
    }

    const metrics = getSecurityMetrics();
    expect(metrics.tenantViolations).toBeGreaterThan(0);
  });
});

describe('SDUI Security - Schema Validation', () => {
  it('should reject invalid schemas', () => {
    const invalidSchema = {
      type: 'page',
      // Missing required 'sections' field
    };

    const { container } = render(<SDUIRenderer schema={invalidSchema} />);

    expect(container.textContent).toContain('schema failed validation');
  });

  it('should track invalid schemas in metrics', () => {
    const invalidSchema = {
      type: 'invalid',
      sections: [],
    };

    resetSecurityMetrics();
    render(<SDUIRenderer schema={invalidSchema} />);

    const metrics = getSecurityMetrics();
    expect(metrics.invalidSchemas).toBeGreaterThan(0);
  });

  it('should reject schemas with invalid component versions', () => {
    const schema = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          version: -1, // Invalid version
          props: {},
        },
      ],
    };

    const { container } = render(<SDUIRenderer schema={schema} />);

    expect(container.textContent).toContain('schema failed validation');
  });
});

describe('SDUI Security - Integration', () => {
  it('should handle combined attack vectors', () => {
    // Schema with XSS, deep nesting, and multiple bindings
    const maliciousSchema = {
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'NarrativeBlock',
          version: 1,
          props: {
            content: '<script>alert("XSS")</script><img src=x onerror="alert(1)">',
          },
          hydrateWith: Array(50).fill('/api/data'), // Try to trigger rate limit
        },
      ],
    };

    resetSecurityMetrics();
    const { container } = render(<SDUIRenderer schema={maliciousSchema} />);

    // XSS should be blocked
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).not.toContain('onerror=');

    // Metrics should track multiple security events
    const metrics = getSecurityMetrics();
    expect(metrics.xssBlocked).toBeGreaterThan(0);
  });

  it('should maintain security under load', async () => {
    const resolver = new DataBindingResolver();
    
    try {
      const binding = {
        $source: 'realization_engine' as const,
        $bind: 'test',
        $fallback: null,
      };

      const context: DataSourceContext = {
        organizationId: 'org_load_test',
        userId: 'user_test',
        sessionId: 'session_test',
        tenantId: 'tenant_test',
      };

      vi.spyOn(resolver as any, 'resolveFromSupabase').mockResolvedValue({ data: 'test' });

      // Simulate 500 concurrent requests across multiple orgs
      const promises = [];
      for (let i = 0; i < 500; i++) {
        const orgContext = {
          ...context,
          organizationId: `org_${i % 10}`, // 10 different orgs
        };
        promises.push(
          resolver.resolve(binding, orgContext).catch(() => {}) // Ignore rate limit errors
        );
      }

      await Promise.allSettled(promises);

      // Should have enforced rate limits without crashing
      const metrics = getSecurityMetrics();
      expect(metrics.rateLimitHits).toBeGreaterThan(0);
    } finally {
      resolver.destroy();
    }
  });
});
