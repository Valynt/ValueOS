/**
 * App Routes with Authentication and Comprehensive Error Boundaries
 *
 * Enhanced routing configuration with:
 * - Multi-level error boundary hierarchy
 * - Route-specific error handling
 * - Async operation error boundaries
 * - Lazy loading with error recovery
 */

import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/app/providers/AuthContext";
import { TenantProvider } from "@/app/providers/TenantContext";
import { DrawerProvider } from "@/app/providers/DrawerContext";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { ToastProvider } from "./components/Common/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteErrorBoundary } from "./components/error-boundaries/RouteErrorBoundary";
import { AsyncErrorBoundary } from "./components/error-boundaries/AsyncErrorBoundary";
import { LoadingSpinner } from "./components/Common/LoadingSpinner";
import { BetaFeedbackWidget } from "./components/Feedback/BetaFeedbackWidget";
import { EnvironmentBanner } from "./components/Common/EnvironmentBanner";
import { CommandPaletteProvider } from "./components/CommandPalette";
import { SDUIStateProvider } from "./lib/state/SDUIStateProvider";
import { supabase } from "./lib/supabase";

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

// Lazy load main app
const App = lazy(() => import("./App"));

// Lazy load VALUI components
const MainLayout = lazy(() => import("./components/Layout/MainLayout"));
const Home = lazy(() => import("./views/Home"));
const ValueCanvas = lazy(() => import("./views/ValueCanvas"));
const ImpactCascade = lazy(() => import("./views/ImpactCascade"));
const AgentDashboard = lazy(() => import("./views/AgentDashboard"));
const ROICalculator = lazy(() => import("./views/ROICalculator"));
const ConversationalAI = lazy(() => import("./views/ConversationalAI"));
const LaunchReadinessDashboard = lazy(
  () => import("./views/LaunchReadinessDashboard")
);
const NotFound = lazy(() => import("./views/NotFound"));
const MissionControl = lazy(() => import("./views/MissionControl"));

// Sales Enablement Views
const DealsView = lazy(() =>
  import("./views/DealsView").then((m) => ({ default: m.DealsView }))
);

// Admin Views
const CustomerAccessManagement = lazy(() =>
  import("./views/Admin/CustomerAccessManagement").then((m) => ({
    default: m.CustomerAccessManagement,
  }))
);

// Lazy load Documentation Portal
const DocsPortal = lazy(() => import("./components/docs/DocsPortal"));
const PreviewPage = lazy(() => import("./views/PreviewPage"));

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <TenantProvider>
            <DrawerProvider>
              <ToastProvider>
                <SDUIStateProvider
                  supabase={supabase}
                  persistence={true}
                  debug={true}
                >
                  <CommandPaletteProvider>
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        {/* Root redirect to deals (sales enablement) */}
                        <Route
                          path="/"
                          element={<Navigate to="/deals" replace />}
                        />

                        {/* Authentication Routes with Route-Level Error Boundaries */}
                        <Route
                          path="/login"
                          element={
                            <RouteErrorBoundary routeName="Login">
                              <AsyncErrorBoundary>
                                <LoginPage />
                              </AsyncErrorBoundary>
                            </RouteErrorBoundary>
                          }
                        />
                        <Route
                          path="/signup"
                          element={
                            <RouteErrorBoundary routeName="Signup">
                              <AsyncErrorBoundary>
                                <SignupPage />
                              </AsyncErrorBoundary>
                            </RouteErrorBoundary>
                          }
                        />
                        <Route
                          path="/reset-password"
                          element={
                            <RouteErrorBoundary routeName="Reset Password">
                              <AsyncErrorBoundary>
                                <ResetPasswordPage />
                              </AsyncErrorBoundary>
                            </RouteErrorBoundary>
                          }
                        />
                        <Route
                          path="/auth/callback"
                          element={
                            <RouteErrorBoundary routeName="Auth Callback">
                              <AsyncErrorBoundary>
                                <AuthCallback />
                              </AsyncErrorBoundary>
                            </RouteErrorBoundary>
                          }
                        />

                        {/* Preview Route - Public access for UI development */}
                        <Route
                          path="/preview"
                          element={
                            <RouteErrorBoundary routeName="Preview">
                              <AsyncErrorBoundary>
                                <PreviewPage />
                              </AsyncErrorBoundary>
                            </RouteErrorBoundary>
                          }
                        />

                        {/* Protected Application Routes with Error Boundaries */}
                        <Route
                          element={
                            <ProtectedRoute>
                              <RouteErrorBoundary routeName="Main Application">
                                <AsyncErrorBoundary>
                                  <MainLayout />
                                </AsyncErrorBoundary>
                              </RouteErrorBoundary>
                            </ProtectedRoute>
                          }
                        >
                          {/* Home Dashboard */}
                          <Route
                            path="/"
                            element={
                              <RouteErrorBoundary routeName="Home">
                                <Home />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Value Canvas */}
                          <Route
                            path="/canvas"
                            element={
                              <RouteErrorBoundary routeName="Value Canvas">
                                <ValueCanvas />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Impact Cascade */}
                          <Route
                            path="/cascade"
                            element={
                              <RouteErrorBoundary routeName="Impact Cascade">
                                <ImpactCascade />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* ROI Calculator */}
                          <Route
                            path="/calculator"
                            element={
                              <RouteErrorBoundary routeName="ROI Calculator">
                                <ROICalculator />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Agent Dashboard */}
                          <Route
                            path="/dashboard"
                            element={
                              <RouteErrorBoundary routeName="Agent Dashboard">
                                <AgentDashboard />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Conversational AI */}
                          <Route
                            path="/chat"
                            element={
                              <RouteErrorBoundary routeName="Conversational AI">
                                <ConversationalAI />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Launch Readiness Dashboard */}
                          <Route
                            path="/launch-readiness"
                            element={
                              <RouteErrorBoundary routeName="Launch Readiness">
                                <LaunchReadinessDashboard />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Mission Control */}
                          <Route
                            path="/mission-control"
                            element={
                              <RouteErrorBoundary routeName="Mission Control">
                                <MissionControl />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Sales Enablement Routes */}
                          <Route
                            path="/sales"
                            element={
                              <RouteErrorBoundary routeName="Sales Enablement">
                                <DealsView />
                              </RouteErrorBoundary>
                            }
                          >
                            <Route
                              index
                              element={
                                <RouteErrorBoundary routeName="Sales Dashboard">
                                  <DealsView />
                                </RouteErrorBoundary>
                              }
                            />
                          </Route>

                          {/* Documentation Portal */}
                          <Route
                            path="/docs"
                            element={
                              <RouteErrorBoundary routeName="Documentation Portal">
                                <DocsPortal />
                              </RouteErrorBoundary>
                            }
                          />
                          <Route
                            path="/docs/:sectionId"
                            element={
                              <RouteErrorBoundary routeName="Documentation Section">
                                <DocsPortal />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* Main App (Chat+Canvas) - Default protected route */}
                          <Route
                            path="/app/*"
                            element={
                              <RouteErrorBoundary routeName="Main App">
                                <App />
                              </RouteErrorBoundary>
                            }
                          />

                          {/* 404 Not Found - Must be last */}
                          <Route path="*" element={<NotFound />} />
                        </Route>

                        {/* Sales Enablement - Deals View */}
                        <Route
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
                        />

                        <Route
                          path="/admin/customer-access"
                          element={
                            <ProtectedRoute>
                              <CustomerAccessManagement />
                            </ProtectedRoute>
                          }
                        />

                        {/* Launch Readiness Dashboard */}
                        <Route
                          path="/launch-readiness"
                          element={
                            <ProtectedRoute>
                              <LaunchReadinessDashboard />
                            </ProtectedRoute>
                          }
                        />

                        {/* VALUI Routes - Modern UI */}
                        <Route
                          path="/home"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<Home />} />
                        </Route>

                        <Route
                          path="/canvas"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ValueCanvas />} />
                        </Route>

                        <Route
                          path="/cascade"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ImpactCascade />} />
                        </Route>

                        <Route
                          path="/calculator"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ROICalculator />} />
                        </Route>

                        <Route
                          path="/dashboard"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<AgentDashboard />} />
                        </Route>

                        <Route
                          path="/chat"
                          element={
                            <ProtectedRoute>
                              <MainLayout />
                            </ProtectedRoute>
                          }
                        >
                          <Route index element={<ConversationalAI />} />
                        </Route>

                        {/* Documentation Portal Routes */}
                        <Route
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
                        />

                        {/* Main App (Chat+Canvas) - Default protected route */}
                        <Route
                          path="/app/*"
                          element={
                            <ProtectedRoute>
                              <App />
                            </ProtectedRoute>
                          }
                        />

                        {/* 404 Not Found - Must be last */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </CommandPaletteProvider>
                </SDUIStateProvider>
                <BetaFeedbackWidget />
                <EnvironmentBanner />
              </ToastProvider>
            </DrawerProvider>
          </TenantProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default AppRoutes;
