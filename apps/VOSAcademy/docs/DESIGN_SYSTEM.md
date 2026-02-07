# VOS Education Hub Design System

This document outlines the design tokens and usage guidelines for the VOS Education Hub platform.

---

## 1. Color Tokens

All colors are defined as CSS variables using OKLCH color space for better perceptual uniformity.

### Light Mode (`:root`)

**Base Colors:**
- `--background`: Pure white background
- `--foreground`: Dark text for maximum readability
- `--primary`: VOS Teal (`oklch(0.55 0.15 190)`) - Brand color for CTAs and key actions
- `--primary-foreground`: White text on primary backgrounds

**Surface Colors:**
- `--card`: White cards with subtle shadow
- `--popover`: White popovers
- `--secondary`: Light gray for secondary actions
- `--muted`: Muted gray for less prominent content
- `--accent`: Accent gray for hover states

**Semantic Colors:**
- `--destructive`: Red for destructive actions
- `--border`: Light gray borders
- `--input`: Input field borders
- `--ring`: Focus ring color

**Sidebar:**
- `--sidebar-background`: Light background
- `--sidebar-primary`: VOS Teal for active items
- `--sidebar-accent`: Hover state background

### Dark Mode (`.dark`)

**Base Colors:**
- `--background`: Dark background (`oklch(0.141 0.005 285.823)`)
- `--foreground`: Light text
- `--primary`: Lighter VOS Teal (`oklch(0.60 0.15 190)`)
- `--primary-foreground`: Dark text on primary

**Surface Colors:**
- `--card`: Elevated dark surface
- `--secondary`: Dark gray for secondary actions
- `--muted`: Muted dark gray
- `--accent`: Accent dark gray

### Usage Examples

```tsx
// Layout background
<div className="bg-background text-foreground">

// Primary CTA button
<button className="bg-primary text-primary-foreground shadow-light-blue-sm rounded-lg">

// Card with beautiful shadow
<div className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">

// Sidebar navigation
<nav className="bg-sidebar-background text-sidebar-foreground">
```

---

## 2. Typography Tokens

### Font Family

- **Sans-serif**: Inter (loaded from Google Fonts)
  - Weights: 300, 400, 500, 600, 700, 800
  - Fallback: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

- **Monospace**: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas

### Letter Spacing

- **Body text**: `-0.01em` (slightly tighter for better readability)
- **Headings (h3-h6)**: `-0.02em`
- **Large headings (h2)**: `-0.025em`
- **Hero headings (h1)**: `-0.03em` (tightest for impact)

### Font Weights

- **Light**: 300 (sparingly for large text)
- **Regular**: 400 (body text)
- **Medium**: 500 (emphasis)
- **Semibold**: 600 (headings, buttons)
- **Bold**: 700 (strong emphasis)
- **Extrabold**: 800 (hero text)

### Usage Examples

```tsx
// Hero heading
<h1 className="text-4xl font-bold">Master the Value Operating System</h1>

// Section heading
<h2 className="text-2xl font-semibold">Why VOS Education Hub?</h2>

// Body text (default styling applied)
<p>Transform from feature-focused operations...</p>

// Muted helper text
<p className="text-sm text-muted-foreground">Additional context</p>
```

---

## 3. Shadow Tokens

Shadows create depth hierarchy and visual separation.

### Available Shadows

- **`shadow-beautiful-sm`**: Subtle elevation for basic UI elements
  - Use for: Small cards, dropdowns, tooltips
  
- **`shadow-beautiful-md`**: Standard elevation for primary cards
  - Use for: Content cards, panels, modals
  
- **`shadow-beautiful-lg`**: Prominent elevation for hero elements
  - Use for: Hero cards, featured content, important modals
  
- **`shadow-beautiful-xl`**: Maximum elevation for overlays
  - Use for: Full-screen modals, drawers, major overlays

- **`shadow-light-blue-sm`**: Branded shadow with VOS Teal tint
  - Use for: Primary CTAs, active states, brand emphasis

### Usage Examples

```tsx
// Standard card
<div className="bg-card shadow-beautiful-md rounded-lg p-6">

// Primary CTA with branded shadow
<button className="bg-primary text-primary-foreground shadow-light-blue-sm rounded-lg px-6 py-3">
  Start Learning
</button>

// Hero card
<div className="bg-card shadow-beautiful-lg rounded-xl p-8">
  Featured content
</div>
```

---

## 4. Radius Tokens

Consistent border radius creates visual harmony.

### Available Radii

- **`rounded-sm`**: `calc(var(--radius) - 4px)` ≈ 6px
  - Use for: Small pills, badges, tags
  
- **`rounded-md`**: `calc(var(--radius) - 2px)` ≈ 8px
  - Use for: Inputs, small buttons, chips
  
- **`rounded-lg`**: `var(--radius)` = 10px (base radius)
  - Use for: Cards, buttons, panels (most common)
  
- **`rounded-xl`**: `calc(var(--radius) + 4px)` ≈ 14px
  - Use for: Hero sections, large cards, featured content

### Usage Examples

```tsx
// Standard button
<button className="rounded-lg px-4 py-2">

// Input field
<input className="rounded-md border border-input px-3 py-2" />

// Badge
<span className="rounded-sm bg-secondary px-2 py-1 text-xs">
  New
</span>

// Hero card
<div className="rounded-xl bg-card p-8">
```

---

## 5. VOS-Specific Utilities

### Gradients

- **`vos-gradient`**: Primary teal gradient
  - Use for: Hero sections, feature highlights
  
- **`vos-gradient-subtle`**: Subtle gray gradient
  - Use for: Backgrounds, subtle emphasis

### Maturity Level Colors

Pre-defined color classes for the 6 maturity levels (L0-L5):

- `maturity-0`: Red (Value Chaos)
- `maturity-1`: Orange (Value Alignment)
- `maturity-2`: Yellow (Measurement)
- `maturity-3`: Lime (Predictability)
- `maturity-4`: Green (Analytics)
- `maturity-5`: Teal (Orchestration)

### Usage Examples

```tsx
// Hero section with gradient
<section className="vos-gradient text-white py-20">
  <h1>Master the Value Operating System</h1>
</section>

// Maturity badge
<span className="maturity-3 rounded-sm px-2 py-1 text-xs font-medium">
  Level 3: Predictability
</span>
```

---

## 6. Component Patterns

### Primary CTA Button

```tsx
<button className="bg-primary text-primary-foreground shadow-light-blue-sm rounded-lg px-6 py-3 font-semibold hover:opacity-90 transition-opacity">
  Get Started
</button>
```

### Secondary Button

```tsx
<button className="bg-secondary text-secondary-foreground border border-border rounded-lg px-6 py-3 font-medium hover:bg-accent transition-colors">
  Learn More
</button>
```

### Card Component

```tsx
<div className="bg-card text-card-foreground shadow-beautiful-md rounded-lg p-6 hover:shadow-beautiful-lg transition-shadow">
  <h3 className="text-lg font-semibold mb-2">Card Title</h3>
  <p className="text-muted-foreground">Card content...</p>
</div>
```

### Input Field

```tsx
<input 
  type="text"
  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
  placeholder="Enter value..."
/>
```

---

## 7. Accessibility Guidelines

- **Contrast**: All color combinations meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- **Focus states**: Always visible with `ring` color
- **Interactive elements**: Clear hover and active states
- **Typography**: Minimum 16px for body text, sufficient line height (1.5)

---

## 8. Dark Mode Best Practices

- Always pair semantic colors: `bg-card` with `text-card-foreground`
- Test all components in both light and dark modes
- Use `dark:` prefix for dark-mode-specific overrides when needed
- Shadows automatically adjust for dark mode (lighter, more subtle)

---

## 9. Design Principles

1. **Consistency**: Use design tokens consistently across all components
2. **Hierarchy**: Use shadows and typography to create clear visual hierarchy
3. **Accessibility**: Maintain high contrast and clear focus states
4. **Performance**: Prefer CSS variables and Tailwind utilities over custom CSS
5. **Responsiveness**: Design mobile-first, enhance for larger screens

---

## 10. Quick Reference

**Most Common Patterns:**

```tsx
// Page layout
<div className="bg-background text-foreground min-h-screen">
  <div className="container py-8">
    {/* Content */}
  </div>
</div>

// Section with cards
<section className="py-12">
  <div className="container">
    <h2 className="text-3xl font-bold mb-8">Section Title</h2>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="bg-card shadow-beautiful-md rounded-lg p-6">
        {/* Card content */}
      </div>
    </div>
  </div>
</section>

// Hero section
<section className="vos-gradient text-white py-20">
  <div className="container text-center">
    <h1 className="text-5xl font-bold mb-4">Hero Title</h1>
    <p className="text-xl mb-8 opacity-90">Hero subtitle</p>
    <button className="bg-white text-primary shadow-beautiful-lg rounded-lg px-8 py-4 font-semibold">
      Primary CTA
    </button>
  </div>
</section>
```
