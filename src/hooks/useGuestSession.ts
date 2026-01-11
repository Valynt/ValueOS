/**
 * Guest Session Hook
 * 
 * Manages guest user session, token validation, and expiration handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getGuestAccessService,
  TokenValidationResult,
  GuestPermissions,
} from '../services/GuestAccessService';
import { logger } from '../lib/logger';

export interface GuestSessionState {
  isLoading: boolean;
  isValid: boolean;
  isExpired: boolean;
  guestUserId?: string;
  valueCaseId?: string;
  permissions?: GuestPermissions;
  guestName?: string;
  guestEmail?: string;
  expiresAt?: string;
  errorMessage?: string;
}

export interface UseGuestSessionOptions {
  onExpired?: () => void;
  onInvalid?: (error: string) => void;
  checkInterval?: number; // Check expiration every N milliseconds
}

export function useGuestSession(options: UseGuestSessionOptions = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const guestService = getGuestAccessService();

  const [state, setState] = useState<GuestSessionState>({
    isLoading: true,
    isValid: false,
    isExpired: false,
  });

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expirationTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Validate guest token
   */
  const validateToken = useCallback(async (token: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Get IP and user agent
      const ipAddress = undefined; // Would be set by backend
      const userAgent = navigator.userAgent;

      const result: TokenValidationResult = await guestService.validateToken(
        token,
        ipAddress,
        userAgent
      );

      if (!result.isValid) {
        setState({
          isLoading: false,
          isValid: false,
          isExpired: result.errorMessage?.includes('expired') || false,
          errorMessage: result.errorMessage,
        });

        if (result.errorMessage?.includes('expired')) {
          options.onExpired?.();
        } else {
          options.onInvalid?.(result.errorMessage || 'Invalid token');
        }

        return;
      }

      // Get token details to check expiration
      const tokens = await guestService.getTokensForValueCase(result.valueCaseId!);
      const currentToken = tokens.find((t) => t.token === token);

      setState({
        isLoading: false,
        isValid: true,
        isExpired: false,
        guestUserId: result.guestUserId,
        valueCaseId: result.valueCaseId,
        permissions: result.permissions,
        guestName: result.guestName,
        guestEmail: result.guestEmail,
        expiresAt: currentToken?.expiresAt,
      });

      // Set up expiration timer
      if (currentToken?.expiresAt) {
        setupExpirationTimer(currentToken.expiresAt);
      }

      // Log access
      if (result.guestUserId && result.valueCaseId) {
        await guestService.logActivity(
          result.guestUserId,
          currentToken?.id || '',
          result.valueCaseId,
          'access',
          undefined,
          ipAddress,
          userAgent
        );
      }
    } catch (error) {
      logger.error('Failed to validate guest token', error as Error);
      setState({
        isLoading: false,
        isValid: false,
        isExpired: false,
        errorMessage: 'Failed to validate access token',
      });
      options.onInvalid?.('Failed to validate access token');
    }
  }, [guestService, options]);

  /**
   * Setup expiration timer
   */
  const setupExpirationTimer = useCallback((expiresAt: string) => {
    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiration = expirationTime - now;

    if (timeUntilExpiration <= 0) {
      // Already expired
      handleExpiration();
      return;
    }

    // Clear existing timer
    if (expirationTimerRef.current) {
      clearTimeout(expirationTimerRef.current);
    }

    // Set new timer
    expirationTimerRef.current = setTimeout(() => {
      handleExpiration();
    }, timeUntilExpiration);

    logger.debug('Expiration timer set', {
      expiresAt,
      timeUntilExpiration,
    });
  }, []);

  /**
   * Handle token expiration
   */
  const handleExpiration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isValid: false,
      isExpired: true,
      errorMessage: 'Your access has expired',
    }));

    options.onExpired?.();

    logger.info('Guest session expired');
  }, [options]);

  /**
   * Check if token is about to expire
   */
  const checkExpirationWarning = useCallback((): {
    isExpiringSoon: boolean;
    daysRemaining: number;
  } => {
    if (!state.expiresAt) {
      return { isExpiringSoon: false, daysRemaining: 0 };
    }

    const expirationTime = new Date(state.expiresAt).getTime();
    const now = Date.now();
    const timeRemaining = expirationTime - now;
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

    return {
      isExpiringSoon: daysRemaining <= 3 && daysRemaining > 0,
      daysRemaining,
    };
  }, [state.expiresAt]);

  /**
   * Refresh token validation
   */
  const refresh = useCallback(async () => {
    const token = searchParams.get('token');
    if (token) {
      await validateToken(token);
    }
  }, [searchParams, validateToken]);

  /**
   * Logout guest user
   */
  const logout = useCallback(() => {
    // Clear timers
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    if (expirationTimerRef.current) {
      clearTimeout(expirationTimerRef.current);
    }

    // Reset state
    setState({
      isLoading: false,
      isValid: false,
      isExpired: false,
    });

    // Navigate away
    navigate('/');
  }, [navigate]);

  /**
   * Initialize session
   */
  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setState({
        isLoading: false,
        isValid: false,
        isExpired: false,
        errorMessage: 'No access token provided',
      });
      options.onInvalid?.('No access token provided');
      return;
    }

    validateToken(token);

    // Set up periodic validation check
    const checkInterval = options.checkInterval || 60000; // Default: 1 minute
    checkIntervalRef.current = setInterval(() => {
      validateToken(token);
    }, checkInterval);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current);
      }
    };
  }, [searchParams, validateToken, options.checkInterval]);

  return {
    ...state,
    refresh,
    logout,
    checkExpirationWarning,
  };
}

/**
 * Hook to check guest permissions
 */
export function useGuestPermissions(permissions?: GuestPermissions) {
  const canView = permissions?.can_view || false;
  const canComment = permissions?.can_comment || false;
  const canEdit = permissions?.can_edit || false;

  const hasPermission = useCallback(
    (action: 'view' | 'comment' | 'edit'): boolean => {
      if (action === 'view') return canView;
      if (action === 'comment') return canView && canComment;
      if (action === 'edit') return canView && canEdit;
      return false;
    },
    [canView, canComment, canEdit]
  );

  return {
    canView,
    canComment,
    canEdit,
    hasPermission,
  };
}

/**
 * Hook to log guest activity
 */
export function useGuestActivity(
  guestUserId?: string,
  tokenId?: string,
  valueCaseId?: string
) {
  const guestService = getGuestAccessService();

  const logActivity = useCallback(
    async (
      activityType: 'access' | 'view_element' | 'add_comment' | 'view_metric' | 'export_pdf' | 'export_excel' | 'share_email',
      activityData?: Record<string, any>
    ) => {
      if (!guestUserId || !tokenId || !valueCaseId) {
        logger.warn('Cannot log activity: missing required IDs');
        return;
      }

      try {
        await guestService.logActivity(
          guestUserId,
          tokenId,
          valueCaseId,
          activityType,
          activityData,
          undefined, // IP address (set by backend)
          navigator.userAgent
        );
      } catch (error) {
        logger.error('Failed to log guest activity', error as Error);
      }
    },
    [guestUserId, tokenId, valueCaseId, guestService]
  );

  return { logActivity };
}
