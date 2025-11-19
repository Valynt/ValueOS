/**
 * Application Bootstrap
 * 
 * Production-ready initialization sequence for the ValueCanvas application.
 * Ensures all systems are ready before rendering the UI.
 */

import { getConfig, validateEnvironmentConfig, isProduction } from './config/environment';
import { initializeAgents, SystemHealth } from './services/AgentInitializer';

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

  const {
    skipAgentCheck = false,
    failFast = isProduction(),
    onProgress,
    onWarning,
    onError,
  } = options;

  console.log('🚀 Bootstrapping ValueCanvas Application...\n');

  // Step 1: Load and validate environment configuration
  onProgress?.('Loading environment configuration...');
  console.log('📋 Step 1: Loading environment configuration');

  let config: ReturnType<typeof getConfig>;
  try {
    config = getConfig();
    console.log(`   Environment: ${config.app.env}`);
    console.log(`   App URL: ${config.app.url}`);
    console.log(`   API URL: ${config.app.apiBaseUrl}`);
    console.log(`   Agent API: ${config.agents.apiUrl}`);
  } catch (error) {
    const errorMsg = `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    onError?.(errorMsg);
    console.error(`   ❌ ${errorMsg}`);

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
  console.log('\n📋 Step 2: Validating configuration');

  const configErrors = validateEnvironmentConfig(config);
  if (configErrors.length > 0) {
    configErrors.forEach((error) => {
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
  } else {
    console.log('   ✅ Configuration valid');
  }

  // Step 3: Check feature flags
  onProgress?.('Checking feature flags...');
  console.log('\n🎯 Step 3: Feature flags');
  console.log(`   SDUI Debug: ${config.features.sduiDebug ? '✅' : '❌'}`);
  console.log(`   Agent Fabric: ${config.features.agentFabric ? '✅' : '❌'}`);
  console.log(`   Workflow: ${config.features.workflow ? '✅' : '❌'}`);
  console.log(`   Compliance: ${config.features.compliance ? '✅' : '❌'}`);
  console.log(`   Multi-Tenant: ${config.features.multiTenant ? '✅' : '❌'}`);
  console.log(`   Usage Tracking: ${config.features.usageTracking ? '✅' : '❌'}`);
  console.log(`   Billing: ${config.features.billing ? '✅' : '❌'}`);

  // Step 4: Initialize monitoring (if enabled)
  if (config.monitoring.sentry.enabled) {
    onProgress?.('Initializing error tracking...');
    console.log('\n📊 Step 4: Initializing Sentry');
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
    console.log('\n📊 Step 4: Error tracking disabled');
  }

  // Step 5: Initialize Agent Fabric
  let agentHealth: SystemHealth | undefined;

  if (config.features.agentFabric && !skipAgentCheck) {
    onProgress?.('Checking agent health...');
    console.log('\n🤖 Step 5: Initializing Agent Fabric');

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
    console.log('\n🤖 Step 5: Agent Fabric disabled or skipped');
  }

  // Step 6: Database connection check
  if (config.database.url) {
    onProgress?.('Checking database connection...');
    console.log('\n💾 Step 6: Database connection');
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
    console.log('\n💾 Step 6: Database not configured');
  }

  // Step 7: Cache initialization
  if (config.cache.enabled) {
    onProgress?.('Initializing cache...');
    console.log('\n🗄️  Step 7: Cache initialization');
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
    console.log('\n🗄️  Step 7: Cache disabled');
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
