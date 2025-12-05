/**
 * App Routes with Authentication
 * Centralized routing configuration
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { ToastProvider } from './components/Common/Toast';
import LoginPage from './views/Auth/LoginPage';
import SignupPage from './views/Auth/SignupPage';
import ResetPasswordPage from './views/Auth/ResetPasswordPage';
import App from './App';
import { LaunchReadinessDashboard } from './views/LaunchReadinessDashboard';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
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

          {/* Protected App Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRoutes;
