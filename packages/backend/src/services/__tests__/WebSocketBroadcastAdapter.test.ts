import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";

// Mock settings before importing the adapter so REDIS_URL is undefined.
vi.mock("../../config/settings.js", () => ({
  settings: { REDIS_URL: undefined },
}));

import { WebSocketBroadcastAdapter } from "../WebSocketBroadcastAdapter";

function makeFakeClient(tenantId: string, open = true): WebSocket & { tenantId: string; sent: string[] } {
  const sent: string[] = [];
  return {
    tenantId,
    readyState: open ? WebSocket.OPEN : WebSocket.CLOSED,
    sent,
    send: vi.fn((msg: string) => sent.push(msg)),
  } as unknown as WebSocket & { tenantId: string; sent: string[] };
}

function makeFakeWss(clients: WebSocket[]): WebSocketServer {
  return { clients: new Set(clients) } as unknown as WebSocketServer;
}

describe("WebSocketBroadcastAdapter", () => {
  describe("local-only mode (no Redis)", () => {
    let adapter: WebSocketBroadcastAdapter;
    let clientA: ReturnType<typeof makeFakeClient>;
    let clientB: ReturnType<typeof makeFakeClient>;
    let closedClient: ReturnType<typeof makeFakeClient>;

    beforeEach(() => {
      clientA = makeFakeClient("tenant-a");
      clientB = makeFakeClient("tenant-b");
      closedClient = makeFakeClient("tenant-a", false);
      const wss = makeFakeWss([clientA, clientB, closedClient]);
      adapter = new WebSocketBroadcastAdapter(wss);
      // Don't call init() — simulates no REDIS_URL
    });

    it("delivers to matching tenant clients only", () => {
      adapter.broadcast("tenant-a", '{"type":"test"}');

      expect(clientA.sent).toEqual(['{"type":"test"}']);
      expect(clientB.sent).toHaveLength(0);
    });

    it("skips closed connections", () => {
      adapter.broadcast("tenant-a", '{"type":"test"}');

      expect(closedClient.send).not.toHaveBeenCalled();
    });

    it("reports Redis as not connected", () => {
      expect(adapter.isRedisConnected()).toBe(false);
    });
  });

  describe("init without REDIS_URL", () => {
    it("stays in local-only mode when REDIS_URL is not set", async () => {
      const wss = makeFakeWss([]);
      const adapter = new WebSocketBroadcastAdapter(wss);

      // settings.REDIS_URL is undefined in test env
      await adapter.init();

      expect(adapter.isRedisConnected()).toBe(false);
    });
  });

  describe("shutdown", () => {
    it("is safe to call even when not initialised", async () => {
      const wss = makeFakeWss([]);
      const adapter = new WebSocketBroadcastAdapter(wss);

      await expect(adapter.shutdown()).resolves.not.toThrow();
    });
  });
});
