// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../api/client/unified-api-client";

import { useAuditLog } from "./useAuditLog";

vi.mock("../../../api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("useAuditLog exportLogs", () => {
  const clickSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-type": "text/csv",
          "content-disposition": 'attachment; filename="audit-export.csv"',
        }),
        blob: vi.fn().mockResolvedValue(new Blob(["id,action\n1,export"], { type: "text/csv" })),
      })
    );

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads CSV exports as a blob", async () => {
    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs({ userId: "user-1" }, "csv");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/audit-logs/export?userId=user-1&format=csv",
      expect.objectContaining({ method: "GET" })
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportError).toBeNull();
  });

  it("downloads JSON exports from backend download URL", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn().mockResolvedValue({ downloadUrl: "https://files.example.com/audit.json" }),
    } as Response);

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs(undefined, "json");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/audit-logs/export?format=json",
      expect.objectContaining({ method: "GET" })
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.exportError).toBeNull();
  });

  it("sets a friendly export error when API export fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    } as Response);

    const { result } = renderHook(() => useAuditLog());

    await expect(
      act(async () => {
        await result.current.exportLogs(undefined, "csv");
      })
    ).rejects.toThrow("Unable to export audit logs right now. Please try again in a moment or contact support if the issue persists.");

    await waitFor(() => {
      expect(result.current.exportError).toBe(
        "Unable to export audit logs right now. Please try again in a moment or contact support if the issue persists."
      );
    });
    expect(result.current.isExporting).toBe(false);
  });

  it("fetches audit logs and maps API response", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: {
        logs: [
          {
            id: "log-1",
            action: "export",
            resource_type: "document",
            resource_id: "doc-1",
            user_id: "user-1",
            user_email: "test@example.com",
            timestamp: "2025-01-01T00:00:00Z",
            details: {},
          },
        ],
      },
    });

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.fetchLogs({ userId: "user-1" });
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/admin/audit-logs", expect.objectContaining({ userId: "user-1" }));
    expect(result.current.entries).toHaveLength(1);
  });
});
