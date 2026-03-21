import type { AppRouter } from "@backend/api/trpc";
import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { createElement, type PropsWithChildren, useState } from "react";

const TRPC_ENDPOINT_PATH = "/api/trpc";
const QUERY_STALE_TIME_MS = 1000 * 60 * 5;

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.BACKEND_ORIGIN ?? process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        retry: 1,
      },
    },
  });
}

function createTrpcClient() {
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          import.meta.env.DEV ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: `${getBaseUrl()}${TRPC_ENDPOINT_PATH}`,
        fetch(url, options) {
          return globalThis.fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}

export const trpc = createTRPCReact<AppRouter>();
export const trpcQueryClient = createQueryClient();
export const trpcClient = createTrpcClient();

export function TrpcProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => trpcQueryClient);
  const [client] = useState(() => trpcClient);

  return createElement(
    trpc.Provider,
    { client, queryClient },
    children,
  );
}
