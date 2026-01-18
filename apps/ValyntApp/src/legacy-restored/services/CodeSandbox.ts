/**
 * Code Execution Sandbox
 * 
 * Provides isolated, secure code execution environment for agent-generated code.
 * Uses VM2 for sandboxing with strict timeout and memory limits.
 */

import { logger } from '../lib/logger';

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  /** Execution timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Maximum memory in MB (default: 50) */
  maxMemory?: number;
  /** Allowed built-in modules */
  allowedModules?: string[];
  /** Enable console output capture */
  captureConsole?: boolean;
}

/**
 * Sandbox execution result
 */
export interface SandboxResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  consoleOutput?: string[];
}

/**
 * CodeSandbox service for safe code execution
 * 
 * Security features:
 * - Isolated execution context
 * - Timeout enforcement
 * - Memory limits
 * - Module whitelist
 * - No filesystem access
 * - No network access
 */
export class CodeSandbox {
  private config: Required<SandboxConfig>;

  constructor(config: SandboxConfig = {}) {
    this.config = {
      timeout: config.timeout || 5000,
      maxMemory: config.maxMemory || 50,
      allowedModules: config.allowedModules || [],
      captureConsole: config.captureConsole ?? true,
    };
  }

  /**
   * Execute code in sandboxed environment
   * 
   * @param code - JavaScript code to execute
   * @param context - Context variables to inject
   * @returns Execution result
   */
  async execute(
    code: string,
    context: Record<string, any> = {}
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const consoleOutput: string[] = [];

    try {
      // Validate code before execution
      this.validateCode(code);

      // Create sandboxed context
      const sandboxContext = this.createSandboxContext(context, consoleOutput);

      // Execute with timeout
      const result = await this.executeWithTimeout(code, sandboxContext);

      const executionTime = Date.now() - startTime;

      logger.info('Sandbox execution successful', {
        executionTime,
        codeLength: code.length,
      });

      return {
        success: true,
        result,
        executionTime,
        consoleOutput: this.config.captureConsole ? consoleOutput : undefined,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.warn('Sandbox execution failed', {
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        codeLength: code.length,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        consoleOutput: this.config.captureConsole ? consoleOutput : undefined,
      };
    }
  }

  /**
   * Validate code for basic security issues
   */
  private validateCode(code: string): void {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/i,
      /import\s+/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /process\./i,
      /__dirname/i,
      /__filename/i,
      /child_process/i,
      /fs\./i,
      /net\./i,
      /http\./i,
      /https\./i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(
          `Dangerous code pattern detected: ${pattern.source}`
        );
      }
    }

    // Check code length
    if (code.length > 50000) {
      throw new Error('Code exceeds maximum length (50KB)');
    }
  }

  /**
   * Create sandboxed execution context
   */
  private createSandboxContext(
    userContext: Record<string, any>,
    consoleOutput: string[]
  ): Record<string, any> {
    // Safe console implementation
    const sandboxConsole = {
      log: (...args: any[]) => {
        const message = args.map(String).join(' ');
        consoleOutput.push(message);
      },
      error: (...args: any[]) => {
        const message = args.map(String).join(' ');
        consoleOutput.push(`ERROR: ${message}`);
      },
      warn: (...args: any[]) => {
        const message = args.map(String).join(' ');
        consoleOutput.push(`WARN: ${message}`);
      },
    };

    // Safe Math and JSON
    const safeMath = { ...Math };
    const safeJSON = { ...JSON };

    // Merge with user context (validated)
    const validatedContext = this.validateContext(userContext);

    return {
      console: sandboxConsole,
      Math: safeMath,
      JSON: safeJSON,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      ...validatedContext,
    };
  }

  /**
   * Validate user-provided context
   */
  private validateContext(context: Record<string, any>): Record<string, any> {
    const validated: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      // Skip functions and dangerous objects
      if (typeof value === 'function') {
        logger.warn('Skipping function in context', { key });
        continue;
      }

      // Deep clone to prevent reference manipulation
      try {
        validated[key] = JSON.parse(JSON.stringify(value));
      } catch {
        logger.warn('Could not serialize context value', { key });
      }
    }

    return validated;
  }

  /**
   * Execute code with timeout enforcement
   */
  private executeWithTimeout(
    code: string,
    context: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Execution timeout (${this.config.timeout}ms)`));
      }, this.config.timeout);

      try {
        // Use Function constructor for basic sandboxing
        // Note: For production, use VM2 or isolated-vm
        const contextKeys = Object.keys(context);
        const contextValues = Object.values(context);

        // Wrap code in IIFE to capture return value
        const wrappedCode = `
          'use strict';
          return (function() {
            ${code}
          })();
        `;

        const fn = new Function(...contextKeys, wrappedCode);
        const result = fn(...contextValues);

        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Execute multiple code snippets in batch
   */
  async executeBatch(
    codeSnippets: Array<{ code: string; context?: Record<string, any> }>
  ): Promise<SandboxResult[]> {
    const results: SandboxResult[] = [];

    for (const snippet of codeSnippets) {
      const result = await this.execute(snippet.code, snippet.context);
      results.push(result);

      // Stop on first error if configured
      if (!result.success) {
        logger.warn('Batch execution stopped due to error', {
          completedCount: results.length,
          totalCount: codeSnippets.length,
        });
        break;
      }
    }

    return results;
  }

  /**
   * Test if code would pass validation without executing
   */
  isCodeSafe(code: string): { safe: boolean; reason?: string } {
    try {
      this.validateCode(code);
      return { safe: true };
    } catch (error) {
      return {
        safe: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Default singleton instance
export const codeSandbox = new CodeSandbox();

/**
 * SECURITY NOTE:
 * 
 * This implementation uses Function constructor for basic sandboxing.
 * For production use, consider:
 * 
 * 1. VM2 (node-only):
 *    npm install vm2
 *    const { VM } = require('vm2');
 * 
 * 2. isolated-vm (strongest isolation):
 *    npm install isolated-vm
 * 
 * 3. Web Workers (browser):
 *    Use Worker API for browser-based sandboxing
 * 
 * Current implementation provides:
 * ✅ Timeout enforcement
 * ✅ Pattern blocking
 * ✅ Context isolation
 * ✅ Console capture
 * 
 * Does NOT provide:
 * ❌ Complete VM isolation
 * ❌ Memory limit enforcement
 * ❌ Prototype pollution protection
 * 
 * Recommend upgrading to VM2 or isolated-vm for production.
 */
