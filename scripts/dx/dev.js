#!/usr/bin/env node

/**
 * Unified Development Server
 * Starts all services with unified logging
 */

import { execSync, spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPorts, resolvePort } from './ports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../..');
const ports = loadPorts();
const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);
const supabaseStudioPort = resolvePort(
  process.env.SUPABASE_STUDIO_PORT,
  ports.supabase.studioPort
);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Format log line with service prefix
 */
function formatLog(service, line, color) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `${color}[${service}]${colors.reset}`;
  return `${colors.bright}${timestamp}${colors.reset} ${prefix} ${line}`;
}

/**
 * Check whether a port is already in use.
 */
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

/**
 * Log a warning with service prefix.
 */
function logWarning(service, message) {
  console.log(formatLog(service, `⚠️ ${message}`, colors.yellow));
}

/**
 * Start a service
 */
function startService(name, command, color) {
  console.log(formatLog(name, `Starting...`, color));

  const [cmd, ...args] = command.split(' ');
  const proc = spawn(cmd, args, {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(formatLog(name, line, color));
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(formatLog(name, line, color));
      }
    });
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(formatLog(name, `Exited with code ${code}`, color));
    }
  });

  return proc;
}

/**
 * Run a command and stream output.
 */
function runCommand(name, command) {
  return new Promise((resolve, reject) => {
    console.log(formatLog(name, `Running "${command}"...`, colors.yellow));
    const proc = spawn(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} exited with code ${code}`));
      }
    });
  });
}

/**
 * Parse CLI args for --mode.
 */
function resolveMode(args) {
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  if (modeArg) {
    return modeArg.split('=')[1];
  }

  const modeIndex = args.indexOf('--mode');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    return args[modeIndex + 1];
  }

  return 'local';
}

/**
 * Check whether Docker is publishing a host port.
 */
function isDockerPortPublished(port) {
  let output = '';
  try {
    output = execSync('docker ps --format "{{.Ports}}"', {
      cwd: projectRoot,
      encoding: 'utf8'
    }).trim();
  } catch (error) {
    return false;
  }

  if (!output) {
    return false;
  }

  const matcher = new RegExp(`(^|,\\s*)(?:[^\\s,]+:)?${port}->`);
  return output.split('\n').some(line => matcher.test(line));
}

/**
 * Main function
 */
async function main() {
  const mode = resolveMode(process.argv.slice(2));

  if (!['local', 'docker'].includes(mode)) {
    console.error(`❌ Invalid mode "${mode}". Use --mode local or --mode docker.`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting ValueOS development environment...');
  console.log('='.repeat(60) + '\n');

  const services = [];

  if (mode === 'docker') {
    await runCommand('docker', 'docker-compose -f docker-compose.full.yml up -d');
    console.log('\n' + '='.repeat(60));
    console.log('✅ Docker services are running!');
    console.log('='.repeat(60) + '\n');
    console.log('💡 Run "npm run dx:down" to stop the environment.\n');
    return;
  }

  // Start Docker dependency services first
  await runCommand('docker', 'docker-compose -f docker-compose.deps.yml up -d');

  const conflicts = [];
  if (isDockerPortPublished(3001)) {
    conflicts.push('Backend already running in Docker on 3001');
  }
  if (isDockerPortPublished(5173)) {
    conflicts.push('Frontend already running in Docker on 5173');
  }

  if (conflicts.length > 0) {
    console.error(formatLog(
      'dx',
      `${conflicts.join('. ')}. Run "npm run dx:down" or start with "npm run dx:docker".`,
      colors.yellow
    ));
    process.exit(1);
  }

  // Start backend
  const backendPortInUse = await isPortInUse(backendPort);
  if (backendPortInUse) {
    logWarning('backend', `Port ${backendPort} already in use. Skipping local backend start.`);
  } else {
    const backendProc = startService('backend', 'npm run backend:dev', colors.blue);
    services.push(backendProc);
  }

  // Wait a bit for backend to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start frontend
  const frontendPortInUse = await isPortInUse(frontendPort);
  if (frontendPortInUse) {
    logWarning(
      'frontend',
      `Port ${frontendPort} already in use. Skipping local frontend start.`
    );
  } else {
    const frontendProc = startService('frontend', 'npm run dev', colors.green);
    services.push(frontendProc);
  }

  // Wait for services to initialize
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Display service URLs
  console.log('\n' + '='.repeat(60));
  console.log('✅ All services ready!');
  console.log('='.repeat(60) + '\n');
  console.log('📍 Service URLs:');
  console.log(`   ${colors.green}Frontend:${colors.reset}  http://localhost:${frontendPort}`);
  console.log(`   ${colors.blue}Backend:${colors.reset}   http://localhost:${backendPort}`);
  console.log(
    `   ${colors.yellow}Supabase API:${colors.reset}     http://localhost:${supabaseApiPort}`
  );
  console.log(
    `   ${colors.yellow}Supabase Studio:${colors.reset}  http://localhost:${supabaseStudioPort}`
  );
  console.log('\n💡 Press Ctrl+C to stop all services\n');

  // Handle shutdown
  const shutdown = () => {
    console.log('\n\n🛑 Shutting down services...\n');
    services.forEach(proc => {
      try {
        proc.kill('SIGTERM');
      } catch (error) {
        // Ignore errors during shutdown
      }
    });
    
    setTimeout(() => {
      console.log('✅ All services stopped\n');
      process.exit(0);
    }, 2000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  await new Promise(() => {});
}

// Run
main().catch(error => {
  console.error('❌ Failed to start services:', error);
  process.exit(1);
});
