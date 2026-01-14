# VALYNT Design Token Validation

**Version**: 1.0  
**Last Updated**: January 5, 2026  
**Status**: Active in CI/CD

---

## Overview

Automated validation ensures all code follows VALYNT design system rules. The validation runs in CI/CD on every pull request and blocks merges if critical violations are found.

**Purpose**: Enforce design system compliance and prevent design drift.

---

## Validation Rules

### 1. No Raw Hex Colors

**Severity**: Error  
**Rule**: Use semantic color tokens instead of hex values

❌ **Bad**:

```tsx
<div style={{ color: '#18C3A5' }} />
<div className="bg-[#0B0C0F]" />
const color = '#18C3A5';
```

✅ **Good**:

```tsx
<div className="text-primary" />
<div className="bg-vc-surface-1" />
<div className="text-vc-teal-500" />
```

**Why**: Raw hex values bypass the design system and make theme changes difficult.

---

### 2. No Raw RGB Colors

**Severity**: Error  
**Rule**: Use semantic color tokens instead of rgb/rgba values

❌ **Bad**:

```tsx
<div style={{ backgroundColor: 'rgb(24, 195, 165)' }} />
<div style={{ color: 'rgba(11, 12, 15, 0.8)' }} />
```

✅ **Good**:

```tsx
<div className="bg-primary" />
<div className="bg-vc-surface-1/80" />
```

---

### 3. No Raw Pixel Values

**Severity**: Warning  
**Rule**: Use spacing tokens instead of raw px values

❌ **Bad**:

```tsx
<div style={{ padding: '16px', margin: '24px' }} />
<div className="p-[16px]" />
```

✅ **Good**:

```tsx
<div className="p-vc-2 m-vc-3" />
```

**Exceptions**: Font sizes and line heights are allowed to use px values.

---

### 4. No Inline Styles

**Severity**: Warning  
**Rule**: Use className with Tailwind/CSS instead of inline styles

❌ **Bad**:

```tsx
<div style={{ backgroundColor: "#18C3A5", padding: "16px" }} />
```

✅ **Good**:

```tsx
<div className="bg-primary p-vc-2" />
```

**Why**: Inline styles bypass Tailwind's optimization and make maintenance harder.

---

### 5. No Non-Semantic Color Classes

**Severity**: Error  
**Rule**: Use VALYNT semantic tokens instead of Tailwind color scales

❌ **Bad**:

```tsx
<div className="bg-blue-500 text-gray-700 border-green-400" />
```

✅ **Good**:

```tsx
<div className="bg-primary text-muted-foreground border-vc-border-default" />
```

**Why**: Direct Tailwind colors don't follow VALYNT semantics (Teal = value, Grey = structure).

---

## Running Validation

### Locally

```bash
# Run validation on all files
npm run lint:design-tokens

# Run validation on specific files
node scripts/validate-design-tokens.cjs
```

### In CI/CD

Validation runs automatically on:

- Pull requests to `main` or `develop`
- Pushes to `main`
- Changes to `src/**/*.{ts,tsx,js,jsx,css}`

**Workflow**: `.github/workflows/design-token-validation.yml`

---

## Marking Exceptions

Sometimes you need to use raw values (e.g., third-party libraries, dynamic colors from API). Mark these with exception comments:

```tsx
// @design-token-exception: Third-party library requires inline styles
<ThirdPartyComponent style={{ color: '#FF0000' }} />

/* @design-token-exception: Dynamic color from API */
<div style={{ backgroundColor: apiColor }} />
```

**Exception patterns**:

- `// @design-token-exception: <reason>`
- `/* @design-token-exception: <reason> */`

**Important**: Always provide a reason for the exception.

---

## VALYNT Design Tokens Reference

### Surface Tokens (Elevation)

```tsx
// Base application shell
<div className="bg-vc-surface-1" />

// Raised content (cards)
<div className="bg-vc-surface-2" />

// Highest elevation (modals, dialogs)
<div className="bg-vc-surface-3" />
```

### Brand Colors

```tsx
// Value Teal (value intelligence, primary actions)
<button className="bg-vc-teal-500" />

// Teal hover state
<button className="hover:bg-vc-teal-400" />

// Graph Grey (structure, metadata)
<span className="text-vc-grey-500" />
```

### Semantic Tokens

```tsx
// Backgrounds
<div className="bg-background" />      // Base shell
<div className="bg-card" />            // Cards
<div className="bg-popover" />         // Modals

// Text
<p className="text-foreground" />      // Primary text
<p className="text-muted-foreground" /> // Secondary text

// Actions
<button className="bg-primary" />      // Primary actions (Teal)
<button className="bg-secondary" />    // Secondary actions (Grey)
<button className="bg-destructive" />  // Dangerous actions (Red)

// Borders
<div className="border-border" />      // Default borders
<div className="border-vc-border-strong" /> // Strong borders

// Focus
<input className="focus:ring-ring" />  // Focus ring (Teal)
```

### Spacing Tokens (8px Grid)

```tsx
<div className="p-vc-1" />  // 8px padding
<div className="m-vc-2" />  // 16px margin
<div className="gap-vc-3" /> // 24px gap
<div className="space-y-vc-4" /> // 32px vertical spacing
```

---

## CI/CD Workflow Details

### Jobs

**1. validate-design-tokens**

- Runs validation script
- Reports violations
- Fails on errors (blocks merge)
- Warns on warnings (doesn't block)

**2. check-token-drift**

- Detects changes to CSS variables
- Detects changes to Tailwind config
- Warns if design tokens are modified

**3. generate-token-report**

- Counts token usage
- Reports non-compliant patterns
- Provides statistics

### Workflow Triggers

```yaml
on:
  pull_request:
    branches: ["main", "develop"]
    paths:
      - "src/**/*.{ts,tsx,js,jsx,css}"
      - ".design-tokens.config.json"
      - "scripts/validate-design-tokens.cjs"
  push:
    branches: ["main"]
```

---

## Configuration

### .design-tokens.config.json

Configuration file for validation rules:

```json
{
  "rules": {
    "rawHexColors": {
      "enabled": true,
      "severity": "error"
    },
    "rawPixelValues": {
      "enabled": true,
      "severity": "warning"
    }
  },
  "ci": {
    "failOnError": true,
    "failOnWarning": false
  }
}
```

### Customizing Rules

Edit `.design-tokens.config.json` to:

- Enable/disable rules
- Change severity levels
- Add allowed patterns
- Configure CI behavior

---

## Troubleshooting

### Validation Fails in CI

**Problem**: CI fails with design token violations

**Solution**:

1. Run `npm run lint:design-tokens` locally
2. Fix violations or add exception comments
3. Commit and push changes

### False Positives

**Problem**: Validation flags legitimate code

**Solution**:

1. Add exception comment with reason
2. Or update `.design-tokens.config.json` to allow pattern

### Too Many Violations

**Problem**: Existing code has many violations

**Solution**:

1. Fix violations incrementally
2. Add exception comments for legacy code
3. Focus on new code compliance first

---

## Migration Strategy

For existing codebases with many violations:

### Phase 1: New Code Only

- Enable validation in CI
- Set `failOnError: false` initially
- Focus on new PRs being compliant

### Phase 2: Incremental Fixes

- Fix violations file by file
- Prioritize high-traffic components
- Add exception comments for legacy code

### Phase 3: Full Compliance

- Set `failOnError: true`
- Remove exception comments
- Achieve 100% compliance

---

## Examples

### Before (Non-Compliant)

```tsx
function MetricCard({ value }: { value: number }) {
  return (
    <div
      style={{
        backgroundColor: "#13141A",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid #2A2A2A",
      }}
    >
      <h3 className="text-lg font-bold text-gray-100">Revenue Impact</h3>
      <p className="text-3xl font-bold text-blue-500">
        ${value.toLocaleString()}
      </p>
    </div>
  );
}
```

**Violations**:

- Raw hex colors: `#13141A`, `#2A2A2A`
- Raw px values: `16px`, `8px`, `1px`
- Inline styles
- Non-semantic colors: `text-gray-100`, `text-blue-500`

### After (Compliant)

```tsx
function MetricCard({ value }: { value: number }) {
  return (
    <div className="bg-vc-surface-2 p-vc-2 rounded-vc-md border border-vc-border-default">
      <h3 className="text-lg font-bold text-foreground">Revenue Impact</h3>
      <p className="text-3xl font-bold text-vc-teal-500">
        ${value.toLocaleString()}
      </p>
    </div>
  );
}
```

**Improvements**:

- Uses surface token: `bg-vc-surface-2`
- Uses spacing token: `p-vc-2`
- Uses border radius token: `rounded-vc-md`
- Uses border token: `border-vc-border-default`
- Uses semantic text colors: `text-foreground`, `text-vc-teal-500`
- No inline styles

---

## Related Documentation

- [VALYNT Design System](./SHADCN_THEME_INTEGRATION_ANALYSIS.md)
- [Design Rules](../instructions/design%20rules.instructions.md)
- [Tailwind Configuration](../../tailwind.config.cjs)
- [CSS Variables](../../src/index.css)

---

## Support

**Questions?**

- Check `.design-tokens.config.json` for examples
- Review existing compliant components
- Ask in #design-system channel

**Issues?**

- Report false positives as GitHub issues
- Suggest rule improvements
- Request new validation rules

---

**Remember**: Design token validation helps maintain consistency and prevents design drift. When in doubt, use semantic tokens!
