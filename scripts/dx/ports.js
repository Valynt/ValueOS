import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../..');
const portsPath = path.join(projectRoot, 'config', 'ports.json');

export function loadPorts() {
  const raw = fs.readFileSync(portsPath, 'utf8');
  const parsed = JSON.parse(raw);
  validatePorts(parsed);
  console.log('✅ Loaded ports configuration from', portsPath);
  return parsed;
}

function validatePorts(ports) {
  const usedPorts = new Set();
  const conflicts = [];

  function checkPort(service, portName, portValue) {
    if (typeof portValue !== 'number' || !Number.isInteger(portValue)) {
      throw new Error(`${service}.${portName} must be an integer, got ${portValue}`);
    }
    if (portValue < 1 || portValue > 65535) {
      throw new Error(`${service}.${portName} must be between 1-65535, got ${portValue}`);
    }
    if (usedPorts.has(portValue)) {
      conflicts.push(`${service}.${portName} conflicts with existing port ${portValue}`);
    } else {
      usedPorts.add(portValue);
    }
  }

  Object.entries(ports).forEach(([service, config]) => {
    Object.entries(config).forEach(([key, value]) => {
      if (key.includes('Port') || key === 'port') {
        checkPort(service, key, value);
      }
    });
  });

  if (conflicts.length > 0) {
    throw new Error(`Port conflicts detected:\n${conflicts.join('\n')}`);
  }
}

export function resolvePort(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export function formatPortsEnv(ports) {
  return [
    '# ValueOS Port Configuration',
    '# Generated from config/ports.json',
    '',
    '# Database Ports',
    `POSTGRES_PORT=${ports.postgres.port}`,
    `REDIS_PORT=${ports.redis.port}`,
    '',
    '# Application Ports',
    `API_PORT=${ports.backend.port}`,
    `VITE_PORT=${ports.frontend.port}`,
    '',
    '# Supabase Ports (if running locally)',
    `SUPABASE_API_PORT=${ports.supabase.apiPort}`,
    `SUPABASE_STUDIO_PORT=${ports.supabase.studioPort}`,
    '',
    '# Reverse Proxy Ports',
    `CADDY_HTTP_PORT=${ports.edge.httpPort}`,
    `CADDY_HTTPS_PORT=${ports.edge.httpsPort}`,
    `CADDY_ADMIN_PORT=${ports.edge.adminPort}`,
    '',
    '# Observability Ports',
    `PROMETHEUS_PORT=${ports.observability.prometheusPort}`,
    `GRAFANA_PORT=${ports.observability.grafanaPort}`,
    '',
    '# Security Configuration',
    'GRAFANA_ADMIN_PASSWORD=admin',
    '',
    '# Development Domain',
    'DEV_DOMAIN=localhost',
    '',
    '# Service URLs (auto-configured)',
    `API_UPSTREAM=http://backend:${ports.backend.port}`,
    `FRONTEND_UPSTREAM=http://frontend:80`,
    '',
    '# Logging Configuration',
    'CADDY_LOG_LEVEL=DEBUG',
    'AUTO_HTTPS=off',
    ''
  ].join('\n');
}

export function writePortsEnvFile(destination = path.join(projectRoot, '.env.ports')) {
  const ports = loadPorts();
  const content = formatPortsEnv(ports);
  fs.writeFileSync(destination, content, 'utf8');
  console.log(`✅ Wrote ports env file to ${destination}`);
  return destination;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = writePortsEnvFile();
  console.log(`✅ Wrote ports env file to ${outputPath}`);
}
