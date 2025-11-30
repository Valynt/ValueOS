import { describe, it, expect, beforeEach } from 'vitest';
import { CodeSandbox } from '../CodeSandbox';

describe('CodeSandbox', () => {
  let sandbox: CodeSandbox;

  beforeEach(() => {
    sandbox = new CodeSandbox();
  });

  describe('Safe Execution', () => {
    it('should execute simple arithmetic', async () => {
      const result = await sandbox.execute('return 2 + 2;');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
    });

    it('should execute with context variables', async () => {
      const result = await sandbox.execute(
        'return x * y;',
        { x: 5, y: 3 }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(15);
    });

    it('should capture console output', async () => {
      const result = await sandbox.execute(`
        console.log('Hello');
        console.log('World');
        return 42;
      `);
      
      expect(result.success).toBe(true);
      expect(result.consoleOutput).toEqual(['Hello', 'World']);
    });

    it('should handle JSON operations', async () => {
      const result = await sandbox.execute(`
        const data = JSON.parse('{"name":"test"}');
        return data.name;
      `);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('test');
    });
  });

  describe('Security Blocking', () => {
    it('should block require() calls', async () => {
      const result = await sandbox.execute('require("fs")');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });

    it('should block import statements', async () => {
      const result = await sandbox.execute('import fs from "fs"');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });

    it('should block eval()', async () => {
      const result = await sandbox.execute('eval("malicious code")');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });

    it('should block process access', async () => {
      const result = await sandbox.execute('process.exit(1)');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });

    it('should block filesystem access', async () => {
      const result = await sandbox.execute('fs.readFileSync("/etc/passwd")');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });

    it('should block network access', async () => {
      const result = await sandbox.execute('http.request("http://evil.com")');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });

    it('should block Function constructor', async () => {
      const result = await sandbox.execute('new Function("return 1")()');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous code pattern');
    });
  });

  describe('Timeout Enforcement', () => {
    it('should timeout long-running code', async () => {
      const sandbox = new CodeSandbox({ timeout: 100 });
      
      const result = await sandbox.execute(`
        while(true) {
          // Infinite loop
        }
      `);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 200);

    it('should complete fast code within timeout', async () => {
      const sandbox = new CodeSandbox({ timeout: 1000 });
      
      const result = await sandbox.execute('return 42;');
      
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(100);
    });
  });

  describe('Context Isolation', () => {
    it('should isolate context variables', async () => {
      const context = { safe: 'value' };
      
      await sandbox.execute('safe = "modified";', context);
      
      // Original context should not be modified
      expect(context.safe).toBe('value');
    });

    it('should skip functions in context', async () => {
      const result = await sandbox.execute(
        'return typeof dangerousFunc;',
        { dangerousFunc: () => {} }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('undefined');
    });

    it('should deep clone context objects', async () => {
      const obj = { nested: { value: 42 } };
      
      await sandbox.execute('nested.value = 100;', { nested: obj.nested });
      
      // Original should not be modified
      expect(obj.nested.value).toBe(42);
    });
  });

  describe('Error Handling', () => {
    it('should catch runtime errors', async () => {
      const result = await sandbox.execute('throw new Error("test error")');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('test error');
    });

    it('should catch syntax errors', async () => {
      const result = await sandbox.execute('this is not valid javascript {');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle undefined variables', async () => {
      const result = await sandbox.execute('return undefinedVar;');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('undefinedVar');
    });
  });

  describe('Batch Execution', () => {
    it('should execute multiple code snippets', async () => {
      const results = await sandbox.executeBatch([
        { code: 'return 1 + 1;' },
        { code: 'return 2 * 2;' },
        { code: 'return 3 ** 2;' },
      ]);
      
      expect(results).toHaveLength(3);
      expect(results[0].result).toBe(2);
      expect(results[1].result).toBe(4);
      expect(results[2].result).toBe(9);
    });

    it('should stop on first error', async () => {
      const results = await sandbox.executeBatch([
        { code: 'return 42;' },
        { code: 'throw new Error("fail");' },
        { code: 'return 100;' },
      ]);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Code Validation', () => {
    it('should validate code without executing', () => {
      const safe = sandbox.isCodeSafe('return 2 + 2;');
      expect(safe.safe).toBe(true);
    });

    it('should detect unsafe code patterns', () => {
      const unsafe = sandbox.isCodeSafe('require("fs")');
      expect(unsafe.safe).toBe(false);
      expect(unsafe.reason).toContain('Dangerous code pattern');
    });

    it('should reject overly long code', () => {
      const longCode = 'x'.repeat(100000);
      const unsafe = sandbox.isCodeSafe(longCode);
      
      expect(unsafe.safe).toBe(false);
      expect(unsafe.reason).toContain('maximum length');
    });
  });

  describe('Execution Time Tracking', () => {
    it('should track execution time', async () => {
      const result = await sandbox.execute('return 42;');
      
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThan(1000);
    });
  });

  describe('Console Capture', () => {
    it('should capture multiple console methods', async () => {
      const result = await sandbox.execute(`
        console.log('info');
        console.error('error');
        console.warn('warning');
      `);
      
      expect(result.consoleOutput).toEqual([
        'info',
        'ERROR: error',
        'WARN: warning',
      ]);
    });

    it('should disable console capture when configured', async () => {
      const sandbox = new CodeSandbox({ captureConsole: false });
      
      const result = await sandbox.execute('console.log("test")');
      
      expect(result.consoleOutput).toBeUndefined();
    });
  });
});
