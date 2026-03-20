import { useQuery } from "@tanstack/react-query";

import { PolicyHistoryEntry } from "./types";

import { apiClient } from "@/api/client/unified-api-client";


export function PolicyHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["compliance-policy-history"],
    queryFn: async () => {
      const res = await apiClient.get<{ history: PolicyHistoryEntry[] }>("/api/admin/compliance/policy-history");
      return res.data;
    },
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Policy History</h2>
      <div className="rounded border bg-card p-4 space-y-3">
        {isLoading && <p className="text-sm text-gray-500">Loading policy history...</p>}
        {data?.history.map((entry) => (
          <div key={entry.id} className="border rounded p-3">
            <div className="text-sm font-medium">{entry.policy_key}</div>
            <div className="text-xs text-gray-500 mt-1">
              {entry.previous_value ?? "unset"} → {entry.next_value}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Changed by {entry.changed_by} on {new Date(entry.changed_at).toLocaleString()} · {entry.evidence_pointer}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
