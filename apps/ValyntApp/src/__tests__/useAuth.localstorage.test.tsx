/**
 * useAuth — localStorage write guard
 *
 * The hook currently writes the serialized user profile to localStorage under
 * the key "manus-runtime-user-info" on every render. This is a security risk:
 * any script on the page can read the full user object, and the data persists
 * across sessions.
 *
 * These tests pin the current (broken) behaviour so the regression is visible.
 * When the localStorage.setItem call is removed from useAuth, the "currently
 * writes" assertions should be deleted and replaced with "does NOT write" checks.
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

  it('currently writes serialized user profile to localStorage (known bug)', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(FAKE_USER));

    renderHook(() => useAuth());

    // Documents the current broken behaviour.
    // This assertion MUST fail once the localStorage.setItem call is removed.
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'manus-runtime-user-info',
      JSON.stringify(FAKE_USER),
    );
  });

  it('writes serialized null to localStorage when user is unauthenticated (known bug)', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(null));

    renderHook(() => useAuth());

    // Even when unauthenticated the hook writes the string "null".
    // After the fix, setItem should never be called with this key.
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'manus-runtime-user-info',
      'null',
    );
  });

  it('does NOT call localStorage.removeItem on unmount (stale data persists — known bug)', () => {
    mockUseQuery.mockReturnValue(makeQueryResult(FAKE_USER));

    const { unmount } = renderHook(() => useAuth());
    vi.clearAllMocks(); // clear the setItem call from render
    unmount();

    // After unmount the key should be cleared, but currently it is not.
    // After the fix, removeItem('manus-runtime-user-info') should be called.
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('manus-runtime-user-info');
  });

  it('returns correct auth state regardless of localStorage side-effect', () => {
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
