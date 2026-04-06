/**
 * Auth Context
 * Provides authentication state and methods throughout the app
 */

import { Session, User } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";


import { analyticsClient } from "../lib/analyticsClient";
import { secureTokenManager } from "../lib/auth/SecureTokenManager";
import { getSupabaseConfig } from "../lib/env";
import { createLogger } from "../lib/logger";
import { AuthRateLimitError, parseAuthLockoutMetadata } from "../lib/rateLimiter";
import { supabase } from "../lib/supabase";
import { computePermissions, UserClaims } from "../types/security";

import { apiClient } from "@/api/client/unified-api-client";

const logger = createLogger({ component: "AuthContext" });

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  email: string;
  password: string;
  fullName?: string;
}

interface AuthSession {
  user: User;
  session: Session | null;
  requiresEmailVerification: boolean;
}

const getUserRoles = (user: User): string[] => {
  if (
    user?.user_metadata?.roles &&
    Array.isArray(user.user_metadata.roles) &&
    user.user_metadata.roles.every((role: unknown) => typeof role === "string")
  ) {
    return user.user_metadata.roles as string[];
  }
  // Default to "member" — aligns with backend canonical role model (admin | member | viewer)
  return ["member"];
};

const getUserOrgId = (user: User): string => {
  if (user?.user_metadata?.org_id && typeof user.user_metadata.org_id === "string") {
    return user.user_metadata.org_id;
  }
  return "default";
};

const computeUserClaims = (user: User): UserClaims => {
  return {
    sub: user.id,
    email: user.email || "",
    roles: getUserRoles(user),
    permissions: computePermissions(getUserRoles(user)),
    org_id: getUserOrgId(user),
  };
};

const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userClaims, setUserClaims] = useState<UserClaims | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Validate Supabase configuration first
        const supabaseConfig = getSupabaseConfig();
        if (!supabaseConfig.url || !supabaseConfig.anonKey) {
          logger.error("Supabase configuration missing", undefined, {
            hasUrl: !!supabaseConfig.url,
            hasAnonKey: !!supabaseConfig.anonKey,
          });
          setLoading(false);
          return;
        }

        logger.debug("Supabase configuration validated");

        // OPTIMIZATION: Optimistically restore session from synchronous storage
        // This prevents blocking the UI render for unauthenticated users
        const storedSession = secureTokenManager.getStoredSession();

        if (storedSession) {
          setSession(storedSession);
          setUser(storedSession.user);
          setUserClaims(computeUserClaims(storedSession.user));
          logger.debug("Session optimistically restored from storage");
        } else {
          // No session found, likely unauthenticated.
          // We can stop loading immediately to show the Login page.
          logger.debug("No session found in storage, assuming unauthenticated");
        }

        // Unblock the UI immediately
        setLoading(false);

        // Continue with heavy async initialization in the background
        initializeBackgroundAuth();
      } catch (error) {
        logger.error("Failed to initialize auth", error as Error);
        setLoading(false);
      }
    };

    const initializeBackgroundAuth = async () => {
      try {
        // Initialize secure token manager (network calls)
        await secureTokenManager.initialize();

        // Get authoritative session from secure token manager
        const session = await secureTokenManager.getCurrentSession();

        if (session) {
          setSession(session);
          setUser(session.user);
          setUserClaims(computeUserClaims(session.user));

          analyticsClient.identify(session.user.id, {
            email: session.user.email,
            created_at: session.user.created_at,
          });
          analyticsClient.track("user_session_restored", {
            workflow: "activation",
            session_age:
              Date.now() -
              (session.user.created_at ? new Date(session.user.created_at).getTime() : Date.now()),
          });
          logger.info("Session validated via secure token manager");
        } else if (secureTokenManager.getStoredSession()) {
          // If we had an optimistic session but the background check failed (e.g. token expired remotely and refresh failed)
          // We should clear the state and redirect to login
          logger.warn("Optimistic session invalid, clearing state");
          setUser(null);
          setUserClaims(null);
          setSession(null);
          secureTokenManager.clearSessionStorage();
        }
      } catch (error) {
        logger.error("Background auth initialization failed", error as Error);
      }
    };

    initAuth();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (session?.access_token) {
      apiClient.setAuthToken(session.access_token);
      return;
    }

    apiClient.clearAuthToken();
  }, [session]);

  // Listen for auth state changes
  useEffect(() => {
    // Skip auth state listener if Supabase is not configured
    const supabaseConfig = getSupabaseConfig();
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      return;
    }

    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, newSession: Session | null) => {
      logger.debug("Auth state changed", { event });

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Update UserClaims
      if (newSession?.user) {
        setUserClaims(computeUserClaims(newSession.user));
      } else {
        setUserClaims(null);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setUserClaims(null);
        setSession(null);
        secureTokenManager.clearSessionStorage();
      } else if (newSession) {
        // Store session securely on sign in
        secureTokenManager.storeSession(newSession);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    setUser,
    userClaims,
    setUserClaims,
    session,
    setSession,
    loading,
    setLoading,
  };
};

const useAuthMethods = ({
  setUser,
  setUserClaims,
  setSession,
}: {
  setUser: (user: User | null) => void;
  setUserClaims: (claims: UserClaims | null) => void;
  setSession: (session: Session | null) => void;
}) => {
  const login = async (credentials: LoginCredentials) => {
    const loginLogger = (msg: string, data?: Record<string, unknown>) => {
      const timestamp = new Date().toISOString();
      logger.info(`[Auth ${timestamp}] ${msg}`, data || "");
      logger.debug(msg, data);
    };

    loginLogger("🔐 Login attempt started", { email: credentials.email });

    // Input validation
    if (!credentials.email || !credentials.password) {
      loginLogger("❌ Validation failed: missing credentials");
      throw new Error("Email and password are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      loginLogger("❌ Validation failed: invalid email format");
      throw new Error("Please enter a valid email address");
    }

    if (credentials.password.length < 8) {
      loginLogger("❌ Validation failed: password too short");
      throw new Error("Password must be at least 8 characters long");
    }

    if (credentials.password.length > 72) {
      loginLogger("❌ Validation failed: password too long");
      throw new Error("Password exceeds maximum length");
    }

    loginLogger("✓ Input validation passed");

    if (!supabase) {
      loginLogger("❌ Supabase client not initialized");
      throw new Error("Supabase not configured");
    }

    loginLogger("📡 Calling Supabase signInWithPassword...");
    const startTime = performance.now();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      const elapsed = (performance.now() - startTime).toFixed(0);
      loginLogger(`📡 Supabase response received in ${elapsed}ms`);

      if (error) {
        const status = typeof error.status === "number" ? error.status : undefined;
        const lockoutMetadata =
          parseAuthLockoutMetadata(error) ??
          (status === 429 ? { locked: true } : undefined);

        loginLogger("❌ Supabase auth error", {
          code: status,
          message: error.message,
          name: error.name,
          lockoutMetadata,
        });
        logger.error("Login failed", error);
        if (lockoutMetadata?.locked) {
          throw new AuthRateLimitError("Too many login attempts. Please try again later.", lockoutMetadata, status);
        }
        throw new Error("Invalid credentials");
      }
      if (!data.user || !data.session) {
        loginLogger("❌ Login failed - missing user or session in response", {
          hasUser: !!data.user,
          hasSession: !!data.session,
        });
        logger.error("Login failed - missing session");
        throw new Error("Invalid credentials");
      }

      loginLogger("✅ Login successful!", {
        userId: data.user.id,
        email: data.user.email,
        sessionExpires: data.session.expires_at,
      });

      setUser(data.user);
      loginLogger("✓ User state updated");

      setSession(data.session);
      loginLogger("✓ Session state updated");

      setUserClaims(computeUserClaims(data.user));
      loginLogger("✓ User claims computed");

      logger.info("User logged in", { email: credentials.email });
      analyticsClient.identify(data.user.id, {
        email: data.user.email,
        created_at: data.user.created_at,
      });
      analyticsClient.track("user_login", { workflow: "activation" });
      loginLogger("🎉 Login flow complete - ready for redirect");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      loginLogger("❌ Login catch block", { error: errMsg });
      logger.error("Login failed", error as Error);
      throw error;
    }
  };

  const signup = async (data: SignupData) => {
    // Input validation
    if (!data.email || !data.password) {
      throw new Error("Email and password are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }

    if (data.password.length < 12) {
      throw new Error("Password must be at least 12 characters");
    }

    // Complexity check: enforce security baseline
    const hasUpper = /[A-Z]/.test(data.password);
    const hasLower = /[a-z]/.test(data.password);
    const hasNumber = /\d/.test(data.password);
    const hasSpecial = /[^A-Za-z0-9]/.test(data.password);

    if (!(hasUpper && hasLower && hasNumber && hasSpecial)) {
      throw new Error(
        "Password must include at least one uppercase letter, one lowercase letter, one number, and one symbol"
      );
    }

    if (data.fullName && data.fullName.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }

    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        logger.error("Signup failed", error);
        throw new Error("Signup failed");
      }
      if (!authData.user) {
        logger.error("Signup failed - no user");
        throw new Error("Signup failed");
      }

      if (authData.session) {
        setUser(authData.user);
        setSession(authData.session);
        setUserClaims(computeUserClaims(authData.user));
        logger.info("User signed up", { email: data.email });
        analyticsClient.identify(authData.user.id, {
          email: authData.user.email,
          created_at: authData.user.created_at,
        });
        analyticsClient.track("user_created", {
          workflow: "activation",
          created_at: authData.user.created_at,
        });
      } else {
        logger.info("Signup pending email verification", { email: data.email });
        analyticsClient.track("user_signup_pending_verification", {
          workflow: "activation",
          email: data.email,
        });
      }

      return {
        user: authData.user,
        session: authData.session ?? null,
        requiresEmailVerification: !authData.session,
      };
    } catch (error) {
      logger.error("Signup failed", error as Error);
      throw error;
    }
  };

  const logout = async () => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error("Logout failed", error);
        throw new Error("Logout failed");
      }
      setUser(null);
      setSession(null);
      logger.info("User logged out");
    } catch (error) {
      logger.error("Logout failed", error as Error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        logger.error("Password reset failed", error);
        throw new Error("Password reset failed");
      }
      logger.info("Password reset email sent", { email });
    } catch (error) {
      logger.error("Password reset failed", error as Error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        logger.error("Password update failed", error);
        throw new Error("Password update failed");
      }
      logger.info("Password updated");
    } catch (error) {
      logger.error("Password update failed", error as Error);
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        logger.error("Resend verification failed", error);
        throw new Error("Resend verification failed");
      }
      logger.info("Verification email resent", { email });
    } catch (error) {
      logger.error("Resend verification failed", error as Error);
      throw error;
    }
  };

  const signInWithProvider = async (provider: "google" | "apple" | "github") => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        logger.error("OAuth sign in failed", error);
        throw new Error(`OAuth sign in failed: ${error.message}`);
      }

      logger.info("OAuth sign in initiated", { provider });
      analyticsClient.track("oauth_signin_initiated", {
        workflow: "activation",
        provider,
      });

      // OAuth redirect happens automatically
    } catch (error) {
      logger.error("OAuth sign in failed", error as Error);
      throw error;
    }
  };

  return {
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    resendVerificationEmail,
    signInWithProvider,
  };
};

interface AuthContextType {
  user: User | null;
  userClaims: UserClaims | null; // New: with permissions
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<AuthSession>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  signInWithProvider: (provider: "google" | "apple" | "github") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuthState();
  const methods = useAuthMethods({
    setUser: authState.setUser,
    setUserClaims: authState.setUserClaims,
    setSession: authState.setSession,
  });

  const value: AuthContextType = {
    user: authState.user,
    userClaims: authState.userClaims,
    session: authState.session,
    loading: authState.loading,
    isAuthenticated: !!authState.user,

    ...methods,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
