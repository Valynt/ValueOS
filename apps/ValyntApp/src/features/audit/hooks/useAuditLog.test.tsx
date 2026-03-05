// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuditLog } from "./useAuditLog";

vi.mock("../../../api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("useAuditLog exportLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn();
    window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("downloads CSV exports returned as blobs", async () => {
    const anchor = document.createElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("id,action\n1,create", {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition": 'attachment; filename="audit.csv"',
        },
      })
    );

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs({ userId: "user-1" }, "csv");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/audit-logs/export?format=csv&userId=user-1",
      expect.any(Object)
    );
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(result.current.exportError).toBeNull();
  });

  it("downloads JSON exports using backend download URL response", async () => {
    const anchor = document.createElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ downloadUrl: "https://example.com/audit.json", filename: "audit.json" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })
    );

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs(undefined, "json");
    });

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    expect(result.current.exportError).toBeNull();
  });

  it("sets a user-friendly export error when API export fails", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "Export service unavailable" }), {
        status: 503,
        headers: {
          "content-type": "application/json",
        },
      })
    );

    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.exportLogs(undefined, "csv");
    });

    expect(result.current.exportError).toBe("Export service unavailable");
    expect(result.current.error).toBe("Export service unavailable");
    expect(result.current.isExporting).toBe(false);
  });
});
