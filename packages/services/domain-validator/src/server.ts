/**
 * Domain Validator Service
 * 
 * Validates custom domains for Caddy's on-demand TLS feature.
 * Checks if a domain is verified and belongs to a tenant.
 */

import express, { type Application, NextFunction, Request, Response } from 'express';

import { config, validateConfig } from './config';
import { domainDatabase } from './database';
import { logger } from './logger';
import { domainValidator } from './validator';

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  logger.error('Configuration validation failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

const app: Application = express();
const startTime = Date.now();

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request', {
      method: req.method,
      path: req.path,
      query: req.query,
      status: res.statusCode,
      duration,
    });
  });
  
  next();
});

/**
 * GET /verify?domain=<domain>
 * 
 * Caddy on-demand TLS verification endpoint.
 * Returns 200 if domain is verified, 404 otherwise.
 */
app.get('/verify', async (req: Request, res: Response) => {
  const domain = req.query.domain as string;

  // Validate domain parameter
  if (!domain) {
    logger.warn('Missing domain parameter');
    return res.status(400).send('Domain parameter required');
  }

  try {
    const result = await domainValidator.verifyDomain(domain);

    if (result.verified) {
      logger.info('Domain verification successful', {
        domain,
        cached: result.cached,
        duration: result.duration,
      });
      return res.status(200).send('OK');
    }

    logger.info('Domain not verified', {
      domain,
      cached: result.cached,
      duration: result.duration,
    });
    return res.status(404).send('Domain not verified');
  } catch (error) {
    logger.error('Domain verification error', {
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).send('Internal server error');
  }
});

/**
 * GET /health
 * 
 * Health check endpoint for monitoring.
 */
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    const dbHealthy = await domainDatabase.healthCheck();

    if (!dbHealthy) {
      logger.error('Database health check failed');
      return res.status(503).json({
        status: 'unhealthy',
        reason: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }

    // Get statistics
    const stats = await domainValidator.getStats();

    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      cache: {
        size: stats.cacheSize,
        maxSize: stats.cacheMaxSize,
        ttlSeconds: stats.cacheTtlSeconds,
      },
      database: {
        verifiedDomains: stats.verifiedDomainsCount,
      },
    });
  } catch (error) {
    logger.error('Health check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({
      status: 'unhealthy',
      reason: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /cache/clear
 * 
 * Clear the domain cache (admin endpoint).
 */
app.post('/cache/clear', (_req: Request, res: Response) => {
  try {
    const clearedCount = domainValidator.clearCache();

    logger.info('Cache cleared via API', { clearedCount });

    return res.status(200).json({
      message: 'Cache cleared',
      clearedCount,
    });
  } catch (error) {
    logger.error('Cache clear error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to clear cache',
    });
  }
});

/**
 * GET /stats
 * 
 * Get service statistics (admin endpoint).
 */
app.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await domainValidator.getStats();

    return res.status(200).json({
      uptime: Math.floor((Date.now() - startTime) / 1000),
      cache: {
        size: stats.cacheSize,
        maxSize: stats.cacheMaxSize,
        ttlSeconds: stats.cacheTtlSeconds,
      },
      database: {
        verifiedDomains: stats.verifiedDomainsCount,
      },
    });
  } catch (error) {
    logger.error('Stats error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to get stats',
    });
  }
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

/**
 * Error handler
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
  });
});

/**
 * Start server
 */
const server = app.listen(config.port, () => {
  logger.info('Domain validator service started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    cacheTtl: config.cache.ttlSeconds,
    cacheMaxSize: config.cache.maxSize,
  });
});

/**
 * Graceful shutdown
 */
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
