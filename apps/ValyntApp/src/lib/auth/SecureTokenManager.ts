// Stub SecureTokenManager for development
import { Session } from "@supabase/supabase-js";

export const secureTokenManager = {
  initialize: async () => {
    console.log("SecureTokenManager initialized");
  },
  getStoredSession: (): Session | null => {
    try {
      const stored = localStorage.getItem("supabase.auth.token");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  storeSession: (session: Session) => {
    localStorage.setItem("supabase.auth.token", JSON.stringify(session));
  },
  clearSessionStorage: () => {
    localStorage.removeItem("supabase.auth.token");
  },
  getCurrentSession: async (): Promise<Session | null> => {
    return secureTokenManager.getStoredSession();
  },
};
