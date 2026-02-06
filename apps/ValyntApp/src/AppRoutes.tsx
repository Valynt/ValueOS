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
import { publicRoutePaths, redirectRoutes } from "./routes/routeConfig";

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


// Lazy load VALUI components
// const MainLayout = lazy(() => import("./components/Layout/MainLayout"));
// const Home = lazy(() => import("./views/Home"));
// const ValueCanvas = lazy(() => import("./views/ValueCanvas"));
// const ImpactCascade = lazy(() => import("./views/ImpactCascade"));
// const AgentDashboard = lazy(() => import("./views/AgentDashboard"));
// const ROICalculator = lazy(() => import("./views/ROICalculator"));
// const ConversationalAI = lazy(() => import("./views/ConversationalAI"));
// const LaunchReadinessDashboard = lazy(() => import("./views/LaunchReadinessDashboard"));
// const NotFound = lazy(() => import("./views/NotFound"));
// const MissionControl = lazy(() => import("./views/MissionControl"));

// Sales Enablement Views
// const DealsView = lazy(() => import("./views/DealsView").then((m) => ({ default: m.DealsView })));

// Admin Views
// const CustomerAccessManagement = lazy(() =>
//   import("./views/Admin/CustomerAccessManagement").then((m) => ({
//     default: m.CustomerAccessManagement,
//   }))
// );

// Lazy load Documentation Portal
// const DocsPortal = lazy(() => import("./components/docs/DocsPortal"));

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

                        {/* Root redirect to login */}
                        {redirectRoutes.map((route) => (
                          <Route
                            key={route.path}
                            path={route.path}
                            element={<Navigate to={route.to} replace />}
                          />
                        ))}

                        {/* Sales Enablement - Deals View */}
                        {/* <Route
                          path="/deals"
                          element={
                            <ProtectedRoute>
                              <DealsView />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/deals/:dealId"
                          element={
                            <ProtectedRoute>
                              <DealsView />
                            </ProtectedRoute>
                          }
                        /> */}

                        {/* <Route
                          path="/admin/customer-access"
                          element={
                            <ProtectedRoute>
                              <CustomerAccessManagement />
                            </ProtectedRoute>
                          }
                        /> */}

                        {/* Mission Control (Zero State) */}
                        {/* <Route
                          path="/launch"
                          element={
                            <ProtectedRoute>
                              <MissionControl />
                            </ProtectedRoute>
                          }
                        /> */}

                        {/* Launch Readiness Dashboard */}
                        {/* <Route
                          path="/launch-readiness"
                          element={
                            <ProtectedRoute>
                              <LaunchReadinessDashboard />
                            </ProtectedRoute>
                          }
                        /> */}

                        {/* VALUI Routes - Modern UI */}
                        {/* <Route
                          path="/home"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<Home />} />
                        </Route> */}

                        {/* <Route
                          path="/canvas"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ValueCanvas />} />
                        </Route> */}

                        {/* <Route
                          path="/cascade"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ImpactCascade />} />
                        </Route> */}

                        {/* <Route
                          path="/calculator"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ROICalculator />} />
                        </Route> */}

                        {/* <Route
                          path="/dashboard"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<AgentDashboard />} />
                        </Route> */}

                        {/* <Route
                          path="/chat"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ConversationalAI />} />
                        </Route> */}

                        {/* Documentation Portal Routes */}
                        {/* <Route
                          path="/docs"
                          element={
                            <ProtectedRoute>
                              <DocsPortal />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/docs/:sectionId"
                          element={
                            <ProtectedRoute>
                              <DocsPortal />
                            </ProtectedRoute>
                          }
                        /> */}

                        {/* Main App (Chat+Canvas) - Default protected route */}
                        {/* <Route
                          path="/app/*"
                          element={
                            <ProtectedRoute>
                              <App />
                            </ProtectedRoute>
                          }
                        /> */}

                        {/* 404 Not Found - Must be last */}
                        {/* <Route path="*" element={<NotFound />} /> */}
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
