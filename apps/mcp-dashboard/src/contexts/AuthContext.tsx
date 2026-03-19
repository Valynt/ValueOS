import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { csrfProtection } from "../index";
import { authRateLimiter } from "../index";
import { secureTokenStorage } from "../index";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  permissions: string[];
  apiKeys: APIKey[];
  createdAt: Date;
  lastLogin: Date;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
  lastUsed?: Date;
  usage: {
    requests: number;
    quota: number;
    resetDate: Date;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  getRateLimitStatus: (email: string) => {
    attempts: number;
    maxAttempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

async function fetchCurrentSession(): Promise<User | null> {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to verify the current session");
  }

  const payload = (await response.json()) as { user?: User | null };
  return payload.user ?? null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    csrfProtection.initialize();

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const invalidatedLegacySession = secureTokenStorage.invalidateLegacyStorageOnLoad();

        if (invalidatedLegacySession) {
          await csrfProtection.secureFetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          }).catch(() => undefined);

          if (!cancelled) {
            setUser(null);
          }
          return;
        }

        const currentUser = await fetchCurrentSession();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Auth validation failed:", error);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const rateLimitStatus = authRateLimiter.canAttemptAuth(email);
    if (!rateLimitStatus.allowed) {
      const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
      throw new Error(`Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`);
    }

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    setLoading(true);
    try {
      const response = await csrfProtection.secureFetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        authRateLimiter.recordFailedAttempt(email);
        throw new Error((errorData as { error?: string; message?: string }).message || (errorData as { error?: string }).error || "Login failed");
      }

      const payload = (await response.json()) as { user?: User | null };
      if (!payload.user || !payload.user.id || !payload.user.email) {
        authRateLimiter.recordFailedAttempt(email);
        throw new Error("Invalid response from server");
      }

      authRateLimiter.recordSuccessfulAttempt(email);
      setUser(payload.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await csrfProtection.secureFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      secureTokenStorage.clearToken();
      csrfProtection.clearToken();
      setUser(null);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    const rateLimitStatus = authRateLimiter.canAttemptAuth(email);
    if (!rateLimitStatus.allowed) {
      const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
      throw new Error(`Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`);
    }

    if (!email || !password || !name) {
      throw new Error("Email, password, and name are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }

    setLoading(true);
    try {
      const response = await csrfProtection.secureFetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, fullName: name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        authRateLimiter.recordFailedAttempt(email);
        throw new Error((errorData as { error?: string; message?: string }).message || (errorData as { error?: string }).error || "Registration failed");
      }

      const payload = (await response.json()) as {
        user?: User | null;
        requiresEmailVerification?: boolean;
      };

      authRateLimiter.recordSuccessfulAttempt(email);

      if (payload.requiresEmailVerification) {
        setUser(null);
        return;
      }

      if (!payload.user || !payload.user.id || !payload.user.email) {
        throw new Error("Invalid response from server");
      }

      setUser(payload.user);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error("No user logged in");

    const response = await csrfProtection.secureFetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Profile update failed");
    }

    const updatedUser = (await response.json()) as User;
    setUser(updatedUser);
  };

  const getRateLimitStatus = (email: string) => {
    return authRateLimiter.getRateLimitStatus(email);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    updateProfile,
    getRateLimitStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
