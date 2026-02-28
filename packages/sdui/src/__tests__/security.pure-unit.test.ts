/**
 * SDUI Security Pure Unit Tests
 *
 * These tests bypass Vitest setup to avoid database initialization.
 * Run with: node --import tsx/esm src/sdui/__tests__/security.pure-unit.test.ts
 */



// Simple test framework
type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.push({ name, passed: false, error: String(error) });
      console.log(`❌ ${name}`);
      console.error(error);
    }
  };
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toEqual(expected: unknown) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${actualStr} to equal ${expectedStr}`);
      }
    },
    toContain(expected: string) {
      if (typeof actual !== 'string' || !actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    },
    not: {
      toContain(expected: string) {
        if (typeof actual === 'string' && actual.includes(expected)) {
          throw new Error(`Expected ${actual} not to contain ${expected}`);
        }
      },
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toHaveProperty(property: string) {
      if (typeof actual !== 'object' || actual === null || !(property in actual)) {
        throw new Error(`Expected object to have property ${property}`);
      }
    },
  };
}

// Import security modules
import {
  checkCriticalThresholds,
  getMetricSummary,
  getSecurityMetrics,
  incrementSecurityMetric,
  resetSecurityMetrics,
} from '../security/metrics.js';
import {
  getXSSStats,
  resetXSSStats,
  runSanitizationSelfTest,
  sanitizeProps,
  sanitizeString,
  XSS_TEST_VECTORS,
} from '../security/sanitization.js';

// Test Suite
async function runTests() {
  console.log('🧪 Running SDUI Security Pure Unit Tests\n');

  // XSS Sanitization Tests
  console.log('📦 XSS Sanitization Tests');

  await test('should remove script tags', () => {
    resetXSSStats();
    const input = '<script>alert("XSS")</script>Hello';
    const result = sanitizeString(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');

    const stats = getXSSStats();
    expect(stats.attemptsPrevented).toBe(1);
  })();

  await test('should remove event handlers', () => {
    resetXSSStats();
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeString(input);
    expect(result).not.toContain('onerror');
  })();

  await test('should block javascript: URLs', () => {
    resetXSSStats();
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeString(input);
    expect(result).not.toContain('javascript:');
  })();

  await test('should track XSS attempts', () => {
    resetXSSStats();
    sanitizeString('<script>evil()</script>');
    sanitizeString('<img onerror="bad()">');

    const stats = getXSSStats();
    expect(stats.attemptsPrevented).toBe(2);
  })();

  await test('should sanitize nested objects', () => {
    resetXSSStats();
    const input = {
      title: '<script>alert(1)</script>Title',
      nested: {
        description: '<img onerror="alert(2)">',
      },
    };

    const result = sanitizeProps(input, 'TestComponent');
    expect(result.title).not.toContain('<script>');
    expect(result.nested.description).not.toContain('onerror');
  })();

  await test('should sanitize arrays of strings', () => {
    resetXSSStats();
    const input = {
      items: ['<script>1</script>', '<script>2</script>'],
    };

    const result = sanitizeProps(input, 'TestComponent');
    expect(result.items[0]).not.toContain('<script>');
    expect(result.items[1]).not.toContain('<script>');
  })();

  await test('should pass all test vectors', () => {
    resetXSSStats();
    const allPassed = runSanitizationSelfTest();
    expect(allPassed).toBe(true);
  })();

  // Security Metrics Tests
  console.log('\n📊 Security Metrics Tests');

  await test('should track XSS blocks', () => {
    resetSecurityMetrics();
    incrementSecurityMetric('xss_blocked');
    incrementSecurityMetric('xss_blocked');

    const metrics = getSecurityMetrics();
    expect(metrics.xss_blocked).toBe(2);
  })();

  await test('should track rate limit hits', () => {
    resetSecurityMetrics();
    incrementSecurityMetric('rate_limit_hit');

    const metrics = getSecurityMetrics();
    expect(metrics.rate_limit_hit).toBe(1);
  })();

  await test('should track tenant violations', () => {
    resetSecurityMetrics();
    incrementSecurityMetric('tenant_violation');

    const metrics = getSecurityMetrics();
    expect(metrics.tenant_violation).toBe(1);
  })();

  await test('should reset metrics', () => {
    resetSecurityMetrics();
    incrementSecurityMetric('xss_blocked');
    resetSecurityMetrics();

    const metrics = getSecurityMetrics();
    expect(metrics.xss_blocked).toBe(0);
  })();

  await test('should generate metric summary', () => {
    resetSecurityMetrics();
    incrementSecurityMetric('xss_blocked');
    incrementSecurityMetric('rate_limit_hit');

    const summary = getMetricSummary();
    expect(summary).toHaveProperty('total');
    expect(summary.total).toBeGreaterThan(0);
  })();

  await test('should detect critical thresholds for tenant violations', () => {
    resetSecurityMetrics();
    incrementSecurityMetric('tenant_violation');

    const alerts = checkCriticalThresholds();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toContain('tenant_violation');
  })();

  await test('should detect critical thresholds for high XSS attempts', () => {
    resetSecurityMetrics();
    for (let i = 0; i < 51; i++) {
      incrementSecurityMetric('xss_blocked');
    }

    const alerts = checkCriticalThresholds();
    expect(alerts.length).toBeGreaterThan(0);
  })();

  // XSS Test Vectors Tests
  console.log('\n🎯 XSS Test Vectors Tests');

  await test('should have comprehensive test vectors', () => {
    expect(XSS_TEST_VECTORS.length).toBeGreaterThan(10);
  })();

  await test('should block all test vectors', () => {
    resetXSSStats();
    XSS_TEST_VECTORS.forEach((vector) => {
      const sanitized = sanitizeString(vector);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('javascript:');
    });

    const stats = getXSSStats();
    expect(stats.attemptsPrevented).toBeGreaterThan(0);
  })();

  // Print Summary
  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  const underVitest = Boolean(process.env.VITEST);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.name}`);
      if (r.error) console.log(`    ${r.error}`);
    });
    if (underVitest) {
      // Throw so Vitest registers the failure without killing the process
      throw new Error(`${failed} pure-unit tests failed`);
    } else {
      process.exit(1);
    }
  } else {
    console.log('\n✅ All tests passed!');
    if (underVitest) {
      return;
    } else {
      process.exit(0);
    }
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  if (process.env.VITEST) {
    throw error;
  } else {
    process.exit(1);
  }
});
