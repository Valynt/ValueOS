#!/usr/bin/env node

/**
 * Build Validation Script
 * Validates build artifacts exist and are valid before deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../..');

/**
 * Check if backend build artifact exists
 */
function checkBackendBuild() {
  const backendBuildPath = path.join(projectRoot, 'dist/backend/server.js');

  if (!fs.existsSync(backendBuildPath)) {
    console.log('❌ Backend build artifact missing: dist/backend/server.js');
    return false;
  }

  console.log('✅ Backend build artifact exists: dist/backend/server.js');
  return true;
}

/**
 * Check if frontend build directory exists
 */
function checkFrontendBuild() {
  const frontendBuildPath = path.join(projectRoot, 'dist');

  if (!fs.existsSync(frontendBuildPath)) {
    console.log('❌ Frontend build directory missing: dist/');
    return false;
  }

  // Check for key frontend files
  const indexHtml = path.join(frontendBuildPath, 'index.html');
  const assetsDir = path.join(frontendBuildPath, 'assets');

  if (!fs.existsSync(indexHtml)) {
    console.log('❌ Frontend index.html missing');
    return false;
  }

  if (!fs.existsSync(assetsDir)) {
    console.log('❌ Frontend assets directory missing');
    return false;
  }

  console.log('✅ Frontend build artifacts exist');
  return true;
}

/**
 * Validate backend server can be required (basic syntax check)
 */
function validateBackendServer() {
  try {
    const backendBuildPath = path.join(projectRoot, 'dist/backend/server.js');

    // Basic syntax check by attempting to load the module
    // This will throw if there are syntax errors
    const module = require(backendBuildPath);

    console.log('✅ Backend server syntax validation passed');
    return true;
  } catch (error) {
    console.log('❌ Backend server validation failed:', error.message);
    return false;
  }
}

/**
 * Check for build manifest
 */
function checkBuildManifest() {
  const manifestPath = path.join(projectRoot, 'BUILD_MANIFEST.json');

  if (!fs.existsSync(manifestPath)) {
    console.log('❌ Build manifest missing: BUILD_MANIFEST.json');
    return false;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const required = ['buildTime', 'version', 'commit', 'branch'];

    for (const field of required) {
      if (!manifest[field]) {
        console.log(`❌ Build manifest missing required field: ${field}`);
        return false;
      }
    }

    console.log('✅ Build manifest validation passed');
    return true;
  } catch (error) {
    console.log('❌ Build manifest validation failed:', error.message);
    return false;
  }
}

/**
 * Main validation function
 */
async function validateBuild() {
  console.log('\n🔨 Validating build artifacts...\n');

  const checks = [
    checkBackendBuild(),
    checkFrontendBuild(),
    checkBuildManifest()
  ];

  const allPassed = checks.every(check => check);

  if (allPassed) {
    console.log('\n✅ Build validation passed!\n');
    return true;
  } else {
    console.log('\n❌ Build validation failed\n');
    console.log('Please run: npm run build\n');
    return false;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  validateBuild().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}

export { validateBuild };