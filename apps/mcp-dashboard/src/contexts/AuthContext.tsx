import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { secureTokenStorage } from "../lib/secureStorage";
import { authRateLimiter } from "../lib/rateLimiter";

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
  logout: () => void;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Check for existing session
    const checkAuth = async () => {
      try {
        const tokenData = secureTokenStorage.getAccessToken();
        if (tokenData && !cancelled) {
          // Validate token with backend
          const response = await fetch("/api/auth/validate", {
            headers: {
              Authorization: `Bearer ${tokenData}`,
            },
          });

          if (response.ok && !cancelled) {
            const userData = await response.json();
            setUser(userData);
          } else {
            secureTokenStorage.clearToken();
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Auth validation failed:", error);
          secureTokenStorage.clearToken();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    // Rate limiting check
    const rateLimitStatus = authRateLimiter.canAttemptAuth(email);
    if (!rateLimitStatus.allowed) {
      const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
      throw new Error(`Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`);
    }

    // Input validation
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Record failed attempt for rate limiting
        authRateLimiter.recordFailedAttempt(email);

        throw new Error(errorData.message || "Login failed");
      }

      const { user: userData, token } = await response.json();

      // Validate response data
      if (!userData || !token || !userData.id || !userData.email) {
        authRateLimiter.recordFailedAttempt(email);
        throw new Error("Invalid response from server");
      }

      // Record successful attempt (clears rate limit)
      authRateLimiter.recordSuccessfulAttempt(email);

      // Store token securely with expiration
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      secureTokenStorage.setToken({
        token,
        expiresAt,
        userId: userData.id,
      });

      setUser(userData);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    secureTokenStorage.clearToken();
    setUser(null);
  };

  const register = async (email: string, password: string, name: string) => {
    // Rate limiting check
    const rateLimitStatus = authRateLimiter.canAttemptAuth(email);
    if (!rateLimitStatus.allowed) {
      const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
      throw new Error(`Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`);
    }

    // Input validation
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Record failed attempt for rate limiting
        authRateLimiter.recordFailedAttempt(email);

        throw new Error(errorData.message || "Registration failed");
      }

      const { user: userData, token } = await response.json();

      // Validate response data
      if (!userData || !token || !userData.id || !userData.email) {
        authRateLimiter.recordFailedAttempt(email);
        throw new Error("Invalid response from server");
      }

      // Record successful attempt (clears rate limit)
      authRateLimiter.recordSuccessfulAttempt(email);

      // Store token securely with expiration
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      secureTokenStorage.setToken({
        token,
        expiresAt,
        userId: userData.id,
      });

      setUser(userData);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) throw new Error("No user logged in");

    try {
      const token = secureTokenStorage.getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Profile update failed");
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
    } catch (error) {
      throw error;
    }
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
