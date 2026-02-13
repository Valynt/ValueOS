# Manual Assistive-Technology Test Protocol

## Purpose

Define a recurring, human-driven accessibility test cycle that complements automated checks and catches issues around semantics, interaction models, and readability that are often missed by static analyzers.

## Cadence & Ownership

- **Cadence**: Run every sprint (minimum bi-weekly) and before each production release.
- **Owner**: Frontend QA lead.
- **Contributors**: Design, product, and one engineer from each core workflow area.
- **Artifacts**: Completed checklist, defects logged with severity, and a short release readiness summary.

## Scope (Core Workflows)

Run each scenario against the following routes/workflows at minimum:

1. Login and sign-up (`/login`, `/signup`)
2. Dashboard landing (`/home`)
3. Deals and opportunity workflow (`/deals`, `/opportunities`)
4. Value Canvas workflow (`/canvas`)
5. Realization dashboard workflow (`/realization-dashboard`)

## Scenario A: Screen Reader Validation

### Supported AT + Browser Matrix

- NVDA + Firefox (Windows)
- JAWS + Chrome (Windows)
- VoiceOver + Safari (macOS)

### Procedure

1. Start from the top of each page and navigate via landmarks/headings.
2. Verify page title, primary landmark, and heading hierarchy are announced correctly.
3. Tab through interactive controls and confirm:
   - Accessible name is clear and contextual.
   - Role and state are announced (expanded/collapsed, checked, selected).
   - Errors are announced when triggered.
4. Trigger async states (loading/success/error) and verify polite/assertive live regions announce updates once.
5. Open all dialogs/drawers and confirm focus trap + return focus behavior.

### Pass/Fail Criteria

- No unlabeled controls in core workflows.
- No keyboard trap while screen reader is active.
- Form validation and status updates are announced within 2 seconds.

## Scenario B: Keyboard-Only Navigation

### Procedure

1. Disconnect mouse/trackpad input for the run.
2. Traverse each workflow using `Tab`, `Shift+Tab`, arrow keys, `Enter`, and `Esc` only.
3. Confirm visible focus indicator appears on every interactive element.
4. Confirm logical focus order (left-to-right/top-to-bottom, modal-contained).
5. Execute critical actions (login, create/edit, save/export, modal close) using keyboard only.

### Pass/Fail Criteria

- All core workflow tasks are completable without pointer input.
- Focus is never lost to `body` or hidden elements.
- No control requires a pointer-only gesture.

## Scenario C: High-Zoom / Reflow Validation

### Procedure

1. Test at **200%** and **400%** browser zoom.
2. Test viewport widths:
   - Desktop reflow width: 1280px @ 200%
   - Small viewport width: 320px @ 400%
3. Validate core pages for:
   - No horizontal scroll on main content containers.
   - No clipped labels, buttons, or form errors.
   - Sticky headers/sidebars do not obscure content.
4. Validate German-like long copy by enabling pseudo-localization (`en-XA`) when available.

### Pass/Fail Criteria

- No blocked actions caused by clipping/overflow.
- Horizontal scroll is limited to data tables requiring it.
- Text remains readable and non-overlapping for controls and status messages.

## Defect Logging Requirements

Each defect must include:

- Route and workflow step
- Assistive technology + browser combination
- Reproduction steps and expected/actual behavior
- Severity (`a11y-p0`, `a11y-p1`, `a11y-p2`)
- WCAG mapping (e.g., 1.3.1, 2.1.1, 4.1.2)
- Screenshot/video when visual or focus-related

## Exit Criteria for Release

- No open `a11y-p0` defects.
- `a11y-p1` defects have documented workaround or approved exception.
- Test protocol run completed within 7 days of release cut.
