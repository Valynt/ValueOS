/**
 * App Routes with Authentication
 * Centralized routing configuration
 */

import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DrawerProvider } from "./contexts/DrawerContext";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { ToastProvider } from "./components/Common/Toast";
import LoginPage from "./views/Auth/LoginPage";
import SignupPage from "./views/Auth/SignupPage";
import ResetPasswordPage from "./views/Auth/ResetPasswordPage";
import App from "./App";
import { LaunchReadinessDashboard } from "./views/LaunchReadinessDashboard";
import { BetaFeedbackWidget } from "./components/Feedback/BetaFeedbackWidget";

// VALUI Components
import MainLayout from "./components/Layout/MainLayout";
import Home from "./views/Home";
import ValueCanvas from "./views/ValueCanvas";
import ImpactCascade from "./views/ImpactCascade";
import AgentDashboard from "./views/AgentDashboard";
import ROICalculator from "./views/ROICalculator";
import ConversationalAI from "./views/ConversationalAI";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DrawerProvider>
          <ToastProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route
                path="/launch-readiness"
                element={
                  <ProtectedRoute>
                    <LaunchReadinessDashboard />
                  </ProtectedRoute>
                }
              />

              {/* VALUI Routes - New Modern UI (explicit paths) */}
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

              {/* Protected App Routes (Legacy) - catch all remaining */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <App />
                  </ProtectedRoute>
                }
              />
            </Routes>
            <BetaFeedbackWidget />
          </ToastProvider>
        </DrawerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRoutes;
