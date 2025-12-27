# Component Tests

Comprehensive tests for React UI components.

## Test Files Created

### Atomic Components (6 tests)

- **Button.test.tsx** - Button variants, states, interactions, accessibility
- **Input.test.tsx** - Input types, validation, error states, accessibility
- **Modal.test.tsx** - Open/close, overlay, escape, focus management
- **Card.test.tsx** - Header/body/footer, variants, click handling
- **LoadingSpinner.test.tsx** - Sizes, variants, accessibility
- **Alert.test.tsx** - Variants, dismissible, auto-dismiss, accessibility

## Running Tests

```bash
# Run all component tests
npm test tests/components

# Run specific component
npm test tests/components/Button.test.tsx

# Watch mode
npm run test:watch tests/components
```

## Test Coverage

Each component test includes:

- ✅ Rendering tests (default props, variants, states)
- ✅ Interaction tests (click, change, keyboard)
- ✅ Accessibility tests (ARIA attributes, roles, labels)
- ✅ Edge cases (disabled, loading, error states)

## Testing Patterns

### Component Structure

```tsx
describe("ComponentName", () => {
  describe("Rendering", () => {
    /* visual tests */
  });
  describe("Interaction", () => {
    /* user interaction */
  });
  describe("States", () => {
    /* loading, disabled, etc */
  });
  describe("Accessibility", () => {
    /* a11y compliance */
  });
});
```

### Accessibility Checklist

- ✅ Proper ARIA roles
- ✅ Accessible names (aria-label, labels)
- ✅ Keyboard navigation
- ✅ Screen reader announcements
- ✅ Focus management

## Next Steps

Additional components to test:

- Form components (Select, Checkbox, Radio)
- Navigation (Tabs, Breadcrumbs, Menu)
- Data display (Table, List, Badge)
- SDUI components (HypothesisCard, AgentWidget)
- Layout components (Grid, Flex, Container)

Target: 50 component tests total
Current: 6 tests
Remaining: 44 tests
