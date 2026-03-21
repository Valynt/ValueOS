/**
 * App Routes with Authentication
 * Centralized routing configuration with lazy loading and per-route error boundaries.
 *
 * Each lazy-loaded route is wrapped with its own ErrorBoundary + Suspense pair so that
 * a failure in one section does not crash the entire application (enterprise isolation pattern).
 */

import { lazy, type ReactElement, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { SDUIHumanCheckpointProvider } from "./app/providers/SDUIHumanCheckpointProvider";
import { OnboardingGate } from "./app/routes/OnboardingGate";
import { ProtectedRoute } from "./app/routes/route-guards";
import { TenantGate } from "./app/routes/TenantGate";
import { CommandPaletteProvider } from "./components/CommandPalette";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { ToastProvider } from "./components/common/Toast";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyContextProvider } from "./contexts/CompanyContextProvider";
import { DrawerProvider } from "./contexts/DrawerContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { I18nProvider } from "./i18n/I18nProvider";
import { SDUIStateProvider } from "./lib/state/SDUIStateProvider";
import { supabase } from "./lib/supabase";
import { publicRoutePaths } from "./routes/routeConfig";

// ---------------------------------------------------------------------------
// Lazy load auth pages (public routes)
// ---------------------------------------------------------------------------
const LoginPage = lazy(() =>
  import("./views/Auth/ModernLoginPage").then((m) => ({
    default: m.ModernLoginPage,
  }))
);
const SignupPage = lazy(() =>
  import("./views/Auth/ModernSignupPage").then((m) => ({
    default: m.ModernSignupPage,
  }))
);
const ResetPasswordPage = lazy(() => import("./views/Auth/ResetPasswordPage"));
const AuthCallback = lazy(() => import("./views/Auth/AuthCallback"));
const GuestAccessPage = lazy(() =>
  import("./pages/guest/GuestAccessPage").then((m) => ({
    default: m.GuestAccessPage,
  })),
);

const BetaFeedbackWidget = lazy(() =>
  import("./components/feedback/BetaFeedbackWidget").then((m) => ({
    default: m.BetaFeedbackWidget,
  })),
);
const EnvironmentBanner = lazy(() =>
  import("./components/common/EnvironmentBanner").then((m) => ({
    default: m.EnvironmentBanner,
  })),
);

// ---------------------------------------------------------------------------
// Lazy load app shell + pages
// ---------------------------------------------------------------------------
const MainLayout = lazy(() =>
  import("./layouts/MainLayout").then((m) => ({ default: m.MainLayout }))
);
const Dashboard = lazy(() => import("./views/Dashboard"));
const Opportunities = lazy(() => import("./views/Opportunities"));
const OpportunityDetail = lazy(() => import("./views/OpportunityDetail"));
const ValueCaseCanvas = lazy(() => import("./views/ValueCaseCanvas"));
const Models = lazy(() => import("./views/Models"));
const ModelDetail = lazy(() => import("./views/ModelDetail"));
const Agents = lazy(() => import("./views/Agents"));
const AgentDetail = lazy(() => import("./views/AgentDetail"));
const Integrations = lazy(() => import("./views/Integrations"));
const SettingsPage = lazy(() => import("./views/SettingsPage"));
const CompanyOnboarding = lazy(() => import("./views/CompanyOnboarding"));
const CreateOrganization = lazy(() => import("./views/CreateOrganization"));
const CompanyKnowledge = lazy(() => import("./views/CompanyKnowledge"));
const ValueCaseWorkspace = lazy(() => import("./views/ValueCaseWorkspace"));
const AgentAdminPage = lazy(() => import("./views/Admin/AgentAdminPage"));
const LivingValueGraphPage = lazy(() => import("./views/LivingValueGraphPage"));

// V1 Surface Views
const DealAssemblyWorkspace = lazy(() => import("./views/DealAssemblyWorkspace"));
const ValueModelWorkbench = lazy(() => import("./views/ValueModelWorkbench"));
const IntegrityDashboard = lazy(() => import("./views/IntegrityDashboard"));
const ExecutiveOutputStudio = lazy(() => import("./views/ExecutiveOutputStudio"));
const RealizationTracker = lazy(() => import("./views/RealizationTracker"));
const BillingPortal = lazy(() => import("./views/BillingPortal"));

// Academy v2 (migrated from VOSAcademy)
const AcademyV2Routes = lazy(() => import("./features/academy-v2/routes"));

const MainLayoutSkipLinkHarness = lazy(() =>
  import("./views/testing/MainLayoutSkipLinkHarness").then((m) => ({
    default: m.MainLayoutSkipLinkHarness,
  }))
);
const TenantBrandingHarness = lazy(() =>
  import("./views/testing/TenantBrandingHarness").then((m) => ({
    default: m.TenantBrandingHarness,
  }))
);

// ---------------------------------------------------------------------------
// Route-level boundary helpers
// ---------------------------------------------------------------------------

/** Shared page-level loading fallback */
const PageLoader = <LoadingSpinner />;

/**
 * Wraps a lazy-loaded route element with its own Suspense + ErrorBoundary pair.
 * This ensures that a failure or slow load in one route does not affect others.
 */
function RouteGuard({
  element,
  context,
}: {
  element: ReactElement;
  context: string;
}) {
  return (
    <ErrorBoundary context={context}>
      <Suspense fallback={PageLoader}>{element}</Suspense>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Tenant routing helpers
// ---------------------------------------------------------------------------

const TENANT_SCOPED_PREFIX = "/org";

function buildTenantPath(tenantSlugOrId: string, leafPath: string): string {
  const normalizedLeafPath = leafPath.startsWith("/") ? leafPath.slice(1) : leafPath;
  return `${TENANT_SCOPED_PREFIX}/${tenantSlugOrId}/${normalizedLeafPath}`;
}

function TenantAwareRedirect({ leafPath }: { leafPath: string }) {
  const { currentTenant, isLoading } = useTenant();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!currentTenant) {
    return <Navigate to="/create-org" replace />;
  }

  return (
    <Navigate
      to={buildTenantPath(currentTenant.slug || currentTenant.id, leafPath)}
      replace
    />
  );
}

function LegacyTenantRouteBridge() {
  const { currentTenant, isLoading } = useTenant();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }
  if (!currentTenant) {
    return <Navigate to="/create-org" replace />;
  }

  const tenantSlugOrId = currentTenant.slug || currentTenant.id;
  const nextPath = buildTenantPath(tenantSlugOrId, location.pathname.replace(/^\//, ""));
  const searchWithHash = `${location.search}${location.hash}`;

  return <Navigate to={`${nextPath}${searchWithHash}`} replace />;
}

// ---------------------------------------------------------------------------
// App Routes
// ---------------------------------------------------------------------------

export function AppRoutes() {
  const publicRouteElements: Record<string, ReactElement> = {
    "/login": <RouteGuard element={<LoginPage />} context="Login" />,
    "/signup": <RouteGuard element={<SignupPage />} context="Signup" />,
    "/reset-password": <RouteGuard element={<ResetPasswordPage />} context="ResetPassword" />,
    "/auth/callback": <RouteGuard element={<AuthCallback />} context="AuthCallback" />,
    "/guest/access": <RouteGuard element={<GuestAccessPage />} context="GuestAccess" />,
  };

  const resolvePublicElement = (path: string) => {
    const element = publicRouteElements[path];
    if (!element) {
      throw new Error(`Missing route element for ${path}`);
    }
    return element;
  };

  return (
    <BrowserRouter>
      {/* Application-level boundary — catches catastrophic failures */}
      <ErrorBoundary context="Application">
        <AuthProvider>
          <TenantProvider>
            <CompanyContextProvider>
              <DrawerProvider>
                <I18nProvider>
                  <ToastProvider>
                    <SDUIStateProvider _supabase={supabase}>
                      <SDUIHumanCheckpointProvider>
                        <CommandPaletteProvider>
                          {/* Top-level Suspense for the router shell */}
                          <Suspense fallback={<LoadingSpinner />}>
                            <Routes>
                              {/* Public Auth Routes — each has its own boundary via RouteGuard */}
                              {publicRoutePaths.map((path) => (
                                <Route
                                  key={path}
                                  path={path}
                                  element={resolvePublicElement(path)}
                                />
                              ))}

                              {import.meta.env.DEV && (
                                <>
                                  <Route
                                    path="/__playwright__/main-layout"
                                    element={
                                      <RouteGuard
                                        element={<MainLayout />}
                                        context="MainLayoutHarness"
                                      />
                                    }
                                  >
                                    <Route
                                      index
                                      element={
                                        <RouteGuard
                                          element={<MainLayoutSkipLinkHarness />}
                                          context="SkipLinkHarness"
                                        />
                                      }
                                    />
                                  </Route>
                                  <Route
                                    path="/__playwright__/branding-preview"
                                    element={
                                      <RouteGuard
                                        element={<TenantBrandingHarness />}
                                        context="BrandingHarness"
                                      />
                                    }
                                  />
                                </>
                              )}

                              {/* Root redirect */}
                              <Route
                                path="/"
                                element={<TenantAwareRedirect leafPath="dashboard" />}
                              />
                              <Route
                                path="/home"
                                element={<TenantAwareRedirect leafPath="dashboard" />}
                              />

                              {/* Protected routes */}
                              <Route element={<ProtectedRoute />}>
                                {/* Org creation — shown when user has no tenants */}
                                <Route
                                  path="/create-org"
                                  element={
                                    <RouteGuard
                                      element={<CreateOrganization />}
                                      context="CreateOrganization"
                                    />
                                  }
                                />

                                {/* Tenant gate: redirects to /create-org if no tenants */}
                                <Route element={<TenantGate />}>
                                  {/* Onboarding — own layout, no gate */}
                                  <Route
                                    path="/onboarding"
                                    element={
                                      <RouteGuard
                                        element={<CompanyOnboarding />}
                                        context="Onboarding"
                                      />
                                    }
                                  />

                                  {/* Main app — gated by onboarding completion */}
                                  <Route path="/org/:tenantSlug" element={<OnboardingGate />}>
                                    <Route
                                      element={
                                        <ErrorBoundary context="MainLayout">
                                          <Suspense fallback={<LoadingSpinner />}>
                                            <MainLayout />
                                          </Suspense>
                                        </ErrorBoundary>
                                      }
                                    >
                                      <Route
                                        path="dashboard"
                                        element={
                                          <RouteGuard element={<Dashboard />} context="Dashboard" />
                                        }
                                      />
                                      <Route
                                        path="opportunities"
                                        element={
                                          <RouteGuard
                                            element={<Opportunities />}
                                            context="Opportunities"
                                          />
                                        }
                                      />
                                      <Route
                                        path="opportunities/:id"
                                        element={
                                          <RouteGuard
                                            element={<OpportunityDetail />}
                                            context="OpportunityDetail"
                                          />
                                        }
                                      />
                                      <Route
                                        path="opportunities/:oppId/cases/:caseId"
                                        element={
                                          <RouteGuard
                                            element={<ValueCaseCanvas />}
                                            context="ValueCaseCanvas"
                                          />
                                        }
                                      />
                                      <Route
                                        path="models"
                                        element={
                                          <RouteGuard element={<Models />} context="Models" />
                                        }
                                      />
                                      <Route
                                        path="models/:id"
                                        element={
                                          <RouteGuard
                                            element={<ModelDetail />}
                                            context="ModelDetail"
                                          />
                                        }
                                      />
                                      <Route
                                        path="agents"
                                        element={
                                          <RouteGuard element={<Agents />} context="Agents" />
                                        }
                                      />
                                      <Route
                                        path="agents/:id"
                                        element={
                                          <RouteGuard
                                            element={<AgentDetail />}
                                            context="AgentDetail"
                                          />
                                        }
                                      />
                                      <Route
                                        path="admin/agents"
                                        element={
                                          <RouteGuard
                                            element={<AgentAdminPage />}
                                            context="AgentAdmin"
                                          />
                                        }
                                      />
                                      <Route
                                        path="integrations"
                                        element={
                                          <RouteGuard
                                            element={<Integrations />}
                                            context="Integrations"
                                          />
                                        }
                                      />
                                      <Route
                                        path="settings"
                                        element={
                                          <RouteGuard
                                            element={<SettingsPage />}
                                            context="Settings"
                                          />
                                        }
                                      />
                                      <Route
                                        path="workspace/:caseId"
                                        element={
                                          <RouteGuard
                                            element={<ValueCaseWorkspace />}
                                            context="ValueCaseWorkspace"
                                          />
                                        }
                                      />
                                      <Route
                                        path="workspace/:caseId/assembly"
                                        element={
                                          <RouteGuard
                                            element={<DealAssemblyWorkspace />}
                                            context="DealAssembly"
                                          />
                                        }
                                      />
                                      <Route
                                        path="workspace/:caseId/model"
                                        element={
                                          <RouteGuard
                                            element={<ValueModelWorkbench />}
                                            context="ValueModel"
                                          />
                                        }
                                      />
                                      <Route
                                        path="workspace/:caseId/integrity"
                                        element={
                                          <RouteGuard
                                            element={<IntegrityDashboard />}
                                            context="Integrity"
                                          />
                                        }
                                      />
                                      <Route
                                        path="workspace/:caseId/outputs"
                                        element={
                                          <RouteGuard
                                            element={<ExecutiveOutputStudio />}
                                            context="ExecutiveOutputs"
                                          />
                                        }
                                      />
                                      <Route
                                        path="workspace/:caseId/realization"
                                        element={
                                          <RouteGuard
                                            element={<RealizationTracker />}
                                            context="Realization"
                                          />
                                        }
                                      />
                                      <Route
                                        path="billing"
                                        element={
                                          <RouteGuard
                                            element={<BillingPortal />}
                                            context="Billing"
                                          />
                                        }
                                      />
                                      <Route
                                        path="company"
                                        element={
                                          <RouteGuard
                                            element={<CompanyKnowledge />}
                                            context="CompanyKnowledge"
                                          />
                                        }
                                      />
                                      <Route
                                        path="living-value-graph/:opportunityId?/:caseId?"
                                        element={
                                          <RouteGuard
                                            element={<LivingValueGraphPage />}
                                            context="LivingValueGraph"
                                          />
                                        }
                                      />
                                      <Route
                                        path="academy/*"
                                        element={
                                          <RouteGuard
                                            element={<AcademyV2Routes />}
                                            context="Academy"
                                          />
                                        }
                                      />
                                    </Route>
                                  </Route>

                                  {/* Legacy non-tenant routes bridge to canonical tenant URL */}
                                  <Route path="/dashboard" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/opportunities" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/opportunities/:id" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/opportunities/:oppId/cases/:caseId" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/models" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/models/:id" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/agents" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/agents/:id" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/integrations" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/settings" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/workspace/:caseId" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/workspace/:caseId/assembly" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/workspace/:caseId/model" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/workspace/:caseId/integrity" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/workspace/:caseId/outputs" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/workspace/:caseId/realization" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/billing" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/company" element={<LegacyTenantRouteBridge />} />
                                  <Route path="/living-value-graph/*" element={<LegacyTenantRouteBridge />} />
                                </Route>
                              </Route>

                              {/* Catch-all */}
                              <Route
                                path="*"
                                element={<TenantAwareRedirect leafPath="dashboard" />}
                              />
                            </Routes>
                          </Suspense>
                        </CommandPaletteProvider>
                      </SDUIHumanCheckpointProvider>
                    </SDUIStateProvider>
                    {/* Floating UI elements — isolated so they never crash the main app */}
                    <ErrorBoundary context="FloatingWidgets">
                      <Suspense fallback={null}>
                        <BetaFeedbackWidget />
                        <EnvironmentBanner />
                      </Suspense>
                    </ErrorBoundary>
                  </ToastProvider>
                </I18nProvider>
              </DrawerProvider>
            </CompanyContextProvider>
          </TenantProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default AppRoutes;
