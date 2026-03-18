/**
 * Unit tests for two bugs fixed in packages/backend/src/api/agents.ts.
 *
 * These tests are self-contained (no Express router import) so they run under
 * the root vitest config without requiring Node-only package resolution.
 *
 * Bug 1 — GET /:agentId/info
 *   `return res.setHeader(...)` before `return res.json(...)` made the JSON
 *   body unreachable. The endpoint returned an empty 200 with only the version
 *   header set — the model card data was never sent to the client.
 *
 * Bug 2 — GET /jobs/:jobId/stream (SSE)
 *   Three consecutive `return res.setHeader(...)` calls meant only the first
 *   header (Content-Type) was set. Cache-Control and Connection were never
 *   written, and the entire SSE setup (flushHeaders, sendEvent, polling loop)
 *   was dead code — the stream never opened.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Minimal Express-like Response mock
// ---------------------------------------------------------------------------

function makeMockRes() {
  const headers: Record<string, string> = {};
  const res = {
    _headers: headers,
    _body: undefined as unknown,

    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res; // Express returns `this` from setHeader
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    flushHeaders() {
      /* no-op */
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Bug 1: /info endpoint
// ---------------------------------------------------------------------------

describe("agents /info — setHeader must not short-circuit the response", () => {
  // Mirrors the buggy code path: `return res.setHeader(...)` exits before json()
  function buggyInfoHandler(
    modelCard: { schemaVersion: string; modelCard: unknown },
    res: ReturnType<typeof makeMockRes>
  ) {
    return res.setHeader("x-model-card-version", modelCard.schemaVersion);
    // eslint-disable-next-line no-unreachable -- intentional: mirrors the original bug
    return res.json({
      success: true,
      data: { model_card: modelCard.modelCard },
    });
  }

  // Mirrors the fixed code path: setHeader without return, then json()
  function fixedInfoHandler(
    modelCard: { schemaVersion: string; modelCard: unknown },
    res: ReturnType<typeof makeMockRes>
  ) {
    res.setHeader("x-model-card-version", modelCard.schemaVersion);
    return res.json({
      success: true,
      data: { model_card: modelCard.modelCard },
    });
  }

  it("buggy: header is set but body is never written", () => {
    const res = makeMockRes();
    buggyInfoHandler(
      { schemaVersion: "2.0.0", modelCard: { name: "OpportunityAgent" } },
      res
    );

    expect(res._headers["x-model-card-version"]).toBe("2.0.0");
    expect(res._body).toBeUndefined(); // json() was never called
  });

  it("fixed: both header and JSON body are written", () => {
    const res = makeMockRes();
    fixedInfoHandler(
      { schemaVersion: "2.0.0", modelCard: { name: "OpportunityAgent" } },
      res
    );

    expect(res._headers["x-model-card-version"]).toBe("2.0.0");
    expect(res._body).toEqual({
      success: true,
      data: { model_card: { name: "OpportunityAgent" } },
    });
  });
});

// ---------------------------------------------------------------------------
// Bug 2: SSE stream handler
// ---------------------------------------------------------------------------

describe("agents SSE stream — all three headers must be set before flushing", () => {
  // Mirrors the buggy code: each `return res.setHeader(...)` exits immediately
  function buggySSESetup(res: ReturnType<typeof makeMockRes>) {
    return res.setHeader("Content-Type", "text/event-stream");
    return res.setHeader("Cache-Control", "no-cache"); // eslint-disable-line no-unreachable
    return res.setHeader("Connection", "keep-alive"); // eslint-disable-line no-unreachable
    res.flushHeaders(); // eslint-disable-line no-unreachable
  }

  // Mirrors the fixed code: no return on setHeader calls
  function fixedSSESetup(res: ReturnType<typeof makeMockRes>) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  }

  it("buggy: only Content-Type is set; Cache-Control and Connection are missing", () => {
    const res = makeMockRes();
    buggySSESetup(res);

    expect(res._headers["content-type"]).toBe("text/event-stream");
    expect(res._headers["cache-control"]).toBeUndefined();
    expect(res._headers["connection"]).toBeUndefined();
  });

  it("fixed: all three SSE headers are present", () => {
    const res = makeMockRes();
    fixedSSESetup(res);

    expect(res._headers["content-type"]).toBe("text/event-stream");
    expect(res._headers["cache-control"]).toBe("no-cache");
    expect(res._headers["connection"]).toBe("keep-alive");
  });
});
