import { useCallback, useState } from "react";

import { apiClient } from "../../../api/client/unified-api-client";
import type { AuditFilter, AuditLogEntry } from "../types";

interface ExportResponseBody {
  downloadUrl?: string;
  filename?: string;
  data?: unknown;
  error?: string;
}

function buildExportParams(filter?: AuditFilter, format: "csv" | "json" = "csv"): URLSearchParams {
  const params = new URLSearchParams({ format });

  if (!filter) {
    return params;
  }

  if (filter.userId) {
    params.set("userId", filter.userId);
  }

  if (filter.startDate) {
    params.set("startDate", filter.startDate);
  }

  if (filter.endDate) {
    params.set("endDate", filter.endDate);
  }

  if (filter.search) {
    params.set("search", filter.search);
  }

  filter.action?.forEach((action) => params.append("action", action));
  filter.resource?.forEach((resource) => params.append("resourceType", resource));

  return params;
}

function getFilenameFromHeader(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?\"?([^";]+)\"?/i);
  if (!filenameMatch?.[1]) {
    return fallback;
  }

  const rawFilename = filenameMatch[1];

  try {
    return decodeURIComponent(rawFilename);
  } catch {
    // If the header contains malformed percent-encoding (e.g. stray '%' characters),
    // fall back to the raw filename match instead of throwing and aborting the export.
    return rawFilename || fallback;
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function triggerUrlDownload(downloadUrl: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (filter?: AuditFilter, cursor?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = {
        userId: filter?.userId,
        action: filter?.action,
        resourceType: filter?.resource,
        startDate: filter?.startDate,
        endDate: filter?.endDate,
        offset: cursor ? Number(cursor) : 0,
        limit: 50,
      };

      const response = await apiClient.get<{ logs: Array<Record<string, unknown>> }>(
        "/api/admin/audit-logs",
        queryParams
      );

      if (response.success && response.data) {
        const logs: AuditLogEntry[] = response.data.logs.map((log) => ({
          id: String(log.id),
          action: log.action as AuditLogEntry["action"],
          resource: log.resource_type as AuditLogEntry["resource"],
          resourceId: String(log.resource_id),
          userId: String(log.user_id),
          userEmail: String(log.user_email),
          timestamp: String(log.timestamp),
          ipAddress: typeof log.ip_address === "string" ? log.ip_address : undefined,
          userAgent: typeof log.user_agent === "string" ? log.user_agent : undefined,
          metadata: (log.details as Record<string, unknown> | undefined) ?? undefined,
          changes:
            (log.details as { changes?: AuditLogEntry["changes"] } | undefined)?.changes ?? undefined,
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
    setError(null);

    try {
      const params = buildExportParams(filter, format);
      const response = await fetch(`/api/admin/audit-logs/export?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: format === "csv" ? "text/csv,application/json" : "application/json,text/csv",
        },
      });

      if (!response.ok) {
        let message = `Unable to export audit logs (${response.status})`;
        try {
          const errorBody = (await response.json()) as ExportResponseBody;
          if (errorBody.error) {
            message = errorBody.error;
          }
        } catch {
          // no-op
        }

        throw new Error(message);
      }

      const fallbackFilename = `audit-logs-${new Date().toISOString()}.${format}`;
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      const contentDisposition = response.headers.get("content-disposition");
      const filename = getFilenameFromHeader(contentDisposition, fallbackFilename);

      if (contentType.includes("application/json")) {
        const body = (await response.json()) as ExportResponseBody;

        if (body.downloadUrl) {
          triggerUrlDownload(body.downloadUrl, body.filename ?? filename);
          return body.downloadUrl;
        }

        if (typeof body.data !== "undefined") {
          const jsonBlob = new Blob([JSON.stringify(body.data, null, 2)], {
            type: "application/json;charset=utf-8",
          });
          triggerBlobDownload(jsonBlob, body.filename ?? filename);
          return null;
        }

        const message = body.error || "Export response did not contain downloadable data";
        throw new Error(message);
      }

      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export logs";
      setExportError(message);
      setError(message);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

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
