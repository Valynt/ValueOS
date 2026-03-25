/**
 * Frontend Audit — Cycle 8: Consistency & Design System
 *
 * Dimensions: Design System + Component Consistency
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

const TYPOGRAPHY_HIERARCHY = {
  // Arbitrary pixel sizes used throughout (text-[10px] through text-[15px])
  // instead of Tailwind's semantic scale (text-xs, text-sm, text-base, etc.)
  usesArbitraryPixelSizes: true,
  // Sizes observed: 10px, 11px, 12px, 13px, 14px, 15px — 6 distinct sizes in Dashboard alone
  arbitrarySizesInDashboard: [10, 11, 12, 13, 14, 15],
  // font-black used for primary headings (h1, card titles, values)
  primaryHeadingWeight: "font-black",
  // font-semibold used for secondary headings
  secondaryHeadingWeight: "font-semibold",
  // font-medium used for body/labels
  bodyWeight: "font-medium",
  // tracking-[-0.05em] used on h1 elements — consistent
  h1TrackingConsistent: true,
  // tracking-[0.15em] or tracking-[0.2em] used on section labels — consistent
  sectionLabelTrackingConsistent: true,
  // No typography scale defined in tailwind.config.cjs
  hasTypographyScaleInConfig: false,
  // Semantic text sizes (text-xs, text-sm) used in some components (LivingValueGraphPage)
  mixesSemanticAndArbitrarySizes: true,
};

const SPACING_SIZING = {
  // Padding patterns: p-5, p-6, px-6 lg:px-10, px-3 py-4 — inconsistent
  // Dashboard: p-6 lg:p-10 max-w-[1200px]
  // Opportunities: p-6 lg:p-10 max-w-[1400px]
  // Agents: p-6 lg:p-10 (inferred)
  maxWidthInconsistent: true, // 1200px vs 1400px across views
  // Card padding: p-5 (Dashboard cards), p-6 (Agent cards), p-4 (Integrity claims)
  cardPaddingInconsistent: true,
  // Border radius: rounded-2xl (most cards), rounded-3xl (Agent cards), rounded-xl (buttons)
  borderRadiusInconsistent: true,
  // rounded-2xl is the dominant card radius
  dominantCardRadius: "rounded-2xl",
  // rounded-3xl used on Agent cards — inconsistent with rest
  agentCardsUseRounded3xl: true,
  // Spacing scale: uses Tailwind defaults (gap-3, gap-4, gap-6) — consistent
  spacingScaleConsistent: true,
};

const BUTTON_PATTERNS = {
  // Primary action buttons: bg-zinc-950 text-white rounded-xl — consistent in app views
  primaryButtonStyle: "bg-zinc-950 text-white rounded-xl",
  // Secondary/outline buttons: border border-zinc-200 — used in some places
  // Danger buttons: no consistent danger button style found
  hasDangerButtonStyle: false,
  // Login page uses different button style (ring-offset-black, border-zinc-800)
  loginButtonStyleDifferent: true,
  // Settings uses shadcn Button component
  settingsUsesButtonComponent: true,
  // Canvas views use inline Tailwind button styles
  canvasUsesInlineButtonStyles: true,
  // Inconsistency: some views use shadcn Button, others use raw Tailwind
  buttonImplementationInconsistent: true,
  // Min height: min-h-10 (nav items), py-3 (QuickStart buttons) — not standardized
  buttonMinHeightStandardized: false,
};

const MODAL_DRAWER_PATTERNS = {
  // EvidenceDrawer: fixed right panel (400px wide)
  evidenceDrawerIsFixedPanel: true,
  // AgentChatSidebar: fixed right panel
  agentChatIsFixedPanel: true,
  // OrganizationRoles: inline modal for role creation (showCreateModal state)
  rolesUsesInlineModal: true,
  // No consistent modal/dialog component used across all views
  // Settings uses shadcn Dialog (inferred from imports)
  // Canvas uses custom fixed panels
  modalImplementationInconsistent: true,
  // No backdrop blur on modals
  modalsHaveBackdropBlur: false,
  // Drawer close: X button + click-outside (EvidenceDrawer has X, no click-outside)
  drawerHasClickOutsideClose: false, // EvidenceDrawer only has X button
};

const CARD_COMPONENT_PATTERNS = {
  // Dashboard case cards: bg-white border border-zinc-200 rounded-2xl p-5
  dashboardCardStyle: "bg-white border border-zinc-200 rounded-2xl p-5",
  // Agent cards: bg-white border border-zinc-200 rounded-3xl p-6 shadow-[...]
  agentCardStyle: "bg-white border border-zinc-200 rounded-3xl p-6 shadow",
  // Integrity claim cards: p-4 rounded-2xl border — consistent with dashboard
  integrityCardStyle: "p-4 rounded-2xl border",
  // Hover state: hover:border-zinc-300 hover:shadow-md — consistent
  cardHoverStateConsistent: true,
  // Shadow: Dashboard cards have no shadow; Agent cards have custom shadow
  cardShadowInconsistent: true,
  // No card component abstraction — all cards are inline Tailwind
  hasCardComponent: false,
  // components.json exists (shadcn config) but card component not used in main views
  shadcnCardNotUsedInMainViews: true,
};

// ---------------------------------------------------------------------------
// TASK 8.1 — Typography Hierarchy Consistency Check
// ---------------------------------------------------------------------------

describe("Task 8.1: Typography Hierarchy Consistency Check", () => {
  it("primary headings use a consistent weight (font-black)", () => {
    // Positive finding — font-black on h1 elements is consistent
    expect(TYPOGRAPHY_HIERARCHY.primaryHeadingWeight).toBe("font-black");
  });

  it("section labels use consistent tracking (uppercase + wide tracking)", () => {
    // Positive finding — section labels use uppercase + tracking-[0.15em] or [0.2em]
    expect(TYPOGRAPHY_HIERARCHY.sectionLabelTrackingConsistent).toBe(true);
  });

  it("typography uses Tailwind semantic scale (not arbitrary pixel sizes)", () => {
    // Criterion: Arbitrary sizes bypass the design system and create inconsistency
    // FINDING: FAIL — text-[10px] through text-[15px] used throughout
    expect(TYPOGRAPHY_HIERARCHY.usesArbitraryPixelSizes).toBe(false); // ← FAILS
  });

  it("typography scale is defined in tailwind.config.cjs", () => {
    // Criterion: Design tokens should be centralized
    // FINDING: FAIL — no typography scale in config
    expect(TYPOGRAPHY_HIERARCHY.hasTypographyScaleInConfig).toBe(true); // ← FAILS
  });

  it("application does not mix semantic and arbitrary text sizes", () => {
    // Criterion: Consistent sizing approach
    // FINDING: FAIL — LivingValueGraphPage uses text-sm/text-lg while others use text-[13px]
    expect(TYPOGRAPHY_HIERARCHY.mixesSemanticAndArbitrarySizes).toBe(false); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 8.2 — Spacing/Sizing Standardization Audit
// ---------------------------------------------------------------------------

describe("Task 8.2: Spacing/Sizing Standardization Audit", () => {
  it("max-width is consistent across all main content views", () => {
    // Criterion: Consistent content width for visual coherence
    // FINDING: FAIL — Dashboard uses max-w-[1200px], Opportunities uses max-w-[1400px]
    expect(SPACING_SIZING.maxWidthInconsistent).toBe(false); // ← FAILS
  });

  it("card padding is consistent across all card components", () => {
    // Criterion: Cards should feel like the same component
    // FINDING: FAIL — p-5 vs p-6 vs p-4 across different card types
    expect(SPACING_SIZING.cardPaddingInconsistent).toBe(false); // ← FAILS
  });

  it("border radius is consistent across all card components", () => {
    // Criterion: rounded-2xl vs rounded-3xl creates visual inconsistency
    // FINDING: FAIL — Agent cards use rounded-3xl, others use rounded-2xl
    expect(SPACING_SIZING.borderRadiusInconsistent).toBe(false); // ← FAILS
  });

  it("spacing scale uses Tailwind defaults consistently", () => {
    // Positive finding — gap-3/4/6 used consistently
    expect(SPACING_SIZING.spacingScaleConsistent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TASK 8.3 — Button Treatment Pattern Inventory
// ---------------------------------------------------------------------------

describe("Task 8.3: Button Treatment Pattern Inventory", () => {
  it("primary action buttons have a consistent visual style", () => {
    // Positive finding — bg-zinc-950 text-white rounded-xl is consistent in app views
    expect(BUTTON_PATTERNS.primaryButtonStyle).toContain("bg-zinc-950");
  });

  it("button implementation is consistent (shadcn vs inline Tailwind)", () => {
    // Criterion: All buttons should use the same component
    // FINDING: FAIL — Settings uses shadcn Button, canvas uses inline Tailwind
    expect(BUTTON_PATTERNS.buttonImplementationInconsistent).toBe(false); // ← FAILS
  });

  it("danger/destructive button style is defined and used consistently", () => {
    // Criterion: Destructive actions need a distinct visual treatment
    // FINDING: FAIL — no consistent danger button style
    expect(BUTTON_PATTERNS.hasDangerButtonStyle).toBe(true); // ← FAILS
  });

  it("login page buttons match the authenticated app button style", () => {
    // Criterion: Visual consistency across auth and app
    // FINDING: FAIL — login uses border-zinc-800 style, app uses bg-zinc-950
    expect(BUTTON_PATTERNS.loginButtonStyleDifferent).toBe(false); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 8.4 — Modal/Drawer Usage Consistency
// ---------------------------------------------------------------------------

describe("Task 8.4: Modal/Drawer Usage Consistency", () => {
  it("modal/drawer implementation is consistent across the application", () => {
    // Criterion: All modals should use the same component
    // FINDING: FAIL — mix of custom fixed panels and shadcn Dialog
    expect(MODAL_DRAWER_PATTERNS.modalImplementationInconsistent).toBe(false); // ← FAILS
  });

  it("drawers support click-outside-to-close", () => {
    // Criterion: Standard UX pattern for dismissing overlays
    // FINDING: FAIL — EvidenceDrawer only has X button, no click-outside
    expect(MODAL_DRAWER_PATTERNS.drawerHasClickOutsideClose).toBe(true); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 8.5 — Card/Component Pattern Analysis
// ---------------------------------------------------------------------------

describe("Task 8.5: Card/Component Pattern Analysis", () => {
  it("card hover states are consistent across all card types", () => {
    // Positive finding — hover:border-zinc-300 hover:shadow-md consistent
    expect(CARD_COMPONENT_PATTERNS.cardHoverStateConsistent).toBe(true);
  });

  it("a reusable Card component is used across all card instances", () => {
    // Criterion: DRY principle — cards should be a component, not repeated Tailwind
    // FINDING: FAIL — all cards are inline Tailwind; shadcn Card not used in main views
    expect(CARD_COMPONENT_PATTERNS.hasCardComponent).toBe(true); // ← FAILS
  });

  it("card shadow treatment is consistent", () => {
    // Criterion: Visual consistency
    // FINDING: FAIL — Dashboard cards have no shadow, Agent cards have custom shadow
    expect(CARD_COMPONENT_PATTERNS.cardShadowInconsistent).toBe(false); // ← FAILS
  });
});
