import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EvidenceDrawer } from '../EvidenceDrawer';

vi.mock('@/hooks/useIntegrityOutput', () => ({
  useIntegrityOutput: vi.fn(),
}));

import { useIntegrityOutput } from '@/hooks/useIntegrityOutput';

const mockedUseIntegrityOutput = vi.mocked(useIntegrityOutput);

describe('EvidenceDrawer', () => {
  it('renders orchestration failure state instead of fake claims', () => {
    mockedUseIntegrityOutput.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Integrity API unavailable'),
      isRunning: false,
      runAgent: vi.fn(),
    });

    render(<EvidenceDrawer open onClose={() => undefined} caseId="case-1" />);

    expect(screen.getByText('Evidence integration failure')).toBeInTheDocument();
    expect(screen.getByText(/Integrity API unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Annual revenue \$2.4B/i)).not.toBeInTheDocument();
  });

  it('renders live integrity claims when available', () => {
    mockedUseIntegrityOutput.mockReturnValue({
      data: {
        id: 'out-1',
        case_id: 'case-1',
        organization_id: 'org-1',
        agent_run_id: null,
        claims: [
          {
            claim_id: 'claim-1',
            text: 'ERP upgrade reduces reconciliation cycle by 35%',
            confidence_score: 0.81,
            evidence_tier: 2,
            flagged: false,
          },
        ],
        overall_confidence: 0.81,
        veto_triggered: false,
        veto_reason: null,
        source_agent: 'integrity',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
      isRunning: false,
      runAgent: vi.fn(),
    });

    render(<EvidenceDrawer open onClose={() => undefined} caseId="case-1" />);

    expect(screen.getByText('ERP upgrade reduces reconciliation cycle by 35%')).toBeInTheDocument();
    expect(screen.getByText('Tier 2')).toBeInTheDocument();
    expect(screen.getByText('81%')).toBeInTheDocument();
  });
});
