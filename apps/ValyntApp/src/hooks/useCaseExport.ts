/**
 * useCaseExport
 *
 * Triggers a PPTX export for a value case and downloads the result.
 * Uses the UnifiedApiClient so the raw-fetch ESLint rule is satisfied.
 */

import { useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";

export type ExportFormat = "pptx";

export interface UseCaseExportResult {
  exporting: boolean;
  error: string | null;
  exportCase: (caseId: string, format?: ExportFormat) => Promise<void>;
}

export function useCaseExport(): UseCaseExportResult {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCase = async (caseId: string, format: ExportFormat = "pptx") => {
    setExporting(true);
    setError(null);

    try {
      // apiClient.post returns the raw Response when responseType is "blob"
      const response = await apiClient.postRaw(`/api/v1/cases/${caseId}/export/${format}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `value-case-${caseId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return { exporting, error, exportCase };
}
