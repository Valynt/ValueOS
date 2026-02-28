---
description: Add and validate accessibility in UI components
---

# Accessibility Testing Workflow

## During Development

1. Use semantic HTML elements
2. Add ARIA labels where needed
3. Ensure keyboard navigation works
4. Check color contrast ratios

## Automated Testing

// turbo 2. Run accessibility tests:

```bash
npx playwright test tests/accessibility/axe-a11y.spec.ts
```

## Manual Verification

4. Keyboard navigation test:
   - Tab through all interactive elements
   - Ensure focus is visible
   - Verify Enter/Space activate buttons

5. Screen reader test:
   - Use VoiceOver (Mac) or NVDA (Windows)
   - Navigate the feature
   - Verify announcements make sense

## Axe DevTools Check

6. In browser:
   - Open DevTools
   - Run Axe scan
   - Fix any violations

## Common Fixes

- Missing alt text → Add descriptive alt attributes
- Low contrast → Adjust colors to meet WCAG AA (4.5:1)
- Missing labels → Add aria-label or associate with label element
- Focus not visible → Add :focus-visible styles
- Non-semantic elements → Replace div/span with button/nav/main/etc.

## Checklist

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators are visible
- [ ] Axe scan shows 0 violations
