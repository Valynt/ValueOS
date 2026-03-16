/**
 * Wireframe Auth Context - stub declaration.
 * TODO: Replace with full implementation.
 */
import * as React from "react";

export interface WireframeUser {
  id: string;
  name: string;
  role: string;
}

export interface WireframeAuthContextType {
  user: WireframeUser | null;
  isAuthenticated: boolean;
}

export const WireframeAuthContext = React.createContext<WireframeAuthContextType>({
  user: null,
  isAuthenticated: false,
});

export function useWireframeAuth(): WireframeAuthContextType {
  return React.useContext(WireframeAuthContext);
}
