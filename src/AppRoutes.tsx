/**
 * App Routes with Authentication
 * Centralized routing configuration with lazy loading and error boundaries
 */

import React, { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DrawerProvider } from "./contexts/DrawerContext";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { ToastProvider } from "./components/Common/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { LoadingSpinner } from "./components/Common/LoadingSpinner";
import { BetaFeedbackWidget } from "./components/Feedback/BetaFeedbackWidget";
import { SDUIStateProvider } from "./lib/state/SDUIStateProvider";
import { supabase } from "./lib/supabase";

// Lazy load auth pages (public routes)
const LoginPage = lazy(() => import("./views/Auth/LoginPage"));
const SignupPage = lazy(() => import("./views/Auth/SignupPage"));
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

// Lazy load Documentation Portal
const DocsPortal = lazy(() => import("./components/docs/DocsPortal"));

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <DrawerProvider>
            <ToastProvider>
              <SDUIStateProvider
                supabase={supabase}
                persistence={true}
                debug={true}
              >
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    {/* Root redirect to home */}
                    <Route path="/" element={<Navigate to="/home" replace />} />

                    {/* Public Auth Routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route
                      path="/reset-password"
                      element={<ResetPasswordPage />}
                    />

                    {/* OAuth Callback */}
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    {/* Mission Control (Zero State) */}
                    <Route
                      path="/launch"
                      element={
                        <ProtectedRoute>
                          <MissionControl />
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
              </SDUIStateProvider>
              <BetaFeedbackWidget />
            </ToastProvider>
          </DrawerProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default AppRoutes;
