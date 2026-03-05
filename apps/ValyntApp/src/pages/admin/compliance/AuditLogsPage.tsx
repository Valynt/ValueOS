import { useEffect } from "react";

import { useAuditLog } from "@/features/audit";

import { useComplianceLiveStatus } from "./useComplianceLiveStatus";

export function AuditLogsPage() {
  const { data: controls } = useComplianceLiveStatus();
  const { entries, isLoading, fetchLogs, exportLogs, isExporting, exportError } = useAuditLog();

  useEffect(() => {
    void fetchLogs();

    const interval = window.setInterval(() => {
      void fetchLogs();
    }, 45000);

    return () => window.clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500">Immutable events with evidence pointers and integrity status.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void exportLogs(undefined, "csv")}
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => void exportLogs(undefined, "json")}
            className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "Export JSON"}
          </button>
        </div>
      </div>

      {exportError && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded border bg-white p-3"><div className="text-xs text-gray-500">Controls Passing</div><div className="text-2xl font-semibold">{controls?.summary.controls_passing ?? 0}</div></div>
        <div className="rounded border bg-white p-3"><div className="text-xs text-gray-500">Warnings</div><div className="text-2xl font-semibold">{controls?.summary.controls_warning ?? 0}</div></div>
        <div className="rounded border bg-white p-3"><div className="text-xs text-gray-500">Failing</div><div className="text-2xl font-semibold">{controls?.summary.controls_failing ?? 0}</div></div>
        <div className="rounded border bg-white p-3"><div className="text-xs text-gray-500">Last Evidence Refresh</div><div className="text-sm font-medium">{controls ? new Date(controls.generated_at).toLocaleString() : "-"}</div></div>
      </div>
      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Resource</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-3" colSpan={5}>Loading...</td></tr>}
            {!isLoading && entries.length === 0 && <tr><td className="p-3" colSpan={5}>No audit logs found.</td></tr>}
            {entries.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-3">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="p-3">{log.userEmail}</td>
                <td className="p-3">{log.action}</td>
                <td className="p-3">{log.resource}</td>
                <td className="p-3">{typeof log.metadata?.status === "string" ? log.metadata.status : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
