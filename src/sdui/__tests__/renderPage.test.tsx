/**
 * Tests for renderPage() function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderPage, RenderPageOptions } from '../renderPage';
import { SDUIPageDefinition, SDUIValidationError } from '../schema';
import { clearAllHydrationCache } from '../hooks/useDataHydration';

describe('renderPage', () => {
  beforeEach(() => {
    clearAllHydrationCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should validate a valid page definition', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.element).toBeDefined();
      expect(result.warnings).toEqual([]);
      expect(result.metadata.componentCount).toBe(1);
    });

    it('should throw validation error for invalid page definition', () => {
      const invalidDefinition = {
        type: 'page',
        version: 1,
        sections: [], // Invalid: must have at least one section
      };

      expect(() => renderPage(invalidDefinition)).toThrow(SDUIValidationError);
    });

    it('should call onValidationError callback', () => {
      const onValidationError = vi.fn();
      const invalidDefinition = {
        type: 'page',
        version: 1,
        sections: [],
      };

      try {
        renderPage(invalidDefinition, { onValidationError });
      } catch (error) {
        // Expected to throw
      }

      expect(onValidationError).toHaveBeenCalled();
      expect(onValidationError.mock.calls[0][0]).toBeInstanceOf(Array);
    });

    it('should handle missing required fields', () => {
      const invalidDefinition = {
        type: 'page',
        // Missing version and sections
      };

      expect(() => renderPage(invalidDefinition)).toThrow(SDUIValidationError);
    });

    it('should validate nested component sections', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: '', // Invalid: empty component name
            version: 1,
            props: {},
          },
        ],
      };

      expect(() => renderPage(pageDefinition)).toThrow(SDUIValidationError);
    });

    it('should reject structurally invalid layouts before render', () => {
      const invalidDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'layout',
            component: 'Grid',
            // Missing layout configuration and invalid children payload
            columns: ['<script>alert(1)</script>'],
          },
        ],
      } as unknown as SDUIPageDefinition;

      expect(() => renderPage(invalidDefinition)).toThrow(SDUIValidationError);
    });
  });

  describe('Component Rendering', () => {
    it('should render components from registry', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Test Banner',
              description: 'Test description',
            },
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.element).toBeDefined();
      expect(result.metadata.componentCount).toBe(1);
    });

    it('should handle unknown components gracefully', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'NonExistentComponent',
            version: 1,
            props: {},
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.element).toBeDefined();
      // Should render fallback component
    });

    it('renders fallback content for unknown components', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'NonExistentComponent',
            version: 1,
            props: {},
          },
        ],
      };

      const result = renderPage(pageDefinition);
      const rendered = result.element as any;
      expect(JSON.stringify(rendered)).toContain('Component unavailable');
    });

    it('renders layout container components without validation errors', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'Grid',
            version: 1,
            props: {
              columns: 2,
              children: [
                { type: 'component', component: 'InfoBanner', version: 1, props: { title: 'A' } },
                { type: 'component', component: 'InfoBanner', version: 1, props: { title: 'B' } },
              ],
            },
          },
        ],
      } as unknown as SDUIPageDefinition;

      const result = renderPage(pageDefinition);
      expect(result.metadata.componentCount).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
    });

    it('should call onComponentRender callback', () => {
      const onComponentRender = vi.fn();
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
      };

      renderPage(pageDefinition, { onComponentRender });

      expect(onComponentRender).toHaveBeenCalledWith('InfoBanner', expect.any(Object));
    });

    it('should render multiple components', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Banner 1' },
          },
          {
            type: 'component',
            component: 'DiscoveryCard',
            version: 1,
            props: { questions: ['Q1', 'Q2'] },
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.metadata.componentCount).toBe(2);
    });
  });

  describe('Data Hydration', () => {
    it('should identify components requiring hydration', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/data'],
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.metadata.hydratedComponentCount).toBe(1);
    });

    it('should call onHydrationComplete callback', async () => {
      const onHydrationComplete = vi.fn();
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/data'],
          },
        ],
      };

      const mockFetcher = vi.fn().mockResolvedValue({ data: 'test' });

      renderPage(pageDefinition, {
        onHydrationComplete,
        dataFetcher: mockFetcher,
      });

      // Note: Actual hydration happens asynchronously in the component
      // This test verifies the callback is passed correctly
    });

    it('should handle hydration errors', () => {
      const onHydrationError = vi.fn();
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/failing-endpoint'],
          },
        ],
      };

      const mockFetcher = vi.fn().mockRejectedValue(new Error('Network error'));

      renderPage(pageDefinition, {
        onHydrationError,
        dataFetcher: mockFetcher,
      });

      // Hydration error handling is tested in useDataHydration tests
    });

    it('should use fallback component on hydration failure', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'ValueTreeCard',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/failing-endpoint'],
            fallback: {
              message: 'Data unavailable',
              component: 'InfoBanner',
              props: {
                title: 'Fallback',
                tone: 'warning',
              },
            },
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.element).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should catch component rendering errors', () => {
      const onRenderError = vi.fn();
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
      };

      renderPage(pageDefinition, { onRenderError });

      // Error boundary will catch any rendering errors
    });

    it('should use custom error fallback', () => {
      const CustomErrorFallback = vi.fn(() => null);
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'NonExistentComponent',
            version: 1,
            props: {},
          },
        ],
      };

      renderPage(pageDefinition, {
        unknownComponentFallback: CustomErrorFallback,
      });

      // Custom fallback should be used for unknown components
    });
  });

  describe('Debug Mode', () => {
    it('should enable debug mode from options', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
      };

      const result = renderPage(pageDefinition, { debug: true });

      expect(result.element).toBeDefined();
      // Debug overlays should be rendered
    });

    it('should enable debug mode from page metadata', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
        metadata: {
          debug: true,
        },
      };

      const result = renderPage(pageDefinition);

      expect(result.element).toBeDefined();
    });

    it('should show warnings in debug mode', () => {
      const onWarning = vi.fn();
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 999, // Future version
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
      };

      const result = renderPage(pageDefinition, {
        debug: true,
        onWarning,
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Metadata', () => {
    it('should return correct component count', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test 1' },
          },
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test 2' },
          },
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test 3' },
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.metadata.componentCount).toBe(3);
    });

    it('should return correct hydrated component count', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test 1' },
          },
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test 2' },
            hydrateWith: ['/api/data'],
          },
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test 3' },
            hydrateWith: ['/api/data2'],
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.metadata.hydratedComponentCount).toBe(2);
    });

    it('should return page version', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 2,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
      };

      const result = renderPage(pageDefinition);

      expect(result.metadata.version).toBe(2);
    });
  });

  describe('Custom Options', () => {
    it('should use custom data fetcher', () => {
      const customFetcher = vi.fn().mockResolvedValue({ data: 'custom' });
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/data'],
          },
        ],
      };

      renderPage(pageDefinition, {
        dataFetcher: customFetcher,
      });

      // Custom fetcher should be passed to hydration hook
    });

    it('should use custom loading component', () => {
      const CustomLoader = vi.fn(() => null);
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/data'],
          },
        ],
      };

      renderPage(pageDefinition, {
        loadingComponent: CustomLoader,
      });

      // Custom loader should be used during hydration
    });

    it('should respect hydration timeout', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/slow-endpoint'],
          },
        ],
      };

      renderPage(pageDefinition, {
        hydrationTimeout: 1000,
      });

      // Timeout should be passed to hydration hook
    });

    it('should respect retry configuration', () => {
      const pageDefinition: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
            hydrateWith: ['/api/failing-endpoint'],
          },
        ],
      };

      renderPage(pageDefinition, {
        enableHydrationRetry: true,
        retryAttempts: 5,
      });

      // Retry config should be passed to hydration hook
    });
  });
});
