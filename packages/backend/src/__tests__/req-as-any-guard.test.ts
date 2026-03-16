import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BASELINE_VIOLATIONS = new Set<string>([
  'src/api/workflow.ts:    const tenantId = getTenantIdFromRequest(req as any) ?? "__anon__";',
  'src/api/workflow.ts:    const db = (req as any).db as { query?: (query: string, params?: unknown[]) => Promise<{ rows?: Array<{ output_data?: unknown }> }> } | undefined;',
  'src/middleware/featureFlagMiddleware.ts:      (req as any).featureFlagVariant = variant;',
  'src/middleware/featureFlagMiddleware.ts:      (req as any).featureFlagConfig = config;',
  'src/middleware/tenantDbContext.ts:      (req as any).db = {',
]);

describe('backend request typing guardrails', () => {
  it('does not allow new `(req as any)` casts in non-test files', async () => {
    let stdout = '';

    try {
      const result = await execFileAsync('rg', [
        '(req as any)',
        'src',
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

      // ripgrep uses exit code 1 to mean "no matches found"
      if (err.code === 1) {
        stdout = err.stdout ?? '';
      } else if (err.code === 'ENOENT') {
        // rg is not available in this environment; treat as a skipped test
        // rather than an opaque failure.
        // eslint-disable-next-line no-console
        console.warn('Skipping `(req as any)` guardrail test because `rg` (ripgrep) is not installed.');
        return;
      } else {
        throw error;
      }
    }

    const violations = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const firstSeparator = line.indexOf(':');
        const secondSeparator = line.indexOf(':', firstSeparator + 1);

        if (firstSeparator === -1 || secondSeparator === -1) {
          return line;
        }

        const filePath = line.slice(0, firstSeparator);
        const content = line.slice(secondSeparator + 1);
        return `${filePath}:${content}`;
      });

    const unexpectedViolations = violations.filter((line) => !BASELINE_VIOLATIONS.has(line));

    expect(unexpectedViolations).toEqual([]);
  });
});
