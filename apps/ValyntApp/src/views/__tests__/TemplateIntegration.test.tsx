/**
 * Integration Tests for UI Template Workflows
 * Tests complete user journeys across multiple templates
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ROICalculator from '../ROICalculator';
import ImpactCascade from '../ImpactCascade';
import { ScenarioSelector } from '../../components/SDUI/ScenarioSelector';
import ValueCanvas from '../ValueCanvas';
import QuantumView from '../QuantumView';

vi.mock('../../components/ChatCanvas/ChatCanvasLayout', () => ({
  ChatCanvasLayout: ({ initialAction }: { initialAction?: { type: string; data: unknown } | null }) => (
    <div data-testid="chat-canvas-layout" data-action={initialAction?.type ?? 'none'}>
      {initialAction ? JSON.stringify(initialAction.data) : 'No initial action'}
    </div>
  ),
}));

// Mock external dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('../../contexts/DrawerContext', () => ({
  useDrawer: () => ({
    openDrawer: vi.fn(),
  }),
}));

describe('Template Integration Workflows', () => {
  describe('Financial Analysis Workflow', () => {
    it('should complete ROI analysis to Impact Cascade flow', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/roi-calculator']}>
          <Routes>
            <Route path="/roi-calculator" element={<ROICalculator />} />
            <Route path="/impact-cascade" element={<ImpactCascade />} />
          </Routes>
        </MemoryRouter>
      );

      // Step 1: ROI Calculator
      const roiCard = screen.getByText('Cost Inputs').closest('button');
      fireEvent.click(roiCard!);

      // Should open drawer with inputs
      expect(screen.getByText('Engineering Headcount')).toBeInTheDocument();

      // Step 2: Navigate to Impact Cascade
      // In real app, this would be triggered by "Analyze Impact" button
      // For testing, we simulate navigation
      const { rerender } = render(
        <MemoryRouter initialEntries={['/impact-cascade']}>
          <Routes>
            <Route path="/impact-cascade" element={<ImpactCascade />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify Impact Cascade renders
      expect(screen.getByText('Phase 2: Value Architecture')).toBeInTheDocument();
      expect(screen.getByText('Total Impact')).toBeInTheDocument();
    });

    it('should handle scenario selection workflow', async () => {
      const mockScenarios = [
        {
          id: 'roi-calculator',
          title: 'ROI Calculator',
          description: 'Calculate return on investment',
          category: 'Financial',
        },
        {
          id: 'impact-cascade',
          title: 'Impact Cascade',
          description: 'Visualize value flow',
          category: 'Visualization',
        },
      ];

      const mockOnSelect = vi.fn();

      render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={mockOnSelect}
        />
      );

      // Select ROI scenario
      const roiCard = screen.getByText('ROI Calculator').closest('button');
      fireEvent.click(roiCard!);

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'roi-calculator' })
      );
    });
  });

  describe('Multi-Persona Analysis Workflow', () => {
    it('should complete Quantum View analysis flow', async () => {
      const mockAnalyses = [
        {
          id: 'financial-1',
          persona: 'financial',
          title: 'Financial Analysis',
          summary: 'Strong ROI potential',
          confidence: 85,
          keyMetrics: [{ label: 'ROI', value: '245', unit: '%' }],
          recommendations: ['Proceed with investment'],
          risks: ['Market volatility'],
          consensus: true,
        },
        {
          id: 'technical-1',
          persona: 'technical',
          title: 'Technical Assessment',
          summary: 'Architecture supports scale',
          confidence: 78,
          keyMetrics: [{ label: 'Capacity', value: '10000', unit: 'users' }],
          recommendations: ['Upgrade infrastructure'],
          risks: ['Technical debt'],
          consensus: true,
        },
      ];

      render(
        <QuantumView
          analyses={mockAnalyses}
          showConsensus={true}
        />
      );

      // Step 1: View overview
      expect(screen.getByText('Quantum View')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Total personas

      // Step 2: Select financial persona
      const financialCard = screen.getByText('Financial Analysis').closest('button');
      fireEvent.click(financialCard!);

      // Step 3: View details
      expect(screen.getByText('Financial Analysis')).toBeInTheDocument();
      expect(screen.getByText('Strong ROI potential')).toBeInTheDocument();

      // Step 4: View consensus
      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      expect(screen.getByText('Consensus View')).toBeInTheDocument();
      expect(screen.getByText('3 of 5 personas agree')).toBeInTheDocument();
    });
  });

  describe('Story Arc Workflow', () => {
    it('should handle Value Canvas with different sources', async () => {
      const testCases = [
        { source: 'research', domain: 'enterprise-software', expected: 'research' },
        { source: 'sales-call', data: { customer: 'Acme' }, expected: 'sales-call' },
        { source: 'crm', data: { company: 'TechCorp' }, expected: 'crm' },
        { source: 'upload-notes', data: { content: 'Meeting notes' }, expected: 'upload-notes' },
        { source: 'template', templateId: 'roi-calculator', expected: 'template' },
      ];

      for (const testCase of testCases) {
        render(
          <MemoryRouter
            initialEntries={[
              {
                pathname: '/value-canvas',
                state: { source: testCase.source, ...testCase },
              },
            ]}
          >
            <ValueCanvas />
          </MemoryRouter>
        );

        // Should render ChatCanvasLayout with correct initial action
        const layout = screen.getByTestId('chat-canvas-layout');
        expect(layout).toBeInTheDocument();
        expect(layout).toHaveAttribute('data-action', testCase.expected);

        // Clear mock for next iteration
        vi.clearAllMocks();
      }
    });
  });

  describe('Cross-Template Data Flow', () => {
    it('should maintain data integrity across template transitions', () => {
      // Test that sanitized data flows correctly between templates
      const testData = {
        engHeadcount: 20,
        engSalary: 130,
        buildCost: 250,
        efficiencyTarget: 20,
      };

      // Validate ROI inputs
      const { validateROIInputs } = require('../../utils/templateSecurity');
      const validated = validateROIInputs(testData);

      expect(validated.engHeadcount).toBe(20);
      expect(validated.engSalary).toBe(130);
      expect(validated.buildCost).toBe(250);
      expect(validated.efficiencyTarget).toBe(20);
    });

    it('should handle malicious input across templates', () => {
      const { sanitizeTemplateInput } = require('../../utils/templateSecurity');

      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        'https://evil.com?cookie=<script>document.cookie</script>',
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeTemplateInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large datasets efficiently', async () => {
      // Generate large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `scenario-${i}`,
        title: `Scenario ${i}`,
        description: `Description ${i}`,
        category: 'Test',
        aiRecommended: i % 2 === 0,
        aiConfidence: 0.7 + (i * 0.003),
        estimatedTime: `${15 + i} min`,
        estimatedValue: `$${50 + i}K`,
        complexity: i % 3 === 0 ? 'simple' : i % 3 === 1 ? 'medium' : 'complex',
      }));

      const start = performance.now();
      
      render(
        <ScenarioSelector
          scenarios={largeDataset}
          onSelect={() => {}}
        />
      );

      const end = performance.now();

      // Should render within reasonable time
      expect(end - start).toBeLessThan(500);

      // Should show first few items
      expect(screen.getByText('Scenario 0')).toBeInTheDocument();
    });

    it('should handle rapid state updates without performance degradation', () => {
      const { rerender } = render(
        <QuantumView
          analyses={[
            {
              id: 'test',
              persona: 'financial',
              title: 'Test',
              summary: 'Test',
              confidence: 80,
              keyMetrics: [],
              recommendations: [],
              risks: [],
            },
          ]}
        />
      );

      const start = performance.now();

      // Rapid updates
      for (let i = 0; i < 50; i++) {
        rerender(
          <QuantumView
            analyses={[
              {
                id: `test-${i}`,
                persona: 'financial',
                title: `Test ${i}`,
                summary: `Summary ${i}`,
                confidence: 80 + i,
                keyMetrics: [],
                recommendations: [],
                risks: [],
              },
            ]}
          />
        );
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(1000);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should recover from corrupted data', () => {
      const { sanitizeDataObject } = require('../../utils/templateSecurity');

      // Corrupted data scenarios
      const corruptedData = [
        { id: 'test', title: null, description: undefined },
        { id: 'test', title: '<script>alert(1)</script>', description: 'Valid' },
        { id: 'test', title: 'Valid', description: 'javascript:alert(1)' },
        null,
        undefined,
        'string instead of object',
      ];

      corruptedData.forEach(data => {
        expect(() => {
          const sanitized = sanitizeDataObject(data);
          // Should not throw
        }).not.toThrow();
      });
    });

    it('should handle missing dependencies gracefully', () => {
      // Test component resilience when external services fail
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <QuantumView
          analyses={[]}
          onPersonaSelect={() => {
            throw new Error('Service unavailable');
          }}
        />
      );

      // Should still render
      expect(screen.getByText('Quantum View')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events during user interactions', () => {
      const { logSecurityEvent, getSecurityEvents } = require('../../utils/templateSecurity');

      // Clear previous events
      const initialEvents = getSecurityEvents();

      // Simulate security events
      logSecurityEvent({
        type: 'xss_attempt',
        source: 'test',
        details: { input: '<script>alert(1)</script>' },
      });

      logSecurityEvent({
        type: 'invalid_input',
        source: 'test',
        details: { field: 'email', value: 'invalid' },
      });

      const events = getSecurityEvents();

      // Should contain our logged events
      const newEvents = events.slice(initialEvents.length);
      expect(newEvents.length).toBeGreaterThanOrEqual(2);
      expect(newEvents.some(e => e.type === 'xss_attempt')).toBe(true);
    });
  });

  describe('Mobile Workflow Adaptation', () => {
    it('should adapt workflows for mobile screens', () => {
      // Test mobile layout
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <QuantumView
          analyses={[
            {
              id: 'test',
              persona: 'financial',
              title: 'Financial Analysis',
              summary: 'Test summary',
              confidence: 85,
              keyMetrics: [],
              recommendations: [],
              risks: [],
            },
          ]}
        />
      );

      // Should still be usable
      const card = screen.getByText('Financial Analysis').closest('button');
      fireEvent.click(card!);

      expect(screen.getByText('Financial Analysis')).toBeInTheDocument();

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });
  });

  describe('End-to-End User Journey', () => {
    it('should complete full business analysis workflow', async () => {
      // This simulates a complete user journey:
      // 1. Select scenario
      // 2. Run ROI analysis
      // 3. View impact cascade
      // 4. Get multi-persona insights
      // 5. Create story arc

      const mockScenarios = [
        {
          id: 'business-case',
          title: 'Business Case Analysis',
          description: 'Complete business case analysis',
          category: 'Financial',
        },
      ];

      const mockAnalyses = [
        {
          id: 'financial',
          persona: 'financial',
          title: 'Financial Analysis',
          summary: 'Strong ROI',
          confidence: 85,
          keyMetrics: [{ label: 'ROI', value: '200', unit: '%' }],
          recommendations: ['Proceed'],
          risks: ['Low risk'],
          consensus: true,
        },
      ];

      // Step 1: Scenario Selection
      const { rerender } = render(
        <ScenarioSelector
          scenarios={mockScenarios}
          onSelect={() => {
            // Step 2: Navigate to ROI Calculator
            rerender(<ROICalculator />);
          }}
        />
      );

      const scenarioCard = screen.getByText('Business Case Analysis').closest('button');
      fireEvent.click(scenarioCard!);

      // Step 3: ROI Analysis
      expect(screen.getByText('Business Case')).toBeInTheDocument();

      // Step 4: Navigate to Quantum View
      rerender(
        <QuantumView
          analyses={mockAnalyses}
          showConsensus={true}
        />
      );

      expect(screen.getByText('Quantum View')).toBeInTheDocument();

      // Step 5: View consensus
      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      expect(screen.getByText('Consensus View')).toBeInTheDocument();
    });
  });
});
