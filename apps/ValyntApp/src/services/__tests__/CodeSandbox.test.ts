import { beforeEach, describe, expect, it } from 'vitest';

import { CodeSandbox } from '../CodeSandbox';

describe('CodeSandbox', () => {
  let sandbox: CodeSandbox;

  beforeEach(() => {
    sandbox = new CodeSandbox();
  });

  it('rejects dynamic execution in production paths', async () => {
    const result = await sandbox.execute('return 2 + 2;');

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
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
