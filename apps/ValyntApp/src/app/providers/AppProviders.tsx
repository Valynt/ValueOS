import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";

import { TENANT_CACHE_CLEAR_EVENT } from "../../lib/tenantCacheIsolation";
import { TrpcProvider, trpcQueryClient } from "../../lib/trpc";
import { ThemeProvider } from "./ThemeProvider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clearQueryCache = () => {
      trpcQueryClient.clear();
    };

    window.addEventListener(TENANT_CACHE_CLEAR_EVENT, clearQueryCache);
    return () => {
      window.removeEventListener(TENANT_CACHE_CLEAR_EVENT, clearQueryCache);
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="system">
      <TrpcProvider>
        <QueryClientProvider client={trpcQueryClient}>{children}</QueryClientProvider>
      </TrpcProvider>
    </ThemeProvider>
  );
}
