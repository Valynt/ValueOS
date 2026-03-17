import { useQuery } from "@tanstack/react-query";

import { ComplianceModeStatus } from "./types";
import { useComplianceLiveStatus } from "./useComplianceLiveStatus";

import { apiClient } from "@/api/client/unified-api-client";


function ageLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function ComplianceModePage() {
  const { data: controls } = useComplianceLiveStatus();
  const { data: mode } = useQuery({
    queryKey: ["compliance-mode"],
    queryFn: async () => {
      const res = await apiClient.get<ComplianceModeStatus>("/api/admin/compliance/mode");
      return res.data;
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Compliance Mode</h2>
      <div className="rounded border bg-white p-4">
        <div className="text-sm text-gray-600">Active frameworks</div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {mode?.active_modes.map((framework) => (
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-medium" key={framework}>{framework}</span>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-3">Strict enforcement: {mode?.strict_enforcement ? "enabled" : "disabled"}</div>
      </div>
      <div className="rounded border bg-white p-4">
        <h3 className="text-sm font-semibold">Live Control Status</h3>
        <div className="mt-3 space-y-2">
          {controls?.controls.map((control) => (
            <div key={control.control_id} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="text-sm font-medium">{control.control_id}</div>
                <div className="text-xs text-gray-500">{control.framework} · Evidence: {control.evidence_pointer}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{control.metric_value}{control.metric_unit === "percent" ? "%" : control.metric_unit === "hours" ? "h" : ""}</div>
                <div className="text-xs text-gray-500">{ageLabel(control.evidence_recency_minutes)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
