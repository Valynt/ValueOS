import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealsView } from '../DealsView';

// Mocks
const mockErrorToast = vi.fn();
vi.mock('@/components/Common/Toast', () => ({
  useToast: () => ({
    error: mockErrorToast,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

vi.mock('@/services/ValueCaseService', () => ({
  valueCaseService: {
    getValueCases: vi.fn().mockResolvedValue([
      {
        id: '123',
        company: 'Test Company',
        name: 'Test Deal',
        stage: 'opportunity',
        metadata: {
          persona: { id: 'p1', role: 'Champion' },
          industry: 'Tech',
          companySize: 'Enterprise'
        }
      }
    ]),
    updateValueCase: vi.fn().mockResolvedValue({}),
  },
}));

// Mock child components to isolate the test and trigger the error
vi.mock('@/components/deals/BusinessCaseGenerator', () => ({
  BusinessCaseGenerator: ({ onError }: { onError: (msg: string) => void }) => (
    <button data-testid="trigger-error" onClick={() => onError('Simulated Error')}>
      Trigger Error
    </button>
  ),
}));

// Mock other components to avoid rendering issues
vi.mock('@/components/deals/DealSelector', () => ({ DealSelector: () => <div>DealSelector</div> }));
vi.mock('@/components/deals/DealImportModal', () => ({ DealImportModal: () => <div>DealImportModal</div> }));
vi.mock('@/components/deals/LifecycleStageNav', () => ({ LifecycleStageNav: () => <div>LifecycleStageNav</div> }));
vi.mock('@/components/deals/PersonaSelector', () => ({ PersonaSelector: () => <div>PersonaSelector</div> }));
vi.mock('@/components/deals/OpportunityAnalysisPanel', () => ({ OpportunityAnalysisPanel: () => <div>OpportunityAnalysisPanel</div> }));
vi.mock('@/components/deals/BenchmarkComparisonPanel', () => ({ BenchmarkComparisonPanel: () => <div>BenchmarkComparisonPanel</div> }));
vi.mock('@/components/deals/ShareCustomerButton', () => ({ ShareCustomerButton: () => <div>ShareCustomerButton</div> }));

describe('DealsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error toast when business case generation fails', async () => {
    render(
      <MemoryRouter initialEntries={['/deals/123']}>
        <Routes>
          <Route path="/deals/:dealId" element={<DealsView />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the deal to load and BusinessCaseGenerator to appear
    const triggerBtn = await screen.findByTestId('trigger-error');

    // Trigger the error
    fireEvent.click(triggerBtn);

    // Assert
    expect(mockErrorToast).toHaveBeenCalledWith(
      'Business case generation failed',
      'Simulated Error'
    );
  });
});
