#!/usr/bin/env node

/**
 * Error Recovery System
 * Detects and recovers from common errors
 */

import { execSync } from 'child_process';
import { detectPlatform, getPlatformConfig } from './platform.js';

/**
 * Error patterns and recovery strategies
 */
const errorPatterns = [
  {
    pattern: /EADDRINUSE.*:(\d+)/,
    name: 'Port in use',
    autoFix: true,
    detect: (error) => {
      const match = error.message.match(/EADDRINUSE.*:(\d+)/);
      return match ? { port: match[1] } : null;
    },
    fix: async (context) => {
      const { port } = context;
      console.log(`\n⚠️  Port ${port} is already in use`);
      console.log(`🔧 Finding next available port...`);
      
      // Try next port
      const nextPort = parseInt(port) + 1;
      console.log(`✅ Using port ${nextPort} instead\n`);
      
      return { port: nextPort };
    },
    instructions: (context) => `
   Port ${context.port} is already in use.
   
   Fix:
   1. Find process: lsof -i :${context.port}
   2. Kill process: kill -9 <PID>
   
   Or the script will use the next available port.`
  },
  
  {
    pattern: /Cannot connect to the Docker daemon/,
    name: 'Docker not running',
    autoFix: false,
    detect: (error) => {
      return error.message.includes('Cannot connect to the Docker daemon') ? {} : null;
    },
    fix: null,
    instructions: () => {
      const platform = detectPlatform();
      const config = getPlatformConfig(platform);
      
      return `
   Docker is not running.
   
   Fix:
   ${config.dockerCommand}
   
   Then run setup again.`;
    }
  },
  
  {
    pattern: /MODULE_NOT_FOUND/,
    name: 'Missing dependency',
    autoFix: true,
    detect: (error) => {
      const match = error.message.match(/Cannot find module '([^']+)'/);
      return match ? { module: match[1] } : null;
    },
    fix: async (context) => {
      const { module } = context;
      console.log(`\n⚠️  Missing dependency: ${module}`);
      console.log(`🔧 Auto-installing...`);
      
      try {
        execSync(`pnpm install ${module}`, { stdio: 'inherit' });
        console.log(`✅ Dependency installed\n`);
        return { installed: true };
      } catch (error) {
        console.log(`❌ Failed to install ${module}\n`);
        return { installed: false };
      }
    },
    instructions: (context) => `
   Missing dependency: ${context.module}
   
   Fix:
   pnpm install ${context.module}`
  },
  
  {
    pattern: /ENOSPC/,
    name: 'Out of disk space',
    autoFix: false,
    detect: (error) => {
      return error.message.includes('ENOSPC') ? {} : null;
    },
    fix: null,
    instructions: () => `
   Out of disk space.
   
   Fix:
   1. Free up disk space
   2. Clean Docker: docker system prune -a
   3. Clean npm cache: npm cache clean --force
   4. Remove node_modules: rm -rf node_modules`
  },
  
  {
    pattern: /EACCES|EPERM/,
    name: 'Permission denied',
    autoFix: false,
    detect: (error) => {
      return error.message.match(/EACCES|EPERM/) ? {} : null;
    },
    fix: null,
    instructions: () => {
      const platform = detectPlatform();
      
      if (platform === 'linux') {
        return `
   Permission denied.
   
   Fix:
   1. Check file ownership: ls -la
   2. Fix ownership: sudo chown -R $USER:$USER .
   3. For Docker: sudo usermod -aG docker $USER`;
      }
      
      return `
   Permission denied.
   
   Fix:
   1. Check file ownership: ls -la
   2. Fix ownership: sudo chown -R $USER:$USER .`;
    }
  },
  
  {
    pattern: /ETIMEDOUT|ENOTFOUND/,
    name: 'Network error',
    autoFix: true,
    detect: (error) => {
      return error.message.match(/ETIMEDOUT|ENOTFOUND/) ? {} : null;
    },
    fix: async (context) => {
      console.log(`\n⚠️  Network error detected`);
      console.log(`🔧 Retrying in 5 seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log(`✅ Retrying...\n`);
      return { retry: true };
    },
    instructions: () => `
   Network error.
   
   Fix:
   1. Check internet connection
   2. Check firewall settings
   3. Try again later
   4. Use different network`
  }
];

/**
 * Detect error type and recovery strategy
 */
export function detectRecovery(error) {
  for (const pattern of errorPatterns) {
    const context = pattern.detect(error);
    if (context) {
      return {
        name: pattern.name,
        autoFix: pattern.autoFix,
        fix: pattern.fix ? () => pattern.fix(context) : null,
        instructions: pattern.instructions(context),
        context
      };
    }
  }
  
  // Unknown error
  return {
    name: 'Unknown error',
    autoFix: false,
    fix: null,
    instructions: `
   An unexpected error occurred.
   
   Error: ${error.message}
   
   Please check:
   1. Error message above
   2. docs/TROUBLESHOOTING.md
   3. Ask in #engineering on Slack`,
    context: {}
  };
}

/**
 * Handle error with recovery
 */
export async function handleError(error, options = {}) {
  const recovery = detectRecovery(error);
  
  console.log(`\n❌ Error: ${recovery.name}\n`);
  
  if (recovery.autoFix && recovery.fix && !options.noAutoFix) {
    console.log(`🔧 Auto-fixing: ${recovery.name}`);
    
    try {
      const result = await recovery.fix();
      
      if (result && result.retry) {
        return { recovered: true, retry: true };
      }
      
      return { recovered: true, result };
    } catch (fixError) {
      console.log(`❌ Auto-fix failed: ${fixError.message}\n`);
      console.log(`💡 Manual fix required:\n${recovery.instructions}\n`);
      return { recovered: false };
    }
  } else {
    console.log(`💡 Fix:\n${recovery.instructions}\n`);
    return { recovered: false };
  }
}

/**
 * Retry function with error recovery
 */
export async function retryWithRecovery(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`\n⚠️  Attempt ${attempt}/${maxRetries} failed`);
      
      if (attempt === maxRetries) {
        // Last attempt, handle error
        await handleError(error, options);
        throw error;
      }
      
      // Try recovery
      const recovery = await handleError(error, options);
      
      if (!recovery.recovered && !recovery.retry) {
        throw error;
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    // Simulate port in use error
    const portError = new Error('Error: listen EADDRINUSE: address already in use :::5173');
    console.log('Demo: Port in use error');
    await handleError(portError);
    
    // Simulate Docker not running error
    const dockerError = new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock');
    console.log('\nDemo: Docker not running error');
    await handleError(dockerError);
    
    // Simulate missing dependency error
    const moduleError = new Error("Cannot find module '@supabase/supabase-js'");
    console.log('\nDemo: Missing dependency error');
    await handleError(moduleError, { noAutoFix: true });
  }
  
  demo();
}
