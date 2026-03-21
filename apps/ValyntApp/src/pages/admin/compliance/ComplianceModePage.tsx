import { useQuery } from "@tanstack/react-query";

import { ComplianceFrameworkStatus, ComplianceModeStatus } from "./types";
import { useComplianceLiveStatus } from "./useComplianceLiveStatus";

import { apiClient } from "@/api/client/unified-api-client";

function ageLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function frameworkStatusClasses(status: ComplianceFrameworkStatus): string {
  return status.selectable
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
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

  const availableModes = mode?.active_modes ?? [];
  const unavailableFrameworks = mode?.framework_statuses.filter((status) => !status.selectable) ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Compliance Mode</h2>
      <div className="rounded border bg-white p-4 space-y-4">
        <div>
          <div className="text-sm text-gray-600">Selectable frameworks</div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {availableModes.length > 0 ? (
              availableModes.map((framework) => (
                <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800" key={framework}>
                  {framework}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">No compliance frameworks are currently available.</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600">Framework availability</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mode?.framework_statuses.map((status) => (
              <div className="rounded border p-3" key={status.framework}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{status.framework}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {status.selectable ? "Ready for operator selection." : "Gated / unavailable until prerequisites are met."}
                    </div>
                  </div>
                  <span className={`rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${frameworkStatusClasses(status)}`}>
                    {status.selectable ? "Available" : "Gated"}
                  </span>
                </div>

                {!status.selectable && status.missing_prerequisites.length > 0 ? (
                  <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Missing prerequisites</div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-900">
                      {status.missing_prerequisites.map((prerequisite) => (
                        <li key={prerequisite}>{prerequisite}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {unavailableFrameworks.length > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Some frameworks are intentionally hidden from selection until the required backend safeguards are configured.
          </div>
        ) : null}

        <div className="text-xs text-gray-500">Strict enforcement: {mode?.strict_enforcement ? "enabled" : "disabled"}</div>
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
