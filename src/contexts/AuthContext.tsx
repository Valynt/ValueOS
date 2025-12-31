/**
 * Auth Context
 * Provides authentication state and methods throughout the app
 */

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import {
  AuthService,
  AuthSession,
  LoginCredentials,
  SignupData,
} from "../services/AuthService";
import { createLogger } from "../lib/logger";
import { UserClaims, computePermissions } from "../types/security";
import { analyticsClient } from "../lib/analyticsClient";
import { secureTokenManager } from "../lib/auth/SecureTokenManager";
import { env } from "../lib/env";

const logger = createLogger({ component: "AuthContext" });

// Secure session management
class SecureSessionManager {
  private static readonly SESSION_KEY = "vc_session_v2";
  private static readonly MAX_SESSION_AGE = 8 * 60 * 60 * 1000; // 8 hours
  private static readonly ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

  static storeSession(session: Session): void {
    try {
      const sessionData = {
        ...session,
        storedAt: Date.now(),
        rotatedAt: Date.now(),
      };

      // Use sessionStorage instead of localStorage for better security
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

      logger.debug("Session stored securely");
    } catch (error) {
      logger.error("Failed to store session", error as Error);
    }
  }

  static getSession(): Session | null {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      const now = Date.now();

      // Check session age
      if (now - sessionData.storedAt > this.MAX_SESSION_AGE) {
        this.clearSession();
        logger.warn("Session expired due to age");
        return null;
      }

      // Check if rotation is needed
      if (now - sessionData.rotatedAt > this.ROTATION_INTERVAL) {
        // Rotate session by refreshing it
        this.rotateSession(sessionData);
      }

      return sessionData;
    } catch (error) {
      logger.error("Failed to retrieve session", error as Error);
      this.clearSession();
      return null;
    }
  }

  static clearSession(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
      // Also clear any potential localStorage remnants
      localStorage.removeItem("supabase.auth.token");
      logger.debug("Session cleared securely");
    } catch (error) {
      logger.error("Failed to clear session", error as Error);
    }
  }

  private static rotateSession(sessionData: any): void {
    try {
      sessionData.rotatedAt = Date.now();
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      logger.debug("Session rotated for security");
    } catch (error) {
      logger.error("Failed to rotate session", error as Error);
    }
  }
}

interface AuthContextType {
  user: User | null;
  userClaims: UserClaims | null; // New: with permissions
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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

  const authService = new AuthService();

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Initialize secure token manager
        await secureTokenManager.initialize();

        // Get current session from secure token manager
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
              (session.issued_at ? session.issued_at * 1000 : Date.now()),
          });
          logger.info("Session restored via secure token manager");
        }
      } catch (error) {
        logger.error("Failed to initialize auth", error as Error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = authService["supabase"].auth.onAuthStateChange(
      async (event, newSession) => {
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
          SecureSessionManager.clearSession();
        } else if (newSession) {
          // Store session securely on sign in
          SecureSessionManager.storeSession(newSession);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [authService]);

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
    signInWithProvider,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
