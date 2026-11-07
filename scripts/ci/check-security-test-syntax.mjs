#!/usr/bin/env node
/**
 * Fail closed on TypeScript syntax errors that previously caused CodeQL to
 * skip security test files. This is a parse gate, not typecheck or security
 * coverage, and never suppresses findings or excludes code from analysis.
 *
 * With no arguments, checks the three historically broken fixtures. An
 * explicit file list is accepted for regression tests and local investigation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const defaultFiles = [
  'packages/backend/src/services/billing/__tests__/BillingOverridesService.test.ts',
  'packages/backend/src/services/__tests__/kafkaConfig.test.ts',
  'tests/security/owasp-behavioral-security.test.ts',
];
const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles;
let failed = false;
for (const filename of files) {
  const path = resolve(filename);
  let source;
  try {
    source = readFileSync(path, 'utf8');
  } catch (error) {
    console.error('FAIL: unable to read TypeScript test source: ' + filename);
    console.error(String(error));
    failed = true;
    continue;
  }
  const kind = filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  if (tree.parseDiagnostics.length > 0) {
    failed = true;
    for (const diagnostic of tree.parseDiagnostics) {
      const pos = tree.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      console.error(filename + ':' + (pos.line + 1) + ':' + (pos.character + 1) + ': ' +
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  } else {
    console.log('PASS syntax: ' + filename);
  }
}
if (failed) {
  console.error('SECURITY_TEST_PARSE_FAILED');
  process.exitCode = 1;
} else {
  console.log('SECURITY_TEST_PARSE_PASSED');
}
