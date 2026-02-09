/**
 * App Routes with Authentication
 * Centralized routing configuration with lazy loading and error boundaries
 */

import { type ReactElement, lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { CommandPaletteProvider } from "./components/CommandPalette";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { LoadingSpinner } from "./components/common/LoadingSpinner";
import { ToastProvider } from "./components/common/Toast";
import { AuthProvider } from "./contexts/AuthContext";
import { DrawerProvider } from "./contexts/DrawerContext";
import { TenantProvider } from "./contexts/TenantContext";
import { I18nProvider } from "./i18n/I18nProvider";
import { SDUIStateProvider } from "./lib/state/SDUIStateProvider";
import { supabase } from "./lib/supabase";
import { publicRoutePaths } from "./routes/routeConfig";
import { ProtectedRoute } from "./app/routes/route-guards";

// Lazy load auth pages (public routes) - Modern design
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


// Lazy load app shell + pages
const MainLayout = lazy(() => import("./layouts/MainLayout").then((m) => ({ default: m.MainLayout })));
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

export function AppRoutes() {
  const publicRouteElements: Record<string, ReactElement> = {
    "/login": <LoginPage />,
    "/signup": <SignupPage />,
    "/reset-password": <ResetPasswordPage />,
    "/auth/callback": <AuthCallback />,
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
      <ErrorBoundary>
        <AuthProvider>
          <TenantProvider>
            <DrawerProvider>
              <I18nProvider>
                <ToastProvider>
                  <SDUIStateProvider supabase={supabase}>
                    <CommandPaletteProvider>
                      <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        {/* Public Auth Routes */}
                        {publicRoutePaths.map((path) => (
                          <Route
                            key={path}
                            path={path}
                            element={resolvePublicElement(path)}
                          />
                        ))}

                        {/* Root redirect */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/home" element={<Navigate to="/dashboard" replace />} />

                        {/* Protected routes */}
                        <Route element={<ProtectedRoute />}>
                          <Route element={<MainLayout />}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/opportunities" element={<Opportunities />} />
                            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
                            <Route path="/opportunities/:oppId/cases/:caseId" element={<ValueCaseCanvas />} />
                            <Route path="/models" element={<Models />} />
                            <Route path="/models/:id" element={<ModelDetail />} />
                            <Route path="/agents" element={<Agents />} />
                            <Route path="/agents/:id" element={<AgentDetail />} />
                            <Route path="/integrations" element={<Integrations />} />
                            <Route path="/settings" element={<SettingsPage />} />
                          </Route>
                        </Route>

                        {/* Catch-all */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                      </Suspense>
                    </CommandPaletteProvider>
                  </SDUIStateProvider>
                  <Suspense fallback={null}>
                    <BetaFeedbackWidget />
                    <EnvironmentBanner />
                  </Suspense>
                </ToastProvider>
              </I18nProvider>
            </DrawerProvider>
          </TenantProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default AppRoutes;
