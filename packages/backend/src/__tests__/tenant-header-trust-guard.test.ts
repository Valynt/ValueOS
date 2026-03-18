import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const FORBIDDEN_PATTERNS = ["req.headers['x-tenant-id']", "req.headers['x-organization-id']", 'req.header(\'x-tenant-id\')', 'req.header(\'x-organization-id\')'];

describe('tenant header trust guardrails', () => {
  it('prevents authenticated API handlers from directly trusting tenant headers', async () => {
    let stdout = '';

    try {
      const result = await execFileAsync('rg', [
        "req\\.headers\\[['\"]x-(tenant|organization)-id['\"]\\]|req\\.header\\(['\"]x-(tenant|organization)-id['\"]\\)",
        'packages/backend/src/api',
        '--glob',
        '*.ts',
        '--glob',
        '!**/*.test.ts',
        '--glob',
        '!**/*.spec.ts',
        '--glob',
        '!**/__tests__/**',
        '--no-heading',
        '--line-number',
        '--color',
        'never',
      ]);

      stdout = result.stdout;
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { code?: number | string; stdout?: string };

      if (err.code === 1) {
        stdout = err.stdout ?? '';
      } else if (err.code === 'ENOENT') {
         
        console.warn('Skipping tenant header trust guardrail test because `rg` (ripgrep) is not installed.');
        return;
      } else {
        throw error;
      }
    }

    const violations = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => FORBIDDEN_PATTERNS.some((pattern) => line.includes(pattern)));

    expect(violations).toEqual([]);
  });
});
