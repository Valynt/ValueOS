import { describe, it, expect } from 'vitest';

describe('Architecture & Code Quality Remediation', () => {
  
  it('TypeScript "any" usage is strictly zero across all production modules', () => {
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
      } catch (e: any) {
        // grep returns 1 if no matches found, which is the desired state
        if (e.status !== 1) {
          throw e;
        }
      }
    }
  });

  it('No hardcoded mock data in production components', () => {
    // This test scans for hardcoded mock data patterns in active production routes.
    // Exclusions:
    //   - placeholder="..." attributes (UX hint text, not data)
    //   - wireframe/ and wireframes/ directories (design mockups, not production)
    //   - views/Home.tsx and views/ROICalculator.tsx (legacy dead code, not in any active route)
    //   - mcp-crm/index.ts code comments (documentation examples)
    // The critical patterns are hardcoded email addresses used as actual data values.
    const mockEmailPatterns = [
      'sarah@acme.com',
      'james@acme.com',
      'maria@acme.com',
      'david@acme.com',
    ];
    
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src');
    
    for (const pattern of mockEmailPatterns) {
      try {
        // Exclude test files, wireframes, and placeholder attributes
        const cmd = `grep -rE "${pattern}" "${srcPath}" --include="*.tsx" --include="*.ts" | grep -vE "\\.test\\.|node_modules|wireframe|placeholder=" | wc -l`;
        const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
        const count = parseInt(countStr, 10);
        
        expect(count, `Found ${count} instances of hardcoded mock email "${pattern}" used as data in production code.`).toBe(0);
      } catch (e: unknown) {
        const err = e as { status?: number };
        if (err.status !== 1) throw e;
      }
    }

    // Also verify that the DashboardPage no longer uses hardcoded KPI values
    const dashboardPath = path.join(srcPath, 'pages/app/DashboardPage.tsx');
    if (fs.existsSync(dashboardPath)) {
      const content = fs.readFileSync(dashboardPath, 'utf-8');
      // The dashboard should use a hook (usePortfolioValue or similar), not hardcoded numbers
      const hasHook = content.includes('usePortfolioValue') || content.includes('useValueCases') || content.includes('useCases') || content.includes('useMetrics');
      expect(hasHook, 'DashboardPage should use a data hook instead of hardcoded KPI values').toBe(true);
    }
  });

  it('Duplicate UI components are consolidated', () => {
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
      } catch (e: any) {
        if (e.status !== 1) throw e;
      }
    }
  });
});
