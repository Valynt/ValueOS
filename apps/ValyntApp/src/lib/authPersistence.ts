/**
 * Authentication State Persistence with Encryption
 * Provides secure, encrypted persistence for authentication state
 */

import { secureTokenStorage } from "./secureStorage";
import { sessionManager } from "./sessionManager";

interface PersistedAuthState extends Record<string, unknown> {
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    preferences?: Record<string, unknown>;
  };
  session: {
    expiresAt: number;
    lastActivity: number;
    isActive: boolean;
  };
  security: {
    loginMethod: "password" | "oauth" | "sso";
    mfaVerified: boolean;
    deviceFingerprint: string;
  };
  metadata: {
    version: string;
    timestamp: number;
    checksum?: string;
  };
}

class AuthPersistence {
  private readonly persistenceKey = "auth_state_persistence";
  private readonly currentVersion = "1.0.0";
  private readonly maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Generate device fingerprint for additional security
   */
  private generateDeviceFingerprint(): string {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Device fingerprint", 2, 2);
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency,
      (navigator as any).deviceMemory || "unknown",
    ].join("|");

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Generate checksum for data integrity verification
   */
  private generateChecksum(data: Record<string, unknown>): string {
    const serialized = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Validate data integrity using checksum
   */
  private validateChecksum(data: PersistedAuthState): boolean {
    const dataCopy = JSON.parse(JSON.stringify(data)) as PersistedAuthState;
    if (dataCopy.metadata.checksum) {
      delete dataCopy.metadata.checksum;
    }
    const expectedChecksum = this.generateChecksum(dataCopy);
    return data.metadata.checksum === expectedChecksum;
  }

  /**
   * Check if persisted data is too old
   */
  private isExpired(data: PersistedAuthState): boolean {
    return Date.now() - data.metadata.timestamp > this.maxAge;
  }

  /**
   * Check if session is still valid
   */
  private isSessionValid(data: PersistedAuthState): boolean {
    return data.session.isActive && data.session.expiresAt > Date.now();
  }

  /**
   * Persist authentication state securely
   */
  async persistAuthState(user: any, session: any, loginMethod: string = "password"): Promise<void> {
    try {
      const authState: PersistedAuthState = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.user_metadata?.full_name,
          role: user.role || user.user_metadata?.roles?.[0],
          preferences: user.preferences || {},
        },
        session: {
          expiresAt: session.expires_at || Date.now() + 60 * 60 * 1000,
          lastActivity: Date.now(),
          isActive: true,
        },
        security: {
          loginMethod: loginMethod as any,
          mfaVerified: user.mfa_verified || false,
          deviceFingerprint: this.generateDeviceFingerprint(),
        },
        metadata: {
          version: this.currentVersion,
          timestamp: Date.now(),
          checksum: "", // Will be set below
        },
      };

      // Generate checksum for integrity
      authState.metadata.checksum = this.generateChecksum(authState);

      // Store the encrypted state
      const serialized = JSON.stringify(authState);
      const encrypted = await this.encryptData(serialized);

      localStorage.setItem(this.persistenceKey, encrypted);

      // Start session management
      sessionManager.startSession(authState.session.expiresAt);
    } catch (error) {
      console.error("Failed to persist auth state:", error);
      throw new Error("Failed to save authentication state");
    }
  }

  /**
   * Simple encryption for persistence data
   */
  private async encryptData(data: string): Promise<string> {
    // In production, use proper encryption like Web Crypto API
    // For now, use basic obfuscation
    const fingerprint = this.generateDeviceFingerprint();
    let encrypted = "";

    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ fingerprint.charCodeAt(i % fingerprint.length);
      encrypted += String.fromCharCode(charCode);
    }

    return btoa(encrypted);
  }

  /**
   * Simple decryption for persistence data
   */
  private async decryptData(encryptedData: string): Promise<string> {
    try {
      const fingerprint = this.generateDeviceFingerprint();
      const decoded = atob(encryptedData);
      let decrypted = "";

      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ fingerprint.charCodeAt(i % fingerprint.length);
        decrypted += String.fromCharCode(charCode);
      }

      return decrypted;
    } catch (error) {
      throw new Error("Failed to decrypt authentication state");
    }
  }

  /**
   * Retrieve and validate persisted authentication state
   */
  async retrieveAuthState(): Promise<PersistedAuthState | null> {
    try {
      const encryptedData = localStorage.getItem(this.persistenceKey);
      if (!encryptedData) {
        return null;
      }

      const decryptedData = await this.decryptData(encryptedData);
      const authState = JSON.parse(decryptedData) as PersistedAuthState;

      // Validate version compatibility
      if (authState.metadata.version !== this.currentVersion) {
        console.warn("Auth state version mismatch, clearing persisted data");
        this.clearAuthState();
        return null;
      }

      // Validate data integrity
      if (!this.validateChecksum(authState)) {
        console.warn("Auth state checksum validation failed, clearing persisted data");
        this.clearAuthState();
        return null;
      }

      // Check if data is expired
      if (this.isExpired(authState)) {
        console.info("Auth state expired, clearing persisted data");
        this.clearAuthState();
        return null;
      }

      // Check if session is still valid
      if (!this.isSessionValid(authState)) {
        console.info("Auth session expired, clearing persisted data");
        this.clearAuthState();
        return null;
      }

      // Validate device fingerprint for security
      const currentFingerprint = this.generateDeviceFingerprint();
      if (authState.security.deviceFingerprint !== currentFingerprint) {
        console.warn("Device fingerprint mismatch, possible security issue");
        // In production, you might want to require re-authentication
        // For now, we'll clear the state
        this.clearAuthState();
        return null;
      }

      // Update last activity
      authState.session.lastActivity = Date.now();
      await this.updateAuthState(authState);

      return authState;
    } catch (error) {
      console.error("Failed to retrieve auth state:", error);
      this.clearAuthState();
      return null;
    }
  }

  /**
   * Update existing auth state
   */
  private async updateAuthState(authState: PersistedAuthState): Promise<void> {
    try {
      authState.metadata.timestamp = Date.now();
      authState.metadata.checksum = this.generateChecksum(authState);

      const serialized = JSON.stringify(authState);
      const encrypted = await this.encryptData(serialized);

      localStorage.setItem(this.persistenceKey, encrypted);
    } catch (error) {
      console.error("Failed to update auth state:", error);
    }
  }

  /**
   * Clear persisted authentication state
   */
  clearAuthState(): void {
    try {
      localStorage.removeItem(this.persistenceKey);
      sessionManager.cleanup();
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    }
  }

  /**
   * Check if valid auth state exists
   */
  async hasValidAuthState(): Promise<boolean> {
    const state = await this.retrieveAuthState();
    return state !== null;
  }

  /**
   * Get auth state summary (non-sensitive)
   */
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
      loginMethod: state.security.loginMethod,
    };
  }
}

// Export singleton instance
export const authPersistence = new AuthPersistence();
