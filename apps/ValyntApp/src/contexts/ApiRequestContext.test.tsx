/** @vitest-environment jsdom */
import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRequestId } from "@valueos/sdui";

import {
  ApiRequestProvider,
  notifyApiRequest,
  registerApiRequestSetter,
  useApiRequestContext,
} from "./ApiRequestContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <ApiRequestProvider>{children}</ApiRequestProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ApiRequestContext", () => {
  describe("notifyApiRequest before provider mounts", () => {
    it("is a no-op and does not throw", () => {
      // Clear any registered setter from a previous test.
      registerApiRequestSetter(null as unknown as (id: string, failed: boolean) => void);
      expect(() => notifyApiRequest("req_test_123", false)).not.toThrow();
      expect(() => notifyApiRequest("req_test_456", true)).not.toThrow();
    });
  });

  describe("ApiRequestProvider", () => {
    it("provides null initial state", () => {
      const { result } = renderHook(() => useApiRequestContext(), { wrapper });
      expect(result.current.lastRequestId).toBeNull();
      expect(result.current.lastFailedRequestId).toBeNull();
    });

    it("updates lastRequestId on a successful notify", () => {
      const { result } = renderHook(() => useApiRequestContext(), { wrapper });

      act(() => {
        notifyApiRequest("req_success_001", false);
      });

      expect(result.current.lastRequestId).toBe("req_success_001");
      expect(result.current.lastFailedRequestId).toBeNull();
    });

    it("updates both lastRequestId and lastFailedRequestId on a failed notify", () => {
      const { result } = renderHook(() => useApiRequestContext(), { wrapper });

      act(() => {
        notifyApiRequest("req_fail_001", true);
      });

      expect(result.current.lastRequestId).toBe("req_fail_001");
      expect(result.current.lastFailedRequestId).toBe("req_fail_001");
    });

    it("does not overwrite lastFailedRequestId on a subsequent success", () => {
      const { result } = renderHook(() => useApiRequestContext(), { wrapper });

      act(() => {
        notifyApiRequest("req_fail_001", true);
      });
      act(() => {
        notifyApiRequest("req_success_002", false);
      });

      expect(result.current.lastRequestId).toBe("req_success_002");
      // lastFailedRequestId should still point to the last failure.
      expect(result.current.lastFailedRequestId).toBe("req_fail_001");
    });

    it("updates lastFailedRequestId when a new failure occurs", () => {
      const { result } = renderHook(() => useApiRequestContext(), { wrapper });

      act(() => {
        notifyApiRequest("req_fail_001", true);
      });
      act(() => {
        notifyApiRequest("req_fail_002", true);
      });

      expect(result.current.lastFailedRequestId).toBe("req_fail_002");
    });
  });

  describe("provider cleanup", () => {
    it("clears the registered setter on unmount so stale updates are dropped", () => {
      const { result, unmount } = renderHook(() => useApiRequestContext(), { wrapper });

      act(() => {
        notifyApiRequest("req_before_unmount", false);
      });
      expect(result.current.lastRequestId).toBe("req_before_unmount");

      unmount();

      // After unmount, notifyApiRequest should not throw and should be a no-op.
      expect(() => notifyApiRequest("req_after_unmount", false)).not.toThrow();
    });
  });

  describe("RequestIdContext bridge", () => {
    it("exposes lastFailedRequestId to RequestIdContext consumers via the SDUI package context", () => {
      // Render a hook that reads from RequestIdContext (the SDUI-package context)
      // directly, verifying that ApiRequestProvider populates the bridge provider.
      const { result } = renderHook(() => useRequestId(), { wrapper });

      act(() => {
        notifyApiRequest("req_bridge_001", true);
      });

      expect(result.current.lastFailedRequestId).toBe("req_bridge_001");
    });

    it("does not expose lastFailedRequestId to RequestIdContext on a successful request", () => {
      const { result } = renderHook(() => useRequestId(), { wrapper });

      act(() => {
        notifyApiRequest("req_bridge_success", false);
      });

      expect(result.current.lastFailedRequestId).toBeNull();
    });
  });
});
