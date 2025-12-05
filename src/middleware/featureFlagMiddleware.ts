/**
 * Feature Flag Middleware
 * 
 * Express middleware for feature flag evaluation and enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { featureFlags } from '../services/FeatureFlags';
import { logger } from '../utils/logger';

/**
 * Extend Express Request to include feature flag context
 */
declare global {
  namespace Express {
    interface Request {
      featureFlags?: {
        isEnabled: (key: string) => Promise<boolean>;
        getVariant: (key: string) => Promise<string | null>;
        getConfig: (key: string) => Promise<Record<string, any> | null>;
      };
    }
  }
}

/**
 * Middleware to add feature flag helpers to request
 */
export function featureFlagContext() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id || 'anonymous';
    const userTier = (req as any).user?.tier;
    const country = req.headers['cf-ipcountry'] as string; // Cloudflare header

    req.featureFlags = {
      isEnabled: async (key: string) => {
        const evaluation = await featureFlags.isEnabled(key, {
          userId,
          userTier,
          country
        });

        // Track evaluation
        await featureFlags.trackEvaluation(
          key,
          userId,
          evaluation.enabled,
          evaluation.variant
        );

        return evaluation.enabled;
      },

      getVariant: async (key: string) => {
        const { variant } = await featureFlags.getVariant(key, {
          userId,
          userTier,
          country
        });
        return variant;
      },

      getConfig: async (key: string) => {
        const { config } = await featureFlags.getVariant(key, {
          userId,
          userTier,
          country
        });
        return config;
      }
    };

    next();
  };
}

/**
 * Middleware to require a feature flag to be enabled
 */
export function requireFeatureFlag(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.featureFlags) {
        throw new Error('Feature flag context not initialized');
      }

      const enabled = await req.featureFlags.isEnabled(flagKey);

      if (!enabled) {
        logger.warn('Feature flag not enabled', {
          flagKey,
          userId: (req as any).user?.id,
          path: req.path
        });

        return res.status(403).json({
          error: 'Feature not available',
          message: 'This feature is not available for your account',
          featureKey: flagKey
        });
      }

      next();
    } catch (error) {
      logger.error('Feature flag evaluation failed', error as Error);
      next(error);
    }
  };
}

/**
 * Middleware to add feature flag variant to request
 */
export function withFeatureFlagVariant(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.featureFlags) {
        throw new Error('Feature flag context not initialized');
      }

      const variant = await req.featureFlags.getVariant(flagKey);
      const config = await req.featureFlags.getConfig(flagKey);

      (req as any).featureFlagVariant = variant;
      (req as any).featureFlagConfig = config;

      next();
    } catch (error) {
      logger.error('Feature flag variant evaluation failed', error as Error);
      next(error);
    }
  };
}

/**
 * Middleware to conditionally apply middleware based on feature flag
 */
export function conditionalMiddleware(
  flagKey: string,
  middleware: (req: Request, res: Response, next: NextFunction) => void
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.featureFlags) {
        throw new Error('Feature flag context not initialized');
      }

      const enabled = await req.featureFlags.isEnabled(flagKey);

      if (enabled) {
        return middleware(req, res, next);
      }

      next();
    } catch (error) {
      logger.error('Conditional middleware evaluation failed', error as Error);
      next(error);
    }
  };
}

/**
 * Middleware to add feature flags to response headers (for debugging)
 */
export function debugFeatureFlags() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      const flags = await featureFlags.listFlags();
      const enabledFlags = [];

      for (const flag of flags) {
        if (req.featureFlags) {
          const enabled = await req.featureFlags.isEnabled(flag.key);
          if (enabled) {
            enabledFlags.push(flag.key);
          }
        }
      }

      res.setHeader('X-Feature-Flags', enabledFlags.join(','));
    }

    next();
  };
}
