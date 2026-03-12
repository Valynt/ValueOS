/**
 * useAuth — localStorage write guard
 *
 * Verifies that useAuth does NOT write the user profile to localStorage.
 * Writing the full user object (including role) to localStorage is an XSS
 * escalation vector — any injected script can read it, and the data persists
 * across sessions.
 *
 * The localStorage.setItem call was removed from the useMemo in
 * client/src/_core/hooks/useAuth.ts. These tests enforce that it stays gone.
 *
 * The hook lives in client/src/_core/hooks/useAuth.ts. Its @/lib/trpc and
 * @/const imports resolve to apps/ValyntApp/src/lib/trpc.ts and
 * apps/ValyntApp/src/const.ts (stubs), both of which are mocked below.
 *
 * Note: the test setup file (src/test/setup.ts) replaces window.localStorage
 * with vi.fn() mocks, so assertions use spy calls rather than getItem().
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock heavy dependencies ──────────────────────────────────────────────────

const { mockUseQuery, mockUseMutation, mockUseUtils } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseUtils: vi.fn(),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    auth: {
      me: { useQuery: mockUseQuery },
      logout: { useMutation: mockUseMutation },
    },
    useUtils: mockUseUtils,
  },
}));

vi.mock('@/const', () => ({
  getLoginUrl: () => '/login',
  COOKIE_NAME: 'auth-token',
  ONE_YEAR_MS: 31536000000,
}));

// ─── Import hook after mocks ──────────────────────────────────────────────────

import { useAuth } from '../../../../client/src/_core/hooks/useAuth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQueryResult(data: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

function makeMutationResult(overrides: Record<string, unknown> = {}) {
  return { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, error: null, ...overrides };
}

const FAKE_USER = { id: 'user-123', email: 'alice@example.com', role: 'admin' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAuth — localStorage behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUtils.mockReturnValue({
      auth: { me: { setData: vi.fn(), invalidate: vi.fn().mockResolvedValue(undefined) } },
    });
    mockUseMutation.mockReturnValue(makeMutationResult());
  });

  it('does NOT write user profile to localStorage when authenticated', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(FAKE_USER));

    renderHook(() => useAuth());

    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'manus-runtime-user-info',
      expect.any(String),
    );
  });

  it('does NOT write to localStorage when user is unauthenticated', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(null));

    renderHook(() => useAuth());

    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'manus-runtime-user-info',
      expect.any(String),
    );
  });

  it('does NOT write to localStorage on re-render', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(FAKE_USER));

    const { rerender } = renderHook(() => useAuth());
    vi.clearAllMocks();
    rerender();

    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'manus-runtime-user-info',
      expect.any(String),
    );
  });

  it('returns correct auth state', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(FAKE_USER));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(FAKE_USER);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns unauthenticated state when query returns null', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(null));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
