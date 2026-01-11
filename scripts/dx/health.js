#!/usr/bin/env node

/**
 * Health Check System
 * Validates all services and dependencies are working.
 *
 * Single source of truth for ports comes from ./ports.js (loadPorts/resolvePort).
 */

import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveMode } from './lib/mode.js';
import { loadPorts, resolvePort } from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mode;
try {
  mode = resolveMode(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Port registry (single source of truth)
const portConfig = loadPorts();

const backendPort = resolvePort(process.env.API_PORT, portConfig.backend.port);
const frontendPort = resolvePort(process.env.VITE_PORT, portConfig.frontend.port);
const postgresPort = resolvePort(process.env.POSTGRES_PORT, portConfig.postgres.port);
const redisPort = resolvePort(process.env.REDIS_PORT, portConfig.redis.port);
const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, portConfig.supabase.apiPort);
const supabaseStudioPort = resolvePort(process.env.SUPABASE_STUDIO_PORT, portConfig.supabase.studioPort);

const backendBaseUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
const frontendBaseUrl = process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;

/**
 * Check if a URL is accessible
 */
async function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: `${urlObj.pathname}${urlObj.search}`,
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
  const healthUrl = `${backendBaseUrl}/health`;
  const result = await checkUrl(healthUrl);

  return {
    name: 'Backend API',
    url: healthUrl,
    passed: result.success && result.status === 200,
    message: result.success
      ? `OK  Backend API (${healthUrl})`
      : `ERR Backend API - ${result.error}`,
    fix: result.success
      ? null
      : `\
Possible causes:\
- Backend not started (run: npm run backend:dev)\
- Port ${backendPort} in use (check: lsof -i :${backendPort})\
- Environment vars missing or wrong (check: .env)\
\
Debug:\
$ npm run backend:dev\
`
  };
}

/**
 * Check frontend
 */
async function checkFrontend() {
  const result = await checkUrl(frontendBaseUrl);

  return {
    name: 'Frontend',
    url: frontendBaseUrl,
    passed: result.success,
    message: result.success
      ? `OK  Frontend (${frontendBaseUrl})`
      : `ERR Frontend - ${result.error}`,
    fix: result.success
      ? null
      : `\
Possible causes:\
- Frontend not started (run: npm run dev)\
- Port ${frontendPort} in use (check: lsof -i :${frontendPort})\
\
Debug:\
$ npm run dev\
`
  };
}

/**
 * Check PostgreSQL (via docker compose service status)
 */
async function checkDatabase() {
  const composeFile = mode === 'docker'
    ? 'docker-compose.full.yml'
    : 'docker-compose.deps.yml';

  try {
    execSync(`docker compose -f ${composeFile} ps postgres`, {
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '../..')
    });

    return {
      name: 'PostgreSQL',
      url: `localhost:${postgresPort}`,
      passed: true,
      message: `OK  PostgreSQL (localhost:${postgresPort})`,
      fix: null
    };
  } catch {
    return {
      name: 'PostgreSQL',
      url: `localhost:${postgresPort}`,
      passed: false,
      message: 'ERR PostgreSQL - Not running',
      fix: `\
Start Docker services:\
$ docker compose -f ${composeFile} up -d\
`
    };
  }
}

/**
 * Check Redis (via docker compose service status)
 */
async function checkRedis() {
  const composeFile = mode === 'docker'
    ? 'docker-compose.full.yml'
    : 'docker-compose.deps.yml';

  try {
    execSync(`docker compose -f ${composeFile} ps redis`, {
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '../..')
    });

    return {
      name: 'Redis',
      url: `localhost:${redisPort}`,
      passed: true,
      message: `OK  Redis (localhost:${redisPort})`,
      fix: null
    };
  } catch {
    return {
      name: 'Redis',
      url: `localhost:${redisPort}`,
      passed: false,
      message: 'ERR Redis - Not running',
      fix: `\
Start Docker services:\
$ docker compose -f ${composeFile} up -d\
`
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
      message: 'ERR Environment - .env file missing',
      fix: `\
Create .env file:\
$ npm run setup\
`
    };
  }

  const required = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];
  const envContent = fs.readFileSync(envPath, 'utf8');
  const missing = required.filter((key) => !envContent.includes(`${key}=`));

  if (missing.length > 0) {
    return {
      name: 'Environment',
      url: '.env',
      passed: false,
      message: `ERR Environment - Missing vars: ${missing.join(', ')}`,
      fix: `\
Regenerate .env file:\
$ rm .env && npm run setup\
`
    };
  }

  return {
    name: 'Environment',
    url: '.env',
    passed: true,
    message: 'OK  Environment (all required vars set)',
    fix: null
  };
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  // Keep output simple and consistent for CI.
  console.log('\nRunning health checks...\n');

  const checks = await Promise.all([
    checkBackend(),
    checkFrontend(),
    checkDatabase(),
    checkRedis(),
    checkEnvironment()
  ]);

  // Display results
  for (const check of checks) {
    console.log(check.message);
  }

  const allPassed = checks.every((c) => c.passed);
  const failures = checks.filter((c) => !c.passed);

  if (!allPassed) {
    console.log('\nSome checks failed\n');
    for (const check of failures) {
      if (check.fix) {
        console.log(`${check.name}:`);
        console.log(check.fix);
      }
    }
    return false;
  }

  console.log('\nAll systems operational\n');
  return true;
}

/**
 * Display service URLs
 */
function displayServiceUrls() {
  console.log('Service URLs:');
  console.log(`  Frontend:         ${frontendBaseUrl}`);
  console.log(`  Backend:          ${backendBaseUrl}`);
  console.log(`  Supabase API:     http://localhost:${supabaseApiPort}`);
  console.log(`  Supabase Studio:  http://localhost:${supabaseStudioPort}`);
  console.log('');
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthChecks().then((passed) => {
    if (passed) displayServiceUrls();
    process.exit(passed ? 0 : 1);
  });
}

export {
  runHealthChecks,
  checkBackend,
  checkFrontend,
  checkDatabase,
  checkRedis,
  checkEnvironment
};
