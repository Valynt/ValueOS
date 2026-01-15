const STORAGE_PREFIX = "valynt_";

export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      if (item === null) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue ?? null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error("[Storage] Failed to set item:", error);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (error) {
      console.error("[Storage] Failed to remove item:", error);
    }
  },

  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (error) {
      console.error("[Storage] Failed to clear storage:", error);
    }
  },
};

export const sessionStorage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = window.sessionStorage.getItem(STORAGE_PREFIX + key);
      if (item === null) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue ?? null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error("[SessionStorage] Failed to set item:", error);
    }
  },

  remove(key: string): void {
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch (error) {
      console.error("[SessionStorage] Failed to remove item:", error);
    }
  },

  clear(): void {
    try {
      const keys = Object.keys(window.sessionStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
      keys.forEach((k) => window.sessionStorage.removeItem(k));
    } catch (error) {
      console.error("[SessionStorage] Failed to clear storage:", error);
    }
  },
};

// Storage keys constants
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_PREFERENCES: "user_preferences",
  THEME: "theme",
  SIDEBAR_COLLAPSED: "sidebar_collapsed",
  RECENT_PROJECTS: "recent_projects",
  ONBOARDING_COMPLETED: "onboarding_completed",
} as const;
