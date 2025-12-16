# VALYNT Frontend Sprint Plan (Weeks 1-2)

This document enumerates actionable tickets derived from the VALYNT Final Brand Design Rules. Each entry is written so it can be pasted directly into GitHub Issues or imported into a PM tool like Jira. If you want these created as live GitHub Issues, provide assignees, labels, and due dates and I will create them.

---

## Week 1 — Token System Foundation & Global Theme

### Ticket 1.1 — Define tokens: colors, spacing, typography, borders, effects

- Title: Define VALYNT design tokens
- Description: Create a single source of truth for design tokens covering color (surfaces, accents, status), spacing (8px grid tokens), typography scale, border radii, and effects (glow, animation durations). Store as Tailwind config + CSS variables compatible with Vite+React.
- Acceptance Criteria:
  - tailwind.config.js contains semantic color and spacing tokens (surface.1/.2/.3, accent-teal-500/400, accent-grey-500, status tokens, spacing tokens)
  - CSS variables defined in src/index.css (or src/styles/tokens.css) mirror Tailwind tokens
  - No raw hex/px values remain in those token definitions
- Estimate: 3 SP
- Labels: enhancement, design-system, high-priority

### Ticket 1.2 — Expose tokens via Tailwind and CSS variables

- Title: Wire tokens into Tailwind and CSS variables
- Description: Ensure Tailwind theme references CSS variables (hsl(var(--...))) and that a small runtime helper (applyBrandTheme) can set token overrides where needed.
- Acceptance Criteria:
  - Tailwind colors map to CSS variables in tailwind.config.js
  - Runtime theme helper exists and is documented
- Estimate: 2 SP
- Labels: design-system, frontend

### Ticket 1.3 — Remove raw values from global styles

- Title: Remove inline hex/px values from global styles
- Description: Refactor src/index.css and other global files to replace hard-coded hex/px/inline styles with tokens.
- Acceptance Criteria:
  - src/index.css contains only token usage for colors, spacing, fonts, radii
  - No inline styles remain in files under src that apply global themes
- Estimate: 2 SP
- Labels: cleanup, design-system

### Ticket 1.4 — Root background & global fonts

- Title: Apply surface.1 to root and configure global fonts
- Description: Enforce surface.1 as the application background in body and set font stacks (Inter for UI/content; JetBrains Mono for data/code) and base font-size tokens.
- Acceptance Criteria:
  - body uses hsl(var(--background)) (surface.1) and cannot be overridden by components
  - font-family set to Inter fallback stack; JetBrains Mono available for code blocks/metrics
  - Base font-size token defined (16px -> `font-base`)
- Estimate: 1 SP
- Labels: design-system, accessibility

### Ticket 1.5 — Spacing & radius tokens

- Title: Implement spacing and border radius tokens
- Description: Add spacing tokens that enforce 8px grid (spacing-1.. spacing-8) and radius tokens (md=8px, xl=16px, pill=9999px) and map into Tailwind utilities.
- Acceptance Criteria:
  - Spacing tokens available in Tailwind classes (e.g., p-vc-4 -> 16px)
  - Border radius tokens mapped in theme
- Estimate: 2 SP
- Labels: design-system

### Ticket 1.6 — Remove inline styles in app bootstrap

- Title: Eliminate inline styles from main.tsx bootstrap loading UI
- Description: Replace inline HTML/CSS used during app bootstrap with token-based classes or CSS that references tokens; ensure loading fallback complies with brand rules.
- Acceptance Criteria:
  - No inline style attributes in src/main.tsx
  - Loading UI uses tokenized classes and accessible markup
- Estimate: 1 SP
- Labels: cleanup, accessibility

---

## Week 1 — Linting & Enforcement

### Ticket 1.7 — Stylelint rules to block raw hex/px/inline styles

- Title: Add Stylelint and custom rules for token usage
- Description: Configure Stylelint (and stylelint plugins) to detect disallowed raw hex codes, raw px/rem values, inline styles in JSX, and usage of arbitrary Tailwind values. Create autofix where safe.
- Acceptance Criteria:
  - Stylelint config included at project root (stylelint.config.js)
  - CI locally can run `npm run lint:css` and fail on violations
  - Tests/examples added demonstrating detection
- Estimate: 3 SP
- Labels: ci, quality

### Ticket 1.8 — ESLint rules for inline styles and token enforcement in JSX

- Title: Create ESLint rules to prevent inline styles and raw token usage
- Description: Add ESLint rules (or plugin) to detect JSX inline style props, direct hex usage, and arbitrary Tailwind classes; provide developer autofix suggestions when possible.
- Acceptance Criteria:
  - ESLint config updated and linting command fails on violations
  - Documentation added on how to fix common violations
- Estimate: 3 SP
- Labels: quality, frontend

### Ticket 1.9 — CI gating for design token violations

- Title: Add CI job to block PRs with token violations
- Description: Add a pipeline step (GitHub Actions) that runs stylelint/eslint and fails PR checks if token violations are present.
- Acceptance Criteria:
  - .github/workflows/design-lint.yml added and runs on PRs
  - PRs with violations show failing check with actionable logs
- Estimate: 2 SP
- Labels: ci, infra, quality

---

## Week 2 — Component Refactor (Core Set)

> Objective: Audit and refactor core components to use tokens only. Each ticket below follows the same structure: audit, refactor, add tests, and remove local overrides.

### Ticket 2.1 — Buttons: audit & refactor

- Title: Refactor Button components to token-only styles
- Description: Audit primary button components (primary, secondary, ghost) and refactor to use token classes (colors, radii, spacing, focus ring). Ensure teal is only used for semantic success/confirm actions.
- Acceptance Criteria:
  - All Button variants use Tailwind classes that map to tokens (e.g., bg-vc-accent-teal-500)
  - No inline styles or hex values in Button files
  - Visual regression snapshots updated
- Estimate: 3 SP
- Labels: design-system, components

### Ticket 2.2 — Cards: audit & refactor

- Title: Refactor Card components to token-only styles
- Description: Ensure cards use surface.2 for card background, correct border token, and md radius.
- Acceptance Criteria:
  - Cards use hsl(var(--card)) and border token
  - Card modals/overlays use surface.3 appropriately
- Estimate: 3 SP

### Ticket 2.3 — Modals: audit & refactor

- Title: Refactor Modal components to token-only styles
- Description: Ensure modals use surface.3 for highest elevation, radius xl, and no shadows used for elevation.
- Acceptance Criteria:
  - Modal/backdrop uses tokens only
  - No drop-shadow for elevation; shadows may be subtle and secondary
- Estimate: 3 SP

### Ticket 2.4 — Inputs: audit & refactor

- Title: Refactor Input components to token-only styles
- Description: Standardize input borders, radii, spacing, and focus states using tokens (border.default, border.strong, ring token).
- Acceptance Criteria:
  - Inputs reference tokenized border and ring values
  - Disabled/readonly/accessibility states documented
- Estimate: 2 SP

### Ticket 2.5 — Typography components

- Title: Standardize Typography components to fixed font scale
- Description: Ensure all typographic primitives use the approved font scale tokens and tracking where required.
- Acceptance Criteria:
  - No arbitrary font-size/letter-spacing; use pre-defined tokens
  - Headings and micro labels adhere to tracking rules
- Estimate: 2 SP

### Ticket 2.6 — Remove local overrides

- Title: Remove local token overrides from core components
- Description: Identify and remove any component-level CSS variables or inline overrides that bypass tokens; replace with token mappings and theme props where necessary.
- Acceptance Criteria:
  - No local overrides documented in the codebase for core components
- Estimate: 3 SP

---

## Week 2 — UI Library & Utilities

### Ticket 2.7 — Utilities/hooks for spacing, typography, effects

- Title: Create utility classes/hooks for token usage
- Description: Provide small helpers (useSpacing, useTypography) and Tailwind utility classes to make token usage ergonomic.
- Acceptance Criteria:
  - Utilities documented and unit-tested
  - Examples in component library
- Estimate: 3 SP

### Ticket 2.8 — Utility usage docs

- Title: Document utility patterns and restrictions
- Description: Write clear docs showing approved utilities and forbidden patterns.
- Acceptance Criteria:
  - Docs exist in /docs/design-system/token-usage.md
- Estimate: 1 SP

---

## Governance & Documentation

### Ticket 2.9 — Developer documentation for tokens & components

- Title: Document tokens, mappings, and component contract
- Description: Provide a central README describing tokens, how to use them, rules (no hex/px/inline), and examples.
- Acceptance Criteria:
  - README at /docs/design-system/README.md
  - Example snippets for Button, Card, Modal
- Estimate: 2 SP

### Ticket 2.10 — PR review checklist for UI/Design

- Title: Add PR checklist to enforce brand rules
- Description: Create a checklist template that reviewers must follow (tokens used, no inline styles, semantic use of accents, elevation rules, spacing tokens).
- Acceptance Criteria:
  - .github/PULL_REQUEST_TEMPLATE/design-checklist.md exists
- Estimate: 1 SP

---

## Next Steps

1. Confirm you want these created as GitHub Issues (provide assignees and milestones/due dates) or exported in Jira CSV format.
2. I can create the GitHub Actions workflow for design linting next (Week 1 Ticket 1.9) once you confirm CI runner permissions.

If you want, I can now create GitHub Issues automatically for each ticket — confirm and provide assignees and target sprint milestone.
