# Manual Assistive Technology Testing Protocol

## Purpose

Define a recurring manual accessibility validation process focused on assistive technology behavior that automated checks cannot fully verify.

## Cadence

- **Weekly smoke run**: Core login + home workflow.
- **Per release candidate**: Full Tier-1 workflow run.
- **Post-incident**: Re-test impacted flows within 48 hours of an accessibility incident.

## Scope (Tier-1 workflows)

- Authentication (`/login`, `/signup`)
- Home dashboard (`/home`)
- Deals workflow (`/deals`)
- Value Canvas workflow (`/canvas`)
- Settings accessibility controls

## Scenario Matrix

### 1) Screen Reader Scenarios

Run each scenario on latest stable browser + platform defaults.

- **NVDA + Firefox (Windows)**
- **JAWS + Chrome (Windows)**
- **VoiceOver + Safari (macOS)**

Validation checklist:

- Landmarks and heading hierarchy are announced in logical order.
- Interactive controls have meaningful accessible names and role/state announcements.
- Error messages are announced when validation fails.
- Focus moves predictably after route changes and modal open/close actions.
- Dynamic updates (toasts, inline status, loading completion) are conveyed via live regions.

### 2) Keyboard-Only Scenarios

Execute without mouse or touch input:

- Traverse all focusable controls with `Tab`/`Shift+Tab`.
- Activate controls with `Enter`/`Space`.
- Operate menus, dialogs, and comboboxes with arrow keys + `Esc`.
- Verify no keyboard traps; focus return behavior is preserved after dialog close.
- Confirm visible focus indicator at WCAG 2.2 compliant contrast.

### 3) High-Zoom / Reflow Scenarios

- Test at **200% zoom** and **400% zoom** on desktop breakpoints.
- Validate text resize and browser zoom with no horizontal scrolling for main content.
- Verify critical actions remain visible and operable.
- Confirm truncation does not hide essential meaning (especially localized strings).

## Execution Workflow

1. Pull latest release candidate build.
2. Run automated accessibility + localization gates first (axe, visual regression, pseudo-loc overflow checks).
3. Execute manual matrix scenarios and capture:
   - screen recording snippets for failures,
   - URL/path + timestamp,
   - AT + browser + OS version.
4. Log findings in the accessibility tracker with severity (`P0`-`P3`) and impacted workflow.
5. Link defects to remediation owner and SLA target date.

## Exit Criteria

A release passes manual AT validation when all are true:

- No open **P0/P1** accessibility defects.
- All high-severity regressions have verified fixes.
- Screen reader, keyboard-only, and high-zoom scenarios are completed for each Tier-1 workflow.

## Reporting

Publish a weekly summary containing:

- Pass/fail rate by scenario type.
- Defect counts by severity and workflow.
- Mean time to remediate (MTTR) accessibility defects.
- Aging defects beyond SLA threshold.
