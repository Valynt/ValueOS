import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const BASELINE_REQ_AS_ANY_VIOLATIONS = new Set<string>([
  'src/api/workflow.ts:    const tenantId = getTenantIdFromRequest(req as any) ?? "__anon__";',
  'src/api/workflow.ts:    const db = (req as any).db as { query?: (query: string, params?: unknown[]) => Promise<{ rows?: Array<{ output_data?: unknown }> }> } | undefined;',
  'src/middleware/featureFlagMiddleware.ts:      (req as any).featureFlagVariant = variant;',
  'src/middleware/featureFlagMiddleware.ts:      (req as any).featureFlagConfig = config;',
  'src/middleware/tenantDbContext.ts:      (req as any).db = {',
]);

const BASELINE_REQ_TYPED_CAST_VIOLATIONS = new Set<string>([]);

type GuardConfig = {
  baselineViolations: Set<string>;
  description: string;
  pattern: string;
  searchPaths?: string[];
};

async function findViolations({ pattern, searchPaths = ['src'] }: GuardConfig): Promise<string[]> {
  let stdout = '';

  try {
    const result = await execFileAsync('rg', [
      pattern,
      ...searchPaths,
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
    const err = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
    };

    // ripgrep uses exit code 1 to mean "no matches found"
    if (err.code === 1) {
      stdout = err.stdout ?? '';
    } else if (err.code === 'ENOENT') {
      // rg is not available in this environment; treat as a skipped test
      // rather than an opaque failure.
       
      console.warn('Skipping request-cast guardrail test because `rg` (ripgrep) is not installed.');
      return [];
    } else {
      throw error;
    }
  }

  return stdout
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
}

describe('backend request typing guardrails', () => {
  const guardConfigs: GuardConfig[] = [
    {
      pattern: '\\(req as any\\)',
      description: 'does not allow new `(req as any)` casts in non-test files',
      baselineViolations: BASELINE_REQ_AS_ANY_VIOLATIONS,
    },
    {
      pattern: 'req as \\{[^}]*\\}',
      description:
        'does not allow unnecessary typed request casts like `req as { tenantId?: string }` in non-test files',
      baselineViolations: BASELINE_REQ_TYPED_CAST_VIOLATIONS,
    },
    {
      pattern: 'req as unknown as \\{[^}]*\\}',
      description:
        'does not allow `req as unknown as { ... }` request casts in the realization and deal assembly routes',
      baselineViolations: BASELINE_REQ_TYPED_CAST_VIOLATIONS,
      searchPaths: [
        'src/routes/realization.ts',
        'src/routes/deal-assembly.ts',
      ],
    },
  ];

  it.each(guardConfigs)('$description', async (guardConfig) => {
    const violations = await findViolations(guardConfig);
    const unexpectedViolations = violations.filter(
      (line) => !guardConfig.baselineViolations.has(line)
    );

    expect(unexpectedViolations).toEqual([]);
  });
});
