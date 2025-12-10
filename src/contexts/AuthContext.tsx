/**
 * Auth Context
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { AuthService, LoginCredentials, SignupData, AuthSession } from '../services/AuthService';
import { createLogger } from '../lib/logger';
import { analyticsClient } from '../lib/analyticsClient';

const logger = createLogger({ component: 'AuthContext' });

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  enterDemoMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const authService = new AuthService();

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentSession = await authService.getSession();
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          analyticsClient.identify(currentSession.user.id, {
            email: currentSession.user.email,
            created_at: currentSession.user.created_at,
          });
          analyticsClient.track('user_session_started', {
            workflow: 'activation',
            created_at: currentSession.user.created_at,
          });
        }
      } catch (error) {
        logger.error('Failed to initialize auth', error as Error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = authService['supabase'].auth.onAuthStateChange(
      async (event, newSession) => {
        logger.debug('Auth state changed', { event });
        
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
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
      logger.info('User logged in', { email: credentials.email });
      analyticsClient.identify(authSession.user.id, {
        email: authSession.user.email,
        created_at: authSession.user.created_at,
      });
      analyticsClient.track('user_login', { workflow: 'activation' });
    } catch (error) {
      logger.error('Login failed', error as Error);
      throw error;
    }
  };

  const signup = async (data: SignupData) => {
    try {
      const authSession: AuthSession = await authService.signup(data);
      setUser(authSession.user);
      setSession(authSession.session);
      logger.info('User signed up', { email: data.email });
      analyticsClient.identify(authSession.user.id, {
        email: authSession.user.email,
        created_at: authSession.user.created_at,
      });
      analyticsClient.track('user_created', {
        workflow: 'activation',
        created_at: authSession.user.created_at,
      });
    } catch (error) {
      logger.error('Signup failed', error as Error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setSession(null);
      logger.info('User logged out');
    } catch (error) {
      logger.error('Logout failed', error as Error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authService.requestPasswordReset(email);
      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Password reset failed', error as Error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      await authService.updatePassword(newPassword);
      logger.info('Password updated');
    } catch (error) {
      logger.error('Password update failed', error as Error);
      throw error;
    }
  };

  /**
   * Enter Demo Mode (Development Only)
   * 
   * Creates a mock user/session for testing without real authentication.
   * Only available when VITE_APP_ENV !== 'production'.
   */
  const enterDemoMode = async () => {
    // SECURITY: Only allow demo mode in non-production environments
    const appEnv = (import.meta as any)?.env?.VITE_APP_ENV || 'development';
    if (appEnv === 'production') {
      logger.error('Demo mode attempted in production - blocked');
      throw new Error('Demo mode is not available in production');
    }

    try {
      logger.info('Entering demo mode');
      
      // Create a mock demo user
      const demoUser: User = {
        id: 'demo-user-00000000-0000-0000-0000-000000000000',
        email: 'demo@valuecanvas.dev',
        app_metadata: {
          provider: 'demo',
          providers: ['demo'],
        },
        user_metadata: {
          full_name: 'Demo User',
          avatar_url: '',
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        role: 'authenticated',
        confirmed_at: new Date().toISOString(),
      } as User;

      // Create a mock session with a clearly fake token
      const demoSession: Session = {
        access_token: 'demo-access-token-not-for-production',
        refresh_token: 'demo-refresh-token-not-for-production',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: demoUser,
      };

      setUser(demoUser);
      setSession(demoSession);
      setIsDemoMode(true);

      // Track demo mode activation
      analyticsClient.track('demo_mode_activated', {
        workflow: 'development',
        environment: appEnv,
      });

      logger.info('Demo mode activated', { email: demoUser.email });
    } catch (error) {
      logger.error('Failed to enter demo mode', error as Error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isDemoMode,
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    enterDemoMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
