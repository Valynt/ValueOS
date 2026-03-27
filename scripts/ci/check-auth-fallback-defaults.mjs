#!/usr/bin/env node
import fs from 'node:fs/promises';

const targets = [
  'docker-compose.yml',
  'docker-compose.override.yml',
  'infra/docker/docker-compose.dev.yml',
  'infra/docker/docker-compose.prod.yml',
  'scripts/config/environments/development.env',
  'scripts/config/environments/staging.env',
  'scripts/config/environments/production.env',
];

const forbidden = [
  'AUTH_FALLBACK_EMERGENCY_MODE=true',
  'ALLOW_LOCAL_JWT_FALLBACK=true',
];

for (const file of targets) {
  try {
    const content = await fs.readFile(file, 'utf8');
    for (const marker of forbidden) {
      if (content.includes(marker)) {
        throw new Error(`${file} contains forbidden default: ${marker}`);
      }
    }
  } catch (error) {
    if ((error).code === 'ENOENT') continue;
    throw error;
  }
}

console.log('Auth fallback defaults check passed.');
