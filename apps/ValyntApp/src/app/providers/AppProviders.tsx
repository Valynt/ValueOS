import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";

import { TENANT_CACHE_CLEAR_EVENT } from "../../lib/tenantCacheIsolation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clearQueryCache = () => {
      queryClient.clear();
    };

    window.addEventListener(TENANT_CACHE_CLEAR_EVENT, clearQueryCache);
    return () => {
      window.removeEventListener(TENANT_CACHE_CLEAR_EVENT, clearQueryCache);
    };
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
