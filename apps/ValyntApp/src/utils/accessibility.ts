export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
  timeout: number = 1000
): void => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    if (announcement.parentNode) {
      document.body.removeChild(announcement);
    }
  }, timeout);
};

export const trapFocus = (element: HTMLElement): (() => void) => {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);

  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
};

export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    const rgb = parseInt(color.slice(1), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = (rgb & 0xff) / 255;

    const [rs, gs, bs] = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

export const isColorContrastCompliant = (
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean => {
  const ratio = getContrastRatio(foreground, background);
  const threshold = level === 'AAA' ? (size === 'large' ? 4.5 : 7) : size === 'large' ? 3 : 4.5;
  return ratio >= threshold;
};

export const generateAriaLabel = (
  label: string,
  context?: Record<string, string | number>
): string => {
  if (!context) return label;

  let result = label;
  Object.entries(context).forEach(([key, value]) => {
    result = result.replace(`{${key}}`, String(value));
  });

  return result;
};

/**
 * Generate unique ID for accessibility
 */
export function generateA11yId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * WCAG Compliance Checker
 */
export interface AccessibilityIssue {
  element: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  wcagCriterion: string;
  suggestion: string;
}

export class AccessibilityChecker {
  private issues: AccessibilityIssue[] = [];

  audit(container: HTMLElement = document.body): AccessibilityIssue[] {
    this.issues = [];
    this.checkImages(container);
    this.checkFormInputs(container);
    this.checkHeadings(container);
    this.checkLinks(container);
    this.checkColorContrast(container);
    this.checkKeyboardAccess(container);
    return this.issues;
  }

  generateReport(): {
    score: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    issues: AccessibilityIssue[];
  } {
    const errors = this.issues.filter((i) => i.severity === 'error').length;
    const warnings = this.issues.filter((i) => i.severity === 'warning').length;
    const totalChecks = 20;
    const passedChecks = totalChecks - errors - warnings;
    const score = Math.max(0, (passedChecks / totalChecks) * 100);

    return {
      score: Math.round(score),
      totalIssues: this.issues.length,
      errors,
      warnings,
      issues: this.issues,
    };
  }

  private checkImages(container: HTMLElement): void {
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.hasAttribute('alt')) {
        this.issues.push({
          element: `<img src="${img.src}">`,
          issue: 'Missing alt attribute',
          severity: 'error',
          wcagCriterion: '1.1.1 Non-text Content',
          suggestion: 'Add descriptive alt text or alt="" for decorative images',
        });
      }
    });
  }

  private checkFormInputs(container: HTMLElement): void {
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
      const hasLabel =
        input.hasAttribute('aria-label') ||
        input.hasAttribute('aria-labelledby') ||
        container.querySelector(`label[for="${input.id}"]`);

      if (!hasLabel) {
        this.issues.push({
          element: `<${input.tagName.toLowerCase()}>`,
          issue: 'Form input without label',
          severity: 'error',
          wcagCriterion: '3.3.2 Labels or Instructions',
          suggestion: 'Add label, aria-label, or aria-labelledby',
        });
      }
    });
  }

  private checkHeadings(container: HTMLElement): void {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let previousLevel = 0;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1]);

      if (previousLevel > 0 && level > previousLevel + 1) {
        this.issues.push({
          element: `<${heading.tagName.toLowerCase()}>`,
          issue: 'Skipped heading level',
          severity: 'warning',
          wcagCriterion: '1.3.1 Info and Relationships',
          suggestion: `Use h${previousLevel + 1} instead of h${level}`,
        });
      }

      previousLevel = level;
    });
  }

  private checkLinks(container: HTMLElement): void {
    const links = container.querySelectorAll('a');
    links.forEach((link) => {
      const text = link.textContent?.trim() || '';

      if (!text && !link.getAttribute('aria-label')) {
        this.issues.push({
          element: `<a href="${link.href}">`,
          issue: 'Link without text or aria-label',
          severity: 'error',
          wcagCriterion: '2.4.4 Link Purpose',
          suggestion: 'Add descriptive link text or aria-label',
        });
      }
    });
  }

  private checkColorContrast(container: HTMLElement): void {
    const textElements = container.querySelectorAll('p, span, div, button, a, label');

    textElements.forEach((element) => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      if (color && backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        const ratio = getContrastRatio(color, backgroundColor);

        if (ratio < 4.5) {
          this.issues.push({
            element: `<${element.tagName.toLowerCase()}>`,
            issue: `Insufficient color contrast (${ratio.toFixed(2)}:1)`,
            severity: 'error',
            wcagCriterion: '1.4.3 Contrast (Minimum)',
            suggestion: 'Increase contrast to at least 4.5:1',
          });
        }
      }
    });
  }

  private checkKeyboardAccess(container: HTMLElement): void {
    const interactive = container.querySelectorAll('button, a, input, select, textarea');

    interactive.forEach((element) => {
      const tabIndex = element.getAttribute('tabindex');

      if (tabIndex && parseInt(tabIndex) > 0) {
        this.issues.push({
          element: `<${element.tagName.toLowerCase()}>`,
          issue: 'Positive tabindex value',
          severity: 'warning',
          wcagCriterion: '2.4.3 Focus Order',
          suggestion: 'Use tabindex="0" or rely on natural tab order',
        });
      }
    });
  }
}

export const accessibilityChecker = new AccessibilityChecker();
