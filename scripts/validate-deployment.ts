#!/usr/bin/env tsx

/**
 * Deployment Validation Script
 *
 * Validates that the deployment environment is properly configured
 * and all required services are accessible before proceeding with deployment
 */

import { createLogger } from '../src/lib/logger';
import { validateSecretsOnStartup } from '../src/config/secrets/SecretValidator';

const logger = createLogger({ component: 'DeploymentValidator' });

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
}

interface ServiceCheck {
  name: string;
  url: string;
  required: boolean;
  timeout: number;
}

class DeploymentValidator {
  private environment: string;
  private baseUrl: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'staging';
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    switch (this.environment) {
      case 'production':
        return 'https://valueos.com';
      case 'staging':
        return 'https://staging.valueos.com';
      default:
        return `http://localhost:3001`;
    }
  }

  async validateAll(): Promise<ValidationResult> {
    logger.info('🔍 Starting deployment validation', {
      environment: this.environment,
      baseUrl: this.baseUrl,
    });

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      environment: this.environment,
    };

    // 1. Validate secrets configuration
    await this.validateSecrets(result);

    // 2. Validate environment variables
    this.validateEnvironmentVariables(result);

    // 3. Check service connectivity
    await this.validateServices(result);

    // 4. Validate application health
    await this.validateApplicationHealth(result);

    // 5. Validate security configuration
    this.validateSecurityConfiguration(result);

    // 6. Validate performance settings
    this.validatePerformanceSettings(result);

    // Log results
    this.logResults(result);

    return result;
  }

  private async validateSecrets(result: ValidationResult): Promise<void> {
    try {
      logger.info('🔐 Validating secrets configuration...');
      await validateSecretsOnStartup();
      logger.info('✅ Secrets validation passed');
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Secrets validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private validateEnvironmentVariables(result: ValidationResult): void {
    logger.info('🔧 Validating environment variables...');

    const requiredVars = [
      'NODE_ENV',
      'VITE_SUPABASE_URL',
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'ENCRYPTION_KEY',
    ];

    const missingVars: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      result.isValid = false;
      result.errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate specific values
    if (this.environment === 'production') {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret && jwtSecret.length < 32) {
        result.isValid = false;
        result.errors.push('JWT_SECRET must be at least 32 characters long in production');
      }

      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (encryptionKey && encryptionKey.length < 32) {
        result.isValid = false;
        result.errors.push('ENCRYPTION_KEY must be at least 32 characters long in production');
      }
    }

    logger.info('✅ Environment variables validation completed');
  }

  private async validateServices(result: ValidationResult): Promise<void> {
    logger.info('🌐 Validating service connectivity...');

    const services: ServiceCheck[] = [
      {
        name: 'Application Health',
        url: `${this.baseUrl}/health`,
        required: true,
        timeout: 10000,
      },
      {
        name: 'Secret Health',
        url: `${this.baseUrl}/health/secrets`,
        required: true,
        timeout: 5000,
      },
      {
        name: 'Metrics Endpoint',
        url: `${this.baseUrl}/metrics`,
        required: false,
        timeout: 5000,
      },
    ];

    for (const service of services) {
      try {
        const response = await this.fetchWithTimeout(service.url, service.timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        logger.info(`✅ ${service.name} is accessible`);
      } catch (error) {
        const errorMessage = `${service.name} is not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`;

        if (service.required) {
          result.isValid = false;
          result.errors.push(errorMessage);
        } else {
          result.warnings.push(errorMessage);
        }
      }
    }
  }

  private async validateApplicationHealth(result: ValidationResult): Promise<void> {
    logger.info('🏥 Validating application health...');

    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const health = await response.json();

      // Check critical health indicators
      if (health.status !== 'healthy') {
        result.isValid = false;
        result.errors.push(`Application health status: ${health.status}`);
      }

      // Check database connectivity
      if (health.checks?.database?.status !== 'healthy') {
        result.isValid = false;
        result.errors.push('Database connectivity check failed');
      }

      // Check Redis connectivity
      if (health.checks?.redis?.status !== 'healthy') {
        result.warnings.push('Redis connectivity check failed (degraded mode)');
      }

      logger.info('✅ Application health validation completed');
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Application health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateSecurityConfiguration(result: ValidationResult): void {
    logger.info('🔒 Validating security configuration...');

    // Check security headers in production
    if (this.environment === 'production') {
      const securitySettings = [
        'VITE_ENABLE_CIRCUIT_BREAKER=true',
        'VITE_ENABLE_RATE_LIMITING=true',
        'VITE_ENABLE_AUDIT_LOGGING=true',
      ];

      for (const setting of securitySettings) {
        const [key, expectedValue] = setting.split('=');
        const actualValue = process.env[key];

        if (actualValue !== expectedValue) {
          result.isValid = false;
          result.errors.push(`Security setting ${key} must be ${expectedValue} in production`);
        }
      }

      // Check that development tools are disabled
      const devTools = ['VITE_DEV_TOOLS', 'VITE_SOURCE_MAPS'];
      for (const tool of devTools) {
        if (process.env[tool] === 'true') {
          result.warnings.push(`Development tool ${tool} should be disabled in production`);
        }
      }
    }

    logger.info('✅ Security configuration validation completed');
  }

  private validatePerformanceSettings(result: ValidationResult): void {
    logger.info('⚡ Validating performance settings...');

    // Check thread pool configuration
    const threadPoolSize = parseInt(process.env.UV_THREADPOOL_SIZE || '4');
    if (threadPoolSize < 4) {
      result.warnings.push(`UV_THREADPOOL_SIZE should be at least 4, currently ${threadPoolSize}`);
    }

    // Check database pool settings
    const pgPoolMax = parseInt(process.env.PG_POOL_MAX || '20');
    if (pgPoolMax < 10) {
      result.warnings.push(`PG_POOL_MAX should be at least 10 for production, currently ${pgPoolMax}`);
    }

    logger.info('✅ Performance settings validation completed');
  }

  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private logResults(result: ValidationResult): void {
    logger.info('📊 Deployment validation results:', {
      isValid: result.isValid,
      errors: result.errors.length,
      warnings: result.warnings.length,
      environment: result.environment,
    });

    if (result.errors.length > 0) {
      logger.error('❌ Validation errors:');
      result.errors.forEach(error => logger.error(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      logger.warn('⚠️ Validation warnings:');
      result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }

    if (result.isValid && result.errors.length === 0) {
      logger.info('🎉 All validation checks passed!');
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const validator = new DeploymentValidator();

  try {
    const result = await validator.validateAll();

    if (!result.isValid) {
      logger.error('💥 Deployment validation failed! Fix the errors above before proceeding.');
      process.exit(1);
    }

    logger.info('✅ Deployment validation passed! Ready to proceed with deployment.');
    process.exit(0);
  } catch (error) {
    logger.error('💥 Deployment validation script failed:', error instanceof Error ? error : new Error('Unknown error'));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DeploymentValidator };
