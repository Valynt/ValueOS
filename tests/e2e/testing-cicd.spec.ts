import { describe, it, expect } from 'vitest';

describe('Testing & CI/CD Remediation', () => {
  
  it('Test coverage thresholds are increased to enterprise standards', () => {
    // This test verifies that the coverage thresholds in vitest.config.ts
    // have been increased from the current 70-75% to at least 80-85%.
    const frontendConfigPath = path.join(process.cwd(), 'apps/ValyntApp/vitest.config.ts');
    const backendConfigPath = path.join(process.cwd(), 'packages/backend/vitest.config.ts');
    
    const checkThresholds = (configPath: string, expectedMin: number) => {
      if (!fs.existsSync(configPath)) {
        test.skip(`Config file not found: ${configPath}`);
        return;
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      
      // Extract the thresholds block using a simple regex
      const thresholdsMatch = content.match(/thresholds:\s*{([^}]+)}/);
      if (!thresholdsMatch) {
        throw new Error(`Could not find thresholds block in ${configPath}`);
      }
      
      const thresholdsText = thresholdsMatch[1];
      
      // Parse the individual values
      const metrics = ['branches', 'functions', 'lines', 'statements'];
      for (const metric of metrics) {
        const metricMatch = thresholdsText.match(new RegExp(`${metric}:\\s*(\\d+)`));
        if (metricMatch) {
          const value = parseInt(metricMatch[1], 10);
          expect(value, `${metric} coverage threshold in ${path.basename(configPath)} is ${value}%. Expected >= ${expectedMin}%.`).toBeGreaterThanOrEqual(expectedMin);
        } else {
          throw new Error(`Could not find ${metric} threshold in ${configPath}`);
        }
      }
    };

    // Check frontend (expecting >= 80%)
    checkThresholds(frontendConfigPath, 80);
    
    // Check backend (expecting >= 85% due to critical business logic)
    checkThresholds(backendConfigPath, 85);
  });

  it('Comprehensive E2E test suite covers critical user flows', () => {
    // This test verifies that the E2E test suite has been expanded beyond
    // the basic startup and auth tests to cover the full value loop lifecycle.
    const e2ePath = path.join(process.cwd(), 'tests/e2e');
    
    if (!fs.existsSync(e2ePath)) {
      test.skip('E2E tests directory not found');
      return;
    }

    try {
      // Count the number of E2E spec files
      const cmd = `find "${e2ePath}" -name "*.spec.ts" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      // The audit found ~11 spec files, many of which were basic or stubs.
      // We expect a significant increase in comprehensive E2E tests.
      expect(count, `Found only ${count} E2E spec files. Expected > 20 for comprehensive coverage.`).toBeGreaterThan(20);
      
      // Check for specific critical flow files
      const criticalFlows = [
        'deal-assembly',
        'hypothesis-generation',
        'financial-modeling',
        'value-realization'
      ];
      
      for (const flow of criticalFlows) {
        const flowCmd = `find "${e2ePath}" -name "*${flow}*.spec.ts" | wc -l`;
        const flowCountStr = execSync(flowCmd, { encoding: 'utf-8' }).trim();
        const flowCount = parseInt(flowCountStr, 10);
        
        expect(flowCount, `Missing E2E test for critical flow: ${flow}`).toBeGreaterThan(0);
      }
    } catch (e: any) {
      if (e.status !== 1) throw e;
    }
  });

  it('E2E tests are integrated into CI pipeline as a mandatory gate', () => {
    // This test verifies that the CI configuration runs the E2E tests
    // and blocks deployment if they fail.
    const ciPath = path.join(process.cwd(), '.github/workflows');
    
    if (!fs.existsSync(ciPath)) {
      test.skip('GitHub Actions workflows directory not found');
      return;
    }

    try {
      // Look for playwright test execution in the main CI workflow
      const cmd = `grep -rE "npx playwright test|pnpm exec playwright test" "${ciPath}" --include="*.yml" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      expect(count, 'E2E tests are not executed in the CI pipeline.').toBeGreaterThan(0);
      
      // Verify it's a required check (this is harder to test statically, but we can check for 'needs' or similar)
      const gateCmd = `grep -rE "needs:.*e2e|needs:.*playwright" "${ciPath}" --include="*.yml" | wc -l`;
      const gateCountStr = execSync(gateCmd, { encoding: 'utf-8' }).trim();
      const gateCount = parseInt(gateCountStr, 10);
      
      expect(gateCount, 'Deployment jobs do not depend on E2E test success.').toBeGreaterThan(0);
    } catch (e: any) {
      if (e.status !== 1) throw e;
    }
  });
});
