#!/usr/bin/env node

/**
 * Unified Development Server
 * Starts all services with unified logging
 */

import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../..');

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
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting ValueOS development environment...');
  console.log('='.repeat(60) + '\n');

  const services = [];

  // Start Docker services first
  console.log(formatLog('docker', 'Starting Docker services...', colors.yellow));
  const dockerProc = startService('docker', 'docker-compose -f docker-compose.deps.yml up', colors.yellow);
  services.push(dockerProc);

  // Wait a bit for Docker to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Start backend
  const backendPortInUse = await isPortInUse(3001);
  if (backendPortInUse) {
    logWarning('backend', 'Port 3001 already in use. Skipping local backend start.');
  } else {
    const backendProc = startService('backend', 'npm run backend:dev', colors.blue);
    services.push(backendProc);
  }

  // Wait a bit for backend to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start frontend
  const frontendPortInUse = await isPortInUse(5173);
  if (frontendPortInUse) {
    logWarning('frontend', 'Port 5173 already in use. Skipping local frontend start.');
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
  console.log(`   ${colors.green}Frontend:${colors.reset}  http://localhost:5173`);
  console.log(`   ${colors.blue}Backend:${colors.reset}   http://localhost:3000`);
  console.log(`   ${colors.yellow}Supabase:${colors.reset}  http://localhost:54323`);
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
