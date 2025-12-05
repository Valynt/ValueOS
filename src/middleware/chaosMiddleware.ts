/**
 * Chaos Engineering Middleware
 * 
 * Express middleware for controlled failure injection
 */

import { Request, Response, NextFunction } from 'express';
import { chaosEngineering } from '../services/ChaosEngineering';
import { logger } from '../utils/logger';

/**
 * Middleware to inject chaos into requests
 */
export function chaosMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if chaos should be injected
      const injection = chaosEngineering.shouldInject({
        service: 'api',
        endpoint: req.path,
        userId: (req as any).user?.id,
      });

      if (injection) {
        // Execute chaos
        await chaosEngineering.executeChaos(injection);
      }

      next();
    } catch (error) {
      // If chaos was injected, pass the error
      if (error instanceof Error && error.message.includes('chaos')) {
        logger.warn('Chaos error injected', {
          path: req.path,
          error: error.message,
        });
        
        // Return appropriate error response
        const statusCode = (error as any).statusCode || 500;
        return res.status(statusCode).json({
          error: 'Service temporarily unavailable',
          message: error.message,
          chaos: true,
        });
      }

      // Otherwise, pass to error handler
      next(error);
    }
  };
}

/**
 * Middleware to inject chaos into specific service calls
 */
export function chaosServiceMiddleware(serviceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const injection = chaosEngineering.shouldInject({
        service: serviceName,
        endpoint: req.path,
        userId: (req as any).user?.id,
      });

      if (injection) {
        await chaosEngineering.executeChaos(injection);
      }

      next();
    } catch (error) {
      if (error instanceof Error && error.message.includes('chaos')) {
        const statusCode = (error as any).statusCode || 500;
        return res.status(statusCode).json({
          error: `${serviceName} service error`,
          message: error.message,
          chaos: true,
        });
      }

      next(error);
    }
  };
}

/**
 * Wrapper for async functions with chaos injection
 */
export function withChaos<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: {
    service?: string;
    operation?: string;
  }
): T {
  return (async (...args: any[]) => {
    const injection = chaosEngineering.shouldInject({
      service: context.service,
      endpoint: context.operation,
    });

    if (injection) {
      await chaosEngineering.executeChaos(injection);
    }

    return fn(...args);
  }) as T;
}
