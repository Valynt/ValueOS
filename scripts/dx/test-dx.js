#!/usr/bin/env node

/**
 * DX Implementation Test Suite
 * Tests all DX components
 */

import { detectPlatform, getPlatformConfig } from '../lib/platform.js';
import { checkPrerequisites } from '../lib/prerequisites.js';
import { generateSecrets, validateEnv } from '../lib/environment.js';

console.log('🧪 Testing DX Implementation\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

/**
 * Test helper
 */
function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

/**
 * Async test helper
 */
async function testAsync(name, fn) {
  try {
    const result = await fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Run tests
async function runTests() {
  console.log('\n📦 Testing Platform Detection\n');
  
  test('Platform detection works', () => {
    const platform = detectPlatform();
    return ['macos-intel', 'macos-silicon', 'wsl2', 'windows', 'linux'].includes(platform);
  });
  
  test('Platform config exists', () => {
    const platform = detectPlatform();
    const config = getPlatformConfig(platform);
    return config && config.name && config.packageManager;
  });
  
  console.log('\n🔍 Testing Prerequisites Checker\n');
  
  await testAsync('Prerequisites check runs', async () => {
    const result = await checkPrerequisites();
    return typeof result === 'boolean';
  });
  
  console.log('\n🔐 Testing Environment Generator\n');
  
  test('Secret generation works', () => {
    const secrets = generateSecrets();
    return secrets.JWT_SECRET && secrets.JWT_SECRET.length >= 64;
  });
  
  test('Secrets are unique', () => {
    const secrets1 = generateSecrets();
    const secrets2 = generateSecrets();
    return secrets1.JWT_SECRET !== secrets2.JWT_SECRET;
  });
  
  test('Secrets have sufficient entropy', () => {
    const secrets = generateSecrets();
    // Check that secret is hexadecimal and long enough
    return /^[0-9a-f]{64,}$/.test(secrets.JWT_SECRET);
  });
  
  console.log('\n📊 Test Results\n');
  console.log('='.repeat(60));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n✅ All tests passed! 🎉\n');
    return true;
  } else {
    console.log(`\n❌ ${failed} test(s) failed\n`);
    return false;
  }
}

// Run
runTests().then(success => {
  process.exit(success ? 0 : 1);
});
