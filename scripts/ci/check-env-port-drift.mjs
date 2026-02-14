#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { loadPorts, formatPortsEnv } from '../dx/ports.js';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function normalize(content) {
  return content.replace(/\r\n/g, '\n').trim() + '\n';
}

const ports = loadPorts();
const expectedPortsEnv = normalize(formatPortsEnv(ports));

const generatedFiles = ['ops/env/.env.ports', '.env.ports', 'envs/.env.ports'];
for (const rel of generatedFiles) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) continue;
  const actual = normalize(fs.readFileSync(abs, 'utf8'));
  if (actual !== expectedPortsEnv) {
    fail(`${rel} drifted from config/ports.json. Run: node scripts/dx/env-compiler.js`);
  }
}

if (fs.existsSync(path.join(repoRoot, 'scripts/config/ports.json'))) {
  fail('scripts/config/ports.json must not exist (config/ports.json is the only source of truth).');
}

const portVarPattern = /^(API_PORT|VITE_PORT|VITE_HMR_PORT|POSTGRES_PORT|REDIS_PORT|SUPABASE_API_PORT|SUPABASE_STUDIO_PORT|SUPABASE_DB_PORT|CADDY_HTTP_PORT|CADDY_HTTPS_PORT|CADDY_ADMIN_PORT|PROMETHEUS_PORT|GRAFANA_PORT)=/m;
const envExample = read('.env.example');
if (portVarPattern.test(envExample)) {
  fail('.env.example must not define port mappings; use generated .env.ports only.');
}

const localExamplePath = path.join(repoRoot, '.env.local.example');
if (fs.existsSync(localExamplePath)) {
  const localExample = fs.readFileSync(localExamplePath, 'utf8');
  if (portVarPattern.test(localExample)) {
    fail('.env.local.example must not define port mappings; use generated .env.ports only.');
  }
}

const secretKeys = ['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TOGETHER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'JWT_SECRET'];
for (const key of secretKeys) {
  const re = new RegExp(`^${key}=`, 'm');
  if (re.test(envExample)) {
    fail(`.env.example must not contain secret key ${key}; keep secrets in .env.local only.`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('✅ Env/port drift checks passed.');
