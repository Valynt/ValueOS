/**
 * Application Bootstrap
 * 
 * Production-ready initialization sequence for the ValueCanvas application.
 * Ensures all systems are ready before rendering the UI.
 */

import { getConfig, validateEnvironmentConfig, isProduction } from './config/environment';
import { initializeAgents, SystemHealth } from './services/AgentInitializer';
import { initializeSecurity, validateSecurity } from './security';
import { createLogger } from './lib/logger';

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
   * @default false
   */
  skipAgentCheck?: boolean;

  /**
   * Fail fast on errors
   * @default true in production
   */
  failFast?: boolean;

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
    skipAgentCheck = false,
    failFast = isProduction(),
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
  console.log(`   SDUI Debug: ${config.features.sduiDebug ? '✅' : '❌'}`);
  console.log(`   Agent Fabric: ${config.features.agentFabric ? '✅' : '❌'}`);
  console.log(`   Workflow: ${config.features.workflow ? '✅' : '❌'}`);
  console.log(`   Compliance: ${config.features.compliance ? '✅' : '❌'}`);
  console.log(`   Multi-Tenant: ${config.features.multiTenant ? '✅' : '❌'}`);
  console.log(`   Usage Tracking: ${config.features.usageTracking ? '✅' : '❌'}`);
  console.log(`   Billing: ${config.features.billing ? '✅' : '❌'}`);

  // Step 4: Initialize security
  onProgress?.('Initializing security...');
  console.log('\n🔒 Step 4: Security initialization');
  try {
    // Validate security configuration
    const securityValidation = validateSecurity();
    if (securityValidation.errors.length > 0) {
      securityValidation.errors.forEach((error) => {
        errors.push(error);
        onError?.(error);
        console.error(`   ❌ ${error}`);
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
        console.warn(`   ⚠️  ${warning}`);
      });
    }

    // Initialize security features
    initializeSecurity();
    console.log('   ✅ Security features initialized');
    console.log(`   - Password policy: ${config.passwordPolicy.minLength}+ chars`);
    console.log(`   - CSRF protection: ${config.security.csrfEnabled ? '✅' : '❌'}`);
    console.log(`   - Rate limiting: ${config.rateLimit.global.enabled ? '✅' : '❌'}`);
    console.log(`   - CSP: ${config.csp.enabled ? '✅' : '❌'}`);
    console.log(`   - HTTPS only: ${config.security.httpsOnly ? '✅' : '❌'}`);
  } catch (error) {
    const errorMsg = `Failed to initialize security: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    onError?.(errorMsg);
    console.error(`   ❌ ${errorMsg}`);

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
    console.log('\n📊 Step 5: Initializing Sentry');
    try {
      // TODO: Initialize Sentry
      // await initializeSentry(config.monitoring.sentry);
      console.log('   ⚠️  Sentry initialization not implemented yet');
      warnings.push('Sentry initialization not implemented');
      onWarning?.('Sentry initialization not implemented');
    } catch (error) {
      const errorMsg = `Failed to initialize Sentry: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      console.warn(`   ⚠️  ${errorMsg}`);
    }
  } else {
    console.log('\n📊 Step 5: Error tracking disabled');
  }

  // Step 6: Initialize Agent Fabric
  let agentHealth: SystemHealth | undefined;

  if (config.features.agentFabric && !skipAgentCheck) {
    onProgress?.('Checking agent health...');
    console.log('\n🤖 Step 6: Initializing Agent Fabric');

    try {
      agentHealth = await initializeAgents({
        healthCheckTimeout: 5000,
        failFast: false, // Don't fail fast during bootstrap
        retryAttempts: 3,
        retryDelay: 1000,
        onProgress: (status) => {
          const icon = status.available ? '✅' : '❌';
          const time = status.responseTime ? ` (${status.responseTime}ms)` : '';
          console.log(`   ${icon} ${status.agent}${time}`);
        },
      });

      if (!agentHealth.healthy) {
        const warningMsg = `${agentHealth.unavailableAgents} of ${agentHealth.totalAgents} agents unavailable`;
        warnings.push(warningMsg);
        onWarning?.(warningMsg);
        console.warn(`   ⚠️  ${warningMsg}`);

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
        console.log(`   ✅ All agents operational (avg ${agentHealth.averageResponseTime.toFixed(0)}ms)`);
      }
    } catch (error) {
      const errorMsg = `Agent initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      onError?.(errorMsg);
      console.error(`   ❌ ${errorMsg}`);

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
  } else {
    console.log('\n🤖 Step 6: Agent Fabric disabled or skipped');
  }

  // Step 7: Database connection check
  if (config.database.url) {
    onProgress?.('Checking database connection...');
    console.log('\n💾 Step 7: Database connection');
    try {
      // TODO: Check database connection
      // await checkDatabaseConnection();
      console.log('   ⚠️  Database connection check not implemented yet');
      warnings.push('Database connection check not implemented');
      onWarning?.('Database connection check not implemented');
    } catch (error) {
      const errorMsg = `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      console.warn(`   ⚠️  ${errorMsg}`);
    }
  } else {
    console.log('\n💾 Step 7: Database not configured');
  }

  // Step 8: Cache initialization
  if (config.cache.enabled) {
    onProgress?.('Initializing cache...');
    console.log('\n🗄️  Step 8: Cache initialization');
    try {
      // TODO: Initialize Redis cache
      // await initializeCache(config.cache);
      console.log('   ⚠️  Cache initialization not implemented yet');
      warnings.push('Cache initialization not implemented');
      onWarning?.('Cache initialization not implemented');
    } catch (error) {
      const errorMsg = `Cache initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      warnings.push(errorMsg);
      onWarning?.(errorMsg);
      console.warn(`   ⚠️  ${errorMsg}`);
    }
  } else {
    console.log('\n🗄️  Step 8: Cache disabled');
  }

  // Calculate duration
  const duration = Date.now() - startTime;

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Bootstrap Complete!');
  console.log('='.repeat(50));
  console.log(`Duration: ${duration}ms`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Status: ${errors.length === 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log('='.repeat(50) + '\n');

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
    onProgress: (message) => console.log(`⏳ ${message}`),
    onWarning: (warning) => console.warn(`⚠️  ${warning}`),
    onError: (error) => console.error(`❌ ${error}`),
  });
}

/**
 * Bootstrap for production
 */
export async function bootstrapProduction(): Promise<BootstrapResult> {
  return bootstrap({
    skipAgentCheck: false,
    failFast: true,
    onProgress: (message) => console.log(`⏳ ${message}`),
    onWarning: (warning) => console.warn(`⚠️  ${warning}`),
    onError: (error) => console.error(`❌ ${error}`),
  });
}

/**
 * Bootstrap for development
 */
export async function bootstrapDevelopment(): Promise<BootstrapResult> {
  return bootstrap({
    skipAgentCheck: false,
    failFast: false,
    onProgress: (message) => console.log(`⏳ ${message}`),
    onWarning: (warning) => console.warn(`⚠️  ${warning}`),
    onError: (error) => console.error(`❌ ${error}`),
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
