import { useCallback, useState } from "react";

import { apiClient } from "../../../api/client/unified-api-client";
import type { AuditFilter, AuditLogEntry } from "../types";

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (filter?: AuditFilter, cursor?: string) => {
    setIsLoading(true);
    try {
      const queryParams: any = {
        userId: filter?.userId,
        action: filter?.action,
        resourceType: filter?.resource,
        startDate: filter?.startDate,
        endDate: filter?.endDate,
        offset: cursor ? Number(cursor) : 0,
        limit: 50,
      };

      const response = await apiClient.get<any>("/api/admin/audit-logs", queryParams);

      if (response.success && response.data) {
        const logs: AuditLogEntry[] = response.data.logs.map((log: any) => ({
          id: log.id,
          action: log.action,
          resource: log.resource_type,
          resourceId: log.resource_id,
          userId: log.user_id,
          userEmail: log.user_email,
          timestamp: log.timestamp,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          metadata: log.details,
          changes: log.details?.changes,
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

  const exportLogs = useCallback(async (_filter?: AuditFilter, _format: "csv" | "json" = "csv") => {
    try {
      // TODO: Implement actual export
      // const response = await api.post('/audit/export', { filter, format });
      // return response.downloadUrl;
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export logs");
      return null;
    }
  }, []);

  return {
    entries,
    isLoading,
    error,
    hasMore,
    fetchLogs,
    exportLogs,
  };
}
