#!/usr/bin/env node

/**
 * Setup Verification Script
 * Tests that all components are properly configured
 */

console.log('🧪 Testing ValueCanvas Setup...\n');

const tests = [];
let passed = 0;
let failed = 0;

// Test 1: Check Node.js version
tests.push({
  name: 'Node.js version',
  test: () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    if (major >= 18) {
      return { pass: true, message: `Node.js ${version}` };
    }
    return { pass: false, message: `Node.js ${version} (need v18+)` };
  }
});

// Test 2: Check required files
tests.push({
  name: 'Required files exist',
  test: () => {
    const fs = require('fs');
    const required = [
      'package.json',
      'src/agents/CoordinatorAgent.ts',
      'src/services/MessageBus.ts',
      'src/services/UIGenerationTracker.ts',
      'src/services/UIRefinementLoop.ts',
      'src/sdui/ComponentToolRegistry.ts',
    ];
    
    const missing = required.filter(f => !fs.existsSync(f));
    
    if (missing.length === 0) {
      return { pass: true, message: 'All files present' };
    }
    return { pass: false, message: `Missing: ${missing.join(', ')}` };
  }
});

// Test 3: Check migrations
tests.push({
  name: 'Database migrations',
  test: () => {
    const fs = require('fs');
    const migrations = [
      'supabase/migrations/20251120000000_create_sof_schema.sql',
      'supabase/migrations/20251120100000_integrate_sof_governance.sql',
      'supabase/migrations/20251120120000_create_episodic_memory.sql',
      'supabase/migrations/20251120130000_create_artifact_scores.sql',
      'supabase/migrations/20251120140000_create_ui_generation_metrics.sql',
    ];
    
    const missing = migrations.filter(m => !fs.existsSync(m));
    
    if (missing.length === 0) {
      return { pass: true, message: `${migrations.length} migrations found` };
    }
    return { pass: false, message: `Missing: ${missing.length} migrations` };
  }
});

// Test 4: Check environment file
tests.push({
  name: 'Environment configuration',
  test: () => {
    const fs = require('fs');
    if (fs.existsSync('.env')) {
      const content = fs.readFileSync('.env', 'utf8');
      const hasSupabase = content.includes('VITE_SUPABASE_URL');
      const hasLLM = content.includes('VITE_LLM_API_KEY');
      
      if (hasSupabase && hasLLM) {
        return { pass: true, message: '.env configured' };
      }
      return { pass: false, message: '.env missing required variables' };
    }
    return { pass: false, message: '.env file not found' };
  }
});

// Test 5: Check package.json dependencies
tests.push({
  name: 'Package dependencies',
  test: () => {
    const pkg = require('./package.json');
    const required = ['uuid', 'lz-string', 'zod', '@supabase/supabase-js'];
    const missing = required.filter(dep => !pkg.dependencies[dep]);
    
    if (missing.length === 0) {
      return { pass: true, message: 'All dependencies listed' };
    }
    return { pass: false, message: `Missing: ${missing.join(', ')}` };
  }
});

// Test 6: Check node_modules
tests.push({
  name: 'Dependencies installed',
  test: () => {
    const fs = require('fs');
    if (fs.existsSync('node_modules')) {
      const required = ['uuid', 'lz-string', 'zod'];
      const missing = required.filter(dep => !fs.existsSync(`node_modules/${dep}`));
      
      if (missing.length === 0) {
        return { pass: true, message: 'Dependencies installed' };
      }
      return { pass: false, message: `Not installed: ${missing.join(', ')}` };
    }
    return { pass: false, message: 'node_modules not found - run npm install' };
  }
});

// Run tests
console.log('Running tests...\n');

tests.forEach((test, index) => {
  try {
    const result = test.test();
    const status = result.pass ? '✅' : '❌';
    const color = result.pass ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${status} ${test.name}: ${color}${result.message}${reset}`);
    
    if (result.pass) {
      passed++;
    } else {
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name}: \x1b[31mError: ${error.message}\x1b[0m`);
    failed++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ \x1b[32mAll tests passed! Ready to start.\x1b[0m\n');
  console.log('Run: ./start.sh or npm run dev\n');
  process.exit(0);
} else {
  console.log('❌ \x1b[31mSome tests failed. Please fix issues above.\x1b[0m\n');
  console.log('See LOCAL_SETUP_GUIDE.md for help\n');
  process.exit(1);
}
