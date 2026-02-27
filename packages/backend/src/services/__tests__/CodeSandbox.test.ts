import { beforeEach, describe, expect, it } from 'vitest';
import { CodeSandbox } from '../CodeSandbox.js'

describe('CodeSandbox', () => {
  let sandbox: CodeSandbox;

  beforeEach(() => {
    sandbox = new CodeSandbox();
  });

  it('executes safe code in worker sandbox', async () => {
    const result = await sandbox.execute('return 2 + 2;');

    expect(result.success).toBe(true);
    expect(result.result).toBe(4);
  });

  it('continues to flag dangerous code patterns', () => {
    const unsafe = sandbox.isCodeSafe('require("fs")');

    expect(unsafe.safe).toBe(false);
    expect(unsafe.reason).toContain('Dangerous code pattern');
  });

  it('accepts safe code syntax during validation', () => {
    const safe = sandbox.isCodeSafe('return 2 + 2;');

    expect(safe.safe).toBe(true);
  });
});
