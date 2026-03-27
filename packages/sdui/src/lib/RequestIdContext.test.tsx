/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestIdRow } from "./RequestIdContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderRow(requestId: string | null) {
  return render(<RequestIdRow requestId={requestId} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RequestIdRow", () => {
  describe("rendering", () => {
    it("renders nothing when requestId is null", () => {
      const { container } = renderRow(null);
      expect(container.firstChild).toBeNull();
    });

    it("renders the request ID when provided", () => {
      renderRow("req_abc_123");
      expect(screen.getByText("req_abc_123")).toBeInTheDocument();
    });

    it("renders the support note", () => {
      renderRow("req_abc_123");
      expect(
        screen.getByText(/include this id when contacting support/i),
      ).toBeInTheDocument();
    });

    it("renders a Copy button", () => {
      renderRow("req_abc_123");
      expect(screen.getByRole("button", { name: /copy request id/i })).toBeInTheDocument();
    });
  });

  describe("clipboard — success path", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("calls navigator.clipboard.writeText with the request ID", async () => {
      renderRow("req_abc_123");
      fireEvent.click(screen.getByRole("button", { name: /copy request id/i }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("req_abc_123");
    });

    it("shows 'Copied!' after a successful write", async () => {
      renderRow("req_abc_123");
      fireEvent.click(screen.getByRole("button", { name: /copy request id/i }));
      // Flush the resolved clipboard promise.
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button")).toHaveTextContent("Copied!");
    });

    it("resets button label back to 'Copy' after 2 seconds", async () => {
      renderRow("req_abc_123");
      fireEvent.click(screen.getByRole("button", { name: /copy request id/i }));
      // Flush the resolved clipboard promise so setCopyState("copied") fires.
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button")).toHaveTextContent("Copied!");

      // Advance past the 2-second reset timer.
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.getByRole("button")).toHaveTextContent("Copy");
    });
  });

  describe("clipboard — failure path", () => {
    let promptSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers();
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new DOMException("Permission denied")) },
        writable: true,
        configurable: true,
      });
      promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("falls back to window.prompt with the request ID on clipboard rejection", async () => {
      renderRow("req_abc_123");
      fireEvent.click(screen.getByRole("button", { name: /copy request id/i }));
      // Flush the rejected clipboard promise.
      await act(async () => { await Promise.resolve(); });
      expect(promptSpy).toHaveBeenCalledWith(expect.any(String), "req_abc_123");
    });

    it("shows 'Copy failed' on the button after rejection", async () => {
      renderRow("req_abc_123");
      fireEvent.click(screen.getByRole("button", { name: /copy request id/i }));
      // Flush the rejected clipboard promise.
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button")).toHaveTextContent("Copy failed");
    });
  });

  describe("clipboard — unavailable (no navigator.clipboard)", () => {
    let promptSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("falls back to window.prompt immediately when clipboard API is unavailable", () => {
      renderRow("req_abc_123");
      fireEvent.click(screen.getByRole("button", { name: /copy request id/i }));
      expect(promptSpy).toHaveBeenCalledWith(expect.any(String), "req_abc_123");
    });
  });
});
