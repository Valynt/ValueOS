/**
 * Frontend Audit — Cycle 2: Structure Deep-Dive
 *
 * Dimensions: Information Architecture + Navigation Refinement
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

const CROSS_PAGE_NAVIGATION = {
  // From ValueCaseCanvas.tsx: back link goes to /opportunities/:oppId
  canvasBackLink: "/opportunities/:oppId", // ValueCaseCanvas.tsx:93
  // From AgentDetail.tsx: back link goes to /agents
  agentDetailBackLink: "/agents", // AgentDetail.tsx:57
  // Dashboard "New Case" button goes to /opportunities
  dashboardNewCaseLink: "/opportunities", // Dashboard.tsx — Link to="/opportunities"
  // Workspace is reached from Dashboard case cards: /workspace/:caseId
  workspaceEntryPoint: "case-card-click", // No direct nav entry
  // No breadcrumb component found in any view
  hasBreadcrumbs: false,
  // Back links are ad-hoc per-view, not a system
  hasSystematicBackNavigation: false,
};

const SECTION_HIERARCHY = {
  // Top-level sections reachable from sidebar
  topLevel: ["dashboard", "opportunities", "living-value-graph", "models", "agents", "company", "billing", "settings", "integrations"],
  // Second-level: workspace sub-routes
  secondLevel: ["workspace/:caseId", "workspace/:caseId/assembly", "workspace/:caseId/model", "workspace/:caseId/integrity", "workspace/:caseId/outputs", "workspace/:caseId/realization"],
  // Third-level: canvas stages (tab-based, not URL-based)
  thirdLevel: ["hypothesis", "model", "integrity", "narrative", "realization", "expansion", "value-graph"],
  // ValueCaseCanvas stages are tab-based (state), not URL-routed
  canvasStagesAreUrlRouted: false,
  // Settings has its own internal router (settingsRegistry)
  settingsHasInternalRouter: true,
  maxDepth: 3,
};

const ADVANCED_FEATURE_DISCOVERABILITY = {
  // Living Value Graph: in sidebar but label "Value Graph" — purpose unclear without context
  livingValueGraphLabelClear: false, // "Value Graph" doesn't explain it's a causal graph
  // Academy: in routes but NOT in sidebar navigation
  academyInSidebar: false, // AppRoutes.tsx has academy/* but Sidebar.tsx has no academy entry
  // Admin/Agents: in routes but NOT in sidebar
  adminAgentsInSidebar: false, // Route: admin/agents, no sidebar entry
  // Guest access: /guest/access — no link from authenticated app
  guestAccessDiscoverable: false,
  // Company Intel: in sidebar as "Company Intel" — reasonably clear
  companyIntelLabelClear: true,
  // Integrations: in sidebar — clear
  integrationsLabelClear: true,
};

const BREADCRUMB_WAYFINDING = {
  // ValueCaseCanvas has a manual back arrow to /opportunities/:oppId
  hasManualBackArrows: true,
  // AgentDetail has a manual back link to /agents
  hasAgentDetailBackLink: true,
  // No breadcrumb trail showing full path (e.g., Cases > Acme Corp > Hypothesis)
  hasFullPathBreadcrumb: false,
  // No page title in TopBar that reflects current location
  topBarShowsCurrentPage: false, // TopBar shows search + org name, not page title
  // Tenant slug in URL provides some context (/org/acme/workspace/123)
  tenantSlugInUrl: true,
};

const NAVIGATION_STATE_PERSISTENCE = {
  // Sidebar collapse state: useState (not persisted across sessions)
  sidebarCollapsePersistedAcrossSessions: false, // Sidebar.tsx:38 — useState(false)
  // Navigation personalization (usage-based reordering): localStorage via useNavigationPersonalization
  navPersonalizationPersisted: true, // useNavigationPersonalization hook
  // Active tab in ValueCaseCanvas: useState (lost on navigation away)
  canvasActiveStagePersistedAcrossNavigation: false, // ValueCaseCanvas.tsx:38 — useState("hypothesis")
  // Settings active route: SettingsContext (session-only)
  settingsActiveRoutePersistedAcrossSessions: false,
  // Search history: persisted via useNavigationPersonalization
  searchHistoryPersisted: true,
};

const SETTINGS_ARCHITECTURE = {
  // Settings has its own internal routing system (settingsRegistry)
  hasInternalRouter: true,
  // Settings sections: User (profile, security, notifications, appearance, authorized-apps)
  //                    Team (general, members, roles, permissions, audit-log, billing)
  //                    Organization (general, security, users, roles, billing)
  userSections: ["profile", "security", "notifications", "appearance", "authorized-apps"],
  teamSections: ["general", "members", "roles", "permissions", "audit-log", "billing"],
  orgSections: ["general", "security", "users", "roles", "billing"],
  // Several settings sections are SettingsPlaceholder (not implemented)
  placeholderSections: ["notifications", "appearance", "authorized-apps", "team/general", "team/members", "team/permissions"],
  // Placeholder count
  placeholderCount: 6,
};

// ---------------------------------------------------------------------------
// TASK 2.1 — Cross-Page Navigation Flow Validation
// ---------------------------------------------------------------------------

describe("Task 2.1: Cross-Page Navigation Flow Validation", () => {
  it("canvas view provides a back navigation path to its parent", () => {
    // Criterion: Users can navigate back from detail views
    expect(CROSS_PAGE_NAVIGATION.canvasBackLink).toBeTruthy();
    expect(CROSS_PAGE_NAVIGATION.canvasBackLink).toContain("opportunities");
  });

  it("agent detail view provides a back navigation path", () => {
    expect(CROSS_PAGE_NAVIGATION.agentDetailBackLink).toBe("/agents");
  });

  it("navigation uses a systematic breadcrumb pattern (not ad-hoc back links)", () => {
    // Criterion: Enterprise apps need consistent wayfinding, not per-view back arrows
    // FINDING: FAIL — back navigation is ad-hoc per view, no breadcrumb system
    expect(CROSS_PAGE_NAVIGATION.hasSystematicBackNavigation).toBe(true); // ← FAILS
  });

  it("workspace is reachable from a named navigation entry point", () => {
    // Criterion: Primary work surface should be directly navigable
    // FINDING: FAIL — workspace only reachable by clicking a case card
    expect(CROSS_PAGE_NAVIGATION.workspaceEntryPoint).not.toBe("case-card-click"); // ← FAILS
  });

  it("top bar reflects the current page context", () => {
    // Criterion: Users always know where they are
    // FINDING: FAIL — TopBar shows search + org name, not current page title
    expect(BREADCRUMB_WAYFINDING.topBarShowsCurrentPage).toBe(true); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 2.2 — Section Hierarchy Depth Analysis
// ---------------------------------------------------------------------------

describe("Task 2.2: Section Hierarchy Depth Analysis", () => {
  it("navigation depth does not exceed 3 levels", () => {
    // Criterion: Deep hierarchies cause disorientation
    expect(SECTION_HIERARCHY.maxDepth).toBeLessThanOrEqual(3);
  });

  it("canvas workflow stages are URL-routed for deep-linkability", () => {
    // Criterion: Each stage should be bookmarkable and shareable
    // FINDING: FAIL — stages are tab state, not URL segments
    // /workspace/:caseId always loads hypothesis tab regardless of desired stage
    expect(SECTION_HIERARCHY.canvasStagesAreUrlRouted).toBe(true); // ← FAILS
  });

  it("settings section has a manageable number of top-level groups", () => {
    // Criterion: Settings should be organized, not sprawling
    const totalSections =
      SETTINGS_ARCHITECTURE.userSections.length +
      SETTINGS_ARCHITECTURE.teamSections.length +
      SETTINGS_ARCHITECTURE.orgSections.length;
    expect(totalSections).toBeLessThanOrEqual(20);
  });

  it("settings placeholder sections are a minority of total sections", () => {
    // Criterion: Placeholder sections signal incomplete product — should be <30%
    const totalSections =
      SETTINGS_ARCHITECTURE.userSections.length +
      SETTINGS_ARCHITECTURE.teamSections.length +
      SETTINGS_ARCHITECTURE.orgSections.length;
    const placeholderRatio = SETTINGS_ARCHITECTURE.placeholderCount / totalSections;
    // FINDING: FAIL — 6 of ~15 sections are placeholders (~40%)
    expect(placeholderRatio).toBeLessThan(0.3); // ← FAILS
  });

  it("workspace sub-routes are logically ordered by workflow stage", () => {
    // Criterion: assembly → model → integrity → outputs → realization is a logical sequence
    const subRoutes = SECTION_HIERARCHY.secondLevel.map((r) => r.split("/").pop());
    expect(subRoutes).toContain("assembly");
    expect(subRoutes).toContain("model");
    expect(subRoutes).toContain("integrity");
    expect(subRoutes).toContain("outputs");
    expect(subRoutes).toContain("realization");
  });
});

// ---------------------------------------------------------------------------
// TASK 2.3 — Advanced Feature Discoverability Audit
// ---------------------------------------------------------------------------

describe("Task 2.3: Advanced Feature Discoverability Audit", () => {
  it("Academy feature is discoverable from the main navigation", () => {
    // Criterion: Paid/premium features should be visible in nav
    // FINDING: FAIL — academy/* route exists but no sidebar entry
    expect(ADVANCED_FEATURE_DISCOVERABILITY.academyInSidebar).toBe(true); // ← FAILS
  });

  it("Admin/Agents feature is discoverable from the main navigation", () => {
    // Criterion: Admin surfaces should be accessible to admin users
    // FINDING: FAIL — admin/agents route exists but no sidebar entry
    expect(ADVANCED_FEATURE_DISCOVERABILITY.adminAgentsInSidebar).toBe(true); // ← FAILS
  });

  it("Living Value Graph label communicates its purpose", () => {
    // Criterion: Nav labels should be self-explanatory
    // FINDING: FAIL — "Value Graph" doesn't explain causal graph visualization
    expect(ADVANCED_FEATURE_DISCOVERABILITY.livingValueGraphLabelClear).toBe(true); // ← FAILS
  });

  it("Company Intel and Integrations labels are clear", () => {
    // These pass — labels are reasonably descriptive
    expect(ADVANCED_FEATURE_DISCOVERABILITY.companyIntelLabelClear).toBe(true);
    expect(ADVANCED_FEATURE_DISCOVERABILITY.integrationsLabelClear).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TASK 2.4 — Breadcrumb/Wayfinding Patterns
// ---------------------------------------------------------------------------

describe("Task 2.4: Breadcrumb/Wayfinding Patterns", () => {
  it("application has a breadcrumb or path indicator system", () => {
    // Criterion: Enterprise B2B apps need persistent location awareness
    // FINDING: FAIL — no breadcrumb component exists
    expect(BREADCRUMB_WAYFINDING.hasFullPathBreadcrumb).toBe(true); // ← FAILS
  });

  it("detail views provide at minimum a back navigation affordance", () => {
    // This passes — canvas and agent detail both have back links
    expect(CROSS_PAGE_NAVIGATION.canvasBackLink).toBeTruthy();
    expect(CROSS_PAGE_NAVIGATION.agentDetailBackLink).toBeTruthy();
  });

  it("tenant slug in URL provides organizational context", () => {
    // Positive finding — /org/:tenantSlug/... is a good pattern
    expect(BREADCRUMB_WAYFINDING.tenantSlugInUrl).toBe(true);
  });

  it("top bar or page header shows current section name", () => {
    // Criterion: Users should always know their location
    // FINDING: FAIL — TopBar shows search + org, not current section
    expect(BREADCRUMB_WAYFINDING.topBarShowsCurrentPage).toBe(true); // ← FAILS
  });
});

// ---------------------------------------------------------------------------
// TASK 2.5 — Navigation State Persistence Check
// ---------------------------------------------------------------------------

describe("Task 2.5: Navigation State Persistence Check", () => {
  it("sidebar collapse preference persists across sessions", () => {
    // Criterion: User preferences should survive page refresh
    // FINDING: FAIL — useState(false) resets on every load
    expect(NAVIGATION_STATE_PERSISTENCE.sidebarCollapsePersistedAcrossSessions).toBe(true); // ← FAILS
  });

  it("navigation personalization (usage-based reordering) is persisted", () => {
    // Positive finding — useNavigationPersonalization persists to localStorage
    expect(NAVIGATION_STATE_PERSISTENCE.navPersonalizationPersisted).toBe(true);
  });

  it("canvas active stage persists when navigating away and back", () => {
    // Criterion: Users should return to where they left off
    // FINDING: FAIL — useState("hypothesis") resets to hypothesis on every visit
    expect(NAVIGATION_STATE_PERSISTENCE.canvasActiveStagePersistedAcrossNavigation).toBe(true); // ← FAILS
  });

  it("search history is persisted for quick re-access", () => {
    // Positive finding — search history tracked via useNavigationPersonalization
    expect(NAVIGATION_STATE_PERSISTENCE.searchHistoryPersisted).toBe(true);
  });
});
