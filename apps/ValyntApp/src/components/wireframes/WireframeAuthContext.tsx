/**
 * Wireframe Auth Context — thin bridge over the real AuthContext.
 *
 * Wireframe components (e.g. NotificationCenter) consume this hook
 * instead of importing AuthContext directly so they stay decoupled
 * from the full auth surface area.
 */
import * as React from "react";

import { useAuth } from "../../contexts/AuthContext";

export interface WireframeUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface WireframeAuthContextType {
  user: WireframeUser | null;
  isAuthenticated: boolean;
  organizationId: string | null;
  accessToken: string | null;
}

export const WireframeAuthContext = React.createContext<WireframeAuthContextType>({
  user: null,
  isAuthenticated: false,
  organizationId: null,
  accessToken: null,
});

/**
 * Hook that bridges the real auth context into the wireframe shape.
 * Falls back to the WireframeAuthContext if used outside AuthProvider
 * (e.g. in Storybook or unit tests).
 */
export function useWireframeAuth(): WireframeAuthContextType {
  try {
    const auth = useAuth();
    const wireframeUser: WireframeUser | null = auth.user
      ? {
        id: auth.user.id,
        name: auth.user.user_metadata?.full_name ?? auth.user.email ?? "User",
        email: auth.user.email ?? "",
        role: auth.userClaims?.roles?.[0] ?? "member",
      }
      : null;

    return {
      user: wireframeUser,
      isAuthenticated: auth.isAuthenticated,
      organizationId: auth.userClaims?.org_id ?? null,
      accessToken: auth.session?.access_token ?? null,
    };
  } catch {
    // Outside AuthProvider — fall back to context value (useful in tests/Storybook)
    return React.useContext(WireframeAuthContext);
  }
}
