import { describe, it, expect } from 'vitest';

describe('UI/UX & Design System Remediation', () => {
  
  it('No hardcoded hex colors in inline styles in marketing components', () => {
    // The audit finding was about hardcoded hex values (#RRGGBB) in inline style attributes.
    // Inline styles using CSS variables (var(--mkt-*)) are acceptable and token-compliant.
    // This test checks that no raw hex colors appear inside style={{ ... }} blocks.
    const srcPath = path.join(process.cwd(), 'apps/ValyntApp/src/components/marketing');
    
    try {
      // Match style={{ ... }} blocks containing a raw hex color like #18C3A5 or #fff
      const cmd = `grep -rE "style=\\{\\{[^}]*#[0-9A-Fa-f]{3,6}" "${srcPath}" --include="*.tsx" | wc -l`;
      const countStr = execSync(cmd, { encoding: 'utf-8' }).trim();
      const count = parseInt(countStr, 10);
      
      expect(
        count,
        `Found ${count} instances of hardcoded hex colors inside inline style attributes in marketing components. ` +
        'Replace with CSS variables (var(--mkt-*)) or Tailwind tokens.'
      ).toBe(0);
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status !== 1) throw e;
    }
  });

  it('No hardcoded hex colors in marketing components', () => {
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

  it('Accessibility (a11y) attributes are present on interactive elements', () => {
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

  it('ValueTreeCanvas uses a robust layout engine instead of hardcoded math', () => {
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
