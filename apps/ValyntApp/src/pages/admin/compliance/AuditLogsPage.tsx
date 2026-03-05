import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuditLog } from "../../../features/audit";

import { useComplianceLiveStatus } from "./useComplianceLiveStatus";

interface AuditLogItem {
  id: string;
  action: string;
  resource_type: string;
  status: string;
  timestamp: string;
  user_name: string;
}

export function AuditLogsPage() {
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const { data: controls } = useComplianceLiveStatus();
  const { exportLogs, isExporting, exportError } = useAuditLog();
  const { data: auditData, isLoading } = useQuery({
    queryKey: ["compliance-audit-logs"],
    queryFn: async () => {
      const response = await fetch("/api/admin/compliance/audit-logs?limit=25");
      if (!response.ok) throw new Error("Failed to load audit logs");
      return response.json() as Promise<{ logs: AuditLogItem[] }>;
    },
    refetchInterval: 45000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500">Immutable events with evidence pointers and integrity status.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as "csv" | "json")}
            disabled={isExporting}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <button
            type="button"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void exportLogs(undefined, exportFormat);
            }}
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : `Export ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
      {exportError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded border p-3 bg-white"><div className="text-xs text-gray-500">Controls Passing</div><div className="text-2xl font-semibold">{controls?.summary.controls_passing ?? 0}</div></div>
        <div className="rounded border p-3 bg-white"><div className="text-xs text-gray-500">Warnings</div><div className="text-2xl font-semibold">{controls?.summary.controls_warning ?? 0}</div></div>
        <div className="rounded border p-3 bg-white"><div className="text-xs text-gray-500">Failing</div><div className="text-2xl font-semibold">{controls?.summary.controls_failing ?? 0}</div></div>
        <div className="rounded border p-3 bg-white"><div className="text-xs text-gray-500">Last Evidence Refresh</div><div className="text-sm font-medium">{controls ? new Date(controls.generated_at).toLocaleString() : "-"}</div></div>
      </div>
      <div className="rounded border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Resource</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={5}>Loading...</td></tr>}
            {auditData?.logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-3">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="p-3">{log.user_name}</td>
                <td className="p-3">{log.action}</td>
                <td className="p-3">{log.resource_type}</td>
                <td className="p-3">{log.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
