/**
 * useCaseExport
 *
 * Mutations for exporting a value case as PDF or PPTX.
 * On success, opens the signed URL in a new tab.
 */

import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportResult {
  signedUrl: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
}

interface ExportResponse {
  success: boolean;
  data: ExportResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Trigger a PPTX export for a value case.
 * On success, opens the signed download URL in a new tab.
 */
export function usePptxExport(caseId: string | undefined) {
  return useMutation<ExportResult, Error, { title?: string; ownerName?: string }>({
    mutationFn: async (body) => {
      if (!caseId) throw new Error("Case ID required");
      const res = await apiClient.post<ExportResponse>(
        `/api/v1/cases/${caseId}/export/pptx`,
        body,
      );
      if (!res.success || !res.data?.data) {
        throw new Error(res.error?.message ?? res.data?.error ?? "PPTX export failed");
      }
      return res.data.data;
    },
    onSuccess: (result) => {
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    },
  });
}

/**
 * Trigger a PDF export for a value case.
 * On success, opens the signed download URL in a new tab.
 */
export function usePdfExport(caseId: string | undefined) {
  return useMutation<ExportResult, Error, { renderUrl: string; title?: string }>({
    mutationFn: async (body) => {
      if (!caseId) throw new Error("Case ID required");
      const res = await apiClient.post<ExportResponse>(
        `/api/v1/cases/${caseId}/export/pdf`,
        body,
      );
      if (!res.success || !res.data?.data) {
        throw new Error(res.error?.message ?? res.data?.error ?? "PDF export failed");
      }
      return res.data.data;
    },
    onSuccess: (result) => {
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    },
  });
}
