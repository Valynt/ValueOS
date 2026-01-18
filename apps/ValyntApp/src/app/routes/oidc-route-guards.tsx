import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Outlet, useLocation } from "react-router-dom";
import { getOidcConfig } from "../auth/oidc-client";

export function OidcProtectedRoute() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const location = useLocation();
  const oidcConfig = getOidcConfig();

  useEffect(() => {
    if (!oidcConfig || isLoading || isAuthenticated) {
      return;
    }

    void loginWithRedirect({
      appState: { returnTo: location.pathname },
    });
  }, [isAuthenticated, isLoading, loginWithRedirect, location.pathname, oidcConfig]);

  if (!oidcConfig) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        OIDC configuration missing. Update VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID to enable
        sign-in.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Authenticating...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Redirecting to sign-in...
      </div>
    );
  }

  return <Outlet />;
}
