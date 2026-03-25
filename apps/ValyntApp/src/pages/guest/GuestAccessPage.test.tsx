import { render, waitFor } from '@testing-library/react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GuestAccessPage } from './GuestAccessPage';

const mockValidateToken = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useLocation: vi.fn(),
    useNavigate: vi.fn(),
    useSearchParams: vi.fn(),
  };
});

vi.mock('@/GuestAccessService', () => ({
  getGuestAccessService: () => ({
    validateToken: mockValidateToken,
  }),
}));

vi.mock('./GuestValueCalculator', () => ({
  GuestValueCalculator: () => <div>Guest calculator</div>,
}));

describe('GuestAccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/guest/access',
      search: '',
      hash: '#token=fragment-token-123',
      state: null,
      key: 'guest-access',
    });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    mockValidateToken.mockResolvedValue({
      isValid: false,
      errorMessage: 'Token not found',
    });

    window.location.hash = '#token=fragment-token-123';
  });

  it('redeems fragment tokens via validateToken and clears the URL', async () => {
    render(<GuestAccessPage />);

    await waitFor(() => {
      expect(mockValidateToken).toHaveBeenCalledWith('fragment-token-123');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/guest/access', { replace: true });
  });
});
