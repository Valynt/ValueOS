#!/usr/bin/env node
import { getRuntimeConfig, sanitizeRuntimeConfig } from './_shared.mjs';

async function checkConnectivity(config) {
  const checks = [];

  checks.push({
    name: 'node_runtime',
    ok: true,
    detail: process.version,
  });

  checks.push({
    name: 'provider_configured',
    ok: Boolean(config.provider),
    detail: config.provider || 'missing',
  });

  if (!config.baseUrl) {
    checks.push({
      name: 'base_url_connectivity',
      ok: true,
      detail: 'skipped (LLM_BASE_URL not set)',
    });
    return checks;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(500, config.timeoutMs));

  try {
    const response = await fetch(config.baseUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
      },
    });

    checks.push({
      name: 'base_url_connectivity',
      ok: response.ok,
      detail: `HTTP ${response.status}`,
    });
  } catch (error) {
    checks.push({
      name: 'base_url_connectivity',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }

  return checks;
}

const config = getRuntimeConfig();
const sanitized = sanitizeRuntimeConfig(config);
const checks = await checkConnectivity(config);

console.log('LLM runtime config (sanitized):');
console.log(JSON.stringify(sanitized, null, 2));
console.log('\nConnectivity checks:');
for (const check of checks) {
  const status = check.ok ? 'PASS' : 'FAIL';
  console.log(`- [${status}] ${check.name}: ${check.detail}`);
}

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  process.exitCode = 1;
  console.error(`\nDoctor found ${failed.length} failing checks.`);
} else {
  console.log('\nDoctor checks passed.');
}
