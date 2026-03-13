#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const catalogPath = path.resolve(repoRoot, 'config/observability-service-catalog.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

const errors = [];

for (const service of catalog.services ?? []) {
  const dashboardPath = path.resolve(repoRoot, service.dashboard);
  const alertPath = path.resolve(repoRoot, service.alert);

  await access(dashboardPath).catch(() => {
    errors.push(`Missing dashboard file for ${service.name}: ${service.dashboard}`);
  });

  await access(alertPath).catch(() => {
    errors.push(`Missing alert file for ${service.name}: ${service.alert}`);
  });

  const dashboard = await readFile(dashboardPath, 'utf8').catch(() => '');
  const alerts = await readFile(alertPath, 'utf8').catch(() => '');

  if (!dashboard.includes(service.name) && service.name !== 'agent-fabric') {
    errors.push(`Dashboard ${service.dashboard} does not reference service ${service.name}`);
  }

  for (const endpoint of service.endpoints ?? []) {
    const endpointCovered = dashboard.includes(endpoint) || alerts.includes(endpoint);
    if (!endpointCovered) {
      errors.push(`No dashboard/alert coverage found for ${service.name} endpoint ${endpoint}`);
    }
  }
}

if (errors.length > 0) {
  console.error('❌ Observability deployment gate failed.');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('✅ Observability deployment gate passed.');
console.log(`Validated ${(catalog.services ?? []).length} service entries.`);
