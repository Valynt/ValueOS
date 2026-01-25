#!/usr/bin/env node

/**
 * ValueOS Developer Experience Setup
 * Automated setup script for local development environment
 */

import { displayPlatformInfo } from '../lib/platform.js';
import { checkPrerequisites } from '../lib/prerequisites.js';
import { setupEnvironment } from '../lib/environment.js';
import { progressTracker, spinner } from '../lib/progress.js';
import { retryWithRecovery } from '../lib/recovery.js';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writePortsEnvFile } from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const shouldStart =
  args.has('--start') || /^(1|true|yes)$/i.test(process.env.START_DEV_SERVER || '');
const shouldSeed =
  args.has('--seed') || /^(1|true|yes)$/i.test(process.env.SEED_DB || '');

if (args.has('--help') || args.has('-h')) {
  console.log('Usage: node scripts/dx/setup.js [--start] [--seed]');
  console.log('');
  console.log('Options:');
  console.log('  --start   Start the dev environment via pnpm run dx after setup');
  console.log('  --seed    Seed the database after setup (requires a running database)');
  process.exit(0);
}

// Track setup metrics
const metrics = {
  startTime: Date.now(),
  platform: null,
  steps: [],
  success: false
};

/**
 * Execute command with progress tracking
 */
function exec(command, description) {
  const stepStart = Date.now();
  console.log(`\n⏳ ${description}...`);
  
  try {
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../..')
    });
    const duration = Date.now() - stepStart;
    metrics.steps.push({ name: description, success: true, duration });
    console.log(`✅ ${description} (${(duration / 1000).toFixed(1)}s)`);
    return true;
  } catch (error) {
    const duration = Date.now() - stepStart;
    metrics.steps.push({ name: description, success: false, duration });
    console.error(`❌ ${description} failed`);
    return false;
  }
}

/**
 * Check if .env file exists
 */
function envFileExists() {
  const projectRoot = path.resolve(__dirname, '../..');
  return fs.existsSync(path.join(projectRoot, '.env.local'));
}

/**
 * Check for an existing DX session
 */
function getExistingDxSession() {
  const projectRoot = path.resolve(__dirname, '../..');
  const dxStatePath = path.join(projectRoot, '.dx-state.json');

  if (!fs.existsSync(dxStatePath)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(dxStatePath, 'utf8'));
    try {
      process.kill(state.pid, 0);
      return state;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Ensure .env exists for tooling that expects it
 */
function ensureDotEnvFromLocal() {
  const projectRoot = path.resolve(__dirname, '../..');
  const envLocalPath = path.join(projectRoot, '.env.local');
  const envPath = path.join(projectRoot, '.env');

  if (!fs.existsSync(envPath) && fs.existsSync(envLocalPath)) {
    fs.copyFileSync(envLocalPath, envPath);
    console.log('✅ Created .env from .env.local');
  }
}

function ensurePortsEnv() {
  // Delegate to canonical env-compiler for .env.ports
  const projectRoot = path.resolve(__dirname, '../..');
  const portsPath = path.join(projectRoot, '.env.ports');
  
  // Use writePortsEnvFile for backwards compatibility, but env-compiler is authoritative
  writePortsEnvFile(portsPath);
}

/**
 * Generate environment files using the canonical env-compiler
 */
function generateEnvFiles(mode = 'local') {
  console.log('\n📝 Generating environment files...');
  try {
    execSync(`node scripts/dx/env-compiler.js --mode ${mode} --force`, {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'inherit'
    });
    return true;
  } catch (error) {
    console.error('❌ Failed to generate environment files');
    return false;
  }
}

/**
 * Load .env.local into process.env
 */
function loadEnvLocal() {
  const projectRoot = path.resolve(__dirname, '../..');
  const envLocalPath = path.join(projectRoot, '.env.local');

  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  }
}

/**
 * Install dependencies
 */
async function installDependencies() {
  console.log('\n📦 Installing dependencies...');
  console.log('   This may take a few minutes...\n');
  
  // Use pnpm install --frozen-lockfile for faster, more reliable installs
  const command = fs.existsSync(path.resolve(__dirname, '../../package-lock.json'))
    ? 'pnpm install --frozen-lockfile'
    : 'pnpm install';
  
  return exec(command, 'Install dependencies');
}

/**
 * Seed the database
 */
async function seedDatabase() {
  loadEnvLocal();
  return exec('bash scripts/db-seed.sh', 'Seed database');
}


/**
 * Display success message
 */
function displaySuccess() {
  const duration = Date.now() - metrics.startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Setup complete! 🎉');
  console.log('='.repeat(60));
  console.log(`\n⏱️  Time: ${minutes}m ${seconds}s`);
  console.log('\n📋 Next steps:');
  console.log('   1. Start development: pnpm run dx');
  console.log('   2. Open frontend: http://localhost:5173');
  console.log('   3. Read docs: docs/GETTING_STARTED.md');
  console.log('\n💡 Useful commands:');
  console.log('   pnpm run health     - Check system health');
  console.log('   pnpm run dx         - Start all services');
  console.log('   docker-compose -f docker-compose.deps.yml ps  - Check Docker services');
  console.log('\n🚀 Happy coding!\n');
}

/**
 * Display failure message
 */
function displayFailure(error) {
  console.log('\n' + '='.repeat(60));
  console.log('❌ Setup failed');
  console.log('='.repeat(60));
  console.log(`\n${error.message}\n`);
  console.log('💡 Troubleshooting:');
  console.log('   1. Check error messages above');
  console.log('   2. Ensure Docker is running');
  console.log('   3. Check docs/TROUBLESHOOTING.md');
  console.log('   4. Ask for help in #engineering\n');
}

/**
 * Save metrics
 */
function saveMetrics() {
  const projectRoot = path.resolve(__dirname, '../..');
  const metricsPath = path.join(projectRoot, '.dx-metrics.json');
  
  try {
    const existingMetrics = fs.existsSync(metricsPath)
      ? JSON.parse(fs.readFileSync(metricsPath, 'utf8'))
      : [];
    
    existingMetrics.push({
      ...metrics,
      timestamp: new Date().toISOString(),
      duration: Date.now() - metrics.startTime
    });
    
    fs.writeFileSync(metricsPath, JSON.stringify(existingMetrics, null, 2));
  } catch (error) {
    // Silently fail - metrics are nice to have but not critical
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ValueOS Developer Experience Setup');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Detect platform
    const { platform, config } = displayPlatformInfo();
    metrics.platform = platform;
    
    // Step 2: Check prerequisites
    const prereqsPassed = await checkPrerequisites();
    if (!prereqsPassed) {
      throw new Error('Prerequisites check failed');
    }
    
    // Step 3: Setup environment
    if (!envFileExists()) {
      console.log('\n🔧 Setting up environment configuration...');
      await setupEnvironment({
        projectName: 'valueos-dev',
        environment: 'development',
        enableDebug: true,
        envFile: '.env.local'
      });
    } else {
      console.log('\n✅ .env.local already exists, skipping environment setup');
      console.log('   To regenerate: rm .env.local && pnpm run setup\n');
    }

    ensureDotEnvFromLocal();
    ensurePortsEnv();
    
    // Step 4: Install dependencies
    const depsSuccess = await installDependencies();
    if (!depsSuccess) {
      throw new Error('Dependency installation failed');
    }
    
    // Step 5: Optional database seed
    if (shouldSeed) {
      const seedSuccess = await seedDatabase();
      if (!seedSuccess) {
        throw new Error('Database seed failed');
      }
    }

    // Step 6: Optional start
    if (shouldStart) {
      const existingSession = getExistingDxSession();
      if (existingSession) {
        console.log(
          `\n⚠️  Development environment already running (pid ${existingSession.pid}, mode ${existingSession.mode}).`
        );
        console.log('   Skipping automatic start to avoid duplicate processes.\n');
      } else {
        const startSuccess = exec('pnpm run dx', 'Start development environment');
        if (!startSuccess) {
          throw new Error('Development start failed');
        }
      }
    }
    
    // Success!
    metrics.success = true;
    displaySuccess();
    
  } catch (error) {
    metrics.success = false;
    displayFailure(error);
    process.exit(1);
  } finally {
    saveMetrics();
  }
}

// Run setup
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
