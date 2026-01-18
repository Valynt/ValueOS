# Valynt Design System

Welcome to the official design system for Valynt (ValueOS). This living style guide defines the visual language, components, and patterns used to build our agentic SaaS platform.

## 📚 Documentation Structure

- **[Foundation](./foundation/)**: The atomic visual decisions.
  - [Colors](./foundation/colors.md)
  - [Typography](./foundation/typography.md)
  - [Spacing](./foundation/spacing.md)
  - [Elevation](./foundation/elevation.md)
- **[Components](./components/)**: Reusable UI elements.
  - [Button](./components/button.md)
  - [Input](./components/input.md)
  - [Card](./components/card.md)
  - [Modal](./components/modal.md)
- **[Patterns](./patterns/)**: UX flows and compositions.
  - [Forms](./patterns/forms.md)
  - [Navigation](./patterns/navigation.md)
  - [Data Display](./patterns/data-display.md)
- **[Principles](./principles.md)**: Our design philosophy.

## 🎨 Implementation

The source of truth for design tokens is located in `tokens.css`.

```css
@import "/design-system/tokens.css";
```

## 🛠 Tools Stack

- **Figma**: Primary design tool for UI/UX.
- **Tailwind CSS**: Utility-first framework used for implementation (mapped to our tokens).
- **Lucide React**: Iconography library.
- **Radix UI**: Headless accessible primitives for complex components (Dialogs, Popovers).

## 🧩 Icon Usage Guidance

Use the shared icon utility classes to keep icon sizing and color consistent across headers, cards, and empty states:

- **Sizing**: `icon-sm`, `icon-md`, `icon-lg` for 16/20/32px icons.
- **Color**: `icon-muted` for secondary iconography, `icon-accent` for emphasis.
- **Inheritance**: Use size utilities only when the icon should inherit the surrounding text color.
- **Consistency**: Prefer these utilities over ad-hoc `h-* w-*` classes in UI surfaces.

## ⚖️ Governance & Maintenance

### Contribution Process

1. **Explore**: Check existing patterns first.
2. **Propose**: Discuss new component needs in `#design-system` channels.
3. **Draft**: Create a Figma mockup or code prototype.
4. **Review**: Design + Eng review for visual consistency and API design.
5. **Merge**: Update documentation and tokens upon release.

### Versioning

- **Major (1.0)**: Breaking changes to core tokens or component APIs.
- **Minor (1.1)**: New components or additive changes.
- **Patch (1.1.1)**: Bug fixes or slight visual tweaks.

### Accessibility Standards

- All text must meet **WCAG AA** contrast (4.5:1).
- Interactive elements must be at least **44px** tall/wide.
- All forms must have explicit `<label>` elements.
- Components must be keyboard navigable (`Tab` focusable).
