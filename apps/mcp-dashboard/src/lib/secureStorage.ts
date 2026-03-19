/**
 * Legacy browser auth storage cleanup.
 *
 * Browser authentication is now managed exclusively through server-issued
 * HttpOnly cookies. This utility exists only to invalidate pre-migration
 * `secure_auth_data` entries and force re-authentication on first load.
 */

class SecureTokenStorage {
  private readonly storageKey = "secure_auth_data";
  private readonly migrationFlagKey = "secure_auth_data_migrated";

  private removeLegacyEntries(): boolean {
    let removed = false;

    try {
      removed = localStorage.getItem(this.storageKey) !== null || removed;
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error("Failed to clear legacy auth data from localStorage");
    }

    try {
      removed = sessionStorage.getItem(this.storageKey) !== null || removed;
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error("Failed to clear legacy auth data from sessionStorage");
    }

    return removed;
  }

  invalidateLegacyStorageOnLoad(): boolean {
    try {
      if (localStorage.getItem(this.migrationFlagKey) === "true") {
        return false;
      }
    } catch (error) {
      console.error("Failed to read auth storage migration flag");
    }

    const removedLegacyData = this.removeLegacyEntries();

    try {
      localStorage.setItem(this.migrationFlagKey, "true");
    } catch (error) {
      console.error("Failed to persist auth storage migration flag");
    }

    return removedLegacyData;
  }

  clearToken(): void {
    this.removeLegacyEntries();
  }

  hasValidToken(): boolean {
    return false;
  }

  getAccessToken(): string | null {
    return null;
  }

  getRefreshToken(): string | null {
    return null;
  }

  setToken(): void {
    console.warn("Client-side token storage is disabled; browser auth uses HttpOnly cookies.");
  }

  updateToken(): void {
    console.warn("Client-side token storage is disabled; browser auth uses HttpOnly cookies.");
  }
}

export const secureTokenStorage = new SecureTokenStorage();
