#!/usr/bin/env tsx

/**
 * Environment Validation Script
 * Validates all required environment variables at startup
 * Fails fast with clear error messages for missing/invalid configuration
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface EnvVarConfig {
  name: string;
  required: boolean;
  pattern?: RegExp;
  validate?: (value: string) => boolean;
  description: string;
}

// Environment variable validation configuration
const ENV_CONFIGS: EnvVarConfig[] = [
  // Node.js Environment
  {
    name: 'NODE_ENV',
    required: true,
    pattern: /^(development|production|test)$/,
    description: 'Node.js environment (development/production/test)'
  },

  // API Configuration
  {
    name: 'API_PORT',
    required: true,
    pattern: /^\d+$/,
    validate: (value) => parseInt(value) > 0 && parseInt(value) < 65536,
    description: 'Backend API port (1-65535)'
  },

  // Database Configuration
  {
    name: 'DATABASE_URL',
    required: true,
    pattern: /^postgresql:\/\/.+/,
    description: 'PostgreSQL database connection URL'
  },
  {
    name: 'DB_URL',
    required: true,
    pattern: /^postgresql:\/\/.+/,
    description: 'Alternative database connection URL'
  },

  // Supabase Configuration
  {
    name: 'SUPABASE_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Supabase API URL'
  },
  {
    name: 'SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous/public key'
  },
  {
    name: 'VITE_SUPABASE_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Frontend Supabase URL'
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    required: true,
    description: 'Frontend Supabase anonymous key'
  },

  // Redis Configuration
  {
    name: 'REDIS_URL',
    required: true,
    pattern: /^redis:\/\/.*/,
    description: 'Redis connection URL'
  },

  // LLM Configuration
  {
    name: 'VITE_LLM_API_KEY',
    required: false,
    description: 'LLM API key (required for LLM features)'
  },
  {
    name: 'VITE_LLM_PROVIDER',
    required: false,
    pattern: /^(together|openai|anthropic)$/,
    description: 'LLM provider (together/openai/anthropic)'
  },

  // Frontend Configuration
  {
    name: 'VITE_APP_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Frontend application URL'
  },
  {
    name: 'VITE_API_BASE_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    description: 'Backend API base URL'
  }
];

// Validate environment variables
function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  for (const config of ENV_CONFIGS) {
    const value = process.env[config.name];

    // Check required variables
    if (config.required && (!value || value.trim() === '')) {
      result.errors.push(`❌ Missing required environment variable: ${config.name}`);
      result.errors.push(`   Description: ${config.description}`);
      result.isValid = false;
      continue;
    }

    // Skip validation if value is missing and not required
    if (!value && !config.required) {
      continue;
    }

    // Validate pattern
    if (config.pattern && !config.pattern.test(value!)) {
      result.errors.push(`❌ Invalid format for ${config.name}: ${value}`);
      result.errors.push(`   Expected pattern: ${config.pattern.source}`);
      result.isValid = false;
      continue;
    }

    // Custom validation
    if (config.validate && !config.validate(value!)) {
      result.errors.push(`❌ Validation failed for ${config.name}: ${value}`);
      result.isValid = false;
      continue;
    }

    // Security warnings
    if (config.name.includes('KEY') || config.name.includes('SECRET')) {
      if (value!.includes('CHANGE_ME') || value!.includes('your-') || value!.includes('example')) {
        result.warnings.push(`⚠️  ${config.name} appears to contain placeholder/default values`);
      }
    }

    // Development-only checks
    if (process.env.NODE_ENV === 'production') {
      if (config.name.includes('DEV') || config.name.includes('DEBUG')) {
        result.warnings.push(`⚠️  ${config.name} should not be set in production`);
      }
    }
  }

  // Cross-validation checks
  validateCrossDependencies(result);

  return result;
}

// Cross-validation between related environment variables
function validateCrossDependencies(result: ValidationResult): void {
  // Supabase URL consistency
  const supabaseUrl = process.env.SUPABASE_URL;
  const viteSupabaseUrl = process.env.VITE_SUPABASE_URL;

  if (supabaseUrl && viteSupabaseUrl && supabaseUrl !== viteSupabaseUrl) {
    result.warnings.push('⚠️  SUPABASE_URL and VITE_SUPABASE_URL differ - ensure they point to the same instance');
  }

  // LLM configuration consistency
  const hasApiKey = process.env.VITE_LLM_API_KEY;
  const hasProvider = process.env.VITE_LLM_PROVIDER;

  if (hasApiKey && !hasProvider) {
    result.warnings.push('⚠️  VITE_LLM_API_KEY set but VITE_LLM_PROVIDER not specified');
  }

  if (hasProvider && !hasApiKey) {
    result.warnings.push('⚠️  VITE_LLM_PROVIDER set but VITE_LLM_API_KEY not specified');
  }

  // URL consistency checks
  const appUrl = process.env.VITE_APP_URL;
  const apiUrl = process.env.VITE_API_BASE_URL;

  if (appUrl && apiUrl) {
    try {
      const appUrlObj = new URL(appUrl);
      const apiUrlObj = new URL(apiUrl);

      if (appUrlObj.host === apiUrlObj.host && appUrlObj.port === apiUrlObj.port) {
        result.warnings.push('⚠️  Frontend and backend URLs point to same host:port - ensure proper routing');
      }
    } catch (error) {
      result.errors.push('❌ Invalid URL format in VITE_APP_URL or VITE_API_BASE_URL');
      result.isValid = false;
    }
  }

  // Database URL validation
  const dbUrl = process.env.DATABASE_URL;
  const dbUrlAlt = process.env.DB_URL;

  if (dbUrl && dbUrlAlt && dbUrl !== dbUrlAlt) {
    result.warnings.push('⚠️  DATABASE_URL and DB_URL differ - ensure consistency');
  }
}

// Main execution
function main(): void {
  console.log('🔍 Validating environment configuration...\n');

  const result = validateEnvironment();

  // Display results
  if (result.errors.length > 0) {
    console.log('❌ Environment validation failed!\n');
    result.errors.forEach(error => console.log(error));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  Environment validation warnings:\n');
    result.warnings.forEach(warning => console.log(warning));
    console.log('');
  }

  if (result.isValid) {
    console.log('✅ Environment validation passed!\n');

    if (result.warnings.length > 0) {
      console.log('Environment is functional but review the warnings above.');
    } else {
      console.log('All required environment variables are properly configured.');
    }
  } else {
    console.log('💥 Environment validation failed. Please fix the errors above.');
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  main();
}

export { validateEnvironment, ValidationResult };