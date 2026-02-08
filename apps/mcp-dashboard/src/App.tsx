import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import DashboardLayout from "./components";
import { AuthProvider, useAuth } from "./contexts";
import { WebSocketProvider } from "./contexts";

// Layout Components

// Page Components
import {
  adminRoutes,
  catchAllRoute,
  protectedIndexRedirect,
  protectedRoutes,
  publicRoutes,
} from "./routeConfig";

// Magic numbers replaced with constants
const FIVE_MINUTES = 1000 * 60 * 5;
const THIRTY_MINUTES = 1000 * 60 * 30;
// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      cacheTime: THIRTY_MINUTES,
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              {publicRoutes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={<Navigate to={protectedIndexRedirect} replace />}
                />
                {protectedRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={route.element}
                  />
                ))}

                {/* Admin Routes */}
                {adminRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={<AdminRoute>{route.element}</AdminRoute>}
                  />
                ))}
              </Route>

              {/* Catch all route */}
              <Route
                path={catchAllRoute.path}
                element={<Navigate to={catchAllRoute.redirectTo} replace />}
              />
            </Routes>
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
