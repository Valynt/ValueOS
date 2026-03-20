import { Session } from "@supabase/supabase-js";

import { supabase } from "../supabase";

const NON_SENSITIVE_STATE_KEY = "valynt.auth.state";
const REFRESH_TOKEN_FINGERPRINT_KEY = "valynt.auth.refresh.fingerprint";
const REFRESH_TOKEN_STATUS_RPC = "get_refresh_token_status";
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

  sessionStorage.setItem(NON_SENSITIVE_STATE_KEY, JSON.stringify(state));
};

const hashRefreshToken = async (token: string): Promise<string> => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const digestBytes = Array.from(new Uint8Array(digest));
  const hexDigest = digestBytes
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `sha256-${hexDigest}`;
};

interface RefreshTokenStatusResponse {
  trusted: boolean;
  replayDetected?: boolean;
  revoked?: boolean;
}

const isRefreshTokenStatusResponse = (
  value: unknown,
): value is RefreshTokenStatusResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.trusted === "boolean";
};

const checkRefreshTokenStatusWithBackend = async (
  currentFingerprint: string,
  previousFingerprint: string | null,
  event?: string,
): Promise<RefreshTokenStatusResponse | null> => {
  if (!supabase || !previousFingerprint) {
    return null;
  }

  const { data, error } = await supabase.rpc(REFRESH_TOKEN_STATUS_RPC, {
    current_refresh_token_fingerprint: currentFingerprint,
    previous_refresh_token_fingerprint: previousFingerprint,
    auth_event: event ?? null,
  });

  if (error) {
    return null;
  }

  return isRefreshTokenStatusResponse(data) ? data : null;
};

const getStoredRefreshTokenFingerprint = (): string | null => {
  if (lastRefreshToken) {
    return lastRefreshToken;
  }

  const storedFingerprint = sessionStorage.getItem(
    REFRESH_TOKEN_FINGERPRINT_KEY,
  );
  if (storedFingerprint) {
    lastRefreshToken = storedFingerprint;
  }
  return lastRefreshToken;
};

const clearLocalState = () => {
  sessionStorage.removeItem(NON_SENSITIVE_STATE_KEY);
  localStorage.removeItem("supabase.auth.token");
  sessionStorage.removeItem(REFRESH_TOKEN_FINGERPRINT_KEY);
  lastRefreshToken = null;
};

const handleSignedOut = () => {
  clearLocalState();
};

const handleTokenRefreshed = async (session: Session | null) => {
  if (!(await trackRefreshTokenState(session, "TOKEN_REFRESHED")) || !session) {
    return;
  }

  persistNonSensitiveAuthState(session);
};

const handleUnexpectedRefreshToken = async () => {
  clearLocalState();
  if (supabase) {
    await supabase.auth.signOut();
  }
};

const trackRefreshTokenState = async (
  session: Session | null,
  event?: string,
): Promise<boolean> => {
  if (!session?.refresh_token) {
    sessionStorage.removeItem(REFRESH_TOKEN_FINGERPRINT_KEY);
    lastRefreshToken = null;
    return false;
  }

  const fingerprint = await hashRefreshToken(session.refresh_token);
  const previousFingerprint = getStoredRefreshTokenFingerprint();
  const tokenRotated = Boolean(previousFingerprint && previousFingerprint !== fingerprint);

  if (event === "TOKEN_REFRESHED" && previousFingerprint && previousFingerprint === fingerprint) {
    void handleUnexpectedRefreshToken();
    return false;
  }

  const backendStatus = await checkRefreshTokenStatusWithBackend(
    fingerprint,
    previousFingerprint,
    event,
  );

  if (backendStatus && (!backendStatus.trusted || backendStatus.replayDetected || backendStatus.revoked)) {
    void handleUnexpectedRefreshToken();
    return false;
  }

  // Client fingerprinting is telemetry only: do not force sign-out solely due to
  // local rotation detection because legitimate refresh and sign-in flows rotate tokens.
  void tokenRotated;

  lastRefreshToken = fingerprint;
  sessionStorage.setItem(REFRESH_TOKEN_FINGERPRINT_KEY, fingerprint);
  return true;
};

const handleAuthStateChange = async (event: string, session: Session | null) => {
  if (event === "SIGNED_OUT") {
    handleSignedOut();
    return;
  }

  if (event === "TOKEN_REFRESHED") {
    await handleTokenRefreshed(session);
    return;
  }

  const isTracked = await trackRefreshTokenState(session, event);
  if (!isTracked || !session) {
    return;
  }

  persistNonSensitiveAuthState(session);
};

export const secureTokenManager = {
  initialize: async () => {
    // Session tokens are expected to be stored and managed via HttpOnly secure cookies.
    // Client-side storage is limited to non-sensitive state only.
    if (!supabase || authSubscription) {
      return;
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthStateChange(event, session);
    });

    authSubscription = data.subscription;
  },
  getStoredSession: (): Session | null => {
    // Read the Supabase-managed session from localStorage for optimistic UI restore.
    // This prevents ProtectedRoute from redirecting to /login during the async
    // getCurrentSession() background check. The session is validated server-side
    // by getCurrentSession() immediately after — this is only for unblocking the UI.
    try {
      const keys = Object.keys(localStorage);
      const sbKey = keys.find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (!sbKey) return null;
      const raw = localStorage.getItem(sbKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { access_token?: string; user?: unknown };
      if (parsed?.access_token && parsed?.user) {
        return parsed as unknown as Session;
      }
    } catch {
      // localStorage unavailable or malformed — fall through
    }
    return null;
  },
  storeSession: async (session: Session) => {
    if (!(await trackRefreshTokenState(session, "SIGNED_IN"))) {
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

    if (!(await trackRefreshTokenState(data.session, "INITIAL_SESSION"))) {
      return null;
    }

    return data.session;
  },
};
