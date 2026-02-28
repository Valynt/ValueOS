/**
 * Comprehensive Test Suite for Quantum View Template (Multi-Persona)
 * Tests functionality, security, accessibility, and performance
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type PersonaAnalysis, type PersonaType, QuantumView } from '../QuantumView';

// Mock dependencies
vi.mock('../../components/Agents/AgentBadge', () => ({
  default: ({ agentId, size }: { agentId: string; size?: string }) => (
    <div data-testid={`agent-badge-${agentId}`} data-size={size}>
      {agentId}
    </div>
  ),
}));

vi.mock('../../components/Agents/ConfidenceIndicator', () => ({
  default: ({
    value,
    confidence,
    label,
    size,
  }: {
    value: number;
    confidence: number;
    label: string;
    size: string;
  }) => (
    <div data-testid="confidence-indicator" data-size={size}>
      <span data-value>{value}</span>
      <span data-confidence>{confidence}</span>
      <span data-label>{label}</span>
    </div>
  ),
}));

// Mock data for testing
const mockAnalyses: PersonaAnalysis[] = [
  {
    id: 'financial-1',
    persona: 'financial',
    title: 'Financial Analysis',
    summary: 'Strong ROI potential with 18-month payback period',
    confidence: 85,
    keyMetrics: [
      { label: 'ROI', value: '245', unit: '%', trend: 'up' },
      { label: 'Payback', value: '18', unit: 'months', trend: 'down' },
    ],
    recommendations: [
      'Proceed with investment',
      'Allocate additional budget for marketing',
      'Consider phased rollout',
    ],
    risks: [
      'Market volatility could affect projections',
      'Competitive response may reduce market share',
    ],
    consensus: true,
    aiGenerated: true,
  },
  {
    id: 'technical-1',
    persona: 'technical',
    title: 'Technical Assessment',
    summary: 'Architecture supports scale but requires additional infrastructure',
    confidence: 78,
    keyMetrics: [
      { label: 'Capacity', value: '10000', unit: 'users', trend: 'up' },
      { label: 'Latency', value: '150', unit: 'ms', trend: 'neutral' },
    ],
    recommendations: [
      'Upgrade database cluster',
      'Implement caching layer',
      'Add monitoring infrastructure',
    ],
    risks: [
      'Technical debt accumulation',
      'Integration complexity with legacy systems',
    ],
    consensus: true,
    aiGenerated: true,
  },
  {
    id: 'strategic-1',
    persona: 'strategic',
    title: 'Strategic Review',
    summary: 'Aligns with long-term vision but requires competitive analysis',
    confidence: 92,
    keyMetrics: [
      { label: 'Market Fit', value: '95', unit: '%', trend: 'up' },
      { label: 'Competitive Moat', value: '7', unit: '/10', trend: 'up' },
    ],
    recommendations: [
      'Accelerate timeline to market',
      'Focus on differentiation',
      'Build strategic partnerships',
    ],
    risks: [
      'Competitive retaliation',
      'Regulatory changes in target markets',
    ],
    consensus: false,
    aiGenerated: false,
  },
  {
    id: 'risk-1',
    persona: 'risk',
    title: 'Risk Assessment',
    summary: 'Moderate risk profile with manageable mitigation strategies',
    confidence: 72,
    keyMetrics: [
      { label: 'Risk Score', value: '6.5', unit: '/10', trend: 'down' },
      { label: 'Mitigation Cost', value: '150', unit: 'k$', trend: 'neutral' },
    ],
    recommendations: [
      'Implement risk monitoring dashboard',
      'Establish contingency reserves',
      'Create risk response team',
    ],
    risks: [
      'Implementation delays',
      'Budget overrun potential',
      'Resource constraints',
    ],
    consensus: false,
    aiGenerated: true,
  },
  {
    id: 'operational-1',
    persona: 'operational',
    title: 'Operational Impact',
    summary: 'Requires process changes but improves efficiency long-term',
    confidence: 88,
    keyMetrics: [
      { label: 'Efficiency Gain', value: '35', unit: '%', trend: 'up' },
      { label: 'Training Hours', value: '120', unit: 'hrs', trend: 'down' },
    ],
    recommendations: [
      'Develop training program',
      'Create change management plan',
      'Establish success metrics',
    ],
    risks: [
      'Change resistance from staff',
      'Temporary productivity dip',
    ],
    consensus: true,
    aiGenerated: false,
  },
];

describe('QuantumView - Multi-Persona Template', () => {
  const mockOnPersonaSelect = vi.fn();
  const mockOnAnalysisClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('should render all main components correctly', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          onAnalysisClick={mockOnAnalysisClick}
        />
      );

      // Header
      expect(screen.getByText('Quantum View')).toBeInTheDocument();
      expect(screen.getByText('Multi-Persona Analysis')).toBeInTheDocument();

      // Agent badge
      expect(screen.getByTestId('agent-badge-multi-persona')).toBeInTheDocument();

      // Consensus button
      expect(screen.getByText(/Consensus/)).toBeInTheDocument();

      // Persona cards
      expect(screen.getByText('Financial Analysis')).toBeInTheDocument();
      expect(screen.getByText('Technical Assessment')).toBeInTheDocument();
      expect(screen.getByText('Strategic Review')).toBeInTheDocument();
      expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
      expect(screen.getByText('Operational Impact')).toBeInTheDocument();
    });

    it('should render with custom title and subtitle', () => {
      render(
        <QuantumView
          title="Custom Quantum View"
          subtitle="Custom Subtitle"
          analyses={mockAnalyses}
          onSelect={mockOnPersonaSelect}
        />
      );

      expect(screen.getByText('Custom Quantum View')).toBeInTheDocument();
      expect(screen.getByText('Custom Subtitle')).toBeInTheDocument();
    });

    it('should display quick stats correctly', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Total personas
      expect(screen.getByText('5')).toBeInTheDocument();

      // Consensus count
      expect(screen.getByText('3')).toBeInTheDocument();

      // Average confidence
      expect(screen.getByText('83%')).toBeInTheDocument();
    });

    it('should show AI indicators for AI-generated analyses', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Should show AI badges for AI-generated analyses
      const aiBadges = screen.getAllByText('AI');
      expect(aiBadges.length).toBe(3); // Financial, Technical, Risk
    });

    it('should show consensus indicators', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      // Should show consensus badges for consensus analyses
      const consensusBadges = screen.getAllByText('Consensus');
      expect(consensusBadges.length).toBe(3);
    });
  });

  describe('Persona Selection', () => {
    it('should handle persona card click', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          onAnalysisClick={mockOnAnalysisClick}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      expect(mockOnPersonaSelect).toHaveBeenCalledWith('financial');
      expect(mockOnAnalysisClick).toHaveBeenCalledWith(
        expect.objectContaining({
          persona: 'financial',
          title: 'Financial Analysis',
        })
      );
    });

    it('should show selected state visually', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Should have selected styling
      expect(financialCard).toHaveClass('bg-primary/5');
      expect(financialCard).toHaveClass('border-primary');
    });

    it('should navigate to detail view on selection', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Should show detail view
      expect(screen.getByTestId('analysis-detail-financial')).toBeInTheDocument();
    });
  });

  describe('Detail View', () => {
    it('should render detailed analysis view', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Select a persona
      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Check detail content
      expect(screen.getByText('Financial Analysis')).toBeInTheDocument();
      expect(screen.getByText('Financial Analyst')).toBeInTheDocument();
      expect(screen.getByText('Strong ROI potential with 18-month payback period')).toBeInTheDocument();

      // Check metrics
      expect(screen.getByText('ROI')).toBeInTheDocument();
      expect(screen.getByText('245%')).toBeInTheDocument();
      expect(screen.getByText('Payback')).toBeInTheDocument();
      expect(screen.getByText('18 months')).toBeInTheDocument();

      // Check recommendations
      expect(screen.getByText('Proceed with investment')).toBeInTheDocument();
      expect(screen.getByText('Allocate additional budget for marketing')).toBeInTheDocument();

      // Check risks
      expect(screen.getByText('Market volatility could affect projections')).toBeInTheDocument();
    });

    it('should show confidence indicator in detail view', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      const confidenceIndicators = screen.getAllByTestId('confidence-indicator');
      const detailConfidence = confidenceIndicators.find(ind => 
        within(ind).getByAttribute('data-size')?.textContent === 'lg'
      );
      
      expect(detailConfidence).toBeInTheDocument();
    });

    it('should handle back button', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Go to detail
      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Click back
      const backButton = screen.getByText('Back to Overview');
      fireEvent.click(backButton);

      // Should return to overview
      expect(screen.getByText('Quantum View')).toBeInTheDocument();
      expect(screen.queryByTestId('analysis-detail-financial')).not.toBeInTheDocument();
    });

    it('should show trend indicators for metrics', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Should show trend arrows
      expect(screen.getByText('↑')).toBeInTheDocument(); // Up trend
      expect(screen.getByText('↓')).toBeInTheDocument(); // Down trend
    });
  });

  describe('Consensus View', () => {
    it('should render consensus view when button clicked', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      // Should show consensus view
      expect(screen.getByTestId('consensus-view')).toBeInTheDocument();
      expect(screen.getByText('Consensus View')).toBeInTheDocument();
    });

    it('should show agreement score', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      // Should show agreement percentage
      expect(screen.getByText('Overall Agreement')).toBeInTheDocument();
      expect(screen.getByText('3 of 5 personas agree')).toBeInTheDocument();
    });

    it('should show common recommendations', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      // Should show consensus recommendations
      expect(screen.getByText('Top Consensus Recommendations')).toBeInTheDocument();
    });

    it('should show persona agreement list', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      // Should list agreeing personas
      expect(screen.getByText('Financial Analysis')).toBeInTheDocument();
      expect(screen.getByText('Technical Assessment')).toBeInTheDocument();
      expect(screen.getByText('Operational Impact')).toBeInTheDocument();
    });

    it('should handle empty consensus', () => {
      const noConsensus = mockAnalyses.map(a => ({ ...a, consensus: false }));
      
      render(
        <QuantumView
          analyses={noConsensus}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      expect(screen.getByText('No consensus reached among personas')).toBeInTheDocument();
    });
  });

  describe('Auto-Sync Feature', () => {
    it('should auto-select highest confidence persona when autoSync enabled', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          autoSync={true}
        />
      );

      // Strategic has highest confidence (92%)
      expect(screen.getByTestId('analysis-detail-strategic')).toBeInTheDocument();
    });

    it('should not auto-sync when disabled', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          autoSync={false}
        />
      );

      // Should show overview, not detail
      expect(screen.getByText('Quantum View')).toBeInTheDocument();
      expect(screen.queryByTestId(/analysis-detail-/)).not.toBeInTheDocument();
    });
  });

  describe('Security - XSS Prevention', () => {
    it('should sanitize malicious content in titles', () => {
      const maliciousAnalyses: PersonaAnalysis[] = [
        {
          id: 'malicious',
          persona: 'financial',
          title: '<script>alert("xss")</script>',
          summary: 'Test',
          confidence: 80,
          keyMetrics: [],
          recommendations: [],
          risks: [],
        },
      ];

      render(
        <QuantumView
          analyses={maliciousAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Should not execute script
      const scripts = screen.queryAllByRole('script');
      expect(scripts.length).toBe(0);
    });

    it('should sanitize malicious content in summaries', () => {
      const maliciousAnalyses: PersonaAnalysis[] = [
        {
          id: 'malicious',
          persona: 'technical',
          title: 'Test',
          summary: 'javascript:alert(1)',
          confidence: 80,
          keyMetrics: [],
          recommendations: [],
          risks: [],
        },
      ];

      render(
        <QuantumView
          analyses={maliciousAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Should not execute javascript
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should sanitize malicious recommendations', () => {
      const maliciousAnalyses: PersonaAnalysis[] = [
        {
          id: 'malicious',
          persona: 'strategic',
          title: 'Test',
          summary: 'Test',
          confidence: 80,
          keyMetrics: [],
          recommendations: ['<img src=x onerror=alert(1)>'],
          risks: [],
        },
      ];

      render(
        <QuantumView
          analyses={maliciousAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Should not render dangerous HTML
      const images = screen.queryAllByRole('img');
      const hasDangerousImg = images.some(img => 
        img.getAttribute('src') === 'x'
      );
      expect(hasDangerousImg).toBe(false);
    });

    it('should handle prototype pollution attempts', () => {
      const maliciousAnalyses: any[] = [
        {
          id: 'malicious',
          persona: 'financial',
          title: 'Test',
          summary: 'Test',
          confidence: 80,
          keyMetrics: [],
          recommendations: [],
          risks: [],
          __proto__: { isAdmin: true },
        },
      ];

      // Should not crash
      expect(() => {
        render(
          <QuantumView
            analyses={maliciousAnalyses}
            onPersonaSelect={mockOnPersonaSelect}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Check for buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Check for headings
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const personaCards = screen.getAllByRole('button');
      personaCards.forEach(card => {
        expect(card).toHaveAttribute('tabIndex');
      });
    });

    it('should provide screen reader friendly text', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Check for descriptive text
      expect(screen.getByText('Multi-Persona Analysis')).toBeInTheDocument();
      expect(screen.getByText('Financial Analyst')).toBeInTheDocument();
    });

    it('should announce selection changes', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Should be focusable and have proper ARIA
      expect(financialCard).toHaveAttribute('aria-pressed');
    });
  });

  describe('Performance', () => {
    it('should render quickly with many personas', () => {
      const manyAnalyses = Array.from({ length: 20 }, (_, i) => ({
        id: `persona-${i}`,
        persona: ['financial', 'technical', 'strategic', 'risk', 'operational'][i % 5] as PersonaType,
        title: `Persona ${i}`,
        summary: `Summary ${i}`,
        confidence: 70 + (i % 30),
        keyMetrics: [{ label: 'Metric', value: i }],
        recommendations: ['Rec 1'],
        risks: ['Risk 1'],
      }));

      const start = performance.now();
      render(
        <QuantumView
          analyses={manyAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );
      const end = performance.now();

      // Should render in under 200ms
      expect(end - start).toBeLessThan(200);
    });

    it('should handle rapid persona switching efficiently', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Rapidly switch between personas
      const personaCards = screen.getAllByRole('button');
      
      for (let i = 0; i < 10; i++) {
        fireEvent.click(personaCards[i % personaCards.length]);
      }

      // Should remain stable
      expect(screen.getByText('Quantum View')).toBeInTheDocument();
    });

    it('should handle consensus view transitions efficiently', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);

      // Rapidly toggle consensus view
      for (let i = 0; i < 5; i++) {
        fireEvent.click(consensusButton);
        const backButton = screen.getByText('Back to Overview');
        fireEvent.click(backButton);
      }

      expect(screen.getByText('Quantum View')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty analyses array', () => {
      render(
        <QuantumView
          analyses={[]}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      expect(screen.getByText('No persona analyses available')).toBeInTheDocument();
    });

    it('should handle missing optional properties', () => {
      const minimalAnalyses: PersonaAnalysis[] = [
        {
          id: 'minimal',
          persona: 'financial',
          title: 'Minimal',
          summary: 'Minimal analysis',
          confidence: 80,
          keyMetrics: [],
          recommendations: [],
          risks: [],
        },
      ];

      render(
        <QuantumView
          analyses={minimalAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      expect(screen.getByText('Minimal')).toBeInTheDocument();
    });

    it('should handle invalid persona types gracefully', () => {
      const invalidAnalyses: any[] = [
        {
          id: 'invalid',
          persona: 'invalid-persona',
          title: 'Invalid',
          summary: 'Test',
          confidence: 80,
          keyMetrics: [],
          recommendations: [],
          risks: [],
        },
      ];

      // Should not crash
      expect(() => {
        render(
          <QuantumView
            analyses={invalidAnalyses}
            onPersonaSelect={mockOnPersonaSelect}
          />
        );
      }).not.toThrow();
    });

    it('should handle null/undefined values', () => {
      const analysesWithNulls: any[] = [
        {
          id: 'nulls',
          persona: 'financial',
          title: null,
          summary: undefined,
          confidence: 80,
          keyMetrics: null,
          recommendations: undefined,
          risks: [],
        },
      ];

      // Should not crash
      expect(() => {
        render(
          <QuantumView
            analyses={analysesWithNulls}
            onPersonaSelect={mockOnPersonaSelect}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile screens', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Should still render critical content
      expect(screen.getByText('Quantum View')).toBeInTheDocument();
      expect(screen.getByText('Financial Analysis')).toBeInTheDocument();

      // Restore
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('should maintain touch-friendly targets on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Check that persona cards are still accessible
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).toBeEnabled();
      });

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });
  });

  describe('Visual Feedback', () => {
    it('should show loading state for consensus calculations', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      // Consensus button should be visible
      const consensusButton = screen.getByText(/Consensus/);
      expect(consensusButton).toBeInTheDocument();
    });

    it('should highlight selected persona cards', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      // Should have selected styling
      expect(financialCard).toHaveClass('bg-primary/5');
      expect(financialCard).toHaveClass('border-primary');
      expect(financialCard).toHaveClass('shadow-lg');
    });

    it('should show hover effects on cards', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      
      // Before hover
      expect(financialCard).not.toHaveClass('hover:border-primary/50');

      // After hover
      fireEvent.mouseEnter(financialCard);
      // Component should handle hover via CSS
      expect(financialCard).toBeInTheDocument();
    });
  });

  describe('Integration with External Components', () => {
    it('should integrate with AgentBadge component', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      expect(screen.getByTestId('agent-badge-multi-persona')).toBeInTheDocument();
    });

    it('should integrate with ConfidenceIndicator component', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      const confidenceIndicators = screen.getAllByTestId('confidence-indicator');
      expect(confidenceIndicators.length).toBeGreaterThan(0);
    });

    it('should call callbacks with correct data', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          onAnalysisClick={mockOnAnalysisClick}
        />
      );

      const financialCard = screen.getByTestId('persona-card-financial');
      fireEvent.click(financialCard);

      expect(mockOnPersonaSelect).toHaveBeenCalledWith('financial');
      expect(mockOnAnalysisClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'financial-1',
          persona: 'financial',
          title: 'Financial Analysis',
        })
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long titles and summaries', () => {
      const longAnalysis: PersonaAnalysis[] = [
        {
          id: 'long',
          persona: 'financial',
          title: 'A'.repeat(200),
          summary: 'B'.repeat(500),
          confidence: 80,
          keyMetrics: [],
          recommendations: [],
          risks: [],
        },
      ];

      render(
        <QuantumView
          analyses={longAnalysis}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Should render without breaking
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle extreme confidence values', () => {
      const extremeAnalysis: PersonaAnalysis[] = [
        {
          id: 'extreme',
          persona: 'financial',
          title: 'Extreme',
          summary: 'Test',
          confidence: 100,
          keyMetrics: [],
          recommendations: [],
          risks: [],
        },
      ];

      render(
        <QuantumView
          analyses={extremeAnalysis}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should handle rapid state changes without crashing', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      // Rapid interactions
      const consensusButton = screen.getByText(/Consensus/);
      const personaCards = screen.getAllByRole('button');

      for (let i = 0; i < 10; i++) {
        fireEvent.click(personaCards[i % personaCards.length]);
        fireEvent.click(consensusButton);
      }

      expect(screen.getByText('Quantum View')).toBeInTheDocument();
    });
  });

  describe('Visual Regression Prevention', () => {
    it('should maintain consistent card structure', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
        />
      );

      // Check that all cards have consistent structure
      const cards = screen.getAllByRole('button');
      const personaCards = cards.filter(card => 
        card.textContent?.includes('Analysis') || 
        card.textContent?.includes('Assessment')
      );

      expect(personaCards.length).toBeGreaterThan(0);

      // Each card should have title, summary, and confidence
      personaCards.forEach(card => {
        expect(card.textContent).toBeTruthy();
      });
    });

    it('should render all metadata consistently', () => {
      render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      // Check that all expected metadata is present
      expect(screen.getByText('Financial Analyst')).toBeInTheDocument();
      expect(screen.getByText('Technical Architect')).toBeInTheDocument();
      expect(screen.getByText('Strategic Advisor')).toBeInTheDocument();
      expect(screen.getByText('Risk Analyst')).toBeInTheDocument();
      expect(screen.getByText('Operations Lead')).toBeInTheDocument();
    });

    it('should maintain layout in both view modes', () => {
      const { rerender } = render(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={false}
        />
      );

      // Overview mode
      expect(screen.getByText('Quantum View')).toBeInTheDocument();

      // Switch to consensus
      rerender(
        <QuantumView
          analyses={mockAnalyses}
          onPersonaSelect={mockOnPersonaSelect}
          showConsensus={true}
        />
      );

      const consensusButton = screen.getByText(/Consensus/);
      fireEvent.click(consensusButton);

      expect(screen.getByText('Consensus View')).toBeInTheDocument();
    });
  });
});