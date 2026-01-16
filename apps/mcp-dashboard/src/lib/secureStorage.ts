/**
 * Secure Token Storage with Encryption
 * Provides encrypted storage for authentication tokens and session data
 */

interface StorageData {
  token: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
}

class SecureTokenStorage {
  private readonly encryptionKey: string;
  private readonly storageKey = "secure_auth_data";

  constructor() {
    // Generate a deterministic key based on browser fingerprint
    this.encryptionKey = this.generateEncryptionKey();
  }

  /**
   * Generate a deterministic encryption key from browser fingerprint
   */
  private generateEncryptionKey(): string {
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      // Add more entropy factors as needed
    ].join("|");

    // Simple hash function - in production, use a proper crypto library
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16).padStart(8, "0");
  }

  /**
   * Simple XOR encryption - in production, use proper AES encryption
   */
  private encrypt(data: string): string {
    let encrypted = "";
    const key = this.encryptionKey;

    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode);
    }

    return btoa(encrypted);
  }

  /**
   * Simple XOR decryption - in production, use proper AES decryption
   */
  private decrypt(encryptedData: string): string {
    try {
      const decoded = atob(encryptedData);
      let decrypted = "";
      const key = this.encryptionKey;

      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        decrypted += String.fromCharCode(charCode);
      }

      return decrypted;
    } catch (error) {
      console.error("Failed to decrypt data");
      return "";
    }
  }

  /**
   * Store authentication data securely
   */
  setToken(data: StorageData): void {
    try {
      const serialized = JSON.stringify(data);
      const encrypted = this.encrypt(serialized);
      localStorage.setItem(this.storageKey, encrypted);
    } catch (error) {
      console.error("Failed to store token securely");
      // Fallback to sessionStorage if localStorage fails
      try {
        sessionStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (sessionError) {
        console.error("Failed to store token in sessionStorage");
      }
    }
  }

  /**
   * Retrieve authentication data securely
   */
  getToken(): StorageData | null {
    try {
      const encrypted = localStorage.getItem(this.storageKey);
      if (encrypted) {
        const decrypted = this.decrypt(encrypted);
        const data = JSON.parse(decrypted) as StorageData;

        // Check if token has expired
        if (data.expiresAt < Date.now()) {
          this.clearToken();
          return null;
        }

        return data;
      }
    } catch (error) {
      console.error("Failed to retrieve token securely");
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
      console.error("Failed to retrieve token from sessionStorage");
    }

    return null;
  }

  /**
   * Clear stored authentication data
   */
  clearToken(): void {
    try {
      localStorage.removeItem(this.storageKey);
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error("Failed to clear token");
    }
  }

  /**
   * Check if valid token exists
   */
  hasValidToken(): boolean {
    const data = this.getToken();
    return data !== null && data.expiresAt > Date.now();
  }

  /**
   * Get access token only
   */
  getAccessToken(): string | null {
    const data = this.getToken();
    return data?.token || null;
  }

  /**
   * Get refresh token only
   */
  getRefreshToken(): string | null {
    const data = this.getToken();
    return data?.refreshToken || null;
  }

  /**
   * Update token with new expiration
   */
  updateToken(token: string, expiresAt: number): void {
    const currentData = this.getToken();
    if (currentData) {
      this.setToken({
        ...currentData,
        token,
        expiresAt,
      });
    }
  }
}

// Export singleton instance
export const secureTokenStorage = new SecureTokenStorage();
