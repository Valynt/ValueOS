import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";

import { NotificationProvider } from "@/components/shell/NotificationCenter";

import { ApiRequestProvider } from "../../contexts/ApiRequestContext";
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
    <ThemeProvider>
      <ApiRequestProvider>
        <TrpcProvider>
          <QueryClientProvider client={trpcQueryClient}>
            <NotificationProvider>{children}</NotificationProvider>
          </QueryClientProvider>
        </TrpcProvider>
      </ApiRequestProvider>
    </ThemeProvider>
  );
}
