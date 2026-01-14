/**
 * Week 1 Complete Tests
 * 
 * Tests for all Week 1 ship blockers:
 * 1. Remove placeholder tabs ✅
 * 2. Unified save pattern ✅
 * 3. Proper error messages ✅
 * 4. Loading skeletons ✅
 * 5. Unsaved changes warning ✅
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ConfigurationPanel } from '../ConfigurationPanel';
import '@testing-library/jest-dom';

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

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
      customBranding: {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        fontFamily: 'Inter'
      },
      dataResidency: {
        primaryRegion: 'us-east-1',
        complianceRequirements: ['GDPR']
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
          targetAgent: true
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

describe('Week 1: Ship Blockers - Complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockConfigurations
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Item 2: Unified Save Pattern', () => {
    it('should NOT show individual save buttons', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Should NOT find any "Save" buttons in the content
      const saveButtons = screen.queryAllByRole('button', { name: /save/i });
      const contentSaveButtons = saveButtons.filter(btn => 
        !btn.textContent?.includes('Saved') // Exclude status indicators
      );
      
      expect(contentSaveButtons).toHaveLength(0);
    });

    it('should show "Saving..." indicator when changes are made', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Make a change
      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      // Should show saving indicator
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });

    it('should show "Saved" indicator after successful save', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Make a change
      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      // Wait for debounce and save
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });
    });

    it('should debounce saves (1 second delay)', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      const maxUsersInput = screen.getByLabelText('Max Users');
      
      // Make multiple rapid changes
      fireEvent.change(maxUsersInput, { target: { value: '100' } });
      fireEvent.change(maxUsersInput, { target: { value: '101' } });
      fireEvent.change(maxUsersInput, { target: { value: '102' } });

      // Should only call fetch once after debounce
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const fetchCalls = (global.fetch as jest.Mock).mock.calls.filter(
          call => call[0].includes('/api/admin/configurations') && call[1]?.method === 'PUT'
        );
        expect(fetchCalls).toHaveLength(1);
      });
    });

    it('should show "Last saved" timestamp', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });

      // Wait for "Saved" to transition to "Last saved"
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText(/Last saved/i)).toBeInTheDocument();
      });
    });
  });

  describe('Item 3: Proper Error Messages', () => {
    it('should show specific error for 403 Forbidden', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Access denied' })
      });

      const { toast } = require('@/components/ui/use-toast').useToast();
      
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Unable to load configurations',
            description: expect.stringContaining('permission'),
            variant: 'destructive'
          })
        );
      });
    });

    it('should show specific error for 404 Not Found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      const { toast } = require('@/components/ui/use-toast').useToast();
      
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining('does not exist')
          })
        );
      });
    });

    it('should show specific error for 500 Server Error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      const { toast } = require('@/components/ui/use-toast').useToast();
      
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining('servers are experiencing issues')
          })
        );
      });
    });

    it('should show Retry button in error toast', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      const { toast } = require('@/components/ui/use-toast').useToast();
      
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.anything() // Should have retry button
          })
        );
      });
    });

    it('should show setting name in save error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations
      }).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid value' })
      });

      const { toast } = require('@/components/ui/use-toast').useToast();
      
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Tenant Provisioning'),
            description: 'Invalid value'
          })
        );
      });
    });
  });

  describe('Item 4: Loading Skeletons', () => {
    it('should show skeleton screens instead of spinner', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      // Should show skeletons, not spinner
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);

      // Should NOT show spinner
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should match final layout structure', async () => {
      const { container } = render(
        <ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />
      );

      // Skeleton should have header structure
      const headerSkeletons = container.querySelectorAll('.space-y-2 .h-9, .space-y-2 .h-4');
      expect(headerSkeletons.length).toBeGreaterThan(0);

      // Skeleton should have card structure
      const cardSkeletons = container.querySelectorAll('.space-y-4');
      expect(cardSkeletons.length).toBeGreaterThan(0);
    });

    it('should transition smoothly from skeleton to content', async () => {
      const { container } = render(
        <ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />
      );

      // Initially shows skeletons
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

      // After loading, shows content
      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
        expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
      });
    });
  });

  describe('Item 5: Unsaved Changes Warning', () => {
    it('should warn before leaving with unsaved changes', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Make a change
      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      // Try to leave
      const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      window.dispatchEvent(event);

      // Should prevent default (show browser warning)
      expect(event.defaultPrevented).toBe(true);
    });

    it('should NOT warn if no unsaved changes', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Try to leave without changes
      const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      window.dispatchEvent(event);

      // Should NOT prevent default
      expect(event.defaultPrevented).toBe(false);
    });

    it('should show pending changes alert', async () => {
      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Make a change
      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      // Should show alert about unsaved changes
      await waitFor(() => {
        expect(screen.getByText(/unsaved change/i)).toBeInTheDocument();
      });
    });

    it('should clear warning after save completes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigurations
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
      });

      // Make a change
      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      // Wait for save
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });

      // Try to leave after save
      const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      window.dispatchEvent(event);

      // Should NOT prevent default (no warning)
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('Integration: All Week 1 Items Together', () => {
    it('should handle complete user flow', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockConfigurations
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      render(<ConfigurationPanel organizationId="test-org" userRole="tenant_admin" />);

      // 1. Shows loading skeleton
      expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

      // 2. Loads content (only 2 tabs)
      await waitFor(() => {
        expect(screen.getByText('Organization')).toBeInTheDocument();
        expect(screen.getByText('AI & Agents')).toBeInTheDocument();
        expect(screen.queryByText('IAM')).not.toBeInTheDocument();
      });

      // 3. Make a change (auto-save, no save button)
      const maxUsersInput = screen.getByLabelText('Max Users');
      fireEvent.change(maxUsersInput, { target: { value: '100' } });

      // 4. Shows saving indicator
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      // 5. Completes save
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });

      // 6. Can navigate away safely
      const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
