// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../api/client/unified-api-client";

import { useAuditLog } from "./useAuditLog";

vi.mock("../../../api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
    fetchRaw: vi.fn(),
  },
}));

describe("useAuditLog exportLogs", () => {
  const clickSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);

    vi.mocked(apiClient.fetchRaw).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "text/csv",
        "content-disposition": 'attachment; filename="audit-export.csv"',
      }),
      blob: vi.fn().mockResolvedValue(new Blob(["id,action\n1,export"], { type: "text/csv" })),
    } as unknown as Response);

    // jsdom may not define blob URL helpers; define them before spying.
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }

    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads CSV exports as a blob", async () => {
    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs({ userId: "user-1" }, "csv");
    });

    expect(apiClient.fetchRaw).toHaveBeenCalledWith(
      "/api/admin/audit-logs/export?userId=user-1&format=csv",
      expect.objectContaining({ method: "GET" })
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
    expect(result.current.exportError).toBeNull();
  });

  it("downloads JSON exports from backend download URL", async () => {
    vi.mocked(apiClient.fetchRaw).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn().mockResolvedValue({ downloadUrl: "https://files.example.com/audit.json" }),
    } as unknown as Response);

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs(undefined, "json");
    });

    expect(apiClient.fetchRaw).toHaveBeenCalledWith(
      "/api/admin/audit-logs/export?format=json",
      expect.objectContaining({ method: "GET" })
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.exportError).toBeNull();
  });

  it("sets a friendly export error when API export fails", async () => {
    vi.mocked(apiClient.fetchRaw).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    } as unknown as Response);

    const { result } = renderHook(() => useAuditLog());

    let caughtError: unknown = null;
    await act(async () => {
      try {
        await result.current.exportLogs(undefined, "csv");
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      "Unable to export audit logs right now. Please try again in a moment or contact support if the issue persists."
    );

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
            status: "failed",
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
    expect(result.current.entries[0]?.status).toBe("failed");
  });
});
