/**
 * Health Check Endpoints
 * 
 * Provides comprehensive health checks for all system dependencies including
 * Together.ai connectivity, database, and other critical services.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { securityHeadersMiddleware } from '../middleware/securityMiddleware';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(rateLimiters.loose);

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: {
    database: DependencyStatus;
    supabase: DependencyStatus;
    togetherAI: DependencyStatus;
    openAI: DependencyStatus;
    redis: DependencyStatus;
  };
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

interface DependencyStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'not_configured';
  latency?: number;
  message?: string;
  lastChecked: string;
}

/**
 * Check Together.ai API connectivity
 */
async function checkTogetherAI(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  if (!process.env.TOGETHER_API_KEY) {
    return {
      status: 'not_configured',
      message: 'Together.ai API key not configured',
      lastChecked: new Date().toISOString()
    };
  }
  
  try {
    // Test with a minimal API call to check connectivity
    const response = await fetch('https://api.together.xyz/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: latency < 2000 ? 'healthy' : 'degraded',
        latency,
        message: latency < 2000 ? 'Together.ai API responding normally' : 'Together.ai API slow',
        lastChecked: new Date().toISOString()
      };
    } else {
      const errorText = await response.text();
      return {
        status: 'unhealthy',
        latency,
        message: `Together.ai API error: ${response.status} - ${errorText}`,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `Together.ai API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check OpenAI API connectivity (fallback)
 */
async function checkOpenAI(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: 'not_configured',
      message: 'OpenAI API key not configured (fallback not available)',
      lastChecked: new Date().toISOString()
    };
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      signal: AbortSignal.timeout(5000)
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: 'healthy',
        latency,
        message: 'OpenAI API available as fallback',
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'unhealthy',
        latency,
        message: `OpenAI API error: ${response.status}`,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `OpenAI API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check Supabase connectivity
 */
async function checkSupabase(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return {
      status: 'not_configured',
      message: 'Supabase not configured',
      lastChecked: new Date().toISOString()
    };
  }
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    
    // Simple query to test connectivity
    const { error } = await supabase
      .from('agent_sessions')
      .select('id')
      .limit(1);
    
    const latency = Date.now() - startTime;
    
    if (!error) {
      return {
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        message: 'Supabase responding normally',
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'unhealthy',
        latency,
        message: `Supabase error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `Supabase unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check database connectivity (direct PostgreSQL)
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  try {
    // Use Supabase client for database check
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
    );
    
    const { error } = await supabase.rpc('pg_backend_pid');
    
    const latency = Date.now() - startTime;
    
    if (!error) {
      return {
        status: 'healthy',
        latency,
        message: 'Database responding normally',
        lastChecked: new Date().toISOString()
      };
    } else {
      return {
        status: 'unhealthy',
        latency,
        message: `Database error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `Database unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<DependencyStatus> {
  const startTime = Date.now();
  
  if (!process.env.REDIS_URL) {
    return {
      status: 'not_configured',
      message: 'Redis not configured',
      lastChecked: new Date().toISOString()
    };
  }
  
  try {
    const { redisClient } = await import('../middleware/llmRateLimiter');
    
    await redisClient.ping();
    
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency,
      message: 'Redis responding normally',
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Comprehensive health check
 */
router.get('/health', async (req: Request, res: Response) => {
  const [database, supabase, togetherAI, openAI, redis] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkTogetherAI(),
    checkOpenAI(),
    checkRedis()
  ]);
  
  const dependencies = {
    database,
    supabase,
    togetherAI,
    openAI,
    redis
  };
  
  // Determine overall status
  const criticalDeps = [database, supabase, togetherAI];
  const hasUnhealthy = criticalDeps.some(dep => dep.status === 'unhealthy');
  const hasDegraded = criticalDeps.some(dep => dep.status === 'degraded');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }
  
  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    dependencies,
    metrics: {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
  };
  
  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(result);
});

/**
 * Liveness probe (for Kubernetes)
 * Returns 200 if the application is running
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness probe (for Kubernetes)
 * Returns 200 if the application is ready to serve traffic
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies only
    const [database, togetherAI] = await Promise.all([
      checkDatabase(),
      checkTogetherAI()
    ]);
    
    const isReady = database.status !== 'unhealthy' && 
                    togetherAI.status !== 'unhealthy';
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        dependencies: { database, togetherAI }
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: { database, togetherAI }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Startup probe (for Kubernetes)
 * Returns 200 when the application has finished starting up
 */
router.get('/health/startup', async (req: Request, res: Response) => {
  // Check if all critical services are initialized
  const isStarted = process.uptime() > 10; // Application has been running for at least 10 seconds
  
  if (isStarted) {
    res.status(200).json({
      status: 'started',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'starting',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed dependency status
 */
router.get('/health/dependencies', async (req: Request, res: Response) => {
  const [database, supabase, togetherAI, openAI, redis] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkTogetherAI(),
    checkOpenAI(),
    checkRedis()
  ]);
  
  res.json({
    timestamp: new Date().toISOString(),
    dependencies: {
      database,
      supabase,
      togetherAI,
      openAI,
      redis
    }
  });
});

export default router;
