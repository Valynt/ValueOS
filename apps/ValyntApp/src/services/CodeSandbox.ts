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
  result?: unknown;
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
    context: Record<string, unknown> = {}
  ): Promise<SandboxResult> {
    void context;
    const startTime = Date.now();
    const consoleOutput: string[] = [];

    try {
      // Validate code before execution
      this.validateCode(code);

      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error:
          'Dynamic code execution is disabled. Use an isolated worker/service with explicit capabilities.',
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
    userContext: Record<string, unknown>,
    consoleOutput: string[]
  ): Record<string, unknown> {
    // Safe console implementation
    const sandboxConsole = {
      log: (...args: unknown[]) => {
        const message = args.map(String).join(' ');
        consoleOutput.push(message);
      },
      error: (...args: unknown[]) => {
        const message = args.map(String).join(' ');
        consoleOutput.push(`ERROR: ${message}`);
      },
      warn: (...args: unknown[]) => {
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
  private validateContext(context: Record<string, unknown>): Record<string, unknown> {
    const validated: Record<string, unknown> = {};

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
   * Execute multiple code snippets in batch
   */
  async executeBatch(
    codeSnippets: Array<{ code: string; context?: Record<string, unknown> }>
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
 * Dynamic code execution is disabled.
 * For production use, isolate execution out-of-process with strict capability allowlists,
 * timeouts, and memory limits.
 */
