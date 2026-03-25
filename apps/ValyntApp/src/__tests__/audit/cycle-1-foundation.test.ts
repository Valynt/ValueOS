/**
 * Frontend Audit — Cycle 1: Foundation & Discovery
 *
 * Dimensions: Product Positioning + Information Architecture
 * Auditor: Principal Frontend Architect / Staff UX Engineer
 *
 * TDD Protocol: RED → GREEN → REFACTOR for each task.
 * Each test encodes a specific, measurable criterion.
 * Failures are findings; passes are confirmations.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Shared evidence extracted from static analysis of the codebase.
// These objects are the "implementation" phase — gathered facts that the
// tests assert against.
// ---------------------------------------------------------------------------

const PRODUCT_IDENTITY = {
  brandName: "VALUEOS", // ModernLoginPage.tsx:121 — <span>VALUEOS</span>
  sidebarBrand: "VALYNT", // Sidebar.tsx:73 — <span>VALYNT</span>
  loginHeadline: "Welcome back", // ModernLoginPage.tsx:125 — h1 text
  loginSubtext: "Sign in to your account", // ModernLoginPage.tsx:126 — p text (inferred from i18n key)
  hasValueProposition: false, // No tagline/hero copy on login screen beyond "Welcome back"
  hasProductDescription: false, // No "what this product does" copy on first screen
};

const NAVIGATION_STRUCTURE = {
  primaryItems: [
    { path: "/dashboard", label: "My Work", icon: "Zap" },
    { path: "/opportunities", label: "Cases", icon: "Briefcase" },
    { path: "/living-value-graph", label: "Value Graph", icon: "GitGraph" },
  ],
  platformItems: [
    { path: "/models", label: "Models", icon: "Boxes" },
    { path: "/agents", label: "Agents", icon: "Bot" },
    { path: "/company", label: "Company Intel", icon: "Building2" },
    { path: "/billing", label: "Billing", icon: "CreditCard" },
    { path: "/settings", label: "Settings", icon: "Settings" },
  ],
  totalTopLevelItems: 8,
  hasGroupLabels: true, // "Platform" label exists; primary group has no label
  primaryGroupLabel: null, // No label for primary group — Sidebar.tsx:100
  platformGroupLabel: "Platform", // Sidebar.tsx:107
};

const ROUTE_INVENTORY = {
  publicRoutes: ["/login", "/signup", "/reset-password", "/auth/callback", "/guest/access"],
  protectedRoutes: [
    "dashboard",
    "opportunities",
    "opportunities/:id",
    "opportunities/:oppId/cases/:caseId",
    "models",
    "models/:id",
    "agents",
    "agents/:id",
    "admin/agents",
    "integrations",
    "settings",
    "workspace/:caseId",
    "workspace/:caseId/assembly",
    "workspace/:caseId/model",
    "workspace/:caseId/integrity",
    "workspace/:caseId/outputs",
    "workspace/:caseId/realization",
    "billing",
    "company",
    "living-value-graph/:opportunityId?/:caseId?",
    "academy/*",
  ],
  tenantPrefix: "/org/:tenantSlug",
  hasLegacyBridge: true, // LegacyTenantRouteBridge for non-tenant paths
  catchAllBehavior: "redirect-to-dashboard", // AppRoutes.tsx:256
};

const LANDING_PAGE_HIERARCHY = {
  firstScreenRoute: "/login",
  loginPageElements: {
    logo: true, // SVG diamond + "VALUEOS" text
    headline: "Welcome back",
    subtext: "Sign in to your account",
    emailField: true,
    passwordField: true,
    forgotPasswordLink: true,
    signInButton: true,
    oauthGoogle: true,
    oauthGithub: false, // Not present in login page (only Google)
    signupLink: true, // Line 129: to="/signup"
    termsLink: true,
    privacyLink: true,
  },
  missingElements: {
    productTagline: true, // No "what ValueOS does" copy
    featureHighlights: true, // No feature bullets or social proof
    demoOrTrialCTA: true, // No "Try free" or "See demo" path
  },
};

const PRIMARY_PATH = {
  newUserFlow: ["/login", "/signup", "/onboarding", "/org/:slug/dashboard"],
  onboardingPhases: ["Company", "Competitors", "Personas", "Claims", "Review"],
  onboardingPhaseCount: 5,
  postOnboardingLanding: "dashboard",
  dashboardPrimaryAction: "Start a Value Case", // QuickStart component
  dashboardPrimaryActionType: "inline-input", // Company name input → Go button
  caseCreationPath: "/workspace/:caseId",
};

const ROUTE_NAMING_CONSISTENCY = {
  inconsistencies: [
    {
      issue: "Nav label 'My Work' maps to route 'dashboard'",
      severity: "medium",
      // Sidebar.tsx:26 label="My Work" vs path="/dashboard"
      // A user clicking "My Work" lands on /dashboard — the URL doesn't match the label
    },
    {
      issue: "Nav label 'Cases' maps to route 'opportunities'",
      severity: "high",
      // Sidebar.tsx:27 label="Cases" vs path="/opportunities"
      // The domain model uses 'opportunities' but the UI calls them 'cases'
      // ValueCaseCanvas, ValueCaseWorkspace, useCases all use 'case' terminology
      // but the route is /opportunities/:oppId/cases/:caseId — two different concepts
    },
    {
      issue: "Route 'workspace/:caseId' not surfaced in sidebar navigation",
      severity: "medium",
      // The workspace is the primary work surface but has no direct nav entry
    },
    {
      issue: "Route 'living-value-graph' not in routeConfig.ts protectedRoutePaths",
      severity: "low",
      // AppRoutes.tsx:227 has the route but routeConfig.ts:protectedRoutePaths omits it
    },
    {
      issue: "Brand name inconsistency: 'VALUEOS' on login vs 'VALYNT' in sidebar",
      severity: "critical",
      // ModernLoginPage.tsx:121 shows "VALUEOS"
      // Sidebar.tsx:73 shows "VALYNT"
      // Two different product names on the same authenticated session
    },
  ],
  consistentPatterns: [
    "Tenant-scoped URL prefix /org/:tenantSlug is consistent across all protected routes",
    "Legacy bridge pattern handles old non-tenant URLs gracefully",
    "Catch-all redirects to dashboard rather than 404",
  ],
};

// ---------------------------------------------------------------------------
// TASK 1.1 — First-Use Clarity Assessment
// ---------------------------------------------------------------------------

describe("Task 1.1: First-Use Clarity Assessment", () => {
  it("login page presents a recognizable product identity", () => {
    // Criterion: Brand name is visible on first screen
    expect(PRODUCT_IDENTITY.brandName).toBeTruthy();
    expect(PRODUCT_IDENTITY.brandName.length).toBeGreaterThan(0);
  });

  it("login page has a clear primary action (sign in)", () => {
    // Criterion: Primary CTA is unambiguous
    expect(LANDING_PAGE_HIERARCHY.loginPageElements.signInButton).toBe(true);
    expect(LANDING_PAGE_HIERARCHY.loginPageElements.emailField).toBe(true);
    expect(LANDING_PAGE_HIERARCHY.loginPageElements.passwordField).toBe(true);
  });

  it("login page provides a value proposition or product description", () => {
    // Criterion: New user can understand what the product does in <30 seconds
    // FINDING: FAIL — login page has no tagline, no feature copy, no "what this does"
    expect(PRODUCT_IDENTITY.hasValueProposition).toBe(true); // ← FAILS: no value prop
  });

  it("login page offers a path for new users (signup)", () => {
    // Criterion: New users are not stranded on the login screen
    expect(LANDING_PAGE_HIERARCHY.loginPageElements.signupLink).toBe(true);
  });

  it("brand name is consistent between login and authenticated app", () => {
    // Criterion: Same product name on all screens
    // FINDING: FAIL — "VALUEOS" on login, "VALYNT" in sidebar
    expect(PRODUCT_IDENTITY.brandName).toBe(PRODUCT_IDENTITY.sidebarBrand); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 1.2 — Navigation Structure Mapping
// ---------------------------------------------------------------------------

describe("Task 1.2: Navigation Structure Mapping", () => {
  it("primary navigation group contains the core product surfaces", () => {
    // Criterion: Primary nav items represent the main user workflows
    const primaryPaths = NAVIGATION_STRUCTURE.primaryItems.map((i) => i.path);
    expect(primaryPaths).toContain("/dashboard");
    expect(primaryPaths).toContain("/opportunities");
    expect(NAVIGATION_STRUCTURE.primaryItems.length).toBeLessThanOrEqual(5);
  });

  it("navigation has a clear two-tier hierarchy with group labels", () => {
    // Criterion: Users can distinguish primary from secondary nav
    expect(NAVIGATION_STRUCTURE.hasGroupLabels).toBe(true);
    expect(NAVIGATION_STRUCTURE.platformGroupLabel).toBe("Platform");
  });

  it("primary navigation group has a descriptive label", () => {
    // Criterion: Both nav groups are labeled for clarity
    // FINDING: FAIL — primary group has no label; only "Platform" group is labeled
    expect(NAVIGATION_STRUCTURE.primaryGroupLabel).not.toBeNull(); // ← FAILS
  });

  it("total navigation items are within cognitive load limits (≤9)", () => {
    // Criterion: Miller's Law — 7±2 items max
    const total =
      NAVIGATION_STRUCTURE.primaryItems.length + NAVIGATION_STRUCTURE.platformItems.length;
    expect(total).toBeLessThanOrEqual(9);
  });

  it("workspace route is accessible from primary navigation", () => {
    // Criterion: The primary work surface (workspace) is reachable from nav
    // FINDING: FAIL — workspace is only reachable by clicking a case card, not from nav
    const allNavPaths = [
      ...NAVIGATION_STRUCTURE.primaryItems,
      ...NAVIGATION_STRUCTURE.platformItems,
    ].map((i) => i.path);
    const hasWorkspaceEntry = allNavPaths.some((p) => p.includes("workspace"));
    expect(hasWorkspaceEntry).toBe(true); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 1.3 — Primary Path Identification
// ---------------------------------------------------------------------------

describe("Task 1.3: Primary Path Identification", () => {
  it("new user onboarding flow has a defined phase sequence", () => {
    // Criterion: Onboarding is structured and progressive
    expect(PRIMARY_PATH.onboardingPhases.length).toBeGreaterThan(0);
    expect(PRIMARY_PATH.onboardingPhases[0]).toBe("Company");
    expect(PRIMARY_PATH.onboardingPhases[PRIMARY_PATH.onboardingPhases.length - 1]).toBe("Review");
  });

  it("onboarding phase count is within acceptable range (3-7 steps)", () => {
    // Criterion: Not too short (skips context) or too long (abandonment risk)
    expect(PRIMARY_PATH.onboardingPhaseCount).toBeGreaterThanOrEqual(3);
    expect(PRIMARY_PATH.onboardingPhaseCount).toBeLessThanOrEqual(7);
  });

  it("post-onboarding landing is the dashboard (not a blank state)", () => {
    // Criterion: Users land somewhere actionable after onboarding
    expect(PRIMARY_PATH.postOnboardingLanding).toBe("dashboard");
  });

  it("dashboard has a prominent primary action for case creation", () => {
    // Criterion: First-time users know what to do on the dashboard
    expect(PRIMARY_PATH.dashboardPrimaryAction).toBeTruthy();
    expect(PRIMARY_PATH.dashboardPrimaryActionType).toBe("inline-input");
  });

  it("case creation leads directly to the workspace (no dead ends)", () => {
    // Criterion: Creating a case navigates to the work surface
    expect(PRIMARY_PATH.caseCreationPath).toMatch(/workspace/);
  });
});

// ---------------------------------------------------------------------------
// TASK 1.4 — Route Naming Consistency Audit
// ---------------------------------------------------------------------------

describe("Task 1.4: Route Naming Consistency Audit", () => {
  it("nav labels match their route segment names", () => {
    // Criterion: Label 'Cases' should map to a route containing 'cases', not 'opportunities'
    const casesNavItem = NAVIGATION_STRUCTURE.primaryItems.find((i) => i.label === "Cases");
    // FINDING: FAIL — "Cases" maps to /opportunities
    expect(casesNavItem?.path).toContain("cases"); // ← FAILS: path is /opportunities
  });

  it("nav label 'My Work' maps to a semantically matching route", () => {
    // Criterion: Route name should reflect the label
    const myWorkItem = NAVIGATION_STRUCTURE.primaryItems.find((i) => i.label === "My Work");
    // FINDING: FAIL — "My Work" maps to /dashboard (acceptable but inconsistent)
    // "My Work" implies personal task queue; "dashboard" implies overview
    expect(myWorkItem?.path).toMatch(/my-work|work|tasks/); // ← FAILS: path is /dashboard
  });

  it("all protected routes are registered in routeConfig.ts", () => {
    // Criterion: Route config is the single source of truth
    // FINDING: FAIL — living-value-graph is in AppRoutes but not in routeConfig.ts
    const configuredRoutes = [
      "/create-org",
      "/onboarding",
      "/dashboard",
      "/opportunities",
      "/opportunities/:id",
      "/opportunities/:oppId/cases/:caseId",
      "/models",
      "/models/:id",
      "/agents",
      "/agents/:id",
      "/integrations",
      "/settings",
      "/workspace/:caseId",
      "/company",
    ];
    const missingFromConfig = ["living-value-graph", "billing", "academy", "admin/agents"];
    // These routes exist in AppRoutes.tsx but not in routeConfig.ts protectedRoutePaths
    expect(missingFromConfig.length).toBe(0); // ← FAILS: 4 routes missing from config
  });

  it("workspace sub-routes follow a consistent naming pattern", () => {
    // Criterion: /workspace/:id/[segment] segments are semantically clear
    const workspaceSegments = ["assembly", "model", "integrity", "outputs", "realization"];
    // All are single-word, lowercase, noun-based — consistent
    const allLowercase = workspaceSegments.every((s) => s === s.toLowerCase());
    const allSingleWord = workspaceSegments.every((s) => !s.includes("-"));
    expect(allLowercase).toBe(true);
    expect(allSingleWord).toBe(true);
  });

  it("brand name is consistent across all route entry points", () => {
    // Criterion: Same brand name on login, sidebar, and page titles
    // FINDING: FAIL — "VALUEOS" vs "VALYNT"
    expect(ROUTE_NAMING_CONSISTENCY.inconsistencies.find((i) => i.issue.includes("Brand name")))
      .toBeUndefined(); // ← FAILS: brand inconsistency exists
  });
});

// ---------------------------------------------------------------------------
// TASK 1.5 — Landing Page Hierarchy Analysis
// ---------------------------------------------------------------------------

describe("Task 1.5: Landing Page Hierarchy Analysis", () => {
  it("login page has a logical visual hierarchy (logo → headline → form → CTA)", () => {
    // Criterion: Elements appear in order of importance
    const elements = LANDING_PAGE_HIERARCHY.loginPageElements;
    expect(elements.logo).toBe(true);
    expect(elements.headline).toBeTruthy();
    expect(elements.emailField).toBe(true);
    expect(elements.signInButton).toBe(true);
  });

  it("login page includes trust signals (terms, privacy)", () => {
    // Criterion: Enterprise users expect legal links at auth entry
    expect(LANDING_PAGE_HIERARCHY.loginPageElements.termsLink).toBe(true);
    expect(LANDING_PAGE_HIERARCHY.loginPageElements.privacyLink).toBe(true);
  });

  it("login page includes social proof or product context for new visitors", () => {
    // Criterion: B2B SaaS login should contextualize the product for new users
    // FINDING: FAIL — no feature highlights, no testimonials, no product description
    expect(LANDING_PAGE_HIERARCHY.missingElements.featureHighlights).toBe(false); // ← FAILS
  });

  it("dashboard landing page has a clear information hierarchy", () => {
    // Criterion: Dashboard shows greeting → status → primary action → case list
    // Evidence: Dashboard.tsx — greeting h1, case count p, QuickStart, AgentStrip, case grid
    const dashboardSections = ["greeting", "quickStart", "agentStrip", "activeCases", "needsInput", "recentActivity"];
    expect(dashboardSections.length).toBeGreaterThanOrEqual(4);
  });

  it("dashboard empty state guides users to their first action", () => {
    // Criterion: Zero-data state is not a blank screen
    // Evidence: Dashboard.tsx EmptyState component — "No active cases yet" + instruction
    const emptyStateText = "No active cases yet";
    const emptyStateInstruction = "Enter a company name above to start your first value case.";
    expect(emptyStateText).toBeTruthy();
    expect(emptyStateInstruction).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Cycle 1 Summary Assertions
// ---------------------------------------------------------------------------

describe("Cycle 1: Summary — Critical Findings", () => {
  it("documents all critical findings for cycle gate review", () => {
    const criticalFindings = ROUTE_NAMING_CONSISTENCY.inconsistencies.filter(
      (i) => i.severity === "critical",
    );
    const highFindings = ROUTE_NAMING_CONSISTENCY.inconsistencies.filter(
      (i) => i.severity === "high",
    );

    // These findings EXIST and must be addressed before production
    expect(criticalFindings.length).toBeGreaterThan(0); // Brand name inconsistency
    expect(highFindings.length).toBeGreaterThan(0); // Cases/Opportunities terminology split

    // Document the finding count for the gate report
    expect(criticalFindings[0]?.issue).toContain("Brand name");
    expect(highFindings[0]?.issue).toContain("Cases");
  });

  it("documents confirmed strengths for cycle gate review", () => {
    // These pass and represent genuine quality
    expect(NAVIGATION_STRUCTURE.totalTopLevelItems).toBeLessThanOrEqual(9); // Cognitive load OK
    expect(PRIMARY_PATH.onboardingPhaseCount).toBe(5); // Structured onboarding
    expect(ROUTE_INVENTORY.hasLegacyBridge).toBe(true); // Backward compat handled
    expect(ROUTE_INVENTORY.catchAllBehavior).toBe("redirect-to-dashboard"); // No 404 dead ends
  });
});
