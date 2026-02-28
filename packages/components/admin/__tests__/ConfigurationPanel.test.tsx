/**
 * ConfigurationPanel Tests
 * 
 * Week 1, Item 1: Verify placeholder tabs are removed
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ConfigurationPanel } from '../ConfigurationPanel';
import '@testing-library/jest-dom';

// Mock the toast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock fetch
global.fetch = jest.fn();

const mockConfigurations = {
  configurations: {
    organization: {
      tenantProvisioning: {
        organizationId: 'test-org',
        status: 'active',
        maxUsers: 50,
        maxStorageGB: 100,
        enabledFeatures: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      customBranding: null,
      dataResidency: {
        primaryRegion: 'us-east-1'
      }
    },
    ai: {
      llmSpendingLimits: {
        monthlyHardCap: 1000,
        monthlySoftCap: 800,
        perRequestLimit: 10,
        alertThreshold: 80,
        alertRecipients: []
      },
      modelRouting: {
        defaultModel: 'together-llama-3-70b',
        routingRules: [],
        enableAutoDowngrade: true
      },
      agentToggles: {
        enabledAgents: {
          opportunityAgent: true,
          targetAgent: true,
          assumptionAgent: true,
          riskAgent: true,
          valueAgent: true
        }
      },
      hitlThresholds: {
        autoApprovalThreshold: 0.9,
        humanReviewThreshold: 0.7,
        rejectionThreshold: 0.5,
        reviewers: []
      }
    }
  }
};

describe('ConfigurationPanel - Week 1, Item 1: Remove Placeholder Tabs', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockConfigurations
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tab Structure', () => {
    it('should only show 2 tabs (Organization and AI & Agents)', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
        expect(screen.getByText('AI & Agents')).toBeInTheDocument();
      });

      // Verify placeholder tabs are NOT present
      expect(screen.queryByText('IAM')).not.toBeInTheDocument();
      expect(screen.queryByText('Operational')).not.toBeInTheDocument();
      expect(screen.queryByText('Security')).not.toBeInTheDocument();
      expect(screen.queryByText('Billing')).not.toBeInTheDocument();
    });

    it('should NOT show any "coming soon" messages', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Check both tabs
      const aiTab = screen.getByText('AI & Agents');
      fireEvent.click(aiTab);

      await waitFor(() => {
        expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
      });
    });

    it('should have exactly 2 tab triggers', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        const tabTriggers = screen.getAllByRole('tab');
        expect(tabTriggers).toHaveLength(2);
      });
    });
  });

  describe('Tab Functionality', () => {
    it('should default to Organization tab', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        const orgTab = screen.getByRole('tab', { name: /organization/i });
        expect(orgTab).toHaveAttribute('data-state', 'active');
      });
    });

    it('should switch to AI & Agents tab when clicked', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      const aiTab = screen.getByRole('tab', { name: /ai & agents/i });
      fireEvent.click(aiTab);

      await waitFor(() => {
        expect(aiTab).toHaveAttribute('data-state', 'active');
      });
    });

    it('should show complete content in Organization tab', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        // Check for Organization settings cards
        expect(screen.getByText('Tenant Provisioning')).toBeInTheDocument();
        expect(screen.getByText('Custom Branding')).toBeInTheDocument();
        expect(screen.getByText('Data Residency')).toBeInTheDocument();
      });
    });

    it('should show complete content in AI & Agents tab', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      const aiTab = screen.getByRole('tab', { name: /ai & agents/i });
      fireEvent.click(aiTab);

      await waitFor(() => {
        // Check for AI settings cards
        expect(screen.getByText('LLM Spending Limits')).toBeInTheDocument();
        expect(screen.getByText('Model Routing')).toBeInTheDocument();
        expect(screen.getByText('Agent Toggles')).toBeInTheDocument();
        expect(screen.getByText('Human-in-the-Loop Thresholds')).toBeInTheDocument();
      });
    });
  });

  describe('Visual Polish', () => {
    it('should use h1 for page title (not h2)', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('Configuration');
      });
    });

    it('should have descriptive subtitle', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(
          screen.getByText('Manage organization settings and AI agent configuration')
        ).toBeInTheDocument();
      });
    });

    it('should have properly sized action buttons', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        const clearCacheBtn = screen.getByRole('button', { name: /clear cache/i });
        const refreshBtn = screen.getByRole('button', { name: /refresh/i });

        // Both should be small size
        expect(clearCacheBtn.className).toContain('size-sm');
        expect(refreshBtn.className).toContain('size-sm');

        // Clear Cache should be ghost variant (less prominent)
        expect(clearCacheBtn.className).toContain('variant-ghost');
        
        // Refresh should be outline variant
        expect(refreshBtn.className).toContain('variant-outline');
      });
    });
  });

  describe('Intentionality', () => {
    it('should feel complete, not like features are missing', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        // No disabled tabs
        const tabs = screen.getAllByRole('tab');
        tabs.forEach(tab => {
          expect(tab).not.toBeDisabled();
        });

        // No "locked" or "upgrade" messaging
        expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/enterprise/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
      });
    });

    it('should not have any TODO or FIXME comments in rendered output', async () => {
      const { container } = render(
        <ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />
      );

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      const html = container.innerHTML;
      expect(html).not.toMatch(/TODO/i);
      expect(html).not.toMatch(/FIXME/i);
      expect(html).not.toMatch(/HACK/i);
      expect(html).not.toMatch(/XXX/i);
    });
  });

  describe('Error States', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        // Should show error state, not crash
        expect(screen.getByText('No configurations found')).toBeInTheDocument();
      });
    });

    it('should handle empty configurations', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configurations: null })
      });

      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('No configurations found')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles for tabs', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        const tablist = screen.getByRole('tablist');
        expect(tablist).toBeInTheDocument();

        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(2);

        tabs.forEach(tab => {
          expect(tab).toHaveAttribute('aria-selected');
        });
      });
    });

    it('should have keyboard navigation support', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        const orgTab = screen.getByRole('tab', { name: /organization/i });
        expect(orgTab).toHaveAttribute('data-state', 'active');
      });

      const aiTab = screen.getByRole('tab', { name: /ai & agents/i });
      
      // Simulate keyboard navigation
      aiTab.focus();
      fireEvent.keyDown(aiTab, { key: 'Enter' });

      await waitFor(() => {
        expect(aiTab).toHaveAttribute('data-state', 'active');
      });
    });
  });
});
