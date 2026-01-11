/**
 * Auth Context
 * Provides authentication state and methods throughout the app
 */

/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import {
  authService,
  AuthSession,
  LoginCredentials,
  SignupData,
} from "../services/AuthService";
import { createLogger } from "../lib/logger";
import { computePermissions, UserClaims } from "../types/security";
import { analyticsClient } from "../lib/analyticsClient";
import { secureTokenManager } from "../lib/auth/SecureTokenManager";
import { getSupabaseConfig } from "../lib/env";

const logger = createLogger({ component: "AuthContext" });

// SecureSessionManager removed in favor of unified SecureTokenManager

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
  signInWithProvider: (
    provider: "google" | "apple" | "github"
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
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
          logger.error("Supabase configuration missing", {
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

          // Re-compute claims immediately for optimistic UI
          const roles = (storedSession.user.user_metadata
            ?.roles as string[]) || ["ANALYST"];
          setUserClaims({
            sub: storedSession.user.id,
            email: storedSession.user.email || "",
            roles,
            permissions: computePermissions(roles),
            org_id: storedSession.user.user_metadata?.org_id || "default",
          });
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

          // Compute UserClaims with permissions
          const roles = (session.user.user_metadata?.roles as string[]) || [
            "ANALYST",
          ];
          setUserClaims({
            sub: session.user.id,
            email: session.user.email || "",
            roles,
            permissions: computePermissions(roles),
            org_id: session.user.user_metadata?.org_id || "default",
          });

          analyticsClient.identify(session.user.id, {
            email: session.user.email,
            created_at: session.user.created_at,
          });
          analyticsClient.track("user_session_restored", {
            workflow: "activation",
            session_age:
              Date.now() -
              (session.created_at ? new Date(session.created_at).getTime() : Date.now()),
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

    // Listen for auth state changes
    const {
      data: { subscription },
    } = authService["supabase"].auth.onAuthStateChange(
      async (event: string, newSession: Session | null) => {
        logger.debug("Auth state changed", { event });

        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Update UserClaims
        if (newSession?.user) {
          const roles = (newSession.user.user_metadata?.roles as string[]) || [
            "ANALYST",
          ];
          setUserClaims({
            sub: newSession.user.id,
            email: newSession.user.email || "",
            roles,
            permissions: computePermissions(roles),
            org_id: newSession.user.user_metadata?.org_id || "default",
          });
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
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const authSession: AuthSession = await authService.login(credentials);
      setUser(authSession.user);
      setSession(authSession.session);
      logger.info("User logged in", { email: credentials.email });
      analyticsClient.identify(authSession.user.id, {
        email: authSession.user.email,
        created_at: authSession.user.created_at,
      });
      analyticsClient.track("user_login", { workflow: "activation" });
    } catch (error) {
      logger.error("Login failed", error as Error);
      throw error;
    }
  };

  const signup = async (data: SignupData) => {
    try {
      const authSession: AuthSession = await authService.signup(data);
      if (authSession.session) {
        setUser(authSession.user);
        setSession(authSession.session);
        logger.info("User signed up", { email: data.email });
        analyticsClient.identify(authSession.user.id, {
          email: authSession.user.email,
          created_at: authSession.user.created_at,
        });
        analyticsClient.track("user_created", {
          workflow: "activation",
          created_at: authSession.user.created_at,
        });
      } else {
        setUser(null);
        setSession(null);
        logger.info("Signup pending email verification", { email: data.email });
        analyticsClient.track("user_signup_pending_verification", {
          workflow: "activation",
          email: data.email,
        });
      }
      return authSession;
    } catch (error) {
      logger.error("Signup failed", error as Error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setSession(null);
      logger.info("User logged out");
    } catch (error) {
      logger.error("Logout failed", error as Error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authService.requestPasswordReset(email);
      logger.info("Password reset email sent", { email });
    } catch (error) {
      logger.error("Password reset failed", error as Error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await authService.updatePassword(newPassword);
      logger.info("Password updated");
    } catch (error) {
      logger.error("Password update failed", error as Error);
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      await authService.resendVerificationEmail(email);
      logger.info("Verification email resent", { email });
    } catch (error) {
      logger.error("Resend verification failed", error as Error);
      throw error;
    }
  };

  const signInWithProvider = async (
    provider: "google" | "apple" | "github"
  ) => {
    try {
      await authService.signInWithProvider(provider);
      logger.info("OAuth sign in initiated", { provider });
      analyticsClient.track("oauth_signin_initiated", {
        workflow: "activation",
        provider,
      });
    } catch (error) {
      logger.error("OAuth sign in failed", error as Error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    userClaims,
    session,
    loading,
    isAuthenticated: !!user,

    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    resendVerificationEmail,
    signInWithProvider,
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
