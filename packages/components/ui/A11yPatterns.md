/\*\*

- Accessibility Hooks & Patterns (ValueOS)
-
- - useA11y (VOSAcademy): Provides announceToScreenReader and focusTrap utilities for screen reader and modal focus management.
- - All UI primitives (Button, Input, Select, etc.) use Radix UI or ARIA roles, focus-visible, and keyboard navigation patterns.
- - CommandBar: Handles keyboard navigation (Arrow keys, Escape, focus reset) and auto-focuses input on open.
- - Loading states: Use Skeleton/LoadingSpinner with role="status" and aria-live="polite" for async feedback.
- - All forms and agent-generated UI must be fully keyboard navigable and screen reader accessible (see AccessibilityCompliance.test.tsx).
-
- See also: packages/sdui/src/**tests**/AccessibilityCompliance.test.tsx, apps/VOSAcademy/src/lib/a11y.tsx
  \*/
