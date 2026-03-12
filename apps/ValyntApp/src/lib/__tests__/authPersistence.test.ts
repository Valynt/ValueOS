/**
 * authPersistence — unit tests
 *
 * Verifies that PII fields are not written to localStorage and that the
 * persist/retrieve round-trip works correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartSession = vi.fn();
const mockCleanup = vi.fn();

vi.mock('../sessionManager', () => ({
  sessionManager: {
    startSession: mockStartSession,
    cleanup: mockCleanup,
  },
}));

// jsdom provides localStorage; reset between tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { authPersistence } from '../authPersistence';

describe('authPersistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('persistAuthState', () => {
    it('stores only user.id — no email, name, or role', async () => {
      await authPersistence.persistAuthState(
        { id: 'user-123', email: 'secret@example.com', name: 'Alice', role: 'admin' } as never,
        { expires_at: Date.now() + 3600_000 },
      );

      const raw = localStorageMock.getItem('auth_state_persistence');
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.user.id).toBe('user-123');
      expect(parsed.user.email).toBeUndefined();
      expect(parsed.user.name).toBeUndefined();
      expect(parsed.user.role).toBeUndefined();
    });

    it('calls sessionManager.startSession with the expiry', async () => {
      const expiresAt = Date.now() + 3600_000;
      await authPersistence.persistAuthState({ id: 'u1' }, { expires_at: expiresAt });
      expect(mockStartSession).toHaveBeenCalledWith(expiresAt);
    });
  });

  describe('retrieveAuthState', () => {
    it('returns null when nothing is stored', async () => {
      expect(await authPersistence.retrieveAuthState()).toBeNull();
    });

    it('returns the state after a valid persist', async () => {
      await authPersistence.persistAuthState({ id: 'u2' }, { expires_at: Date.now() + 3600_000 });
      const state = await authPersistence.retrieveAuthState();
      expect(state).not.toBeNull();
      expect(state?.user.id).toBe('u2');
    });

    it('clears and returns null when the session is expired', async () => {
      await authPersistence.persistAuthState({ id: 'u3' }, { expires_at: Date.now() - 1 });
      expect(await authPersistence.retrieveAuthState()).toBeNull();
      expect(localStorageMock.getItem('auth_state_persistence')).toBeNull();
    });
  });

  describe('getAuthStateSummary', () => {
    it('does not expose email in the summary', async () => {
      await authPersistence.persistAuthState({ id: 'u4' }, { expires_at: Date.now() + 3600_000 });
      const summary = await authPersistence.getAuthStateSummary();
      expect(summary.isAuthenticated).toBe(true);
      expect(summary.userId).toBe('u4');
      expect((summary as Record<string, unknown>)['email']).toBeUndefined();
    });
  });
});
