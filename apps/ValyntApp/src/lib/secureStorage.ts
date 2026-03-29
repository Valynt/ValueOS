/**
 * Secure Token Storage with Encryption
 * Provides encrypted storage for authentication tokens and session data
 */

import { logger } from "@/lib/logger";

interface StorageData {
  token: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
}

class SecureTokenStorage {
  private encryptionKey: CryptoKey | null = null;
  private readonly storageKey = "secure_auth_data";
  private readonly saltKey = "secure_auth_salt";
  private salt: Uint8Array;

  constructor() {
    // Restore or generate salt for consistent key derivation
    const storedSalt = localStorage.getItem(this.saltKey);
    if (storedSalt) {
      try {
        this.salt = new Uint8Array(
          atob(storedSalt).split("").map((c) => c.charCodeAt(0))
        );
      } catch {
        // Invalid stored salt, generate new one
        this.salt = this.generateAndStoreSalt();
      }
    } else {
      this.salt = this.generateAndStoreSalt();
    }
  }

  private generateAndStoreSalt(): Uint8Array {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    localStorage.setItem(this.saltKey, btoa(String.fromCharCode(...salt)));
    return salt;
  }

  /**
   * Generate a cryptographic key from browser fingerprint using PBKDF2
   */
  private async generateEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      // Add more entropy factors as needed
    ].join("|");

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(fingerprint),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: this.salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    return this.encryptionKey;
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encrypt(data: string): Promise<string> {
    const key = await this.generateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      new TextEncoder().encode(data)
    );

    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decrypt(encryptedData: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const key = await this.generateEncryptionKey();
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      logger.error("Failed to decrypt data", error);
      return "";
    }
  }

  /**
   * Store authentication data securely
   */
  async setToken(data: StorageData): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      const encrypted = await this.encrypt(serialized);
      localStorage.setItem(this.storageKey, encrypted);
    } catch (error) {
      logger.error("Failed to store token securely", error);
      // Fallback to sessionStorage if localStorage fails
      try {
        sessionStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (sessionError) {
        logger.error("Failed to store token in sessionStorage", sessionError);
      }
    }
  }

  /**
   * Retrieve authentication data securely
   */
  async getToken(): Promise<StorageData | null> {
    try {
      const encrypted = localStorage.getItem(this.storageKey);
      if (encrypted) {
        const decrypted = await this.decrypt(encrypted);
        const data = JSON.parse(decrypted) as StorageData;

        // Check if token has expired
        if (data.expiresAt < Date.now()) {
          this.clearToken();
          return null;
        }

        return data;
      }
    } catch (error) {
      logger.error("Failed to retrieve token securely", error);
    }

    // Fallback to sessionStorage
    try {
      const fallback = sessionStorage.getItem(this.storageKey);
      if (fallback) {
        const data = JSON.parse(fallback) as StorageData;

        if (data.expiresAt < Date.now()) {
          this.clearToken();
          return null;
        }

        return data;
      }
    } catch (error) {
      logger.error("Failed to retrieve token from sessionStorage", error);
    }

    return null;
  }

  /**
   * Clear stored authentication data
   */
  async clearToken(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      logger.error("Failed to clear token", error);
    }
  }

  /**
   * Check if valid token exists
   */
  async hasValidToken(): Promise<boolean> {
    const data = await this.getToken();
    return data !== null && data.expiresAt > Date.now();
  }

  /**
   * Get access token only
   */
  async getAccessToken(): Promise<string | null> {
    const data = await this.getToken();
    return data?.token || null;
  }

  /**
   * Get refresh token only
   */
  async getRefreshToken(): Promise<string | null> {
    const data = await this.getToken();
    return data?.refreshToken || null;
  }

  /**
   * Update token with new expiration
   */
  async updateToken(token: string, expiresAt: number): Promise<void> {
    const currentData = await this.getToken();
    if (currentData) {
      await this.setToken({
        ...currentData,
        token,
        expiresAt,
      });
    }
  }
}

// Export singleton instance
export const secureTokenStorage = new SecureTokenStorage();
