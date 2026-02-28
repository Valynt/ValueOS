import { useEffect } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ComplianceControlStatusResponse } from "./types";

async function fetchControlStatus(): Promise<ComplianceControlStatusResponse> {
  const response = await fetch("/api/admin/compliance/control-status");
  if (!response.ok) {
    throw new Error("Failed to load control status");
  }
  return response.json() as Promise<ComplianceControlStatusResponse>;
}

export function useComplianceLiveStatus() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["compliance-control-status"],
    queryFn: fetchControlStatus,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const source = new EventSource("/api/admin/compliance/stream", { withCredentials: true });

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type === "control_status_updated") {
          queryClient.invalidateQueries({ queryKey: ["compliance-control-status"] });
        }
      } catch {
        // Ignore malformed events from upstream proxies.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [queryClient]);

  return query;
}
