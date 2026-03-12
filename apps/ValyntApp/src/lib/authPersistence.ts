/**
 * Authentication state persistence.
 *
 * Session secrets remain server-managed; only lightweight UI metadata is persisted.
 */

import { sessionManager } from "./sessionManager";

interface PersistedAuthState {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  session: {
    expiresAt: number;
    isActive: boolean;
  };
  metadata: {
    version: string;
    timestamp: number;
  };
}

class AuthPersistence {
  private readonly persistenceKey = "auth_state_persistence";
  private readonly currentVersion = "2.0.0";
  private readonly maxAge = 24 * 60 * 60 * 1000;

  private isExpired(data: PersistedAuthState): boolean {
    return Date.now() - data.metadata.timestamp > this.maxAge;
  }

  private isSessionValid(data: PersistedAuthState): boolean {
    return data.session.isActive && data.session.expiresAt > Date.now();
  }

  async persistAuthState(user: any, session: any): Promise<void> {
    const authState: PersistedAuthState = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.user_metadata?.full_name,
        role: user.role || user.user_metadata?.roles?.[0],
      },
      session: {
        expiresAt: session.expires_at || Date.now() + 60 * 60 * 1000,
        isActive: true,
      },
      metadata: {
        version: this.currentVersion,
        timestamp: Date.now(),
      },
    };

    localStorage.setItem(this.persistenceKey, JSON.stringify(authState));
    sessionManager.startSession(authState.session.expiresAt);
  }

  async retrieveAuthState(): Promise<PersistedAuthState | null> {
    const serializedState = localStorage.getItem(this.persistenceKey);
    if (!serializedState) {
      return null;
    }

    try {
      const authState = JSON.parse(serializedState) as PersistedAuthState;

      if (authState.metadata.version !== this.currentVersion || this.isExpired(authState) || !this.isSessionValid(authState)) {
        this.clearAuthState();
        return null;
      }

      return authState;
    } catch {
      this.clearAuthState();
      return null;
    }
  }

  clearAuthState(): void {
    localStorage.removeItem(this.persistenceKey);
    sessionManager.cleanup();
  }

  async updateActivity(): Promise<void> {
    const state = await this.retrieveAuthState();
    if (!state) {
      return;
    }

    state.metadata.timestamp = Date.now();
    localStorage.setItem(this.persistenceKey, JSON.stringify(state));
  }

  async isAuthenticated(): Promise<boolean> {
    const state = await this.retrieveAuthState();
    return state !== null;
  }

  async getAuthStateSummary(): Promise<{
    isAuthenticated: boolean;
    userId?: string;
    email?: string;
    expiresAt?: number;
    loginMethod?: string;
  }> {
    const state = await this.retrieveAuthState();

    if (!state) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      userId: state.user.id,
      email: state.user.email,
      expiresAt: state.session.expiresAt,
      loginMethod: "session-cookie",
    };
  }
}

export const authPersistence = new AuthPersistence();
