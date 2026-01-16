import { createContext, useContext, ReactNode, useState } from "react";
import { useAuth0, Auth0Provider } from "@auth0/auth0-react";

interface User {
  id: string;
  email: string;
  fullName?: string;
  avatar_url?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email?: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthInternalProvider({ children }: { children: ReactNode }) {
  const [bypassUser, setBypassUser] = useState<User | null>(null);
  const {
    user: auth0User,
    isAuthenticated: auth0Authenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const signIn = async (email?: string, password?: string) => {
    if (email === "dev@valynt.com" && password === "bypass") {
      // Bypass Auth0 for development
      setBypassUser({
        id: "dev-user-id",
        email: "dev@valynt.com",
        fullName: "Dev User",
        role: "admin",
      });
      return;
    }
    await loginWithRedirect();
  };

  const signOut = async () => {
    if (bypassUser) {
      setBypassUser(null);
      return;
    }
    await logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const getAccessToken = async () => {
    if (bypassUser) {
      return "bypass-token";
    }
    try {
      return await getAccessTokenSilently();
    } catch (error) {
      // Log error without exposing sensitive information
      return undefined;
    }
  };

  const user =
    bypassUser ||
    (auth0User
      ? {
          id: auth0User.sub || "",
          email: auth0User.email || "",
          fullName: auth0User.name,
          avatar_url: auth0User.picture,
          role: (auth0User as any)["https://valueos.app/roles"]?.[0] || "member",
        }
      : null);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        signIn,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  if (!domain || !clientId) {
    return (
      <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded">
        Auth0 configuration missing. Please check VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <AuthInternalProvider>{children}</AuthInternalProvider>
    </Auth0Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
