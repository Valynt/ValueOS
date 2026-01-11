#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates .env file for security and completeness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../..');
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

function resolveEnvPath() {
  if (fs.existsSync(envLocalPath)) {
    return { path: envLocalPath, label: '.env.local' };
  }

  if (fs.existsSync(envPath)) {
    return { path: envPath, label: '.env' };
  }

  return { path: null, label: null };
}

/**
 * Parse .env file
 */
function parseEnvFile(content) {
  const vars = {};
  const lines = content.split('\n');
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        vars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return vars;
}

/**
 * Check for required variables
 */
function checkRequired(env) {
  const required = [
    'NODE_ENV',
    'DATABASE_URL',
    'JWT_SECRET',
    'VITE_SUPABASE_URL'
  ];

  const missing = required.filter(key => !env[key] || env[key].trim() === '');

  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(key => console.log(`   - ${key}`));
    return false;
  }

  console.log('✅ All required variables present');
  return true;
}

/**
 * Check for weak secrets
 */
function checkSecrets(env) {
  const weakPatterns = ['secret', 'password', '123', 'test', 'changeme', 'example'];
  const secretKeys = ['JWT_SECRET', 'SESSION_SECRET', 'SUPABASE_JWT_SECRET', 'ENCRYPTION_KEY'];
  
  let hasWeakSecrets = false;

  for (const key of secretKeys) {
    if (env[key]) {
      const value = env[key].toLowerCase();
      
      // Check for weak patterns
      if (weakPatterns.some(pattern => value.includes(pattern))) {
        console.log(`❌ Weak secret detected for ${key}`);
        console.log(`   Contains common pattern (${weakPatterns.find(p => value.includes(p))})`);
        hasWeakSecrets = true;
      }
      
      // Check length
      if (value.length < 32) {
        console.log(`❌ Weak secret detected for ${key}`);
        console.log(`   Too short (${value.length} chars, need >= 32)`);
        hasWeakSecrets = true;
      }
    }
  }

  if (!hasWeakSecrets) {
    console.log('✅ All secrets are strong');
  }

  return !hasWeakSecrets;
}

/**
 * Check for production credentials
 */
function checkProductionCredentials(env) {
  const productionPatterns = [
    { key: 'DATABASE_URL', patterns: ['prod', 'production', '.supabase.co', '.aws.com'] },
    { key: 'VITE_SUPABASE_URL', patterns: ['prod', 'production', '.supabase.co'] },
    { key: 'STRIPE_SECRET_KEY', patterns: ['sk_live_'] },
    { key: 'OPENAI_API_KEY', patterns: ['sk-proj-'] }
  ];

  let hasProductionCreds = false;

  for (const { key, patterns } of productionPatterns) {
    if (env[key]) {
      const value = env[key].toLowerCase();
      const matchedPattern = patterns.find(pattern => value.includes(pattern.toLowerCase()));
      
      if (matchedPattern) {
        console.log(`⚠️  Production credential detected: ${key}`);
        console.log(`   Pattern: ${matchedPattern}`);
        console.log(`   Never use production credentials locally!`);
        hasProductionCreds = true;
      }
    }
  }

  if (!hasProductionCreds) {
    console.log('✅ No production credentials detected');
  }

  return !hasProductionCreds;
}

/**
 * Check for localhost URLs
 */
function checkLocalhostUrls(env) {
  const urlKeys = ['DATABASE_URL', 'VITE_SUPABASE_URL', 'BACKEND_URL', 'VITE_APP_URL', 'REDIS_URL'];
  
  let allLocalhost = true;

  for (const key of urlKeys) {
    if (env[key]) {
      const value = env[key].toLowerCase();
      const isLocalhost = value.includes('localhost') || value.includes('127.0.0.1') || value.includes('0.0.0.0');
      
      if (!isLocalhost && env.NODE_ENV === 'development') {
        console.log(`⚠️  Non-localhost URL in development: ${key}`);
        console.log(`   Value: ${env[key]}`);
        allLocalhost = false;
      }
    }
  }

  if (allLocalhost) {
    console.log('✅ All URLs are localhost');
  }

  return allLocalhost;
}

/**
 * Main validation function
 */
async function validateEnvironment() {
  console.log('\n🔍 Validating environment configuration...\n');

  const resolvedEnv = resolveEnvPath();
  if (!resolvedEnv.path) {
    console.log('❌ No environment file found (.env.local or .env)');
    console.log('\nRun: npm run setup\n');
    return false;
  }

  console.log(`Using ${resolvedEnv.label}`);

  // Read and parse environment file
  const content = fs.readFileSync(resolvedEnv.path, 'utf8');
  const env = parseEnvFile(content);

  // Run checks
  const checks = [
    checkRequired(env),
    checkSecrets(env),
    checkProductionCredentials(env),
    checkLocalhostUrls(env)
  ];

  const allPassed = checks.every(check => check);

  if (allPassed) {
    console.log('\n✅ Environment validation passed!\n');
    return true;
  } else {
    console.log('\n❌ Environment validation failed\n');
    console.log('Fix issues above or regenerate:');
    console.log('  rm .env.local && npm run setup\n');
    return false;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  validateEnvironment().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

export { validateEnvironment };
