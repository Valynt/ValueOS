import React, { useEffect } from "react";
import { useLocation } from "wouter";

import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

import { useAuth } from "@/hooks/useAuth";

type RouteGuardProps = {
  children: React.ReactNode;
  requiredRole: string | undefined;
};

export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const userRole = user?.role ?? user?.vosRole;

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated) {
      const redirectParam = encodeURIComponent(location);
      setLocation(`/?redirect=${redirectParam}`);
      return;
    }

    if (requiredRole && userRole !== requiredRole) {
      setLocation("/?error=forbidden");
    }
  }, [isAuthenticated, loading, location, requiredRole, setLocation, userRole]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && userRole !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}

export default RouteGuard;
