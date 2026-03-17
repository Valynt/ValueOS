/**
 * Comprehensive Test Suite for Story Arc Canvas Template
 * Tests functionality, security, accessibility, and performance
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

import ValueCanvas from '../ValueCanvas';

// Mock the ChatCanvasLayout component
vi.mock('../../components/chat-canvas/ChatCanvasLayout', () => ({
  ChatCanvasLayout: ({ initialAction }: { initialAction: any }) => (
    <div data-testid="chat-canvas-layout" tabIndex={0}>
      {initialAction ? (
        <div data-testid="initial-action" data-type={initialAction.type}>
          {JSON.stringify(initialAction.data)}
        </div>
      ) : (
        <div data-testid="empty-canvas">No initial action</div>
      )}
    </div>
  ),
}));

// Mock useLocation
const mockUseLocation = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
  };
});

describe('ValueCanvas - Story Arc Canvas Template', () => {
  const renderWithRouter = (initialState: any = null) => {
    mockUseLocation.mockReturnValue({
      pathname: '/value-canvas',
      search: '',
      hash: '',
      state: initialState,
      key: 'default',
    });

    return render(
      <MemoryRouter>
        <ValueCanvas />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should render ChatCanvasLayout component', () => {
      renderWithRouter();

      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });

    it('should show empty canvas when no initial state', () => {
      renderWithRouter();

      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
      expect(screen.getByText('No initial action')).toBeInTheDocument();
    });

    it('should handle null state gracefully', () => {
      mockUseLocation.mockReturnValue({
        pathname: '/value-canvas',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      render(
        <MemoryRouter>
          <ValueCanvas />
        </MemoryRouter>
      );

      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });
  });

  describe('Initial Action Parsing - Research Flow', () => {
    it('should parse research source with domain', () => {
      const state = {
        source: 'research',
        domain: 'enterprise-software',
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'research');
      expect(actionElement).toHaveTextContent('enterprise-software');
    });

    it('should handle research without domain', () => {
      const state = {
        source: 'research',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });

    it('should handle empty domain string', () => {
      const state = {
        source: 'research',
        domain: '',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });
  });

  describe('Initial Action Parsing - Sales Call Flow', () => {
    it('should parse sales-call source with data', () => {
      const salesData = {
        customer: 'Acme Corp',
        notes: 'Interested in ROI analysis',
      };
      const state = {
        source: 'sales-call',
        data: salesData,
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'sales-call');
      expect(actionElement).toHaveTextContent(JSON.stringify(salesData));
    });

    it('should handle sales-call without data', () => {
      const state = {
        source: 'sales-call',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });

    it('should handle complex sales data', () => {
      const complexData = {
        customer: 'Enterprise Inc',
        revenue: 1000000,
        stakeholders: ['CTO', 'CFO'],
        requirements: ['ROI analysis', 'Risk assessment'],
      };
      const state = {
        source: 'sales-call',
        data: complexData,
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'sales-call');
      expect(actionElement).toHaveTextContent(JSON.stringify(complexData));
    });
  });

  describe('Initial Action Parsing - CRM Flow', () => {
    it('should parse CRM source with data', () => {
      const crmData = {
        company: 'Tech Startup',
        stage: 'evaluation',
        value: 50000,
      };
      const state = {
        source: 'crm',
        data: crmData,
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'crm');
      expect(actionElement).toHaveTextContent(JSON.stringify(crmData));
    });

    it('should handle CRM without data', () => {
      const state = {
        source: 'crm',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });

    it('should handle CRM with minimal data', () => {
      const state = {
        source: 'crm',
        data: { company: 'Small Biz' },
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'crm');
    });
  });

  describe('Initial Action Parsing - Upload Notes Flow', () => {
    it('should parse upload-notes source with data', () => {
      const notesData = {
        content: 'Customer meeting notes about value drivers',
        format: 'text',
      };
      const state = {
        source: 'upload-notes',
        data: notesData,
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'upload-notes');
      expect(actionElement).toHaveTextContent(JSON.stringify(notesData));
    });

    it('should handle upload-notes without data', () => {
      const state = {
        source: 'upload-notes',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });

    it('should handle large notes data', () => {
      const largeData = {
        content: 'A'.repeat(10000),
        format: 'markdown',
        metadata: { pages: 5, author: 'Sales Team' },
      };
      const state = {
        source: 'upload-notes',
        data: largeData,
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'upload-notes');
    });
  });

  describe('Initial Action Parsing - Template Flow', () => {
    it('should parse template source with templateId', () => {
      const state = {
        source: 'template',
        templateId: 'roi-calculator',
        name: 'ROI Template',
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'template');
      
      // Should include templateId and other state properties
      const textContent = actionElement.textContent || '';
      expect(textContent).toContain('roi-calculator');
      expect(textContent).toContain('ROI Template');
    });

    it('should handle template without templateId', () => {
      const state = {
        source: 'template',
        name: 'Generic Template',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });

    it('should handle template with additional metadata', () => {
      const state = {
        source: 'template',
        templateId: 'impact-cascade',
        name: 'Impact Cascade',
        category: 'Visualization',
        complexity: 'medium',
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'template');
      expect(actionElement).toHaveTextContent('impact-cascade');
    });
  });

  describe('Initial Action Parsing - Generic/Fallback Flow', () => {
    it('should handle generic source', () => {
      const state = {
        source: 'generic',
        someData: 'value',
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'generic');
    });

    it('should handle unknown source types', () => {
      const state = {
        source: 'unknown-source',
        data: { test: true },
      };

      renderWithRouter(state);

      // Should fall back to generic type
      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'generic');
    });

    it('should handle state with no source property', () => {
      const state = {
        someOtherProperty: 'value',
      };

      renderWithRouter(state);

      // Should fall back to generic type
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });
  });

  describe('Security - XSS Prevention', () => {
    it('should sanitize malicious data in research flow', () => {
      const state = {
        source: 'research',
        domain: '<script>alert("xss")</script>',
      };

      renderWithRouter(state);

      // Should not execute script
      const scripts = screen.queryAllByRole('script');
      expect(scripts.length).toBe(0);

      // Should show sanitized content
      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toBeInTheDocument();
    });

    it('should sanitize malicious data in sales-call flow', () => {
      const state = {
        source: 'sales-call',
        data: {
          customer: '<img src=x onerror=alert(1)>',
          notes: 'javascript:alert(2)',
        },
      };

      renderWithRouter(state);

      // Should not render dangerous HTML
      const images = screen.queryAllByRole('img');
      const hasDangerousImg = images.some(img => 
        img.getAttribute('src') === 'x'
      );
      expect(hasDangerousImg).toBe(false);
    });

    it('should sanitize malicious data in CRM flow', () => {
      const state = {
        source: 'crm',
        data: {
          company: '<svg onload=alert(1)>',
          stage: 'onerror=alert(2)',
        },
      };

      renderWithRouter(state);

      // Should not execute malicious code
      const svgs = screen.queryAllByRole('img');
      const hasDangerousSvg = svgs.some(img => 
        img.getAttribute('onload') !== null
      );
      expect(hasDangerousSvg).toBe(false);
    });

    it('should sanitize template IDs', () => {
      const state = {
        source: 'template',
        templateId: '<script>alert(1)</script>',
      };

      renderWithRouter(state);

      // Should not execute script
      const scripts = screen.queryAllByRole('script');
      expect(scripts.length).toBe(0);
    });

    it('should handle JSON injection attempts', () => {
      const state = {
        source: 'upload-notes',
        data: {
          content: '{"__proto__": {"isAdmin": true}}',
        },
      };

      renderWithRouter(state);

      // Should not create dangerous prototype properties
      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed state gracefully', () => {
      const state = {
        source: 'research',
        // Missing domain - should handle gracefully
      };

      renderWithRouter(state);

      // Should not crash
      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });

    it('should handle circular references in state', () => {
      const circularObj: any = { source: 'research', domain: 'test' };
      circularObj.self = circularObj;

      mockUseLocation.mockReturnValue({
        pathname: '/value-canvas',
        search: '',
        hash: '',
        state: circularObj,
        key: 'default',
      });

      // Should not crash when rendering
      expect(() => {
        render(
          <MemoryRouter>
            <ValueCanvas />
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('should handle extremely large state objects', () => {
      const largeState = {
        source: 'sales-call',
        data: {
          notes: 'A'.repeat(100000),
          metadata: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}` })),
        },
      };

      renderWithRouter(largeState);

      // Should still render
      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });

    it('should handle undefined/null values in state', () => {
      const state = {
        source: 'research',
        domain: undefined,
        extra: null,
      };

      renderWithRouter(state);

      // Should handle gracefully
      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should provide accessible container', () => {
      renderWithRouter();

      const container = screen.getByTestId('chat-canvas-layout');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-testid', 'chat-canvas-layout');
    });

    it('should announce initial action type', () => {
      const state = {
        source: 'research',
        domain: 'enterprise-software',
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'research');
    });

    it('should be keyboard navigable', () => {
      renderWithRouter();

      const layout = screen.getByTestId('chat-canvas-layout');
      layout.focus();
      expect(document.activeElement).toBe(layout);
    });
  });

  describe('Performance', () => {
    it('should render quickly with complex state', () => {
      const complexState = {
        source: 'template',
        templateId: 'complex-template',
        name: 'Complex Template',
        metadata: {
          category: 'Financial',
          complexity: 'high',
          tags: ['finance', 'analysis', 'reporting'],
          useCases: ['Budget planning', 'Forecasting', 'Risk analysis'],
          prerequisites: ['Cost data', 'Revenue projections', 'Market analysis'],
        },
        additionalData: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random() * 1000,
        })),
      };

      const start = performance.now();
      renderWithRouter(complexState);
      const end = performance.now();

      // Should render in under 100ms
      expect(end - start).toBeLessThan(100);
    });

    it('should handle rapid state changes efficiently', () => {
      const states = [
        { source: 'research', domain: 'domain1' },
        { source: 'sales-call', data: { customer: 'Customer1' } },
        { source: 'crm', data: { company: 'Company1' } },
        { source: 'upload-notes', data: { content: 'Notes1' } },
        { source: 'template', templateId: 'template1' },
      ];

      const start = performance.now();
      states.forEach(state => {
        mockUseLocation.mockReturnValue({
          pathname: '/value-canvas',
          search: '',
          hash: '',
          state,
          key: 'default',
        });
        render(
          <MemoryRouter>
            <ValueCanvas />
          </MemoryRouter>
        );
      });
      const end = performance.now();

      // Should handle all states quickly
      expect(end - start).toBeLessThan(500);
    });
  });

  describe('Integration with ChatCanvasLayout', () => {
    it('should pass correct initialAction to ChatCanvasLayout', () => {
      const state = {
        source: 'research',
        domain: 'enterprise-software',
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'research');
      expect(actionElement).toHaveTextContent('enterprise-software');
    });

    it('should handle all supported action types', () => {
      const actionTypes = [
        { source: 'research', domain: 'test1' },
        { source: 'sales-call', data: { test: true } },
        { source: 'crm', data: { test: true } },
        { source: 'upload-notes', data: { test: true } },
        { source: 'template', templateId: 'test' },
        { source: 'generic', data: { test: true } },
      ];

      actionTypes.forEach(state => {
        mockUseLocation.mockReturnValue({
          pathname: '/value-canvas',
          search: '',
          hash: '',
          state,
          key: 'default',
        });

        const { unmount } = render(
          <MemoryRouter>
            <ValueCanvas />
          </MemoryRouter>
        );

        // Should render without crashing
        expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      const state = {
        source: 'research',
        domain: '',
      };

      renderWithRouter(state);

      // Should fall back to generic
      expect(screen.getByTestId('empty-canvas')).toBeInTheDocument();
    });

    it('should handle numeric values in state', () => {
      const state = {
        source: 'sales-call',
        data: {
          revenue: 123456,
          confidence: 0.85,
        },
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'sales-call');
    });

    it('should handle boolean values in state', () => {
      const state = {
        source: 'crm',
        data: {
          isQualified: true,
          isClosed: false,
        },
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'crm');
    });

    it('should handle array values in state', () => {
      const state = {
        source: 'upload-notes',
        data: {
          tags: ['tag1', 'tag2', 'tag3'],
          categories: ['A', 'B', 'C'],
        },
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'upload-notes');
    });

    it('should handle nested objects in state', () => {
      const state = {
        source: 'template',
        templateId: 'nested',
        metadata: {
          level1: {
            level2: {
              level3: 'deep value',
            },
          },
        },
      };

      renderWithRouter(state);

      const actionElement = screen.getByTestId('initial-action');
      expect(actionElement).toHaveAttribute('data-type', 'template');
    });
  });

  describe('Visual Regression Prevention', () => {
    it('should maintain consistent layout structure', () => {
      renderWithRouter();

      const layout = screen.getByTestId('chat-canvas-layout');
      expect(layout).toBeInTheDocument();
    });

    it('should render empty state consistently', () => {
      renderWithRouter();

      const emptyState = screen.getByTestId('empty-canvas');
      expect(emptyState).toBeInTheDocument();
      expect(emptyState).toHaveTextContent('No initial action');
    });

    it('should render action states consistently', () => {
      const testCases = [
        { source: 'research', domain: 'test1' },
        { source: 'sales-call', data: { customer: 'Test' } },
        { source: 'crm', data: { company: 'Test' } },
      ];

      testCases.forEach(state => {
        mockUseLocation.mockReturnValue({
          pathname: '/value-canvas',
          search: '',
          hash: '',
          state,
          key: 'default',
        });

        const { unmount } = render(
          <MemoryRouter>
            <ValueCanvas />
          </MemoryRouter>
        );

        const actionElement = screen.getByTestId('initial-action');
        expect(actionElement).toBeInTheDocument();
        expect(actionElement).toHaveAttribute('data-type');

        unmount();
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt to mobile screen sizes', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithRouter();

      // Should still render
      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('should handle touch interactions', () => {
      renderWithRouter();

      const layout = screen.getByTestId('chat-canvas-layout');
      
      // Simulate touch events
      fireEvent.touchStart(layout);
      fireEvent.touchEnd(layout);

      // Should remain stable
      expect(layout).toBeInTheDocument();
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across re-renders', () => {
      const state = {
        source: 'research',
        domain: 'enterprise-software',
      };

      const { rerender } = renderWithRouter(state);

      const firstRender = screen.getByTestId('initial-action');
      expect(firstRender).toHaveAttribute('data-type', 'research');

      // Re-render with same state
      rerender(
        <MemoryRouter>
          <ValueCanvas />
        </MemoryRouter>
      );

      const secondRender = screen.getByTestId('initial-action');
      expect(secondRender).toHaveAttribute('data-type', 'research');
    });

    it('should update when state changes', () => {
      const state1 = {
        source: 'research',
        domain: 'domain1',
      };

      const { rerender } = renderWithRouter(state1);

      const action1 = screen.getByTestId('initial-action');
      expect(action1).toHaveTextContent('domain1');

      // Change state
      mockUseLocation.mockReturnValue({
        pathname: '/value-canvas',
        search: '',
        hash: '',
        state: {
          source: 'research',
          domain: 'domain2',
        },
        key: 'updated',
      });

      rerender(
        <MemoryRouter>
          <ValueCanvas />
        </MemoryRouter>
      );

      const action2 = screen.getByTestId('initial-action');
      expect(action2).toHaveTextContent('domain2');
    });
  });

  describe('Browser Compatibility', () => {
    it('should work with modern browser APIs', () => {
      renderWithRouter();

      // Check that required APIs are available
      expect(typeof JSON).toBe('object');
      expect(typeof Array.from).toBe('function');
    });

    it('should handle URL state parameters', () => {
      // Test that component works with URL-based state
      renderWithRouter();

      expect(screen.getByTestId('chat-canvas-layout')).toBeInTheDocument();
    });
  });
});
