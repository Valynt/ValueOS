import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isNoMatchExit = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  (error as { status?: number }).status === 1;

test.describe('Architecture & Code Quality Remediation', () => {
  
  test('TypeScript "any" usage is strictly zero across all production modules', () => {
    // This test verifies that the check-any-count.sh script passes with all ceilings set to 0
    // We simulate the check by running a grep command similar to the script
    const anyPattern = ':[[:space:]]*\\bany\\b|as[[:space:]]+\\bany\\b|<any>';
    const testExclude = '__tests__|/tests/|\\.test\\.|\\.spec\\.';
    
    const modules = [
      'packages/shared',
      'packages/sdui',
      'packages/components',
      'packages/mcp',
      'apps/VOSAcademy',
      'apps/ValyntApp',
      'packages/backend'
    ];

    for (const mod of modules) {
      const modulePath = path.join(process.cwd(), mod);
      if (!fs.existsSync(modulePath)) continue;

      try {
        // Run grep to find 'any' usages, excluding test files
        const cmd = `grep -rE "${anyPattern}" "${modulePath}" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist | grep -vE "${testExclude}|\\.d\\.ts" | wc -l`;
        const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
        const count = parseInt(countStr, 10);
        
        expect(count, `Module ${mod} still contains ${count} usages of 'any'. Expected 0.`).toBe(0);
      } catch (error: unknown) {
        // grep returns 1 if no matches found, which is the desired state
        if (!isNoMatchExit(error)) {
          throw error;
        }
      }
    }
  });

  test('No hardcoded mock data in production components', () => {
    // This test scans for common hardcoded mock data patterns identified in the audit
    const mockPatterns = [
      'Acme Corp',
      'sarah@acme.com',
      'james@acme.com',
      'maria@acme.com',
      'david@acme.com',
      '\\$1,250\\.00',
      '1,234'
    ];
    
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');
    
    for (const pattern of mockPatterns) {
      try {
        // Exclude test files and specific known safe files if necessary
        const cmd = `grep -rE "${pattern}" "${srcPath}" --include="*.tsx" --include="*.ts" | grep -vE "\\.test\\.|node_modules" | wc -l`;
        const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
        const count = parseInt(countStr, 10);
        
        expect(count, `Found ${count} instances of hardcoded mock data matching "${pattern}" in production code.`).toBe(0);
      } catch (error: unknown) {
        if (!isNoMatchExit(error)) throw error;
      }
    }
  });

  test('Duplicate UI components are consolidated', () => {
    // This test checks that duplicate component definitions have been removed
    const duplicateComponents = [
      'EditableField',
      'EditableNumber',
      'ConfidenceBadge',
      'LoadingSpinner',
      'ConfirmationModal'
    ];

    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');

    for (const comp of duplicateComponents) {
      try {
        // Count the number of times the component is defined (function or const)
        const cmd = `grep -rE "function ${comp}\\b|const ${comp}[[:space:]]*=" "${srcPath}" --include="*.tsx" | grep -vE "\\.test\\.|node_modules" | wc -l`;
        const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
        const count = parseInt(countStr, 10);
        
        // It should be defined exactly once (or zero if moved to a shared package)
        expect(count, `Component ${comp} is defined ${count} times. It should be consolidated to a single definition.`).toBeLessThanOrEqual(1);
      } catch (error: unknown) {
        if (!isNoMatchExit(error)) throw error;
      }
    }
  });
});
