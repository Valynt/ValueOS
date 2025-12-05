# Accessibility Standards

## Linting Guardrails
- `eslint-plugin-jsx-a11y` is enabled in `eslint.config.js` to enforce ARIA labels, valid roles, and focus requirements.
- CI should run `npm run lint` to fail on missing alt text, invalid roles, or tabbable patterns that break keyboard navigation.
- Avoid positive tabindex values and unmanaged autofocus; the linter flags both patterns.

## Component Checklist
- Every interactive element has an accessible label (`aria-label`, `aria-labelledby`, or native `<label>` association).
- Ensure focus outlines are visible and logical; keyboard users must reach every control in a predictable order.
- Use semantic elements (`<button>`, `<nav>`, `<header>`) instead of generic `<div>` wrappers for interaction.
- Provide descriptive error messaging and link text, not just color changes, to indicate state.
- Maintain sufficient color contrast between text and backgrounds (WCAG AA minimum).

## Testing Steps
- **axe-core/Browser extension:** Run automated checks on new views; address critical issues before merging.
- **Keyboard navigation:** Tab through forms and dialogs to verify focus traps, skip links, and visible focus states.
- **Screen reader sanity:** Verify that form labels and ARIA attributes read correctly with VoiceOver/NVDA.

## Reporting
- Document known exceptions in PR descriptions and track remediation tasks.
- Include accessibility testing notes in QA plans when introducing new UI components.
