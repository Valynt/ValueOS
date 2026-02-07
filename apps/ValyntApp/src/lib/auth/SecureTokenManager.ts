import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

const NON_SENSITIVE_STATE_KEY = "valynt.auth.state";
let lastRefreshToken: string | null = null;
let authStateSubscription: { unsubscribe: () => void } | null = null;
let isInvalidatingSession = false;

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

const hashRefreshToken = (refreshToken: string): string => {
  let hash = 0;
  for (let index = 0; index < refreshToken.length; index += 1) {
    hash = (hash << 5) - hash + refreshToken.charCodeAt(index);
    hash |= 0;
  }
  return `rt:${Math.abs(hash)}`;
};

const clearLocalState = () => {
  localStorage.removeItem(NON_SENSITIVE_STATE_KEY);
  localStorage.removeItem("supabase.auth.token");
  lastRefreshToken = null;
};

const invalidateSession = async () => {
  if (!supabase || isInvalidatingSession) {
    return;
  }

  isInvalidatingSession = true;
  clearLocalState();
  try {
    await supabase.auth.signOut();
  } finally {
    isInvalidatingSession = false;
  }
};

const evaluateRefreshToken = (
  session: Session | null,
  options: { allowRotation: boolean; expectRotation?: boolean },
): boolean => {
  const refreshToken = session?.refresh_token;
  if (!refreshToken) {
    lastRefreshToken = null;
    return false;
  }

  const fingerprint = hashRefreshToken(refreshToken);
  const hasPrevious = Boolean(lastRefreshToken);

  if (options.expectRotation && hasPrevious && fingerprint === lastRefreshToken) {
    void invalidateSession();
    return false;
  }

  if (!options.allowRotation && hasPrevious && fingerprint !== lastRefreshToken) {
    void invalidateSession();
    return false;
  }

  lastRefreshToken = fingerprint;
  return true;
};

export const secureTokenManager = {
  initialize: async () => {
    // Session tokens are expected to be stored and managed via HttpOnly secure cookies.
    // Client-side storage is limited to non-sensitive state only.
    if (!supabase || authStateSubscription) {
      return;
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearLocalState();
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        evaluateRefreshToken(session, { allowRotation: true, expectRotation: true });
        return;
      }

      evaluateRefreshToken(session, { allowRotation: false });
    });

    authStateSubscription = data?.subscription ?? null;
  },
  getStoredSession: (): Session | null => {
    // Never deserialize session tokens from localStorage.
    return null;
  },
  storeSession: (session: Session) => {
    if (!evaluateRefreshToken(session, { allowRotation: false })) {
      clearLocalState();
      return;
    }
    // Persist only non-sensitive session metadata for UI convenience.
    persistNonSensitiveAuthState(session);
  },
  clearSessionStorage: () => {
    clearLocalState();
  },
  getCurrentSession: async (): Promise<Session | null> => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }

    if (!evaluateRefreshToken(data.session, { allowRotation: false })) {
      return null;
    }

    return data.session;
  },
};
