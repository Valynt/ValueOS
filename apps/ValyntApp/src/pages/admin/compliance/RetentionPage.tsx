import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

import { RetentionRule } from "./types";

export function RetentionPage() {
  const { data } = useQuery({
    queryKey: ["compliance-retention"],
    queryFn: async () => {
      const res = await apiClient.get<{ rules: RetentionRule[] }>("/api/admin/compliance/retention");
      return res.data;
    },
    refetchInterval: 120000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Retention Schedule</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data?.rules.map((rule) => (
          <div className="rounded border bg-white p-4" key={rule.id}>
            <div className="text-sm font-semibold">{rule.data_class}</div>
            <div className="text-xs text-gray-600 mt-1">Retention: {rule.retention_days} days</div>
            <div className="text-xs text-gray-600">Legal hold: {rule.legal_hold ? "enabled" : "disabled"}</div>
            <div className="text-xs text-gray-400 mt-2">Last reviewed {new Date(rule.last_reviewed_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
