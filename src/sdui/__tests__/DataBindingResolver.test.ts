/**
 * Tests for DataBindingResolver
 */

import { DataBindingResolver } from '../DataBindingResolver';
import {
  DataBinding,
  DataSourceContext,
  isDataBinding,
  validateDataBinding,
  createBinding,
  createMetricBinding,
  createCurrencyBinding,
  createPercentageBinding,
} from '../DataBindingSchema';

describe('DataBindingSchema', () => {
  describe('isDataBinding', () => {
    it('should identify valid data bindings', () => {
      const binding = {
        $bind: 'metrics.revenue',
        $source: 'realization_engine',
      };
      expect(isDataBinding(binding)).toBe(true);
    });

    it('should reject non-bindings', () => {
      expect(isDataBinding('static value')).toBe(false);
      expect(isDataBinding(123)).toBe(false);
      expect(isDataBinding(null)).toBe(false);
      expect(isDataBinding(undefined)).toBe(false);
      expect(isDataBinding({ value: 'test' })).toBe(false);
    });
  });

  describe('validateDataBinding', () => {
    it('should validate correct bindings', () => {
      const binding: DataBinding = {
        $bind: 'metrics.revenue',
        $source: 'realization_engine',
        $transform: 'currency',
        $fallback: 'Calculating...',
      };

      const result = validateDataBinding(binding);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject bindings with missing required fields', () => {
      const binding = {
        $bind: 'metrics.revenue',
        // Missing $source
      };

      const result = validateDataBinding(binding);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject bindings with invalid source', () => {
      const binding = {
        $bind: 'metrics.revenue',
        $source: 'invalid_source',
      };

      const result = validateDataBinding(binding);
      expect(result.valid).toBe(false);
    });

    it('should reject bindings with empty path', () => {
      const binding = {
        $bind: '',
        $source: 'realization_engine',
      };

      const result = validateDataBinding(binding);
      expect(result.valid).toBe(false);
    });
  });

  describe('helper functions', () => {
    it('should create basic binding', () => {
      const binding = createBinding('metrics.revenue', 'realization_engine', {
        $fallback: 0,
      });

      expect(binding.$bind).toBe('metrics.revenue');
      expect(binding.$source).toBe('realization_engine');
      expect(binding.$fallback).toBe(0);
    });

    it('should create metric binding', () => {
      const binding = createMetricBinding('loops.length', {
        $fallback: 0,
      });

      expect(binding.$source).toBe('realization_engine');
      expect(binding.$transform).toBe('number');
      expect(binding.$refresh).toBe(30000);
    });

    it('should create currency binding', () => {
      const binding = createCurrencyBinding(
        'metrics.revenue',
        'realization_engine',
        { $fallback: 'N/A' }
      );

      expect(binding.$transform).toBe('currency');
    });

    it('should create percentage binding', () => {
      const binding = createPercentageBinding(
        'evaluation.score',
        'value_eval',
        { $fallback: 'N/A' }
      );

      expect(binding.$transform).toBe('percentage');
    });
  });
});

describe('DataBindingResolver', () => {
  let resolver: DataBindingResolver;
  let context: DataSourceContext;

  beforeEach(() => {
    resolver = new DataBindingResolver();
    context = {
      organizationId: 'test-org',
      userId: 'test-user',
      sessionId: 'test-session',
    };
  });

  describe('path extraction', () => {
    it('should extract simple property', () => {
      const data = { metrics: { revenue: 1000000 } };
      const result = (resolver as any).extractValueFromPath(data, 'metrics.revenue');
      expect(result).toBe(1000000);
    });

    it('should extract array index', () => {
      const data = { loops: [{ strength: 'strong' }, { strength: 'weak' }] };
      const result = (resolver as any).extractValueFromPath(data, 'loops[0].strength');
      expect(result).toBe('strong');
    });

    it('should filter arrays', () => {
      const data = {
        loops: [
          { status: 'active', id: 1 },
          { status: 'inactive', id: 2 },
          { status: 'active', id: 3 },
        ],
      };
      const result = (resolver as any).extractValueFromPath(
        data,
        'loops.filter(status=active)'
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    it('should get array length', () => {
      const data = { loops: [1, 2, 3, 4, 5] };
      const result = (resolver as any).extractValueFromPath(data, 'loops.length');
      expect(result).toBe(5);
    });

    it('should sum array values', () => {
      const data = { values: [10, 20, 30] };
      const result = (resolver as any).extractValueFromPath(data, 'values.sum');
      expect(result).toBe(60);
    });

    it('should average array values', () => {
      const data = { values: [10, 20, 30] };
      const result = (resolver as any).extractValueFromPath(data, 'values.average');
      expect(result).toBe(20);
    });

    it('should get max value', () => {
      const data = { values: [10, 50, 30] };
      const result = (resolver as any).extractValueFromPath(data, 'values.max');
      expect(result).toBe(50);
    });

    it('should get min value', () => {
      const data = { values: [10, 50, 30] };
      const result = (resolver as any).extractValueFromPath(data, 'values.min');
      expect(result).toBe(10);
    });

    it('should chain operations', () => {
      const data = {
        loops: [
          { status: 'active', value: 10 },
          { status: 'inactive', value: 20 },
          { status: 'active', value: 30 },
        ],
      };
      const result = (resolver as any).extractValueFromPath(
        data,
        'loops.filter(status=active).length'
      );
      expect(result).toBe(2);
    });

    it('should handle missing paths gracefully', () => {
      const data = { metrics: {} };
      const result = (resolver as any).extractValueFromPath(data, 'metrics.missing.path');
      expect(result).toBeUndefined();
    });
  });

  describe('transforms', () => {
    it('should format currency', () => {
      const result = (resolver as any).applyTransform(1200000, 'currency');
      expect(result).toBe('$1.2M');
    });

    it('should format small currency', () => {
      const result = (resolver as any).applyTransform(1500, 'currency');
      expect(result).toBe('$1.5K');
    });

    it('should format percentage from decimal', () => {
      const result = (resolver as any).applyTransform(0.85, 'percentage');
      expect(result).toBe('85%');
    });

    it('should format percentage from number', () => {
      const result = (resolver as any).applyTransform(85, 'percentage');
      expect(result).toBe('85%');
    });

    it('should format number with commas', () => {
      const result = (resolver as any).applyTransform(1234567, 'number');
      expect(result).toBe('1,234,567');
    });

    it('should round numbers', () => {
      const result = (resolver as any).applyTransform(3.14159, 'round');
      expect(result).toBe(3.14);
    });

    it('should uppercase strings', () => {
      const result = (resolver as any).applyTransform('hello', 'uppercase');
      expect(result).toBe('HELLO');
    });

    it('should lowercase strings', () => {
      const result = (resolver as any).applyTransform('HELLO', 'lowercase');
      expect(result).toBe('hello');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(100);
      const result = (resolver as any).applyTransform(longString, 'truncate');
      expect(result.length).toBeLessThan(100);
      expect(result).toContain('...');
    });

    it('should get array length', () => {
      const result = (resolver as any).applyTransform([1, 2, 3], 'array_length');
      expect(result).toBe(3);
    });

    it('should sum array', () => {
      const result = (resolver as any).applyTransform([10, 20, 30], 'sum');
      expect(result).toBe(60);
    });

    it('should average array', () => {
      const result = (resolver as any).applyTransform([10, 20, 30], 'average');
      expect(result).toBe(20);
    });

    it('should get max', () => {
      const result = (resolver as any).applyTransform([10, 50, 30], 'max');
      expect(result).toBe(50);
    });

    it('should get min', () => {
      const result = (resolver as any).applyTransform([10, 50, 30], 'min');
      expect(result).toBe(10);
    });
  });

  describe('caching', () => {
    it('should cache resolved values', async () => {
      const binding: DataBinding = {
        $bind: 'test.value',
        $source: 'realization_engine',
        $cache: 'test_cache',
        $cacheTTL: 60000,
      };

      // Register mock resolver
      resolver.registerResolver('realization_engine', async () => ({
        test: { value: 'cached_value' },
      }));

      // First resolution
      const result1 = await resolver.resolve(binding, context);
      expect(result1.cached).toBe(false);

      // Second resolution should use cache
      const result2 = await resolver.resolve(binding, context);
      expect(result2.cached).toBe(true);
      expect(result2.value).toBe('cached_value');
    });

    it('should expire cache after TTL', async () => {
      const binding: DataBinding = {
        $bind: 'test.value',
        $source: 'realization_engine',
        $cache: 'test_cache_expire',
        $cacheTTL: 100, // 100ms
      };

      let callCount = 0;
      resolver.registerResolver('realization_engine', async () => {
        callCount++;
        return { test: { value: `value_${callCount}` } };
      });

      // First resolution
      const result1 = await resolver.resolve(binding, context);
      expect(result1.value).toBe('value_1');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should resolve again
      const result2 = await resolver.resolve(binding, context);
      expect(result2.value).toBe('value_2');
      expect(result2.cached).toBe(false);
    });

    it('should clear cache', async () => {
      const binding: DataBinding = {
        $bind: 'test.value',
        $source: 'realization_engine',
        $cache: 'test_cache_clear',
        $cacheTTL: 60000,
      };

      resolver.registerResolver('realization_engine', async () => ({
        test: { value: 'value' },
      }));

      // Resolve and cache
      await resolver.resolve(binding, context);

      // Clear cache
      resolver.clearCache();

      // Should resolve again
      const result = await resolver.resolve(binding, context);
      expect(result.cached).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return fallback on error', async () => {
      const binding: DataBinding = {
        $bind: 'test.value',
        $source: 'realization_engine',
        $fallback: 'fallback_value',
      };

      resolver.registerResolver('realization_engine', async () => {
        throw new Error('Test error');
      });

      const result = await resolver.resolve(binding, context);
      expect(result.success).toBe(false);
      expect(result.value).toBe('fallback_value');
      expect(result.error).toContain('Test error');
    });

    it('should handle missing resolver', async () => {
      const binding: DataBinding = {
        $bind: 'test.value',
        $source: 'realization_engine',
        $fallback: 'fallback',
      };

      const result = await resolver.resolve(binding, context);
      expect(result.success).toBe(false);
      expect(result.value).toBe('fallback');
    });

    it('should validate binding before resolution', async () => {
      const invalidBinding = {
        $bind: '',
        $source: 'realization_engine',
      } as DataBinding;

      const result = await resolver.resolve(invalidBinding, context);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('resolveObject', () => {
    it('should resolve nested bindings', async () => {
      resolver.registerResolver('realization_engine', async () => ({
        metrics: { revenue: 1000000 },
      }));

      const obj = {
        title: 'Revenue',
        value: {
          $bind: 'metrics.revenue',
          $source: 'realization_engine',
          $transform: 'currency',
        } as DataBinding,
        static: 'unchanged',
      };

      const resolved = await resolver.resolveObject(obj, context);
      expect(resolved.title).toBe('Revenue');
      expect(resolved.value).toBe('$1.0M');
      expect(resolved.static).toBe('unchanged');
    });

    it('should resolve arrays', async () => {
      resolver.registerResolver('realization_engine', async () => ({
        value: 100,
      }));

      const arr = [
        'static',
        {
          $bind: 'value',
          $source: 'realization_engine',
        } as DataBinding,
      ];

      const resolved = await resolver.resolveObject(arr, context);
      expect(resolved[0]).toBe('static');
      expect(resolved[1]).toBe(100);
    });

    it('should handle deeply nested objects', async () => {
      resolver.registerResolver('realization_engine', async () => ({
        metrics: { revenue: 1000000 },
      }));

      const obj = {
        level1: {
          level2: {
            level3: {
              $bind: 'metrics.revenue',
              $source: 'realization_engine',
            } as DataBinding,
          },
        },
      };

      const resolved = await resolver.resolveObject(obj, context);
      expect(resolved.level1.level2.level3).toBe(1000000);
    });
  });

  describe('custom resolvers', () => {
    it('should register and use custom resolver', async () => {
      const customResolver = async (binding: DataBinding) => {
        return { custom: { value: 'custom_data' } };
      };

      resolver.registerResolver('realization_engine', customResolver);

      const binding: DataBinding = {
        $bind: 'custom.value',
        $source: 'realization_engine',
      };

      const result = await resolver.resolve(binding, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe('custom_data');
    });
  });

  describe('resolveMany', () => {
    it('should resolve multiple bindings in parallel', async () => {
      resolver.registerResolver('realization_engine', async () => ({
        metrics: { revenue: 1000000, cost: 500000 },
      }));

      const bindings: DataBinding[] = [
        {
          $bind: 'metrics.revenue',
          $source: 'realization_engine',
        },
        {
          $bind: 'metrics.cost',
          $source: 'realization_engine',
        },
      ];

      const results = await resolver.resolveMany(bindings, context);
      expect(results).toHaveLength(2);
      expect(results[0].value).toBe(1000000);
      expect(results[1].value).toBe(500000);
    });
  });
});
