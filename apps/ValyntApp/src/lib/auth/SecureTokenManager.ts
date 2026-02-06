import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

const NON_SENSITIVE_STATE_KEY = "valynt.auth.state";

interface NonSensitiveAuthState {
  userId: string;
  email?: string;
  expiresAt?: number;
}

const persistNonSensitiveAuthState = (session: Session) => {
  const state: NonSensitiveAuthState = {
    userId: session.user.id,
    email: session.user.email,
    expiresAt: session.expires_at,
  };

  localStorage.setItem(NON_SENSITIVE_STATE_KEY, JSON.stringify(state));
};

export const secureTokenManager = {
  initialize: async () => {
    // Session tokens are expected to be stored and managed via HttpOnly secure cookies.
    // Client-side storage is limited to non-sensitive state only.
  },
  getStoredSession: (): Session | null => {
    // Never deserialize session tokens from localStorage.
    return null;
  },
  storeSession: (session: Session) => {
    // Persist only non-sensitive session metadata for UI convenience.
    persistNonSensitiveAuthState(session);
  },
  clearSessionStorage: () => {
    localStorage.removeItem(NON_SENSITIVE_STATE_KEY);
    localStorage.removeItem("supabase.auth.token");
  },
  getCurrentSession: async (): Promise<Session | null> => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }

    return data.session;
  },
};
