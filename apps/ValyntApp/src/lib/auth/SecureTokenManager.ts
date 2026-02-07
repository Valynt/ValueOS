import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

const NON_SENSITIVE_STATE_KEY = "valynt.auth.state";
const REFRESH_TOKEN_FINGERPRINT_KEY = "valynt.auth.refresh.fingerprint";
let lastRefreshToken: string | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

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

const hashRefreshToken = (token: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
};

const getStoredRefreshTokenFingerprint = (): string | null => {
  if (lastRefreshToken) {
    return lastRefreshToken;
  }

  const storedFingerprint = localStorage.getItem(REFRESH_TOKEN_FINGERPRINT_KEY);
  if (storedFingerprint) {
    lastRefreshToken = storedFingerprint;
  }
  return lastRefreshToken;
};

const clearLocalState = () => {
  localStorage.removeItem(NON_SENSITIVE_STATE_KEY);
  localStorage.removeItem("supabase.auth.token");
  localStorage.removeItem(REFRESH_TOKEN_FINGERPRINT_KEY);
  lastRefreshToken = null;
};

const handleUnexpectedRefreshToken = async () => {
  clearLocalState();
  if (supabase) {
    await supabase.auth.signOut();
  }
};

const trackRefreshTokenState = (
  session: Session | null,
  event?: string,
): boolean => {
  if (!session?.refresh_token) {
    localStorage.removeItem(REFRESH_TOKEN_FINGERPRINT_KEY);
    lastRefreshToken = null;
    return false;
  }

  const fingerprint = hashRefreshToken(session.refresh_token);
  const previousFingerprint = getStoredRefreshTokenFingerprint();
  const tokenRotated =
    Boolean(previousFingerprint) && previousFingerprint !== fingerprint;
  const rotationAllowedEvents = new Set([
    "SIGNED_IN",
    "INITIAL_SESSION",
    "TOKEN_REFRESHED",
  ]);
  const isRotationAllowed = !event || rotationAllowedEvents.has(event);

  if (previousFingerprint) {
    if (event === "TOKEN_REFRESHED" && !tokenRotated) {
      void handleUnexpectedRefreshToken();
      return false;
    }

    if (!isRotationAllowed && tokenRotated) {
      void handleUnexpectedRefreshToken();
      return false;
    }
  }

  lastRefreshToken = fingerprint;
  localStorage.setItem(REFRESH_TOKEN_FINGERPRINT_KEY, fingerprint);
  return true;
};

export const secureTokenManager = {
  initialize: async () => {
    // Session tokens are expected to be stored and managed via HttpOnly secure cookies.
    // Client-side storage is limited to non-sensitive state only.
    if (!supabase || authSubscription) {
      return;
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearLocalState();
        return;
      }

      const isTracked = trackRefreshTokenState(session, event);
      if (!isTracked || !session) {
        return;
      }

      persistNonSensitiveAuthState(session);
    });

    authSubscription = data.subscription;
  },
  getStoredSession: (): Session | null => {
    // Never deserialize session tokens from localStorage.
    return null;
  },
  storeSession: (session: Session) => {
    if (!trackRefreshTokenState(session, "SIGNED_IN")) {
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

    if (!trackRefreshTokenState(data.session, "INITIAL_SESSION")) {
      return null;
    }

    return data.session;
  },
};
