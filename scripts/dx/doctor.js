#!/usr/bin/env node

/**
 * DX Doctor: fail-fast preflight checks for dev environment.
 */

import fs from 'fs';
import net from 'net';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadPorts, resolvePort, formatPortsEnv, writePortsEnvFile } from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const args = process.argv.slice(2);

function resolveMode(cliArgs) {
  const modeArg = cliArgs.find(arg => arg.startsWith('--mode='));
  if (modeArg) {
    return modeArg.split('=')[1];
  }

  const modeIndex = cliArgs.indexOf('--mode');
  if (modeIndex !== -1 && cliArgs[modeIndex + 1]) {
    return cliArgs[modeIndex + 1];
  }

  return process.env.DX_MODE || 'local';
}

const mode = resolveMode(args);

const ports = loadPorts();
const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
const postgresPort = resolvePort(process.env.POSTGRES_PORT, ports.postgres.port);
const redisPort = resolvePort(process.env.REDIS_PORT, ports.redis.port);
const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);
const supabaseStudioPort = resolvePort(process.env.SUPABASE_STUDIO_PORT, ports.supabase.studioPort);

const frontendUrl = process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

const failures = [];

function reportFailure(title, details, fix) {
  failures.push({ title, details, fix });
}

function runCommand(command, options = {}) {
  return execSync(command, {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options
  });
}

function commandExists(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensurePortsEnvFile() {
  const portsPath = path.join(projectRoot, '.env.ports');
  const desired = formatPortsEnv(ports);

  if (!fs.existsSync(portsPath)) {
    writePortsEnvFile(portsPath);
    return;
  }

  const current = fs.readFileSync(portsPath, 'utf8');
  if (current.trim() !== desired.trim()) {
    writePortsEnvFile(portsPath);
  }
}

function parseMajor(version) {
  return Number(String(version).replace(/^v/, '').split('.')[0]);
}

function checkNodeVersion() {
  const nvmrcPath = path.join(projectRoot, '.nvmrc');
  if (!fs.existsSync(nvmrcPath)) {
    return;
  }

  const expected = fs.readFileSync(nvmrcPath, 'utf8').trim();
  if (!expected) {
    return;
  }

  const expectedMajor = parseMajor(expected);
  const actualMajor = parseMajor(process.version);

  if (expectedMajor && actualMajor !== expectedMajor) {
    reportFailure(
      'Node.js version mismatch',
      `Expected Node ${expectedMajor} from .nvmrc, found ${process.version}.`,
      'Run: nvm install && nvm use'
    );
  }
}

function checkDocker() {
  if (!commandExists('docker')) {
    reportFailure(
      'Docker missing',
      'Docker CLI not found in PATH.',
      'Install Docker Desktop: https://www.docker.com/products/docker-desktop'
    );
    return;
  }

  try {
    runCommand('docker info');
  } catch (error) {
    reportFailure(
      'Docker not running',
      'Docker daemon is not responding.',
      'Start Docker Desktop (or `sudo systemctl start docker`).'
    );
  }

  try {
    runCommand('docker context show');
  } catch {
    reportFailure(
      'Docker context unavailable',
      'Unable to read Docker context.',
      'Run: docker context ls && docker context use default'
    );
  }
}

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port, host);
  });
}

function isDockerPortPublished(port) {
  try {
    const output = runCommand('docker ps --format "{{.Ports}}"').trim();
    if (!output) {
      return false;
    }

    const matcher = new RegExp(`(^|,\\s*)(?:[^\\s,]+:)?${port}->`);
    return output.split('\n').some(line => matcher.test(line));
  } catch {
    return false;
  }
}

async function checkPorts() {
  const portChecks = [
    { name: 'Frontend', port: frontendPort },
    { name: 'Backend', port: backendPort }
  ];

  if (mode === 'local') {
    portChecks.push(
      { name: 'Postgres', port: postgresPort },
      { name: 'Redis', port: redisPort }
    );
  }

  for (const { name, port } of portChecks) {
    const inUse = await isPortInUse(port);
    if (inUse && !isDockerPortPublished(port) && process.env.DX_ALLOW_PORT_IN_USE !== '1') {
      reportFailure(
        `${name} port in use`,
        `Port ${port} is already bound on localhost.`,
        `Free the port (lsof -i :${port}) or run with DX_ALLOW_PORT_IN_USE=1.`
      );
    }
  }
}

function checkEnvironment() {
  const envLocalPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envLocalPath)) {
    reportFailure(
      '.env.local missing',
      'Local environment file is required.',
      'Run: npm run setup'
    );
  }
}

function checkComposeState() {
  let fullRunning = [];
  let depsRunning = [];

  if (commandExists('docker')) {
    try {
      fullRunning = runCommand('docker compose -f docker-compose.full.yml ps --status running --services', {
        stdio: 'pipe'
      })
        .trim()
        .split('\n')
        .filter(Boolean);
    } catch {
      fullRunning = [];
    }

    try {
      depsRunning = runCommand('docker compose -f docker-compose.deps.yml ps --status running --services', {
        stdio: 'pipe'
      })
        .trim()
        .split('\n')
        .filter(Boolean);
    } catch {
      depsRunning = [];
    }
  }

  if (mode === 'local' && fullRunning.length > 0) {
    reportFailure(
      'Full Docker stack already running',
      `Running services: ${fullRunning.join(', ')}`,
      'Stop it with: npm run dx:down (or use npm run dx:docker)'
    );
  }

  if (mode === 'docker' && depsRunning.length > 0) {
    reportFailure(
      'Local deps already running',
      `Running services: ${depsRunning.join(', ')}`,
      'Stop it with: npm run dx:down (or use npm run dx)'
    );
  }
}

function checkSupabase() {
  const isLocalSupabase = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');
  if (!isLocalSupabase) {
    return;
  }

  if (!commandExists('supabase')) {
    reportFailure(
      'Supabase CLI missing',
      'Supabase URL is local but CLI is not installed.',
      'Install with: npm install -g supabase'
    );
    return;
  }

  try {
    runCommand('supabase status');
  } catch {
    reportFailure(
      'Supabase local not running',
      `Expected Supabase at http://localhost:${supabaseApiPort}`,
      'Start it with: supabase start'
    );
  }
}

async function main() {
  if (!['local', 'docker'].includes(mode)) {
    console.error(`❌ Invalid mode "${mode}". Use --mode local or --mode docker.`);
    process.exit(1);
  }

  console.log(`\n🧪 DX Doctor (mode: ${mode})\n`);

  ensurePortsEnvFile();
  checkNodeVersion();
  checkDocker();
  checkEnvironment();
  checkComposeState();
  checkSupabase();
  await checkPorts();

  if (failures.length > 0) {
    console.log('❌ Preflight checks failed:\n');
    failures.forEach((failure) => {
      console.log(`- ${failure.title}`);
      console.log(`  ${failure.details}`);
      if (failure.fix) {
        console.log(`  Fix: ${failure.fix}`);
      }
      console.log('');
    });
    process.exit(1);
  }

  console.log('✅ All preflight checks passed.\n');
  console.log('Ports:');
  console.log(`  Frontend:        ${frontendUrl}`);
  console.log(`  Backend:         ${backendUrl}`);
  console.log(`  Supabase API:    http://localhost:${supabaseApiPort}`);
  console.log(`  Supabase Studio: http://localhost:${supabaseStudioPort}\n`);
}

main().catch((error) => {
  console.error('❌ Doctor failed:', error.message);
  process.exit(1);
});
