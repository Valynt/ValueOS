import { useCallback, useState } from "react";

import { apiClient } from "../../../api/client/unified-api-client";
import type { AuditFilter, AuditLogEntry } from "../types";

interface AuditLogResponse {
  logs: Array<{
    id: string;
    action: AuditLogEntry["action"];
    resource_type: AuditLogEntry["resource"];
    resource_id: string;
    user_id: string;
    user_email: string;
    timestamp: string;
    ip_address?: string;
    user_agent?: string;
    details?: Record<string, unknown>;
    status?: "success" | "failed";
  }>;
}

interface AuditExportResponse {
  downloadUrl?: string;
  fileName?: string;
}

function createFilterQueryParams(filter?: AuditFilter): Record<string, string> {
  const params = new URLSearchParams();

  if (filter?.userId) params.set("userId", filter.userId);
  if (filter?.search) params.set("search", filter.search);
  if (filter?.startDate) params.set("startDate", filter.startDate);
  if (filter?.endDate) params.set("endDate", filter.endDate);

  filter?.action?.forEach((action) => params.append("action", action));
  filter?.resource?.forEach((resource) => params.append("resourceType", resource));

  return Object.fromEntries(params.entries());
}

function downloadFromBlob(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function downloadFromUrl(downloadUrl: string): void {
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentFilter, setCurrentFilter] = useState<AuditFilter | undefined>();

  const fetchLogs = useCallback(async (filter?: AuditFilter, cursor?: string) => {
    setIsLoading(true);
    setError(null);

    if (!cursor) {
      setCurrentFilter(filter);
    }

    try {
      const queryParams = {
        ...createFilterQueryParams(filter),
        offset: String(cursor ? Number(cursor) : 0),
        limit: "50",
      };

      const response = await apiClient.get<AuditLogResponse>("/api/admin/audit-logs", queryParams);

      if (response.success && response.data) {
        const logs: AuditLogEntry[] = response.data.logs.map((log) => ({
          id: log.id,
          action: log.action,
          resource: log.resource_type,
          resourceId: log.resource_id,
          userId: log.user_id,
          userEmail: log.user_email,
          timestamp: log.timestamp,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          status: log.status,
          metadata: log.details,
          changes: (log.details?.changes as AuditLogEntry["changes"]) ?? undefined,
        }));

        setEntries((prev) => (cursor && Number(cursor) > 0 ? [...prev, ...logs] : logs));
        setHasMore(logs.length >= 50);
      } else {
        throw new Error(response.error?.message || "Failed to fetch audit logs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch audit logs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportLogs = useCallback(async (filter?: AuditFilter, format: "csv" | "json" = "csv") => {
    setIsExporting(true);
    setExportError(null);

    try {
      const activeFilter = filter ?? currentFilter;
      const queryParams = new URLSearchParams({
        ...createFilterQueryParams(activeFilter),
        format,
      });

      // Raw fetch retained: export needs blob/streaming response handling that
      // apiClient does not expose. Migrate when apiClient supports raw Response.
      const response = await fetch(`/api/admin/audit-logs/export?${queryParams.toString()}`, {
        method: "GET",
        headers: {
          Accept: format === "json" ? "application/json" : "text/csv",
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const defaultFileName = `audit-logs.${format}`;

      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as AuditExportResponse | Record<string, unknown>;
        if ("downloadUrl" in payload && typeof payload.downloadUrl === "string") {
          downloadFromUrl(payload.downloadUrl);
          return payload.downloadUrl;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        downloadFromBlob(blob, fileNameMatch?.[1] ?? defaultFileName);
        return null;
      }

      const blob = await response.blob();
      downloadFromBlob(blob, fileNameMatch?.[1] ?? defaultFileName);
      return null;
    } catch (_err) {
      const message =
        "Unable to export audit logs right now. Please try again in a moment or contact support if the issue persists.";
      setExportError(message);
      throw new Error(message);
    } finally {
      setIsExporting(false);
    }
  }, [currentFilter]);

  return {
    entries,
    isLoading,
    isExporting,
    error,
    exportError,
    hasMore,
    fetchLogs,
    exportLogs,
  };
}
