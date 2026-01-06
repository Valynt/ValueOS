# shadcn/ui Theme Integration Analysis

**Date**: January 5, 2026  
**Status**: Analysis Complete  
**Next Steps**: Implement VALYNT brand theme integration

---

## Executive Summary

ValueOS has a **well-defined, comprehensive brand design system** already in place. The VALYNT brand identity is dark-first, carbon black-based, with strict semantic token enforcement. The recent shadcn/ui integration needs to be aligned with this existing system rather than replacing it.

**Key Finding**: We should NOT implement a new theme from scratch. Instead, we need to **map shadcn/ui's semantic tokens to VALYNT's existing design system**.

---

## Current State Analysis

### 1. Existing Brand Design System

#### Brand Identity (VALYNT)
- **Category**: Value Operating System (not a dashboard or tool)
- **Visual Metaphor**: 
  - Value Intelligence → Teal scale
  - Structure/Graph/Evidence → Grey scale
- **Design Philosophy**: Dark-first, system-level, economically grounded

#### Color System

**Primary Surfaces** (Dark-First Carbon Black):
```css
--vc-surface-1: 230 10% 4%;   /* #0B0C0F - Base shell */
--vc-surface-2: 230 12% 9%;   /* #13141A - Raised content */
--vc-surface-3: 230 12% 12%;  /* #1A1C24 - Highest elevation */
```

**Brand Accent Colors**:
```css
--vc-accent-teal-500: 169 70% 43%;  /* #18C3A5 - Value Teal (primary) */
--vc-accent-teal-400: 170 77% 51%;  /* #27E1C1 - Hover/info */
--vc-accent-grey-500: 230 8% 38%;   /* #5A5D67 - Graph grey */
```

**Semantic Status Colors**:
- Success: Value Teal (#18C3A5)
- Info: Teal 400 (#27E1C1)
- Warning: #FFA726
- Error: #EF5350

**Borders**:
```css
--vc-border-default: 0 0% 16%;  /* #2A2A2A */
--vc-border-strong: 0 0% 23%;   /* #3A3A3A */
```

#### Typography System

**Fonts**:
- UI/Content: **Inter** (system fallback)
- Data/Code: **JetBrains Mono**

**Font Scale** (Fixed):
```css
--font-xs: 0.75rem;    /* 12px - Micro labels */
--font-sm: 0.875rem;   /* 14px - Labels, dense UI */
--font-base: 1rem;     /* 16px - Body text */
--font-3xl: 1.875rem;  /* 30px - Section titles */
--font-5xl: 3rem;      /* 48px - Hero headings */
--font-6xl: 3.75rem;   /* 60px - Display only */
```

**Tracking Rules**:
- Hero headings: `tracking-tight (-0.025em)`
- Micro labels: `tracking-wide (0.05em)`

#### Spacing System

**Strict 8px Grid**:
```css
--spacing-1: 0.5rem;   /* 8px */
--spacing-2: 1rem;     /* 16px */
--spacing-3: 1.5rem;   /* 24px */
--spacing-4: 2rem;     /* 32px */
--spacing-6: 3rem;     /* 48px */
--spacing-8: 4rem;     /* 64px */
```

#### Border Radius

```css
--vc-radius-card: 0.5rem;   /* 8px - Cards/Inputs */
--vc-radius-modal: 1rem;    /* 16px - Modals */
```

#### Effects

**Signature Teal Glow** (Restricted Use):
```css
--vc-glow-teal: 0 0 1.25rem hsl(var(--vc-accent-teal-500), 0.3);
```

**Allowed Only For**:
- Active agents
- High-confidence value intelligence
- System-level emphasis

**Animation Timing**:
```css
--motion-micro: 100ms;      /* Micro-interactions */
--motion-standard: 200ms;   /* Standard UI */
--motion-page: 500ms;       /* Page transitions */
```

### 2. Current shadcn/ui Configuration

**components.json**:
```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.cjs",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  }
}
```

**Current shadcn Tokens** (in src/index.css):
- Using generic neutral colors
- Not aligned with VALYNT brand
- Light mode defaults (needs dark-first approach)

### 3. Design Governance Rules

From `docs/instructions/design rules.instructions.md`:

**North Star Rule**:
> If a design or UI decision does not reinforce VALYNT as a dark-first, system-level, economically grounded Value Operating System, it is incorrect.

**Enforcement**:
- Tokens are the **single source of truth**
- Hex values, px values, inline styles are **prohibited**
- Local component overrides are **prohibited**
- Token violations **block PRs**

**Semantic Over Direct**:
```tsx
// ✓ Required
<div className="bg-vc-surface-2 border-vc-border-default" />

// ✗ Forbidden
<div style={{ background: "#101010", border: "1px solid #2A2A2A" }} />
```

---

## Gap Analysis

### What's Missing

1. **shadcn tokens not mapped to VALYNT tokens**
   - Current: Generic neutral colors
   - Needed: VALYNT-specific semantic mapping

2. **Light mode defaults**
   - Current: Light mode primary
   - Needed: Dark-first with light mode as secondary

3. **Color format inconsistency**
   - VALYNT uses: HSL format (e.g., `230 10% 4%`)
   - shadcn expects: HSL format ✓ (compatible)
   - Note: User suggested OKLCH for 2026, but current system uses HSL

4. **Font loading**
   - Current: System fonts (Inter, JetBrains Mono)
   - Needed: Explicit font loading for consistency

### What's Working

1. ✅ **CSS Variables approach** - Both systems use CSS variables
2. ✅ **HSL color format** - Compatible format
3. ✅ **Semantic naming** - Both use semantic tokens
4. ✅ **Tailwind integration** - Both use Tailwind CSS
5. ✅ **8px spacing grid** - Already implemented

---

## Recommended Approach

### Phase 1: Map shadcn Tokens to VALYNT System

**DO NOT** create a new theme. Instead, **remap** shadcn's semantic tokens to VALYNT's existing tokens:

```css
/* src/index.css - Update shadcn token mappings */

:root {
  /* Map shadcn tokens to VALYNT tokens */
  --background: var(--vc-surface-1);
  --foreground: var(--vc-foreground);
  
  --card: var(--vc-surface-2);
  --card-foreground: var(--vc-foreground);
  
  --popover: var(--vc-surface-3);
  --popover-foreground: var(--vc-foreground);
  
  --primary: var(--vc-accent-teal-500);
  --primary-foreground: 0 0% 100%;
  
  --secondary: var(--vc-surface-3);
  --secondary-foreground: var(--vc-foreground);
  
  --muted: var(--vc-accent-grey-500);
  --muted-foreground: var(--vc-foreground);
  
  --accent: var(--vc-accent-teal-400);
  --accent-foreground: 0 0% 100%;
  
  --destructive: 2 73% 62%;  /* Existing error color */
  --destructive-foreground: 0 0% 100%;
  
  --border: var(--vc-border-default);
  --input: var(--vc-border-default);
  --ring: var(--vc-accent-teal-500);
  
  --radius: var(--vc-radius-card);
}

.dark {
  /* Dark mode is the default - keep same values */
  --background: var(--vc-surface-1);
  --foreground: var(--vc-foreground);
  /* ... same mappings ... */
}
```

### Phase 2: Font Loading (Optional Enhancement)

**Current**: System fonts work but may vary across platforms

**Recommendation**: Add explicit font loading for consistency

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Or use `@fontsource` packages for self-hosting:
```bash
npm install @fontsource/inter @fontsource/jetbrains-mono
```

```typescript
// src/main.tsx
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
```

### Phase 3: OKLCH Migration (Future Enhancement)

**Note**: User mentioned OKLCH as 2026 standard for perceptual uniformity.

**Current State**: HSL works fine and is already implemented
**Future Enhancement**: Consider OKLCH migration for:
- Better perceptual uniformity
- Easier accessible color generation
- More predictable color manipulation

**Migration Path**:
1. Keep HSL as primary format (browser support)
2. Add OKLCH as progressive enhancement
3. Use CSS `color-mix()` for dynamic variations
4. Test accessibility with OKLCH values

**Example**:
```css
/* Future OKLCH approach */
:root {
  --vc-surface-1: oklch(0.145 0 0);  /* Dark base */
  --vc-accent-teal-500: oklch(0.65 0.15 180);  /* Teal */
}
```

### Phase 4: Component Consistency

**Ensure shadcn components respect VALYNT rules**:

1. **Button variants** should map to VALYNT semantics:
   - `default` → Primary actions (teal)
   - `secondary` → Secondary actions (grey)
   - `outline` → Tertiary actions (border only)
   - `ghost` → Minimal actions (no background)
   - `destructive` → Dangerous actions (error color)

2. **Card elevations** should use surface tokens:
   - Base cards: `surface-2`
   - Elevated cards: `surface-3`
   - Never use `surface-1` for cards

3. **Spacing** should use 8px grid:
   - Use `vc-1`, `vc-2`, `vc-3`, etc.
   - Never use arbitrary spacing values

---

## Implementation Checklist

### Immediate (Required)

- [ ] Remap shadcn tokens to VALYNT tokens in `src/index.css`
- [ ] Update `tailwind.config.cjs` to reference VALYNT spacing
- [ ] Test all shadcn components with new token mappings
- [ ] Verify dark-first approach (dark mode is default)
- [ ] Update `ShadcnExample.tsx` to demonstrate VALYNT-aligned usage

### Short-term (Recommended)

- [ ] Add explicit font loading (@fontsource or Google Fonts)
- [ ] Create component usage guidelines for shadcn + VALYNT
- [ ] Add Storybook stories showing VALYNT-themed shadcn components
- [ ] Document token mapping in design system docs

### Long-term (Future Enhancement)

- [ ] Evaluate OKLCH migration for color system
- [ ] Create visual theme generator for VALYNT brand
- [ ] Add automated token validation in CI/CD
- [ ] Create design token documentation site

---

## Key Principles to Maintain

1. **Dark-First**: Dark mode is the default, not an alternative
2. **Semantic Tokens**: Always use semantic names, never raw values
3. **8px Grid**: All spacing must align to 8px base unit
4. **Teal = Value**: Teal color represents value intelligence only
5. **Grey = Structure**: Grey represents metadata and structure
6. **No Decoration**: Every design decision must have business meaning

---

## Tools and Resources

### Recommended Tools

1. **shadcn/ui Theme Editor**: https://ui.shadcn.com/themes
   - Use to visualize token mappings
   - Export CSS variables

2. **Tailwind CSS IntelliSense**: VSCode extension
   - Autocomplete for custom tokens
   - Preview colors inline

3. **CSS Variable Inspector**: Browser DevTools
   - Inspect computed values
   - Debug token inheritance

### Documentation References

- VALYNT Design Rules: `docs/instructions/design rules.instructions.md`
- Style Guide: `docs/portal/style-guide.md`
- Tailwind Config: `tailwind.config.cjs`
- CSS Variables: `src/index.css`

---

## Conclusion

**DO NOT implement the user's suggested approach as-is.** The suggestion to create a new theme from scratch would:
- Duplicate existing design system
- Create inconsistency with VALYNT brand
- Violate design governance rules
- Require extensive refactoring

**INSTEAD**: Map shadcn/ui's semantic tokens to VALYNT's existing, well-defined design system. This approach:
- ✅ Maintains brand consistency
- ✅ Respects existing design governance
- ✅ Leverages existing token infrastructure
- ✅ Requires minimal changes
- ✅ Preserves semantic meaning

The VALYNT design system is **production-ready and comprehensive**. Our job is to integrate shadcn/ui into it, not replace it.

---

**Next Action**: Implement Phase 1 token mapping to align shadcn/ui with VALYNT brand system.
