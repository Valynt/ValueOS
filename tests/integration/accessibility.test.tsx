/**
 * Accessibility Integration Tests
 *
 * Tests for accessibility compliance in the SDUI rendering pipeline.
 * Ensures that rendered components meet WCAG standards and are usable by assistive technologies.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import React, { useState } from 'react';
import { FC, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Import components and hooks
import { useCanvasCommand } from '../../src/hooks/useCanvasCommand';
import { renderPage } from '../../src/sdui/renderPage';

// Import mock builders
import {
  createMockAgentChatService,
  createMockCase,
  createMockSDUIPage,
  createMockSupabase,
  createMockUser,
  createMockWorkflowState,
  createStandardTestSetup
} from './test-utils/mockBuilders';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock services
const mockSupabase = createMockSupabase().build();
const mockAgentChatService = createMockAgentChatService().build();

// Test wrapper
const TestWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Accessibility Tests', () => {
  let mockUser: any;
  let mockCase: any;
  let mockWorkflowState: any;
  let mockSDUIPage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const testSetup = createStandardTestSetup();
    mockUser = testSetup.user;
    mockCase = testSetup.caseData;
    mockWorkflowState = testSetup.workflowState;
    mockSDUIPage = testSetup.sduiPage;
  });

  describe('SDUI Component Accessibility', () => {
    it('should render accessible text content', async () => {
      const accessiblePage = createMockSDUIPage()
        .withComponent('TextBlock', {
          text: '### Accessible Heading\\n\\nThis content is properly structured for screen readers.',
          className: 'mb-6 prose dark:prose-invert',
          'aria-label': 'Analysis content',
        })
        .build();

      const renderResult = renderPage(accessiblePage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify semantic structure
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(screen.getByText('This content is properly structured for screen readers.')).toBeInTheDocument();
    });

    it('should render accessible interactive elements', async () => {
      const interactivePage = createMockSDUIPage()
        .withComponent('Button', {
          text: 'Process Analysis',
          onClick: 'process-analysis',
          'aria-label': 'Process business analysis',
          className: 'btn-primary',
        })
        .withComponent('Link', {
          href: '/analysis/details',
          text: 'View Details',
          'aria-label': 'View detailed analysis results',
        })
        .build();

      const renderResult = renderPage(interactivePage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify interactive elements are accessible
      const button = screen.getByRole('button', { name: /process analysis/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Process business analysis');

      const link = screen.getByRole('link', { name: /view details/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('aria-label', 'View detailed analysis results');
    });

    it('should render accessible forms', async () => {
      const formPage = createMockSDUIPage()
        .withComponent('Form', {
          fields: [
            {
              name: 'companyName',
              label: 'Company Name',
              type: 'text',
              required: true,
              'aria-describedby': 'company-name-help',
            },
            {
              name: 'industry',
              label: 'Industry',
              type: 'select',
              options: ['Technology', 'Healthcare', 'Finance'],
              'aria-label': 'Select industry sector',
            },
          ],
          submitText: 'Submit Analysis',
          'aria-labelledby': 'form-title',
        })
        .build();

      const renderResult = renderPage(formPage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify form accessibility
      expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Company Name')).toBeRequired();
      expect(screen.getByLabelText('Select industry sector')).toBeInTheDocument();

      const helpText = screen.getByText('company-name-help');
      expect(helpText).toBeInTheDocument();
    });

    it('should render accessible data tables', async () => {
      const tablePage = createMockSDUIPage()
        .withComponent('DataTable', {
          headers: ['Company', 'Industry', 'Value Score'],
          data: [
            ['Tech Corp', 'Technology', '85'],
            ['Health Inc', 'Healthcare', '92'],
          ],
          'aria-label': 'Business analysis results table',
          'aria-describedby': 'table-description',
        })
        .build();

      const renderResult = renderPage(tablePage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify table accessibility
      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Business analysis results table');

      expect(screen.getByRole('columnheader', { name: 'Company' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Industry' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Value Score' })).toBeInTheDocument();
    });

    it('should render accessible progress indicators', async () => {
      const progressPage = createMockSDUIPage()
        .withComponent('ProgressBar', {
          value: 65,
          max: 100,
          label: 'Analysis Progress',
          'aria-valuenow': '65',
          'aria-valuemin': '0',
          'aria-valuemax': '100',
          'aria-label': 'Analysis progress: 65 percent complete',
        })
        .build();

      const renderResult = renderPage(progressPage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify progress indicator accessibility
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '65');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label', 'Analysis progress: 65 percent complete');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for interactive elements', async () => {
      const navigationPage = createMockSDUIPage()
        .withComponent('Navigation', {
          items: [
            { text: 'Dashboard', href: '/dashboard', hotkey: 'Alt+D' },
            { text: 'Analysis', href: '/analysis', hotkey: 'Alt+A' },
            { text: 'Settings', href: '/settings', hotkey: 'Alt+S' },
          ],
          'aria-label': 'Main navigation',
        })
        .build();

      const renderResult = renderPage(navigationPage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify keyboard navigation support
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(3);

      // Test tab navigation
      await userEvent.tab();
      expect(links[0]).toHaveFocus();

      await userEvent.tab();
      expect(links[1]).toHaveFocus();

      await userEvent.tab();
      expect(links[2]).toHaveFocus();
    });

    it('should handle focus management for modals', async () => {
      const modalPage = createMockSDUIPage()
        .withComponent('Modal', {
          title: 'Analysis Results',
          content: 'Your analysis is complete.',
          isOpen: true,
          'aria-modal': 'true',
          'aria-labelledby': 'modal-title',
          'aria-describedby': 'modal-content',
        })
        .build();

      const renderResult = renderPage(modalPage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).haveNoViolations();

      // Verify modal accessibility
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(modal).toHaveAttribute('aria-describedby', 'modal-content');

      // Focus should be trapped in modal
      expect(modal).toContainElement(document.activeElement);
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide appropriate ARIA labels and descriptions', async () => {
      const ariaPage = createMockSDUIPage()
        .withComponent('Chart', {
          type: 'bar',
          data: [{ label: 'Q1', value: 100 }, { label: 'Q2', value: 150 }],
          'aria-label': 'Quarterly revenue chart',
          'aria-describedby': 'chart-description',
        })
        .withComponent('StatusIndicator', {
          status: 'success',
          text: 'Analysis Complete',
          'aria-live': 'polite',
          'aria-atomic': 'true',
        })
        .build();

      const renderResult = renderPage(ariaPage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify ARIA attributes
      const chart = screen.getByRole('img'); // Charts should be role="img"
      expect(chart).toHaveAttribute('aria-label', 'Quarterly revenue chart');
      expect(chart).toHaveAttribute('aria-describedby', 'chart-description');

      const status = screen.getByText('Analysis Complete');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });

    it('should announce dynamic content changes', async () => {
      const TestComponent = () => {
        const [announcement, setAnnouncement] = useState('');
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: (update) => {
            if (update?.stage === 'complete') {
              setAnnouncement('Analysis has completed successfully');
            }
          },
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
        });

        return (
          <div>
            <button onClick={() => processCommand('Test command')}>
              Start Analysis
            </button>
            {announcement && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="announcement"
              >
                {announcement}
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Start Analysis');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        const announcement = screen.getByTestId('announcement');
        expect(announcement).toBeInTheDocument();
        expect(announcement).toHaveTextContent('Analysis has completed successfully');
        expect(announcement).toHaveAttribute('role', 'status');
        expect(announcement).toHaveAttribute('aria-live', 'polite');
        expect(announcement).toHaveAttribute('aria-atomic', 'true');
      });
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should maintain sufficient color contrast', async () => {
      const contrastPage = createMockSDUIPage()
        .withComponent('Alert', {
          type: 'error',
          message: 'Analysis failed to complete',
          className: 'bg-red-500 text-white p-4 rounded',
          'aria-role': 'alert',
        })
        .withComponent('Badge', {
          text: 'High Priority',
          className: 'bg-blue-600 text-white px-2 py-1 rounded',
        })
        .build();

      const renderResult = renderPage(contrastPage);

      const { container } = render(renderResult.element);

      // Check for accessibility violations (includes contrast checks)
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify color combinations are accessible
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();

      const badge = screen.getByText('High Priority');
      expect(badge).toBeInTheDocument();
    });

    it('should support high contrast mode', async () => {
      const highContrastPage = createMockSDUIPage()
        .withComponent('TextBlock', {
          text: 'High contrast compatible text',
          className: 'text-black bg-white dark:text-white dark:bg-black',
        })
        .build();

      const renderResult = renderPage(highContrastPage);

      const { container } = render(renderResult.element);

      // Simulate high contrast mode
      container.style.filter = 'contrast(100%)';

      // Check for accessibility violations
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      const errorMessage = 'Analysis service unavailable';
      mockAgentChatService.chat.mockRejectedValue(new Error(errorMessage));

      const TestComponent = () => {
        const [error, setError] = useState('');
        const { processCommand } = useCanvasCommand({
          selectedCaseId: 'test-case-id',
          selectedCase: mockCase,
          workflowState: mockWorkflowState,
          currentSessionId: 'test-session-id',
          currentTenantId: 'test-tenant',
          onWorkflowStateUpdate: vi.fn(),
          onRenderedPageUpdate: vi.fn(),
          onStreamingUpdate: vi.fn(),
          onLoadingUpdate: vi.fn(),
          refetchCases: vi.fn(),
        });

        const handleError = (err: Error) => {
          setError(`Error: ${err.message}`);
        };

        return (
          <div>
            <button onClick={() => processCommand('Test command').catch(handleError)}>
              Trigger Error
            </button>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="error-message"
              >
                {error}
              </div>
            )}
          </div>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const button = screen.getByText('Trigger Error');

      await act(async () => {
        userEvent.click(button);
      });

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
        expect(errorMessage).toHaveAttribute('aria-atomic', 'true');
      });
    });
  });
});
