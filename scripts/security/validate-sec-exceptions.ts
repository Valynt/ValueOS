import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

interface Violation {
  file: string;
  line: number;
  rule: 'SEC-001' | 'SEC-002' | 'SEC-003';
  message: string;
  snippet: string;
}

const FILE_LIST_CMD = "rg --files apps packages -g '*.{ts,tsx,js,jsx}' -g '!**/*.test.*' -g '!**/__tests__/**' -g '!**/dist/**' -g '!**/coverage/**'";

function findViolations(file: string, content: string): Violation[] {
  const lines = content.split('\n');
  const violations: Violation[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    const isComment = /^\s*(\/\/|\*|\/\*)/.test(line);

    if (!isComment && /(^|[^\w$.])eval\s*\(/.test(line) && !/["'`]\s*eval\s*\(/.test(line)) {
      violations.push({ file, line: lineNumber, rule: 'SEC-001', message: 'Dynamic eval() is forbidden. Use a safe parser/interpreter.', snippet: line.trim() });
    }

    if (!isComment && /new\s+Function\s*\(/.test(line) && !/["'`]\s*new\s+Function\s*\(/.test(line)) {
      violations.push({ file, line: lineNumber, rule: 'SEC-002', message: 'new Function() is forbidden. Use a safe evaluator utility instead.', snippet: line.trim() });
    }

    if (line.includes('dangerouslySetInnerHTML')) {
      const context = lines.slice(index, index + 10).join('\n');
      if (!/sanitizeHtml\(/.test(context)) {
        violations.push({ file, line: lineNumber, rule: 'SEC-003', message: 'dangerouslySetInnerHTML must be fed by sanitizeHtml(...).', snippet: line.trim() });
      }
    }
  });

  return violations;
}

function main() {
  const raw = execSync(FILE_LIST_CMD, { encoding: 'utf8' }).trim();
  const files = raw ? raw.split('\n') : [];
  const violations: Violation[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    violations.push(...findViolations(file, content));
  }

  if (violations.length === 0) {
    console.log('✅ SEC-001..SEC-003 checks passed (no forbidden dynamic evaluation or unsafe HTML rendering).');
    return;
  }

  console.error(`❌ Found ${violations.length} SEC policy violation(s):`);
  for (const violation of violations) {
    console.error(`- [${violation.rule}] ${violation.file}:${violation.line} ${violation.message}`);
    console.error(`  ${violation.snippet}`);
  }

  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error('Failed to run SEC validation script.', error);
  process.exit(1);
}
