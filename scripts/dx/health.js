#!/usr/bin/env node

/**
 * Health Check System
 * Validates all services and dependencies are working
 */

import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPorts, resolvePort } from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ports = loadPorts();
const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
const postgresPort = resolvePort(process.env.POSTGRES_PORT, ports.postgres.port);
const redisPort = resolvePort(process.env.REDIS_PORT, ports.redis.port);
const supabaseApiPort = resolvePort(
  process.env.SUPABASE_API_PORT,
  ports.supabase.apiPort
);
const supabaseStudioPort = resolvePort(
  process.env.SUPABASE_STUDIO_PORT,
  ports.supabase.studioPort
);

/**
 * Check if a URL is accessible
 */
async function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'GET',
      timeout
    };

    const req = http.request(options, (res) => {
      resolve({ success: true, status: res.statusCode });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

/**
 * Check backend API
 */
async function checkBackend() {
  const url = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
  const healthUrl = `${url}/health`;
  
  const result = await checkUrl(healthUrl);
  
  return {
    name: 'Backend API',
    url: healthUrl,
    passed: result.success && result.status === 200,
    message: result.success 
      ? `✅ Backend API (${healthUrl})`
      : `❌ Backend API - ${result.error}`,
    fix: result.success ? null : `
   Possible causes:
   - Backend not started (run: npm run backend:dev)
   - Port ${backendPort} in use (check: lsof -i :${backendPort})
   - Environment vars missing (check: .env)
   
   Debug:
   $ npm run backend:dev`
  };
}

/**
 * Check frontend
 */
async function checkFrontend() {
  const url = process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
  
  const result = await checkUrl(url);
  
  return {
    name: 'Frontend',
    url,
    passed: result.success,
    message: result.success 
      ? `✅ Frontend (${url})`
      : `❌ Frontend - ${result.error}`,
    fix: result.success ? null : `
   Possible causes:
   - Frontend not started (run: npm run dev)
   - Port ${frontendPort} in use (check: lsof -i :${frontendPort})
   
   Debug:
   $ npm run dev`
  };
}

/**
 * Check PostgreSQL
 */
async function checkDatabase() {
  try {
    execSync('docker-compose ps postgres', { 
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '../..')
    });
    
    return {
      name: 'PostgreSQL',
      url: `localhost:${postgresPort}`,
      passed: true,
      message: `✅ PostgreSQL (localhost:${postgresPort})`,
      fix: null
    };
  } catch {
    return {
      name: 'PostgreSQL',
      url: `localhost:${postgresPort}`,
      passed: false,
      message: '❌ PostgreSQL - Not running',
      fix: `
   Start Docker services:
   $ docker-compose up -d`
    };
  }
}

/**
 * Check Redis
 */
async function checkRedis() {
  try {
    execSync('docker-compose ps redis', { 
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '../..')
    });
    
    return {
      name: 'Redis',
      url: `localhost:${redisPort}`,
      passed: true,
      message: `✅ Redis (localhost:${redisPort})`,
      fix: null
    };
  } catch {
    return {
      name: 'Redis',
      url: `localhost:${redisPort}`,
      passed: false,
      message: '❌ Redis - Not running',
      fix: `
   Start Docker services:
   $ docker-compose up -d`
    };
  }
}

/**
 * Check environment variables
 */
async function checkEnvironment() {
  const projectRoot = path.resolve(__dirname, '../..');
  const envPath = path.join(projectRoot, '.env');
  
  if (!fs.existsSync(envPath)) {
    return {
      name: 'Environment',
      url: '.env',
      passed: false,
      message: '❌ Environment - .env file missing',
      fix: `
   Create .env file:
   $ npm run setup`
    };
  }

  const required = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];
  const envContent = fs.readFileSync(envPath, 'utf8');
  const missing = required.filter(key => !envContent.includes(`${key}=`));

  if (missing.length > 0) {
    return {
      name: 'Environment',
      url: '.env',
      passed: false,
      message: `❌ Environment - Missing vars: ${missing.join(', ')}`,
      fix: `
   Regenerate .env file:
   $ rm .env && npm run setup`
    };
  }

  return {
    name: 'Environment',
    url: '.env',
    passed: true,
    message: '✅ Environment (all required vars set)',
    fix: null
  };
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  console.log('\n🏥 Running health checks...\n');

  const checks = await Promise.all([
    checkBackend(),
    checkFrontend(),
    checkDatabase(),
    checkRedis(),
    checkEnvironment()
  ]);

  // Display results
  checks.forEach(check => {
    console.log(check.message);
  });

  const allPassed = checks.every(c => c.passed);
  const failures = checks.filter(c => !c.passed);

  if (!allPassed) {
    console.log('\n❌ Some checks failed\n');
    failures.forEach(check => {
      if (check.fix) {
        console.log(`${check.name}:`);
        console.log(check.fix);
        console.log('');
      }
    });
    return false;
  }

  console.log('\n✅ All systems operational! 🎉\n');
  return true;
}

/**
 * Display service URLs
 */
function displayServiceUrls() {
  console.log('📍 Service URLs:');
  console.log(`   Frontend:  ${process.env.VITE_APP_URL || `http://localhost:${frontendPort}`}`);
  console.log(`   Backend:   ${process.env.BACKEND_URL || `http://localhost:${backendPort}`}`);
  console.log(`   Supabase API:     http://localhost:${supabaseApiPort}`);
  console.log(`   Supabase Studio:  http://localhost:${supabaseStudioPort}`);
  console.log('');
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthChecks().then(passed => {
    if (passed) {
      displayServiceUrls();
    }
    process.exit(passed ? 0 : 1);
  });
}

export { runHealthChecks, checkBackend, checkFrontend, checkDatabase, checkRedis, checkEnvironment };
