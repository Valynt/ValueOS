/**
 * Application Bootstrap
 * 
 * Production-ready initialization sequence for the ValueCanvas application.
 * Ensures all systems are ready before rendering the UI.
 */

import { getConfig, validateEnvironmentConfig, isProduction, isDevelopment } from './config/environment';
import { initializeAgents, SystemHealth } from './services/AgentInitializer';
import { initializeSecurity, validateSecurity } from './security';
import { createLogger, logger as globalLogger } from './lib/logger';

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  success: boolean;
  config: ReturnType<typeof getConfig>;
  agentHealth?: SystemHealth;
  errors: string[];
  warnings: string[];
  duration: number;
}

/**
 * Bootstrap options
 */
export interface BootstrapOptions {
  /**
   * Skip agent health checks
   * @default false in production, true in development
   */
  skipAgentCheck?: boolean;

  /**
   * Fail fast on errors
   * @default true in production
   */
  failFast?: boolean;

  /**
   * Maximum time to wait for agent health checks (ms)
   * @default 5000 in development, 30000 in production
   */
  agentCheckTimeout?: number;

  /**
   * Callback for progress updates
   */
  onProgress?: (message: string) => void;

  /**
   * Callback for warnings
   */
  onWarning?: (warning: string) => void;

  /**
   * Callback for errors
   */
  onError?: (error: string) => void;
}

/**
 * Bootstrap the application
 */
export async function bootstrap(
  options: BootstrapOptions = {}
): Promise<BootstrapResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const logger = createLogger({ component: 'Bootstrap' });

  const {
    // In development, skip agent checks by default for faster startup
    skipAgentCheck = isDevelopment(),
    failFast = isProduction(),
    // Short timeout in dev, longer in production
    agentCheckTimeout = isDevelopment() ? 5000 : 30000,
    onProgress,
    onWarning,
    onError,
  } = options;

  logger.info('🚀 Bootstrapping ValueCanvas Application', { action: 'bootstrap_start' });

  // Step 1: Load and validate environment configuration
  onProgress?.('Loading environment configuration...');
  logger.info('Step 1: Loading environment configuration', { action: 'load_config' });

  let config: ReturnType<typeof getConfig>;
  try {
    config = getConfig();
    logger.info('Configuration loaded', {
      action: 'config_loaded',
      environment: config.app.env,
      appUrl: config.app.url,
      apiUrl: config.app.apiBaseUrl,
      agentApi: config.agents.apiUrl,
    });
  } catch (error) {
    const errorMsg = `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    onError?.(errorMsg);
    logger.error('Failed to load configuration', error instanceof Error ? error : undefined, {
      action: 'config_load_failed',
    });

    return {
      success: false,
      config: getConfig(),
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  }

  // Step 2: Validate configuration
  onProgress?.('Validating configuration...');
  logger.info('Step 2: Validating configuration', { action: 'validate_config' });

  const configErrors = validateEnvironmentConfig(config);
  if (configErrors.length > 0) {
    configErrors.forEach((error) => {
      errors.push(error);
      onError?.(error);
      logger.error('Configuration validation error', undefined, {
        action: 'config_validation_failed',
        error,
      });
    });

    if (failFast) {
      return {
        success: false,
        config,
        errors,
        warnings,
        duration: Date.now() - startTime,
      };
    }
  } else {
    logger.info('Configuration valid', { action: 'config_validated' });
  }

  // Step 3: Check feature flags
  onProgress?.('Checking feature flags...');
  logger.info('Step 3: Feature flags', { action: 'check_features' });
  logger.info(`   SDUI Debug: ${config.features.sduiDebug ? '✅' : '❌'}`);
  logger.info(`   Agent Fabric: ${config.features.agentFabric ? '✅' : '❌'}`);
  logger.info(`   Workflow: ${config.features.workflow ? '✅' : '❌'}`);
  logger.info(`   Compliance: ${config.features.compliance ? '✅' : '❌'}`);
  logger.info(`   Multi-Tenant: ${config.features.multiTenant ? '✅' : '❌'}`);
  logger.info(`   Usage Tracking: ${config.features.usageTracking ? '✅' : '❌'}`);
  logger.info(`   Billing: ${config.features.billing ? '✅' : '❌'}`);

  // Step 4: Initialize security
  onProgress?.('Initializing security...');
  logger.info('\n🔒 Step 4: Security initialization');
  try {
    // Validate security configuration
    const securityValidation = validateSecurity();
    if (securityValidation.errors.length > 0) {
      securityValidation.errors.forEach((error) => {
        errors.push(error);
        onError?.(error);
        logger.error(`   ❌ ${error}`);
      });

      if (failFast) {
        return {
          success: false,
          config,
          errors,
          warnings,
          duration: Date.now() - startTime,
        };
      }
    }

    if (securityValidation.warnings.length > 0) {
      securityValidation.warnings.forEach((warning) => {
        warnings.push(warning);
        onWarning?.(warning);
        logger.warn(`   ⚠️  ${warning}`);
      });
    }

    // Initialize security features
    initializeSecurity();
    logger.info('   ✅ Security features initialized');
    logger.info(`   - CSRF protection: ${config.security.csrfEnabled ? '✅' : '❌'}`);
    logger.info(`   - CSP: ${config.security.cspEnabled ? '✅' : '❌'}`);
    logger.info(`   - HTTPS only: ${config.security.httpsOnly ? '✅' : '❌'}`);
  } catch (error) {
    const errorMsg = `Failed to initialize security: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    onError?.(errorMsg);
    logger.error(`   ❌ ${errorMsg}`);

    if (failFast) {
      return {
        success: false,
        config,
        errors,
        warnings,
        duration: Date.now() - startTime,
      };
    }
  }

  // Step 5: Initialize monitoring (if enabled)
  if (config.monitoring.sentry.enabled) {
    onProgress?.('Initializing error tracking...');
    logger.info('\n📊 Step 5: Initializing Sentry');
    try {
      // TODO: Initialize Sentry
      // await initializeSentry(config.monitoring.sentry);
      logger.info('   ⚠️  Sentry initialization not implemented yet');
      warnings.push('Sentry initialization not implemented');
      onWarning?.('Sentry initialization not implemented');
    } catch (error) {
      const errorMsg = `Failed to initialize Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      logger.warn(`   ⚠️  ${errorMsg}`);
    }
  } else {
    logger.info('\n📊 Step 5: Error tracking disabled');
  }

  // Step 6: Initialize Agent Fabric (with timeout to prevent blocking)
  let agentHealth: SystemHealth | undefined;

  if (config.features.agentFabric && !skipAgentCheck) {
    onProgress?.('Checking agent health...');
    logger.info('\n🤖 Step 6: Initializing Agent Fabric');

    // Create a timeout promise
    const timeoutPromise = new Promise<SystemHealth>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent health check timed out after ${agentCheckTimeout}ms`));
      }, agentCheckTimeout);
    });

    try {
      // Race between agent initialization and timeout
      agentHealth = await Promise.race([
        initializeAgents({
          healthCheckTimeout: Math.min(2000, agentCheckTimeout / 4), // Individual check timeout
          failFast: false, // Don't fail fast during bootstrap
          retryAttempts: isDevelopment() ? 1 : 3, // Fewer retries in dev
          retryDelay: 500,
          onProgress: (status) => {
            const icon = status.available ? '✅' : '❌';
            const time = status.responseTime ? ` (${status.responseTime}ms)` : '';
            logger.info(`   ${icon} ${status.agent}${time}`);
          },
        }),
        timeoutPromise,
      ]);

      if (!agentHealth.healthy) {
        const warningMsg = `${agentHealth.unavailableAgents} of ${agentHealth.totalAgents} agents unavailable`;
        warnings.push(warningMsg);
        onWarning?.(warningMsg);
        logger.warn(`   ⚠️  ${warningMsg}`);

        if (failFast) {
          errors.push('Agent Fabric not fully operational');
          return {
            success: false,
            config,
            agentHealth,
            errors,
            warnings,
            duration: Date.now() - startTime,
          };
        }
      } else {
        logger.info(`   ✅ All agents operational (avg ${agentHealth.averageResponseTime.toFixed(0)}ms)`);
      }
    } catch (error) {
      const errorMsg = `Agent initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      // In development, treat agent failures as warnings, not errors
      if (isDevelopment()) {
        warnings.push(errorMsg);
        onWarning?.(errorMsg);
        logger.warn(`   ⚠️  ${errorMsg} (continuing anyway in development)`);
      } else {
        errors.push(errorMsg);
        onError?.(errorMsg);
        logger.error(`   ❌ ${errorMsg}`);

        if (failFast) {
          return {
            success: false,
            config,
            errors,
            warnings,
            duration: Date.now() - startTime,
          };
        }
      }
    }
  } else {
    logger.info('\n🤖 Step 6: Agent Fabric disabled or skipped');
  }

  // Step 7: Database connection check
  if (config.database.url) {
    onProgress?.('Checking database connection...');
    logger.info('\n💾 Step 7: Database connection');
    try {
      // TODO: Check database connection
      // await checkDatabaseConnection();
      logger.info('   ⚠️  Database connection check not implemented yet');
      warnings.push('Database connection check not implemented');
      onWarning?.('Database connection check not implemented');
    } catch (error) {
      const errorMsg = `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      logger.warn(`   ⚠️  ${errorMsg}`);
    }
  } else {
    logger.info('\n💾 Step 7: Database not configured');
  }

  // Step 8: Cache initialization
  if (config.cache.enabled) {
    onProgress?.('Initializing cache...');
    logger.info('\n🗄️  Step 8: Cache initialization');
    try {
      // TODO: Initialize Redis cache
      // await initializeCache(config.cache);
      logger.info('   ⚠️  Cache initialization not implemented yet');
      warnings.push('Cache initialization not implemented');
      onWarning?.('Cache initialization not implemented');
    } catch (error) {
      const errorMsg = `Cache initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      logger.warn(`   ⚠️  ${errorMsg}`);
    }
  } else {
    logger.info('\n🗄️  Step 8: Cache disabled');
  }

  // Calculate duration
  const duration = Date.now() - startTime;

  // Final summary
  logger.debug('\n' + '='.repeat(50));
  logger.info('🎉 Bootstrap Complete!');
  logger.debug('='.repeat(50));
  logger.info(`Duration: ${duration}ms`);
  logger.info(`Errors: ${errors.length}`);
  logger.info(`Warnings: ${warnings.length}`);
  logger.info(`Status: ${errors.length === 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
  logger.info('='.repeat(50) + '\n');

  const success = errors.length === 0;

  return {
    success,
    config,
    agentHealth,
    errors,
    warnings,
    duration,
  };
}

/**
 * Bootstrap with default options
 */
export async function bootstrapDefault(): Promise<BootstrapResult> {
  return bootstrap({
    onProgress: (message) => globalLogger.debug(`⏳ ${message}`),
    onWarning: (warning) => globalLogger.warn(`⚠️  ${warning}`),
    onError: (error) => globalLogger.error(`❌ ${error}`),
  });
}

/**
 * Bootstrap for production
 */
export async function bootstrapProduction(): Promise<BootstrapResult> {
  return bootstrap({
    skipAgentCheck: false,
    failFast: true,
    onProgress: (message) => globalLogger.debug(`⏳ ${message}`),
    onWarning: (warning) => globalLogger.warn(`⚠️  ${warning}`),
    onError: (error) => globalLogger.error(`❌ ${error}`),
  });
}

/**
 * Bootstrap for development
 */
export async function bootstrapDevelopment(): Promise<BootstrapResult> {
  return bootstrap({
    skipAgentCheck: true,  // Skip agent checks in dev for fast startup
    failFast: false,
    onProgress: (message) => globalLogger.debug(`⏳ ${message}`),
    onWarning: (warning) => globalLogger.warn(`⚠️  ${warning}`),
    onError: (error) => globalLogger.error(`❌ ${error}`),
  });
}

/**
 * Bootstrap for testing
 */
export async function bootstrapTest(): Promise<BootstrapResult> {
  return bootstrap({
    skipAgentCheck: true,
    failFast: false,
  });
}
