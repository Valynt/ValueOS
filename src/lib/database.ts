/**
 * Database Connection Health Check
 * 
 * Verifies database connectivity with retry logic and exponential backoff.
 * Used during application bootstrap to ensure database is available.
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface DatabaseHealthCheck {
  connected: boolean;
  latency: number;
  error?: string;
}

/**
 * Check database connection with exponential backoff retry
 * 
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @returns Database health check result
 */
export async function checkDatabaseConnection(
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<DatabaseHealthCheck> {
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < maxRetries) {
    const startTime = Date.now();
    
    try {
      // Try health check table first
      const { data, error } = await supabase
        .from('_health_check')
        .select('count')
        .limit(1)
        .single();

      if (error) {
        // If health check table doesn't exist, try organizations table
        if (error.code === '42P01' || error.code === 'PGRST116') {
          logger.debug('Health check table not found, trying organizations table');
          
          const { error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .limit(1);
          
          if (orgError) {
            throw orgError;
          }
        } else {
          throw error;
        }
      }

      const latency = Date.now() - startTime;
      
      logger.info('Database connection successful', {
        latency,
        attempt: attempt + 1,
      });

      return {
        connected: true,
        latency,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn(`Database connection attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: lastError.message,
          attempt,
          maxRetries,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error('Database connection failed after all retries', lastError, {
    attempts: maxRetries,
  });

  return {
    connected: false,
    latency: 0,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Create health check table if it doesn't exist
 * 
 * This is a convenience function for development/testing.
 * In production, the table should be created via migrations.
 */
export async function ensureHealthCheckTable(): Promise<void> {
  try {
    // Try to create the table using a stored procedure
    const { error } = await supabase.rpc('create_health_check_table');
    
    if (error && error.code !== '42P07') { // Ignore "already exists" error
      logger.warn('Failed to create health check table', { error: error.message });
    } else if (!error) {
      logger.info('Health check table created successfully');
    }
  } catch (error) {
    logger.debug('Health check table creation skipped', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Verify database connection is healthy
 * 
 * Quick check without retries, useful for health endpoints
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const result = await checkDatabaseConnection(1, 500);
    return result.connected;
  } catch (error) {
    return false;
  }
}

/**
 * Get database connection statistics
 */
export async function getDatabaseStats(): Promise<{
  connected: boolean;
  latency: number;
  version?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Get PostgreSQL version
    const { data, error } = await supabase.rpc('version');
    
    const latency = Date.now() - startTime;
    
    if (error) {
      return {
        connected: false,
        latency,
      };
    }

    return {
      connected: true,
      latency,
      version: data,
    };
  } catch (error) {
    return {
      connected: false,
      latency: Date.now() - startTime,
    };
  }
}
