#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ports = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/ports.json'), 'utf8'));

const allowedPorts = new Set();
for (const config of Object.values(ports)) {
  for (const [k, v] of Object.entries(config)) {
    if (k.toLowerCase().includes('port') || k === 'port') allowedPorts.add(Number(v));
  }
}
allowedPorts.add(80);
allowedPorts.add(443);

const targets = ['scripts/dx', 'docs/developer-experience'];
const includeExt = new Set(['.md', '.sh', '.js', '.mjs', '.cjs', '.ts', '.yaml', '.yml']);
const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo']);

const issues = [];

function walk(dirRel) {
  const dirAbs = path.join(repoRoot, dirRel);
  if (!fs.existsSync(dirAbs)) return;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const rel = path.join(dirRel, entry.name);
    const abs = path.join(repoRoot, rel);
    if (entry.isDirectory()) {
      walk(rel);
      continue;
    }
    if (!includeExt.has(path.extname(entry.name))) continue;
    checkFile(rel, abs);
  }
}

function checkFile(rel, abs) {
  const content = fs.readFileSync(abs, 'utf8');

  const localhostMatches = [...content.matchAll(/localhost:(\d{2,5})/g)];
  for (const match of localhostMatches) {
    const port = Number(match[1]);
    if (!allowedPorts.has(port)) {
      issues.push(`${rel}: hardcoded localhost port ${port} is not in config/ports.json`);
    }
  }

  const envMatches = [...content.matchAll(/\b([A-Z_]+_PORT)=(\d{2,5})\b/g)];
  for (const match of envMatches) {
    const port = Number(match[2]);
    if (!allowedPorts.has(port)) {
      issues.push(`${rel}: hardcoded ${match[1]}=${port} is not in config/ports.json`);
    }
  }
}

for (const target of targets) {
  walk(target);
}

if (issues.length > 0) {
  console.error('❌ Hardcoded port mismatches detected:');
  for (const issue of issues.slice(0, 200)) {
    console.error(` - ${issue}`);
  }
  if (issues.length > 200) console.error(` - ...and ${issues.length - 200} more`);
  process.exit(1);
}

console.log('✅ No hardcoded port mismatches found in docs/scripts.');
