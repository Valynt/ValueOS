import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.describe('UI/UX & Design System Remediation', () => {
  
  test('No inline styles in marketing components', () => {
    // This test verifies that inline styles (style={{...}}) have been removed from marketing components
    // in favor of Tailwind utility classes and design tokens.
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src/components/marketing');
    
    try {
      const cmd = `grep -rE "style=\\{\\{" "${srcPath}" --include="*.tsx" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      expect(count, `Found ${count} instances of inline styles in marketing components. Expected 0.`).toBe(0);
    } catch (e: any) {
      if (e.status !== 1) throw e;
    }
  });

  test('No hardcoded hex colors in marketing components', () => {
    // This test verifies that hardcoded hex colors have been replaced with design tokens
    const hexPatterns = ['#18C3A5', '#0B0C0F', '#707070', '#E0E0E0'];
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src/components/marketing');
    
    for (const pattern of hexPatterns) {
      try {
        const cmd = `grep -rE "${pattern}" "${srcPath}" --include="*.tsx" | wc -l`;
        const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
        const count = parseInt(countStr, 10);
        
        expect(count, `Found ${count} instances of hardcoded hex color ${pattern}. Expected 0.`).toBe(0);
      } catch (e: any) {
        if (e.status !== 1) throw e;
      }
    }
  });

  test('Accessibility (a11y) attributes are present on interactive elements', () => {
    // This is a static analysis check to ensure aria-label or aria-describedby usage has increased
    // A more robust test would use axe-core in Playwright, but this verifies the code change
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src/components/ui');
    
    try {
      const cmd = `grep -rE "aria-label|aria-describedby|role=" "${srcPath}" --include="*.tsx" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      // The audit found 16 instances. We expect this to increase significantly after remediation.
      expect(count, `Found only ${count} a11y attributes in UI components. Expected significant increase (> 50).`).toBeGreaterThan(50);
    } catch (e: any) {
      if (e.status !== 1) throw e;
    }
  });

  test('ValueTreeCanvas uses a robust layout engine instead of hardcoded math', () => {
    // This test verifies that the hardcoded layout math has been removed from ValueTreeCanvas
    const filePath = path.join(process.cwd(), 'apps/ValyntApp/src/features/living-value-graph/components/canvas/ValueTreeCanvas.tsx');
    
    if (!fs.existsSync(filePath)) {
      test.skip('ValueTreeCanvas file not found');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check that the old hardcoded layout is gone
    expect(content).not.toContain('x: index * 250');
    expect(content).not.toContain('y: (index % 3) * 150');
    
    // Check that a layout engine (like dagre or elkjs) is imported
    const usesLayoutEngine = content.includes('dagre') || content.includes('elkjs') || content.includes('layoutEngine');
    expect(usesLayoutEngine, 'ValueTreeCanvas should import and use a graph layout engine (e.g., dagre, elkjs)').toBe(true);
  });
});
