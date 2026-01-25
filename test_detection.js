#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Testing Docker Compose version detection:');
try {
  const composeVersion = execSync('docker compose version --short').toString().trim();
  const versionParts = composeVersion.replace(/^v/, '').split('.');
  const majorVersion = parseInt(versionParts[0], 10);
  console.log(`✅ Compose version: "${composeVersion}" (parsed major: ${majorVersion})`);
} catch (e) {
  console.log('❌ Compose detection failed:', e.message);
}

console.log('\nTesting BuildKit detection:');
const buildkitEnabled = process.env.DOCKER_BUILDKIT === '1' || process.env.DOCKER_BUILDKIT?.toLowerCase() === 'true';
console.log(`Environment variable: DOCKER_BUILDKIT="${process.env.DOCKER_BUILDKIT}"`);
console.log(`BuildKit enabled via env: ${buildkitEnabled}`);

if (!buildkitEnabled) {
  try {
    const info = execSync('docker info --format "{{json .}}"').toString();
    const parsed = JSON.parse(info);
    const hasBuildxPlugin = parsed?.ClientInfo?.Plugins?.some(plugin => plugin.Name === 'buildx');
    console.log(`Buildx plugin available: ${hasBuildxPlugin}`);
  } catch (e) {
    console.log('Buildx plugin check failed:', e.message);
  }
}